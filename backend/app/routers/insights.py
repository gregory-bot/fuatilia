"""Metrics, simulated impact, model info, settings and reference data."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..adapters.mpesa import payout_gateway
from ..adapters.sms import sms_gateway
from ..config import RISK_HIGH_FROM, RISK_MEDIUM_FROM, USSD_CODE
from ..database import get_db
from ..models import STATUSES
from ..schemas import Settings
from ..services import geography, metrics
from ..services.risk_model import risk_model
from ..services.settings import runtime

router = APIRouter(tags=["insights"])


@router.get("/metrics")
def get_metrics(db: Session = Depends(get_db)) -> dict:
    return metrics.metrics(db)


@router.get("/impact")
def get_impact(db: Session = Depends(get_db)) -> dict:
    return metrics.impact(db)


@router.get("/model")
def model_info() -> dict:
    return risk_model.info()


@router.get("/meta")
def meta() -> dict:
    return {
        "statuses": STATUSES,
        "counties": [{"name": c.name, "treatment_facility": c.treatment_facility,
                      "screening_sites": list(c.screening_sites), "villages": list(c.villages),
                      "typical_distance_km": c.distance_mean_km} for c in geography.COUNTIES],
        "ussd_code": USSD_CODE,
        "risk_bands": {"medium_from": RISK_MEDIUM_FROM, "high_from": RISK_HIGH_FROM},
        "integrations": {"sms": sms_gateway.mode, "mpesa": payout_gateway.mode},
        "settings": runtime,
        "synthetic_data_only": True,
    }


@router.get("/facilities")
def facilities(q: str = "", county: str | None = None) -> list[dict]:
    return geography.facilities(q, county)


@router.get("/settings", response_model=Settings)
def get_settings() -> dict:
    return runtime


@router.put("/settings", response_model=Settings)
def put_settings(body: Settings) -> dict:
    runtime.update(body.model_dump())
    return runtime
