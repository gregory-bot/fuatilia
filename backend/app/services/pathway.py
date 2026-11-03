"""Patient pathway: registration, status transitions, CHP assignment and vouchers.

Screened Positive -> Navigating -> Checked In -> Treated -> Rescreen Due
                 \\-------------> Lost to Follow-up (from any active status)
"""
from __future__ import annotations

import json
from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..adapters.mpesa import payout_gateway
from ..models import (ACTIVE_STATUSES, CHECKED_IN, CHP, LOST, NAVIGATING, SCREENED_POSITIVE,
                      TREATED, Event, Patient, Voucher)
from . import geography, messaging
from .risk_model import risk_model
from .settings import runtime


class PathwayError(ValueError):
    """Raised for an invalid status transition (mapped to HTTP 409)."""


def add_event(db: Session, p: Patient, kind: str, title: str, detail: str = "",
              at: datetime | None = None) -> Event:
    ev = Event(patient=p, kind=kind, title=title, detail=detail, created_at=at or datetime.now())
    db.add(ev)
    return ev


def appointment_for(screened_on: date, band: str) -> date:
    """High-risk women get an earlier slot so there is time to follow up if they miss it."""
    return screened_on + timedelta(days={"high": 10, "medium": 14, "low": 21}[band])


def pick_chp(candidates: list[CHP], village: str, load: dict[int, int]) -> CHP | None:
    """Prefer the CHP whose area covers her village; otherwise the least-loaded one in the county."""
    if not candidates:
        return None
    local = [c for c in candidates if village and village.lower() in c.area.lower()]
    return min(local or candidates, key=lambda c: (load.get(c.id, 0), c.id))


def assign_chp(db: Session, p: Patient, at: datetime | None = None) -> CHP | None:
    if p.chp_id:
        return p.chp
    rows = db.execute(select(CHP, func.count(Patient.id))
                      .outerjoin(Patient, (Patient.chp_id == CHP.id) & Patient.status.in_(ACTIVE_STATUSES))
                      .where(CHP.county == p.county).group_by(CHP.id)).all()
    chp = pick_chp([c for c, _ in rows], p.village, {c.id: n for c, n in rows})
    if chp:
        p.chp = chp
        add_event(db, p, "chp", f"Assigned to CHP {chp.name}",
                  f"High dropout risk. {chp.name} covers {chp.area} and will visit.", at)
    return chp


def next_code(db: Session) -> str:
    n = (db.scalar(select(func.max(Patient.id))) or 0) + 1
    while db.scalar(select(Patient.id).where(Patient.code == f"FT-{n:04d}")):
        n += 1
    return f"FT-{n:04d}"


def register(db: Session, data: dict, code: str | None = None) -> Patient:
    """Create a screen-positive patient, score risk, assign support and send the first SMS."""
    c = geography.county(data["county"])
    result = risk_model.score(data)
    screened_on = data.get("screened_on") or date.today()
    p = Patient(
        code=code or next_code(db),
        name=data["name"], age=data["age"], county=c.name, village=data.get("village") or c.villages[0],
        phone=data["phone"], phone_type=data["phone_type"], language=data.get("language", "sw"),
        distance_km=data["distance_km"], missed_visits=data["missed_visits"],
        hiv_status=data["hiv_status"], screening_method=data["screening_method"],
        screening_facility=data.get("screening_facility") or c.screening_sites[0],
        treatment_facility=c.treatment_facility, screened_on=screened_on,
        risk_score=result.score, risk_band=result.band, risk_factors_json=json.dumps(result.factors),
        status=SCREENED_POSITIVE,
    )
    p.appointment_on = appointment_for(screened_on, result.band)
    db.add(p)
    db.flush()

    add_event(db, p, "screened", f"Screened positive ({p.screening_method})",
              f"At {p.screening_facility}. Referred to {p.treatment_facility}.")
    reasons = "; ".join(f["en"] for f in result.factors)
    add_event(db, p, "risk", f"Dropout risk {result.score}/100 ({result.band})", reasons)
    if result.band == "high":
        assign_chp(db, p)
    body = messaging.render("intro", p)
    messaging.send_now(db, p, "intro", body)
    add_event(db, p, "sms", f"First SMS sent ({'Kiswahili' if p.language == 'sw' else 'English'})", body)
    messaging.schedule_reminders(db, p)
    db.commit()
    db.refresh(p)
    return p


def _require(p: Patient, allowed: list[str], action: str) -> None:
    if p.status not in allowed:
        raise PathwayError(f"Cannot {action} a patient whose status is '{p.status}'.")


def start_navigating(db: Session, p: Patient, reason: str) -> None:
    if p.status == SCREENED_POSITIVE:
        p.status = NAVIGATING
        add_event(db, p, "status", "Now navigating", reason)


def confirm_appointment(db: Session, p: Patient, via: str = "USSD") -> None:
    _require(p, ACTIVE_STATUSES, "confirm an appointment for")
    add_event(db, p, "ussd", f"Appointment confirmed via {via}",
              f"For {p.appointment_on:%d %b %Y} at {p.treatment_facility}.")
    start_navigating(db, p, f"Patient confirmed by {via}.")
    messaging.send_now(db, p, "confirmed", messaging.render("confirmed", p))
    db.commit()


def reschedule(db: Session, p: Patient, new_date: date, via: str = "USSD") -> None:
    _require(p, ACTIVE_STATUSES, "reschedule")
    old = p.appointment_on
    p.appointment_on = new_date
    add_event(db, p, "ussd", f"Rescheduled via {via}",
              f"From {old:%d %b} to {new_date:%d %b %Y}." if old else f"To {new_date:%d %b %Y}.")
    start_navigating(db, p, f"Patient engaged by {via}.")
    messaging.send_now(db, p, "rescheduled", messaging.render("rescheduled", p))
    messaging.schedule_reminders(db, p)
    db.commit()


def request_callback(db: Session, p: Patient) -> CHP | None:
    chp = assign_chp(db, p)
    add_event(db, p, "ussd", "Asked for a call from her health promoter",
              f"{chp.name} notified." if chp else "No CHP in this county yet; clinic notified.")
    db.commit()
    return chp


def chp_visit(db: Session, p: Patient, note: str = "") -> None:
    _require(p, ACTIVE_STATUSES, "log a CHP visit for")
    p.chp_visited_at = datetime.now()
    who = p.chp.name if p.chp else "CHP"
    add_event(db, p, "chp_visit", f"Home visit by {who}", note or "Explained the visit, planned transport.")
    start_navigating(db, p, "CHP home visit.")
    db.commit()


def check_in(db: Session, p: Patient, amount_kes: int | None = None) -> Voucher:
    """Clinician marks arrival -> M-Pesa transport voucher is released immediately."""
    _require(p, [SCREENED_POSITIVE, NAVIGATING], "check in")
    p.status = CHECKED_IN
    p.checked_in_on = date.today()
    messaging.cancel_scheduled(p)
    add_event(db, p, "checked_in", f"Checked in at {p.treatment_facility}",
              f"{(date.today() - p.screened_on).days} days after positive screen.")
    voucher = release_voucher(db, p, amount_kes or runtime["voucher_amount_kes"])
    db.commit()
    db.refresh(voucher)
    return voucher


def release_voucher(db: Session, p: Patient, amount: int, at: datetime | None = None,
                    notify: bool = True) -> Voucher:
    payout = payout_gateway.pay(p.phone, amount, f"Transport support {p.code}")
    v = Voucher(patient=p, amount_kes=amount, transaction_id=payout.transaction_id,
                status=payout.status, mode=payout.mode, created_at=at or datetime.now())
    db.add(v)
    add_event(db, p, "voucher", f"M-Pesa transport voucher: KES {amount:,}",
              f"Transaction {payout.transaction_id} ({payout.mode}).", at)
    if notify:
        body = messaging.render("voucher", p, on=(at or datetime.now()).date(),
                                txn=payout.transaction_id, amount=f"{amount:,}")
        messaging.send_now(db, p, "voucher", body, at)
    return v


def treat(db: Session, p: Patient) -> None:
    _require(p, [CHECKED_IN], "mark treated")
    p.status = TREATED
    p.treated_on = date.today()
    rescreen = date.today() + timedelta(days=365)
    p.appointment_on = rescreen
    add_event(db, p, "treated", "Treatment completed",
              f"{(p.treated_on - p.screened_on).days} days from positive screen. Rescreen due {rescreen:%b %Y}.")
    messaging.send_now(db, p, "treated", messaging.render("treated", p, on=rescreen))
    db.commit()


def mark_lost(db: Session, p: Patient, reason: str = "") -> None:
    _require(p, ACTIVE_STATUSES, "mark lost")
    p.status = LOST
    messaging.cancel_scheduled(p)
    add_event(db, p, "lost", "Lost to follow-up", reason or "Unreachable after reminders and CHP tracing.")
    db.commit()

