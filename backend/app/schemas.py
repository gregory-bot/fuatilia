"""Pydantic request/response models."""
from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RiskInput(BaseModel):
    age: int = Field(ge=18, le=90)
    county: str
    distance_km: float = Field(ge=0, le=500)
    phone_type: Literal["smartphone", "feature"]
    missed_visits: int = Field(ge=0, le=20)
    hiv_status: Literal["positive", "negative", "unknown"]
    screening_method: Literal["VIA", "HPV"]


class PatientCreate(RiskInput):
    name: str = Field(min_length=2, max_length=100)
    phone: str = Field(pattern=r"^\+?[0-9 ]{9,15}$")
    village: str | None = None
    language: Literal["sw", "en"] = "sw"
    screening_facility: str | None = None


class RiskFactor(BaseModel):
    feature: str
    direction: str
    weight: float
    en: str
    sw: str


class RiskOut(BaseModel):
    score: int
    band: str
    factors: list[RiskFactor]


class CHPOut(ORM):
    id: int
    name: str
    county: str
    area: str
    phone: str


class EventOut(ORM):
    id: int
    kind: str
    title: str
    detail: str
    created_at: datetime


class MessageOut(ORM):
    id: int
    channel: str
    language: str
    purpose: str
    body: str
    status: str
    provider_ref: str | None
    send_at: datetime


class VoucherOut(ORM):
    id: int
    amount_kes: int
    transaction_id: str
    status: str
    mode: str
    created_at: datetime


class PatientSummary(ORM):
    id: int
    code: str
    name: str
    age: int
    county: str
    village: str
    phone_type: str
    distance_km: float
    status: str
    risk_score: int
    risk_band: str
    screened_on: date
    appointment_on: date | None
    chp: CHPOut | None


class PatientDetail(PatientSummary):
    phone: str
    language: str
    missed_visits: int
    hiv_status: str
    screening_method: str
    screening_facility: str
    treatment_facility: str
    risk_factors: list[RiskFactor]
    chp_visited_at: datetime | None
    checked_in_on: date | None
    treated_on: date | None
    events: list[EventOut]
    messages: list[MessageOut]
    vouchers: list[VoucherOut]


class PatientPage(BaseModel):
    total: int
    items: list[PatientSummary]


class CheckIn(BaseModel):
    amount_kes: int | None = Field(default=None, ge=0, le=20000)


class Note(BaseModel):
    note: str = Field(default="", max_length=300)


class Settings(BaseModel):
    voucher_amount_kes: int = Field(ge=0, le=20000)


class PathologyOut(ORM):
    id: int
    case_code: str
    patient_id: int | None
    patient_name: str | None = None
    patient_code: str | None = None
    image_url: str | None = None
    original_filename: str
    urgency_score: int
    urgency_band: str
    ai_note: str
    status: str
    reviewer_note: str | None
    created_at: datetime
    reviewed_at: datetime | None


class Review(BaseModel):
    decision: Literal["confirmed", "rejected"]
    note: str = Field(default="", max_length=300)
