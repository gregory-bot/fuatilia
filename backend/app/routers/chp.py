"""Community health promoter worklists."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import ACTIVE_STATUSES, CHP, Patient
from ..schemas import Note, PatientDetail, PatientSummary
from ..services import pathway
from .patients import get_patient

router = APIRouter(prefix="/chp", tags=["chp"])


@router.get("")
def list_chps(db: Session = Depends(get_db)) -> list[dict]:
    rows = db.execute(
        select(CHP, func.count(Patient.id))
        .outerjoin(Patient, (Patient.chp_id == CHP.id) & Patient.status.in_(ACTIVE_STATUSES))
        .group_by(CHP.id).order_by(CHP.county, CHP.name)
    ).all()
    return [{"id": c.id, "name": c.name, "county": c.county, "area": c.area, "active_patients": n} for c, n in rows]


@router.get("/worklist")
def worklist(chp_id: int | None = None, db: Session = Depends(get_db)) -> list[dict]:
    """Active high-risk patients with a CHP; not-yet-visited first, then soonest appointment."""
    stmt = (select(Patient).options(selectinload(Patient.chp))
            .where(Patient.status.in_(ACTIVE_STATUSES), Patient.risk_band == "high", Patient.chp_id.is_not(None)))
    if chp_id:
        stmt = stmt.where(Patient.chp_id == chp_id)
    rows = db.scalars(stmt).all()
    rows.sort(key=lambda p: (p.chp_visited_at is not None, p.appointment_on or p.screened_on, -p.risk_score))
    return [{**PatientSummary.model_validate(p).model_dump(mode="json"),
             "village": p.village, "phone": p.phone, "visited_at": p.chp_visited_at,
             "top_reason": (p.risk_factors[0] if p.risk_factors else None)} for p in rows]


@router.post("/visits/{patient_id}", response_model=PatientDetail)
def log_visit(patient_id: int, body: Note | None = None, db: Session = Depends(get_db)):
    p = get_patient(db, patient_id)
    try:
        pathway.chp_visit(db, p, body.note if body else "")
    except pathway.PathwayError as exc:
        raise HTTPException(409, str(exc)) from exc
    db.expire_all()
    return get_patient(db, patient_id)
