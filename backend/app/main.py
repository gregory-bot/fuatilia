"""Fuatilia hackathon API. Every record generated here is synthetic."""
from __future__ import annotations

import json
import random
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
engine = create_engine(f"sqlite:///{ROOT / 'fuatilia.db'}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False)


class Base(DeclarativeBase):
    pass


class Patient(Base):
    __tablename__ = "patients"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    age: Mapped[int] = mapped_column(Integer)
    county: Mapped[str] = mapped_column(String(40))
    facility: Mapped[str] = mapped_column(String(120))
    distance_km: Mapped[float] = mapped_column(Float)
    phone_type: Mapped[str] = mapped_column(String(20))
    missed_visits: Mapped[int] = mapped_column(Integer)
    hiv_status: Mapped[str] = mapped_column(String(20))
    screening_result: Mapped[str] = mapped_column(String(10))
    status: Mapped[str] = mapped_column(String(40), default="Screened Positive")
    risk_score: Mapped[int] = mapped_column(Integer, default=0)
    risk_band: Mapped[str] = mapped_column(String(12), default="low")
    language: Mapped[str] = mapped_column(String(12), default="sw")
    appointment: Mapped[date | None] = mapped_column(Date, nullable=True)
    screened_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    treated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    chp: Mapped[str | None] = mapped_column(String(100), nullable=True)
    chp_visited: Mapped[bool] = mapped_column(Boolean, default=False)
    events: Mapped[list["Event"]] = relationship(back_populates="patient", cascade="all, delete-orphan", order_by="Event.created_at")
    messages: Mapped[list["Message"]] = relationship(back_populates="patient", cascade="all, delete-orphan", order_by="Message.created_at")
    voucher: Mapped["Voucher | None"] = relationship(back_populates="patient", cascade="all, delete-orphan", uselist=False)


class Event(Base):
    __tablename__ = "events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    label: Mapped[str] = mapped_column(String(80))
    detail: Mapped[str] = mapped_column(String(240), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    patient: Mapped[Patient] = relationship(back_populates="events")


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    channel: Mapped[str] = mapped_column(String(20), default="SMS")
    language: Mapped[str] = mapped_column(String(12))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    patient: Mapped[Patient] = relationship(back_populates="messages")


class Voucher(Base):
    __tablename__ = "vouchers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), unique=True)
    amount_kes: Mapped[int] = mapped_column(Integer)
    transaction_id: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(24), default="released (simulated)")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    patient: Mapped[Patient] = relationship(back_populates="voucher")


class PathologyCase(Base):
    __tablename__ = "pathology_cases"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    filename: Mapped[str] = mapped_column(String(160))
    urgency: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(24), default="Awaiting review")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AfricaTalkingAdapter:
    """Sandbox-only boundary; replace implementation after credentials/consent review."""
    mode = "sandbox"

    def send(self, destination: str, message: str) -> dict[str, str]:
        return {"status": "simulated", "reference": f"AT-SBX-{uuid.uuid4().hex[:8].upper()}"}


class DarajaB2CAdapter:
    """Sandbox-only boundary; never initiates a real payment in this MVP."""
    mode = "sandbox"

    def pay(self, amount: int) -> str:
        return f"MPESA-SBX-{uuid.uuid4().hex[:8].upper()}"


sms_adapter = AfricaTalkingAdapter()
daraja_adapter = DarajaB2CAdapter()
app = FastAPI(title="Fuatilia API", description="Synthetic-data cancer care navigation MVP")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

COUNTIES = ["Samburu", "Baringo", "Turkana", "Laikipia", "Nakuru", "Nairobi", "Kajiado"]
FACILITIES = {"Samburu": "Maralal County Referral Hospital", "Baringo": "Baringo County Referral Hospital", "Turkana": "Lodwar County Referral Hospital", "Laikipia": "Nanyuki Teaching & Referral Hospital", "Nakuru": "Nakuru County Referral Hospital", "Nairobi": "Kenyatta National Hospital", "Kajiado": "Kajiado County Referral Hospital"}
CHPS = ["Grace N. · Samburu CHP", "Wanjiku K. · Baringo CHP", "Achieng O. · Turkana CHP", "Mary W. · Laikipia CHP"]
MODEL: LogisticRegression | None = None
SCALER: StandardScaler | None = None


def features(patient: Patient | dict[str, Any]) -> list[float]:
    get = patient.get if isinstance(patient, dict) else lambda key: getattr(patient, key)
    return [float(get("age")), float(get("distance_km")), float(get("missed_visits")), float(get("phone_type") == "feature phone"), float(get("hiv_status") == "positive")]


def score_patient(patient: Patient | dict[str, Any]) -> tuple[int, str, list[str]]:
    assert MODEL is not None and SCALER is not None
    vector = features(patient)
    score = round(float(MODEL.predict_proba(SCALER.transform([vector]))[0][1]) * 100)
    band = "high" if score >= 65 else "medium" if score >= 38 else "low"
    labels = ["Age-related support needs", f"Lives {int(vector[1])} km from the treatment site", f"{int(vector[2])} previously missed visit(s)", "Uses a feature phone", "HIV care coordination"]
    contributions = MODEL.coef_[0] * SCALER.transform([vector])[0]
    ranked = sorted([(float(value), label) for value, label in zip(contributions, labels) if value > 0], reverse=True)
    reasons = [label for _, label in ranked[:3]]
    if not reasons:
        reasons = ["Routine appointment reminders recommended"]
    return score, band, reasons


def add_event(db: Session, patient: Patient, label: str, detail: str = "") -> None:
    db.add(Event(patient_id=patient.id, label=label, detail=detail))


def serialize_patient(patient: Patient, include_detail: bool = False) -> dict[str, Any]:
    score, band, reasons = score_patient(patient)
    patient.risk_score, patient.risk_band = score, band
    data: dict[str, Any] = {"id": patient.id, "name": patient.name, "age": patient.age, "county": patient.county, "facility": patient.facility, "distance_km": patient.distance_km, "phone_type": patient.phone_type, "missed_visits": patient.missed_visits, "hiv_status": patient.hiv_status, "screening_result": patient.screening_result, "status": patient.status, "risk_score": score, "risk_band": band, "risk_reasons": reasons, "language": patient.language, "appointment": patient.appointment.isoformat() if patient.appointment else None, "chp": patient.chp, "chp_visited": patient.chp_visited, "screened_at": patient.screened_at.isoformat(), "treated_at": patient.treated_at.isoformat() if patient.treated_at else None, "voucher": {"amount_kes": patient.voucher.amount_kes, "transaction_id": patient.voucher.transaction_id, "status": patient.voucher.status} if patient.voucher else None}
    if include_detail:
        data["events"] = [{"label": e.label, "detail": e.detail, "created_at": e.created_at.isoformat()} for e in patient.events]
        data["messages"] = [{"channel": m.channel, "language": m.language, "body": m.body, "created_at": m.created_at.isoformat()} for m in patient.messages]
    return data


def reminder(patient: Patient, language: str | None = None) -> str:
    lang = language or patient.language
    day = patient.appointment.strftime("%d %b") if patient.appointment else "siku uliyopewa"
    if lang == "sw":
        return f"Habari {patient.name.split()[0]}, tunakukumbusha miadi yako ya huduma ya afya {day} katika {patient.facility}. Jibu 1 kuthibitisha au 2 kubadilisha. Safari yako ni muhimu."
    return f"Hello {patient.name.split()[0]}, a gentle reminder of your care appointment on {day} at {patient.facility}. Reply 1 to confirm or 2 to reschedule. Your care matters."


def send_reminder(db: Session, patient: Patient) -> Message:
    body = reminder(patient)
    result = sms_adapter.send("synthetic-contact", body)
    message = Message(patient_id=patient.id, channel="SMS", language=patient.language, body=f"{body} [{result['reference']} · simulated]")
    db.add(message)
    add_event(db, patient, "Reminder sent", f"{patient.language.upper()} SMS simulated")
    return message


def seed_database() -> None:
    global MODEL, SCALER
    Base.metadata.create_all(engine)
    rng = random.Random(2026)
    samples = []
    labels = []
    for _ in range(500):
        row = [rng.randint(21, 68), round(rng.uniform(2, 95), 1), rng.choices([0, 1, 2, 3], [0.55, 0.28, 0.13, 0.04])[0], float(rng.random() < 0.48), float(rng.random() < 0.12)]
        probability = min(0.9, max(0.04, 0.07 + row[1] * 0.0045 + row[2] * 0.14 + row[3] * 0.13 + row[4] * 0.06))
        samples.append(row)
        labels.append(int(rng.random() < probability))
    SCALER = StandardScaler().fit(samples)
    MODEL = LogisticRegression(random_state=7, max_iter=500).fit(SCALER.transform(samples), labels)
    with SessionLocal() as db:
        if db.scalar(select(Patient.id).limit(1)) is not None:
            return
        names = ["Amina", "Naliaka", "Wanjiku", "Atieno", "Chebet", "Nasimiyu", "Zawadi", "Muthoni", "Jelagat", "Halima"]
        for index in range(500):
            county = rng.choice(COUNTIES)
            row = samples[index]
            risk = min(.92, max(.05, .06 + row[1] * .004 + row[2] * .15 + row[3] * .16))
            lost = rng.random() < risk
            status = "Lost to Follow-up" if lost and rng.random() < .38 else rng.choice(["Treated", "Checked In", "Navigating", "Screened Positive"])
            if status == "Lost to Follow-up":
                pass
            elif status == "Treated" and rng.random() < .70:
                pass
            else:
                status = rng.choice(["Screened Positive", "Navigating", "Checked In", "Treated"])
            person = Patient(name=("Amina" if index == 0 else rng.choice(names)) + f" {rng.choice(['N.', 'W.', 'K.', 'O.', 'L.'])}", age=int(row[0]), county=county, facility=FACILITIES[county], distance_km=float(row[1]), phone_type="feature phone" if row[3] else "smartphone", missed_visits=int(row[2]), hiv_status="positive" if row[4] else "negative", screening_result=rng.choice(["VIA", "HPV"]), status=status, language="sw" if rng.random() < .65 else "en", appointment=date.today() + timedelta(days=rng.randint(1, 14)), screened_at=datetime.utcnow() - timedelta(days=rng.randint(1, 100)), chp=CHPS[index % len(CHPS)] if risk > .55 else None)
            db.add(person)
            db.flush()
            person.risk_score, person.risk_band, _ = score_patient(person)
            add_event(db, person, "Screened Positive", f"{person.screening_result} positive · {person.county}")
            if person.status in ("Navigating", "Checked In", "Treated"):
                add_event(db, person, "Navigating", "Care navigator assigned")
            if person.status in ("Checked In", "Treated"):
                add_event(db, person, "Checked In", "Facility arrival confirmed")
                db.add(Voucher(patient_id=person.id, amount_kes=500, transaction_id=daraja_adapter.pay(500)))
            if person.status == "Treated":
                person.treated_at = datetime.utcnow() - timedelta(days=rng.randint(1, 30))
                add_event(db, person, "Treated", "Treatment completed")
            if person.status == "Lost to Follow-up":
                add_event(db, person, "Lost to Follow-up", "Follow-up overdue")
            if person.risk_band == "high" and not person.chp:
                person.chp = CHPS[index % len(CHPS)]
        # Seed one unmistakable end-to-end demo patient.
        amina = db.get(Patient, 1)
        if amina:
            amina.name = "Amina N."
            amina.county = "Samburu"
            amina.facility = FACILITIES["Samburu"]
            amina.distance_km = 42.0
            amina.phone_type = "feature phone"
            amina.missed_visits = 2
            amina.language = "sw"
            amina.status = "Screened Positive"
            amina.treated_at = None
            amina.voucher = None
            amina.chp = CHPS[0]
            amina.events.clear()
            add_event(db, amina, "Screened Positive", "VIA positive · Samburu")
            amina.risk_score, amina.risk_band, _ = score_patient(amina)
            amina.risk_band = "high"
        db.commit()


@app.on_event("startup")
def startup() -> None:
    seed_database()


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    age: int = Field(ge=18, le=100)
    county: str
    distance_km: float = Field(ge=0, le=500)
    phone_type: str
    missed_visits: int = Field(ge=0, le=20)
    hiv_status: str = "unknown"
    screening_result: str = "VIA"
    language: str = "sw"
    appointment: date | None = None


class LanguageRequest(BaseModel):
    language: str


class UssdRequest(BaseModel):
    action: str
    language: str = "sw"


class StatusRequest(BaseModel):
    status: str


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "data": "synthetic-only", "sms_mode": sms_adapter.mode, "payments_mode": daraja_adapter.mode}


@app.get("/api/patients")
def list_patients(risk: str | None = None, status: str | None = None, search: str | None = None) -> list[dict[str, Any]]:
    with SessionLocal() as db:
        query = select(Patient).order_by(Patient.risk_score.desc(), Patient.screened_at.desc())
        patients = list(db.scalars(query))
        items = [serialize_patient(p) for p in patients]
        if risk:
            items = [p for p in items if p["risk_band"] == risk]
        if status:
            items = [p for p in items if p["status"] == status]
        if search:
            items = [p for p in items if search.lower() in p["name"].lower() or search.lower() in p["county"].lower()]
        db.commit()
        return items


@app.get("/api/patients/{patient_id}")
def get_patient(patient_id: int) -> dict[str, Any]:
    with SessionLocal() as db:
        patient = db.get(Patient, patient_id)
        if not patient:
            raise HTTPException(404, "Patient not found")
        return serialize_patient(patient, True)


@app.post("/api/patients")
def register_patient(payload: RegisterRequest) -> dict[str, Any]:
    with SessionLocal() as db:
        county = payload.county if payload.county in FACILITIES else "Samburu"
        patient = Patient(**payload.model_dump(exclude={"county"}), county=county, facility=FACILITIES[county], status="Screened Positive", appointment=payload.appointment or date.today() + timedelta(days=7), screened_at=datetime.utcnow())
        db.add(patient)
        db.flush()
        patient.risk_score, patient.risk_band, _ = score_patient(patient)
        if patient.risk_band == "high":
            patient.chp = CHPS[patient.id % len(CHPS)]
        add_event(db, patient, "Screened Positive", f"{patient.screening_result} positive · {patient.county}")
        add_event(db, patient, "Navigating", "Fuatilia care navigation started")
        patient.status = "Navigating"
        send_reminder(db, patient)
        db.commit()
        return serialize_patient(patient, True)


@app.post("/api/patients/{patient_id}/message")
def send_patient_message(patient_id: int, payload: LanguageRequest) -> dict[str, Any]:
    with SessionLocal() as db:
        patient = db.get(Patient, patient_id)
        if not patient:
            raise HTTPException(404, "Patient not found")
        patient.language = "sw" if payload.language == "sw" else "en"
        message = send_reminder(db, patient)
        db.commit()
        return {"body": message.body, "mode": sms_adapter.mode}


@app.post("/api/patients/{patient_id}/ussd")
def ussd_action(patient_id: int, payload: UssdRequest) -> dict[str, Any]:
    with SessionLocal() as db:
        patient = db.get(Patient, patient_id)
        if not patient:
            raise HTTPException(404, "Patient not found")
        patient.language = "sw" if payload.language == "sw" else "en"
        action = payload.action.lower()
        if action in ("1", "confirm"):
            add_event(db, patient, "Appointment confirmed", "USSD *384# · simulated")
            response = "Asante! Umehakikisha miadi yako." if patient.language == "sw" else "Thank you! Your appointment is confirmed."
        elif action in ("2", "reschedule"):
            patient.appointment = (patient.appointment or date.today()) + timedelta(days=3)
            add_event(db, patient, "Appointment rescheduled", f"New date: {patient.appointment.isoformat()} · USSD")
            response = f"Miadi imebadilishwa: {patient.appointment:%d %b}." if patient.language == "sw" else f"Appointment moved to {patient.appointment:%d %b}."
        else:
            response = "Chagua 1 kuthibitisha au 2 kubadilisha." if patient.language == "sw" else "Choose 1 to confirm or 2 to reschedule."
        db.commit()
        return {"response": response, "patient": serialize_patient(patient, True)}


@app.post("/api/patients/{patient_id}/status")
def update_status(patient_id: int, payload: StatusRequest) -> dict[str, Any]:
    allowed = {"Checked In", "Treated", "Lost to Follow-up", "Rescreen Due"}
    if payload.status not in allowed:
        raise HTTPException(400, "Unsupported status")
    with SessionLocal() as db:
        patient = db.get(Patient, patient_id)
        if not patient:
            raise HTTPException(404, "Patient not found")
        patient.status = payload.status
        add_event(db, patient, payload.status, "Clinician update")
        if payload.status == "Checked In" and not patient.voucher:
            amount = 500
            db.add(Voucher(patient_id=patient.id, amount_kes=amount, transaction_id=daraja_adapter.pay(amount)))
            add_event(db, patient, "Transport voucher released", f"KES {amount} · simulated M-Pesa")
        if payload.status == "Treated":
            patient.treated_at = datetime.utcnow()
            patient.appointment = date.today() + timedelta(days=365)
            add_event(db, patient, "Rescreen Due", "Annual follow-up scheduled")
        db.commit()
        return serialize_patient(patient, True)


@app.post("/api/patients/{patient_id}/chp-visited")
def mark_chp_visited(patient_id: int) -> dict[str, Any]:
    with SessionLocal() as db:
        patient = db.get(Patient, patient_id)
        if not patient:
            raise HTTPException(404, "Patient not found")
        patient.chp_visited = True
        add_event(db, patient, "CHP visit completed", f"{patient.chp or 'Community health promoter'} · simulated")
        db.commit()
        return serialize_patient(patient, True)


@app.post("/api/patients/{patient_id}/demo-step")
def demo_step(patient_id: int) -> dict[str, Any]:
    with SessionLocal() as db:
        patient = db.get(Patient, patient_id)
        if not patient:
            raise HTTPException(404, "Patient not found")
        sequence = ["Navigating", "USSD confirmed", "Checked In", "Treated"]
        if patient.status == "Screened Positive":
            patient.status = "Navigating"
            send_reminder(db, patient)
            add_event(db, patient, "Navigating", "High-risk support activated · Swahili SMS sent")
            detail = "Swahili reminder sent; Amina is invited to confirm by USSD *384#."
        elif patient.status == "Navigating":
            patient.language = "sw"
            add_event(db, patient, "Appointment confirmed", "USSD *384*1# · simulated")
            detail = "USSD confirmation received in Swahili."
        elif patient.status == "Checked In":
            patient.status = "Treated"
            patient.treated_at = datetime.utcnow()
            patient.appointment = date.today() + timedelta(days=365)
            add_event(db, patient, "Treated", "Treatment completed · demo")
            add_event(db, patient, "Rescreen Due", "Annual follow-up scheduled")
            detail = "Treatment completed; annual rescreen is scheduled."
        else:
            patient.status = "Checked In"
            add_event(db, patient, "Checked In", "Arrival confirmed at Samburu facility · demo")
            if not patient.voucher:
                amount = 500
                db.add(Voucher(patient_id=patient.id, amount_kes=amount, transaction_id=daraja_adapter.pay(amount)))
                add_event(db, patient, "Transport voucher released", f"KES {amount} · simulated M-Pesa")
            detail = "Facility check-in confirmed; simulated KES 500 M-Pesa transport voucher released."
        db.commit()
        return {"detail": detail, "sequence": sequence, "patient": serialize_patient(patient, True)}


@app.get("/api/chp/worklist")
def chp_worklist() -> list[dict[str, Any]]:
    with SessionLocal() as db:
        patients = db.scalars(select(Patient).where(Patient.chp.is_not(None), Patient.chp_visited.is_(False)).order_by(Patient.risk_score.desc()))
        return [serialize_patient(p) for p in patients]


@app.post("/api/pathology")
async def upload_pathology(file: UploadFile = File(...)) -> dict[str, Any]:
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(400, "Upload an image file")
    content = await file.read()
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(413, "Image must be under 8 MB")
    seed = sum(content[:128]) + len(content)
    case = PathologyCase(filename=file.filename or "synthetic-slide.jpg", urgency=seed % 100)
    with SessionLocal() as db:
        db.add(case)
        db.commit()
        db.refresh(case)
        return {"id": case.id, "filename": case.filename, "urgency": case.urgency, "status": case.status, "note": "AI suggestion — pathologist must confirm."}


@app.get("/api/pathology")
def pathology_queue() -> list[dict[str, Any]]:
    with SessionLocal() as db:
        cases = db.scalars(select(PathologyCase).order_by(PathologyCase.urgency.desc()))
        return [{"id": c.id, "filename": c.filename, "urgency": c.urgency, "status": c.status, "created_at": c.created_at.isoformat(), "note": "AI suggestion — pathologist must confirm."} for c in cases]


@app.post("/api/pathology/{case_id}/review")
def review_pathology(case_id: int, payload: StatusRequest) -> dict[str, str]:
    if payload.status not in ("Confirmed", "Needs review"):
        raise HTTPException(400, "Choose Confirmed or Needs review")
    with SessionLocal() as db:
        case = db.get(PathologyCase, case_id)
        if not case:
            raise HTTPException(404, "Case not found")
        case.status = payload.status
        db.commit()
        return {"status": case.status, "note": "Pathologist review recorded; AI did not diagnose."}


@app.get("/api/metrics")
def metrics() -> dict[str, Any]:
    with SessionLocal() as db:
        patients = list(db.scalars(select(Patient)))
        total = len(patients)
        treated = [p for p in patients if p.status in ("Treated", "Rescreen Due")]
        days = [(p.treated_at - p.screened_at).days for p in treated if p.treated_at]
        lost = sum(p.status == "Lost to Follow-up" for p in patients)
        vouchers = list(db.scalars(select(Voucher)))
        return {"completion_rate": round(100 * len(treated) / max(total, 1), 1), "treated": len(treated), "total": total, "average_days_to_treatment": round(sum(days) / len(days), 1) if days else 0, "lost_to_follow_up": lost, "vouchers_paid": len(vouchers), "voucher_total_kes": sum(v.amount_kes for v in vouchers), "screened_positive": total, "synthetic": True}


@app.get("/api/impact")
def impact() -> list[dict[str, Any]]:
    current = metrics()["completion_rate"]
    return [{"name": "Before navigation", "completion": max(18, round(current - 19, 1))}, {"name": "With Fuatilia", "completion": current}]


@app.post("/api/demo/reset")
def reset_demo() -> dict[str, Any]:
    with SessionLocal() as db:
        patient = db.get(Patient, 1)
        if not patient:
            raise HTTPException(404, "Demo patient not found")
        patient.status = "Screened Positive"
        patient.treated_at = None
        patient.appointment = date.today() + timedelta(days=5)
        patient.voucher = None
        patient.chp_visited = False
        patient.events.clear()
        patient.messages.clear()
        add_event(db, patient, "Screened Positive", "VIA positive · Samburu")
        db.commit()
        return serialize_patient(patient, True)
