"""Demo mode: reset Amina so her journey can be replayed live in front of judges."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Patient
from ..schemas import PatientDetail
from ..services import synthetic
from .patients import get_patient

router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("/amina/reset", response_model=PatientDetail)
def reset_amina(db: Session = Depends(get_db)):
    p = synthetic.reset_amina(db)
    return get_patient(db, p.id)


@router.get("/amina", response_model=PatientDetail)
def amina(db: Session = Depends(get_db)):
    p = db.query(Patient).filter(Patient.code == synthetic.AMINA_CODE).first() or synthetic.reset_amina(db)
    return get_patient(db, p.id)
