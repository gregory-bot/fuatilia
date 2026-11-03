"""Database tables. All rows are synthetic: no real patient data is ever stored."""
from __future__ import annotations

import json
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

# Pathway statuses, in order. "Lost to Follow-up" can happen from any active status.
SCREENED_POSITIVE = "Screened Positive"
NAVIGATING = "Navigating"
CHECKED_IN = "Checked In"
TREATED = "Treated"
RESCREEN_DUE = "Rescreen Due"
LOST = "Lost to Follow-up"
STATUSES = [SCREENED_POSITIVE, NAVIGATING, CHECKED_IN, TREATED, RESCREEN_DUE, LOST]
ACTIVE_STATUSES = [SCREENED_POSITIVE, NAVIGATING, CHECKED_IN]
COMPLETED_STATUSES = [TREATED, RESCREEN_DUE]


def now() -> datetime:
    return datetime.now()


class CHP(Base):
    """Community health promoter."""

    __tablename__ = "chps"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    county: Mapped[str] = mapped_column(String(40), index=True)
    area: Mapped[str] = mapped_column(String(80))
    phone: Mapped[str] = mapped_column(String(20))
    patients: Mapped[list["Patient"]] = relationship(back_populates="chp")


class Patient(Base):
    __tablename__ = "patients"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    age: Mapped[int] = mapped_column(Integer)
    county: Mapped[str] = mapped_column(String(40), index=True)
    village: Mapped[str] = mapped_column(String(80))
    phone: Mapped[str] = mapped_column(String(20), index=True)
    phone_type: Mapped[str] = mapped_column(String(20))  # smartphone | feature
    language: Mapped[str] = mapped_column(String(4), default="sw")  # sw | en
    distance_km: Mapped[float] = mapped_column(Float)
    missed_visits: Mapped[int] = mapped_column(Integer, default=0)
    hiv_status: Mapped[str] = mapped_column(String(12))  # positive | negative | unknown
    screening_method: Mapped[str] = mapped_column(String(8))  # VIA | HPV
    screening_facility: Mapped[str] = mapped_column(String(120))
    treatment_facility: Mapped[str] = mapped_column(String(120))
    screened_on: Mapped[date] = mapped_column(Date, index=True)
    appointment_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(24), default=SCREENED_POSITIVE, index=True)
    risk_score: Mapped[int] = mapped_column(Integer, default=0)
    risk_band: Mapped[str] = mapped_column(String(8), default="low", index=True)
    risk_factors_json: Mapped[str] = mapped_column(Text, default="[]")
    chp_id: Mapped[int | None] = mapped_column(ForeignKey("chps.id"), nullable=True)
    chp_visited_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    checked_in_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    treated_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Ground-truth label for SYNTHETIC training rows only (True = completed treatment).
    outcome_completed: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

    chp: Mapped[CHP | None] = relationship(back_populates="patients")
    events: Mapped[list["Event"]] = relationship(
        back_populates="patient", cascade="all, delete-orphan", order_by="Event.created_at"
    )
    messages: Mapped[list["Message"]] = relationship(
        back_populates="patient", cascade="all, delete-orphan", order_by="Message.send_at"
    )
    vouchers: Mapped[list["Voucher"]] = relationship(
        back_populates="patient", cascade="all, delete-orphan"
    )

    @property
    def risk_factors(self) -> list[dict]:
        return json.loads(self.risk_factors_json or "[]")

    @property
    def first_name(self) -> str:
        return self.name.split(" ")[0]


class Event(Base):
    """One entry on a patient's pathway timeline."""

    __tablename__ = "events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    kind: Mapped[str] = mapped_column(String(24))
    title: Mapped[str] = mapped_column(String(120))
    detail: Mapped[str] = mapped_column(String(300), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    patient: Mapped[Patient] = relationship(back_populates="events")


class Message(Base):
    """Every outbound SMS (sent or scheduled) is logged here."""

    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    channel: Mapped[str] = mapped_column(String(12), default="SMS")
    language: Mapped[str] = mapped_column(String(4))
    purpose: Mapped[str] = mapped_column(String(24))
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16))  # sent | scheduled | failed
    provider_ref: Mapped[str | None] = mapped_column(String(64), nullable=True)
    send_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    patient: Mapped[Patient] = relationship(back_populates="messages")


class Voucher(Base):
    """Simulated M-Pesa transport voucher."""

    __tablename__ = "vouchers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    amount_kes: Mapped[int] = mapped_column(Integer)
    transaction_id: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(16), default="paid")
    mode: Mapped[str] = mapped_column(String(12), default="simulated")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    patient: Mapped[Patient] = relationship(back_populates="vouchers")


class PathologyCase(Base):
    """Slide image in the triage queue. Urgency is a MOCK AI suggestion."""

    __tablename__ = "pathology_cases"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    case_code: Mapped[str] = mapped_column(String(16), unique=True)
    patient_id: Mapped[int | None] = mapped_column(ForeignKey("patients.id"), nullable=True)
    image_path: Mapped[str | None] = mapped_column(String(200), nullable=True)
    original_filename: Mapped[str] = mapped_column(String(200))
    urgency_score: Mapped[int] = mapped_column(Integer)
    urgency_band: Mapped[str] = mapped_column(String(12))  # urgent | priority | routine
    ai_note: Mapped[str] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(12), default="pending")  # pending | confirmed | rejected
    reviewer_note: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    patient: Mapped[Patient | None] = relationship()
