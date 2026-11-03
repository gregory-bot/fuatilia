"""Patients: list/filter, register, profile and pathway actions."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Patient
from ..schemas import CheckIn, Note, PatientCreate, PatientDetail, PatientPage, RiskInput, RiskOut, VoucherOut
from ..services import geography, messaging, pathway
from ..services.risk_model import risk_model

router = APIRouter(tags=["patients"])


def get_patient(db: Session, patient_id: int) -> Patient:
    p = db.get(Patient, patient_id, options=[selectinload(Patient.events), selectinload(Patient.messages),
                                             selectinload(Patient.vouchers), selectinload(Patient.chp)])
    if not p:
        raise HTTPException(404, "Patient not found")
    return p


@router.post("/risk/score", response_model=RiskOut)
def score_risk(body: RiskInput) -> RiskOut:
    """Instant risk preview while the clinician fills in the form (nothing is saved)."""
    try:
        geography.county(body.county)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    r = risk_model.score(body.model_dump())
    return RiskOut(score=r.score, band=r.band, factors=r.factors)


@router.get("/patients", response_model=PatientPage)
def list_patients(db: Session = Depends(get_db), risk: str | None = None, status: str | None = None,
                  county: str | None = None, q: str | None = None,
                  limit: int = Query(25, le=200), offset: int = 0,
                  sort: str = Query("recent", pattern="^(recent|risk)$")) -> PatientPage:
    stmt = select(Patient)
    if risk:
        stmt = stmt.where(Patient.risk_band == risk)
    if status:
        stmt = stmt.where(Patient.status == status)
    if county:
        stmt = stmt.where(Patient.county == county)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Patient.name.ilike(like), Patient.code.ilike(like), Patient.village.ilike(like)))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    order = [Patient.risk_score.desc()] if sort == "risk" else [Patient.screened_on.desc(), Patient.id.desc()]
    items = db.scalars(stmt.options(selectinload(Patient.chp)).order_by(*order).limit(limit).offset(offset)).all()
    return PatientPage(total=total, items=items)


@router.post("/patients", response_model=PatientDetail, status_code=201)
def create_patient(body: PatientCreate, db: Session = Depends(get_db)) -> Patient:
    try:
        p = pathway.register(db, body.model_dump())
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return get_patient(db, p.id)


@router.get("/patients/{patient_id}", response_model=PatientDetail)
def patient_detail(patient_id: int, db: Session = Depends(get_db)) -> Patient:
    return get_patient(db, patient_id)


def _run(db: Session, patient_id: int, action) -> Patient:
    p = get_patient(db, patient_id)
    try:
        action(p)
    except pathway.PathwayError as exc:
        raise HTTPException(409, str(exc)) from exc
    db.expire_all()
    return get_patient(db, patient_id)


@router.post("/patients/{patient_id}/check-in", response_model=PatientDetail)
def check_in(patient_id: int, body: CheckIn | None = None, db: Session = Depends(get_db)) -> Patient:
    """Clinician marks the patient as arrived; this releases the M-Pesa transport voucher."""
    return _run(db, patient_id, lambda p: pathway.check_in(db, p, body.amount_kes if body else None))


@router.post("/patients/{patient_id}/treat", response_model=PatientDetail)
def treat(patient_id: int, db: Session = Depends(get_db)) -> Patient:
    return _run(db, patient_id, lambda p: pathway.treat(db, p))


@router.post("/patients/{patient_id}/lost", response_model=PatientDetail)
def lost(patient_id: int, body: Note | None = None, db: Session = Depends(get_db)) -> Patient:
    return _run(db, patient_id, lambda p: pathway.mark_lost(db, p, body.note if body else ""))


@router.post("/patients/{patient_id}/remind", response_model=PatientDetail)
def remind(patient_id: int, db: Session = Depends(get_db)) -> Patient:
    """Send the band-appropriate reminder SMS right now."""
    def send(p: Patient) -> None:
        purpose = f"reminder_{p.risk_band}"
        body = messaging.render(purpose, p)
        messaging.send_now(db, p, purpose, body)
        pathway.add_event(db, p, "sms", "Reminder SMS sent", body)
        db.commit()
    return _run(db, patient_id, send)


@router.get("/patients/{patient_id}/vouchers", response_model=list[VoucherOut])
def vouchers(patient_id: int, db: Session = Depends(get_db)):
    return get_patient(db, patient_id).vouchers
