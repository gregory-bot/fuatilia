"""SMS templates (Kiswahili + English) and reminder scheduling.

Privacy by design: messages never mention cancer or results. Phones in rural Kenya are
often shared, so texts only talk about a "follow-up visit".
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta

from sqlalchemy.orm import Session

from ..adapters.sms import sms_gateway
from ..config import USSD_CODE
from ..models import Message, Patient

SW_MONTHS = ["Januari", "Februari", "Machi", "Aprili", "Mei", "Juni", "Julai",
             "Agosti", "Septemba", "Oktoba", "Novemba", "Desemba"]

# Days before the appointment that a reminder goes out, by risk band.
REMINDER_DAYS = {"high": [7, 3, 1], "medium": [3, 1], "low": [1]}


def fmt_date(d: date, lang: str) -> str:
    if lang == "sw":
        return f"{d.day} {SW_MONTHS[d.month - 1]}"
    return d.strftime("%-d %b")


def short_site(name: str) -> str:
    """'Samburu County Referral Hospital, Maralal' -> 'Maralal Hospital' style short names for SMS."""
    if "," in name:
        return f"{name.split(',')[-1].strip()} Hospital"
    return name.replace("County Referral Hospital", "Hospital").replace("Teaching & Referral Hospital", "Hospital")


def _chp_name(p: Patient) -> str:
    return p.chp.name.split(" ")[0] if p.chp else ("Mhudumu wako" if p.language == "sw" else "Your health promoter")


TEMPLATES = {
    "intro": {
        "en": "Hello {first}, {screen} here. Your screening needs a follow-up visit at {site} on {date}. Dial {ussd} to confirm. Free service.",
        "sw": "Habari {first}, ni {screen}. Uchunguzi wako unahitaji ziara ya ufuatiliaji {site} tarehe {date}. Piga {ussd} kuthibitisha. Bure.",
    },
    "reminder_low": {
        "en": "Reminder: {first}, your follow-up visit at {site} is on {date}. Dial {ussd} to confirm or change the date.",
        "sw": "Kumbusho: {first}, miadi yako {site} ni tarehe {date}. Piga {ussd} kuthibitisha au kubadilisha tarehe.",
    },
    "reminder_medium": {
        "en": "{first}, we are expecting you at {site} on {date}. This visit matters for your health. Dial {ussd} to confirm or reschedule.",
        "sw": "{first}, tunakutarajia {site} tarehe {date}. Ziara hii ni muhimu kwa afya yako. Piga {ussd} kuthibitisha au kubadilisha.",
    },
    "reminder_high": {
        "en": "{first}, your visit at {site} is on {date}. Fare is refunded by M-Pesa when you check in. {chp} will call you. Dial {ussd}.",
        "sw": "{first}, miadi yako {site} ni tarehe {date}. Utarudishiwa nauli kwa M-Pesa ukifika. {chp} atakupigia. Piga {ussd}.",
    },
    "confirmed": {
        "en": "Thank you {first}. Your visit on {date} at {site} is confirmed. We will remind you the day before.",
        "sw": "Asante {first}. Miadi yako ya tarehe {date} {site} imethibitishwa. Tutakukumbusha siku moja kabla.",
    },
    "rescheduled": {
        "en": "{first}, your visit has been moved to {date} at {site}. Dial {ussd} if you need help.",
        "sw": "{first}, miadi yako imehamishwa hadi tarehe {date} {site}. Piga {ussd} ukihitaji msaada.",
    },
    "voucher": {
        "en": "[SIMULATED M-PESA] {txn} Confirmed. You have received Ksh{amount}.00 from FUATILIA TRANSPORT on {date}. Karibu, {first}.",
        "sw": "[MFANO WA M-PESA] {txn} Imethibitishwa. Umepokea Ksh{amount}.00 kutoka FUATILIA USAFIRI tarehe {date}. Karibu, {first}.",
    },
    "treated": {
        "en": "Thank you {first}. Your treatment is complete. Your next check is due around {date}. We will remind you.",
        "sw": "Asante {first}. Matibabu yako yamekamilika. Kipimo chako kijacho ni karibu tarehe {date}. Tutakukumbusha.",
    },
}


def render(purpose: str, p: Patient, on: date | None = None, **extra) -> str:
    lang = p.language if p.language in ("sw", "en") else "sw"
    when = on or p.appointment_on or date.today()
    return TEMPLATES[purpose][lang].format(
        first=p.first_name,
        screen=short_site(p.screening_facility),
        site=short_site(p.treatment_facility),
        date=fmt_date(when, lang),
        ussd=USSD_CODE,
        chp=_chp_name(p),
        **extra,
    )


def send_now(db: Session, p: Patient, purpose: str, body: str, at: datetime | None = None) -> Message:
    """Send through the SMS adapter (simulated/sandbox) and log the message."""
    result = sms_gateway.send(p.phone, body)
    msg = Message(patient=p, language=p.language, purpose=purpose, body=body,
                  status=result.status, provider_ref=result.provider_ref, send_at=at or datetime.now())
    db.add(msg)
    return msg


def cancel_scheduled(p: Patient) -> None:
    """Drop reminders that have not gone out yet (rescheduled, arrived, or closed)."""
    for m in list(p.messages):
        if m.status == "scheduled":
            p.messages.remove(m)  # delete-orphan cascade removes the row


def schedule_reminders(db: Session, p: Patient) -> list[Message]:
    """Queue band-specific reminders before the appointment (skipping any already in the past)."""
    cancel_scheduled(p)
    if not p.appointment_on:
        return []
    out = []
    purpose = f"reminder_{p.risk_band}"
    for days in REMINDER_DAYS[p.risk_band]:
        send_day = p.appointment_on - timedelta(days=days)
        at = datetime.combine(send_day, time(8, 0))
        if send_day <= date.today():
            continue  # too late for this one; intro SMS already covers it
        out.append(Message(patient=p, language=p.language, purpose=purpose,
                           body=render(purpose, p), status="scheduled", send_at=at))
    db.add_all(out)
    return out
