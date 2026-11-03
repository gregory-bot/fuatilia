"""Pathology triage queue. Urgency is a MOCK AI suggestion that a pathologist must confirm."""
from __future__ import annotations

import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, selectinload

from ..config import UPLOAD_DIR
from ..database import get_db
from ..models import PathologyCase, Patient
from ..schemas import PathologyOut, Review
from ..services.pathology import DISCLAIMER, NOTES, band_for_urgency, mock_urgency

router = APIRouter(prefix="/pathology", tags=["pathology"])
MAX_BYTES = 10 * 1024 * 1024
ALLOWED = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def _out(c: PathologyCase) -> PathologyOut:
    out = PathologyOut.model_validate(c)
    out.image_url = f"/uploads/{c.image_path}" if c.image_path else None
    if c.patient:
        out.patient_name, out.patient_code = c.patient.name, c.patient.code
    return out


@router.get("", response_model=list[PathologyOut])
def queue(db: Session = Depends(get_db)):
    """Pending cases first (most urgent at the top), then reviewed cases, newest first."""
    pending_first = case((PathologyCase.status == "pending", 0), else_=1)
    rows = db.scalars(select(PathologyCase).options(selectinload(PathologyCase.patient))
                      .order_by(pending_first, PathologyCase.urgency_score.desc(),
                                PathologyCase.created_at.desc())).all()
    return [_out(c) for c in rows]


@router.post("", response_model=PathologyOut, status_code=201)
async def upload(file: UploadFile = File(...), patient_id: int | None = Form(None), db: Session = Depends(get_db)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED:
        raise HTTPException(415, "Please upload a JPG, PNG, WEBP or GIF image.")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Image is larger than 10 MB.")
    if patient_id is not None and not db.get(Patient, patient_id):
        raise HTTPException(404, "Patient not found")
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    stored = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / stored).write_bytes(data)

    score = mock_urgency(data)
    band = band_for_urgency(score)
    n = (db.scalar(select(func.max(PathologyCase.id))) or 0) + 1
    c = PathologyCase(case_code=f"PX-{n:04d}", patient_id=patient_id, image_path=stored,
                      original_filename=(file.filename or stored)[:200], urgency_score=score,
                      urgency_band=band, ai_note=NOTES[band])
    db.add(c)
    db.commit()
    db.refresh(c)
    return _out(c)


@router.post("/{case_id}/review", response_model=PathologyOut)
def review(case_id: int, body: Review, db: Session = Depends(get_db)):
    c = db.get(PathologyCase, case_id)
    if not c:
        raise HTTPException(404, "Case not found")
    c.status = body.decision
    c.reviewer_note = body.note or None
    c.reviewed_at = datetime.now()
    db.commit()
    db.refresh(c)
    return _out(c)


@router.get("/disclaimer")
def disclaimer() -> dict:
    return {"text": DISCLAIMER}
