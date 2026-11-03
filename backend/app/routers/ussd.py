"""USSD callback (Africa's Talking format). Returns text/plain 'CON ...' or 'END ...'."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Form
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from ..config import USSD_CODE
from ..database import get_db
from ..services import ussd

router = APIRouter(tags=["ussd"])


@router.post("/ussd", response_class=PlainTextResponse)
def ussd_callback(
    sessionId: str = Form(""),
    serviceCode: str = Form(USSD_CODE),
    phoneNumber: str = Form(...),
    text: str = Form(""),
    lang: str | None = Form(None),  # simulator-only: start the menu in this language
    db: Session = Depends(get_db),
) -> str:
    return ussd.handle(db, phoneNumber, text, lang if lang in ("sw", "en") else None)
