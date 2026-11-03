"""Programme metrics and the simulated before/after impact comparison."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import ACTIVE_STATUSES, COMPLETED_STATUSES, LOST, STATUSES, Message, Patient, Voucher
from .geography import COUNTIES


def metrics(db: Session) -> dict:
    by_status = dict(db.execute(select(Patient.status, func.count()).group_by(Patient.status)).all())
    by_band = dict(db.execute(select(Patient.risk_band, func.count()).group_by(Patient.risk_band)).all())
    completed = sum(by_status.get(s, 0) for s in COMPLETED_STATUSES)
    lost = by_status.get(LOST, 0)
    closed = completed + lost
    treated = db.execute(select(Patient.screened_on, Patient.treated_on)
                         .where(Patient.treated_on.is_not(None))).all()
    avg_days = round(sum((t - s).days for s, t in treated) / len(treated), 1) if treated else None
    vouchers = db.execute(select(func.count(Voucher.id), func.coalesce(func.sum(Voucher.amount_kes), 0))).one()
    return {
        # Completion rate: of women whose pathway has an outcome, the share who completed treatment.
        "completion_rate": round(100 * completed / closed, 1) if closed else 0.0,
        "completed": completed,
        "lost_to_follow_up": lost,
        "active": sum(by_status.get(s, 0) for s in ACTIVE_STATUSES),
        "total_patients": sum(by_status.values()),
        "avg_days_to_treatment": avg_days,
        "vouchers_paid": vouchers[0],
        "vouchers_kes": int(vouchers[1]),
        "sms_sent": db.scalar(select(func.count(Message.id)).where(Message.status == "sent")),
        "sms_scheduled": db.scalar(select(func.count(Message.id)).where(Message.status == "scheduled")),
        "by_status": {s: by_status.get(s, 0) for s in STATUSES},
        "by_risk": {b: by_band.get(b, 0) for b in ("low", "medium", "high")},
    }


# Assumed relative reductions in dropout, per intervention (illustrative, not trial results).
INTERVENTIONS = {
    "sms": {"label": "SMS/USSD reminders (everyone)", "rr": 0.85},
    "chp": {"label": "CHP home visit (high risk)", "rr": 0.70},
    "voucher": {"label": "M-Pesa transport voucher (> 30 km)", "rr": 0.75},
}


def impact(db: Session) -> dict:
    """Simulate completion with vs without Fuatilia on the labelled synthetic cohort.

    'Without' = the synthetic ground-truth outcome. 'With' = if an intervention cuts dropout
    probability by a relative risk rr, then a share (1 - rr) of the women who were lost
    would have completed instead. Interventions stack multiplicatively.
    """
    rows = db.execute(select(Patient.county, Patient.risk_band, Patient.distance_km, Patient.outcome_completed)
                      .where(Patient.outcome_completed.is_not(None))).all()
    groups: dict[str, dict] = {}

    for county, band, distance, completed in rows:
        rr = INTERVENTIONS["sms"]["rr"]
        if band == "high":
            rr *= INTERVENTIONS["chp"]["rr"]
        if distance > 30:
            rr *= INTERVENTIONS["voucher"]["rr"]
        without = 1.0 if completed else 0.0
        with_ = 1.0 if completed else 1 - rr
        for key in ("all", f"band:{band}", f"county:{county}"):
            g = groups.setdefault(key, {"n": 0, "without": 0.0, "with": 0.0})
            g["n"] += 1
            g["without"] += without
            g["with"] += with_

    def pct(g: dict, k: str) -> float:
        return round(100 * g[k] / g["n"], 1) if g["n"] else 0.0

    overall = groups.get("all", {"n": 0, "without": 0, "with": 0})
    return {
        "overall": {"without": pct(overall, "without"), "with": pct(overall, "with"), "n": overall["n"]},
        "by_risk": [{"band": b, "without": pct(groups[f"band:{b}"], "without"), "with": pct(groups[f"band:{b}"], "with"),
                     "n": groups[f"band:{b}"]["n"]} for b in ("low", "medium", "high") if f"band:{b}" in groups],
        "by_county": [{"county": c.name, "without": pct(groups[f"county:{c.name}"], "without"),
                       "with": pct(groups[f"county:{c.name}"], "with"), "n": groups[f"county:{c.name}"]["n"]}
                      for c in COUNTIES if f"county:{c.name}" in groups],
        "assumptions": [{"key": k, **v} for k, v in INTERVENTIONS.items()],
        "women_retained": round(overall["with"] - overall["without"]) if overall["n"] else 0,
        "note": "Simulated on synthetic data with assumed intervention effects. Not clinical evidence.",
    }
