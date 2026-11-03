"""USSD menu, written as an Africa's Talking-style callback.

Africa's Talking POSTs `sessionId, serviceCode, phoneNumber, text` on every keypress,
where `text` is all input so far joined by '*' (e.g. "2*1"). We reply with plain text
starting "CON " (keep session open) or "END " (close it). The simulator in the
frontend calls this exact endpoint, so swapping to a real AT sandbox channel is trivial.
"""
from __future__ import annotations

from datetime import timedelta

from sqlalchemy.orm import Session

from ..models import ACTIVE_STATUSES, Patient
from . import geography, messaging, pathway

T = {
    "welcome": {"en": "Fuatilia: Hello {first}", "sw": "Fuatilia: Habari {first}"},
    "menu": {
        "en": "1. Confirm visit ({date})\n2. Change date\n3. Find a treatment clinic\n4. Call me (health promoter)\n5. Kiswahili",
        "sw": "1. Thibitisha miadi ({date})\n2. Badilisha tarehe\n3. Tafuta kituo cha matibabu\n4. Nipigie (mhudumu wa afya)\n5. English",
    },
    "guest": {
        "en": "Welcome to Fuatilia\n1. Find a treatment clinic\n5. Kiswahili",
        "sw": "Karibu Fuatilia\n1. Tafuta kituo cha matibabu\n5. English",
    },
    "confirmed": {
        "en": "Thank you {first}. Your visit on {date} at {site} is confirmed. M-Pesa fare is sent when you check in.",
        "sw": "Asante {first}. Miadi yako ya {date} {site} imethibitishwa. Nauli ya M-Pesa itatumwa ukifika.",
    },
    "pick_date": {"en": "Choose a new date:", "sw": "Chagua tarehe mpya:"},
    "rescheduled": {
        "en": "Done. Your new date is {date} at {site}. We will send an SMS reminder.",
        "sw": "Sawa. Tarehe yako mpya ni {date} {site}. Tutakutumia kumbusho kwa SMS.",
    },
    "pick_county": {"en": "Choose your county:", "sw": "Chagua kaunti yako:"},
    "clinics": {"en": "Treatment: {treat}\nScreening: {screen}", "sw": "Matibabu: {treat}\nUchunguzi: {screen}"},
    "callback": {
        "en": "{chp} will call you within 24 hours. Asante.",
        "sw": "{chp} atakupigia simu ndani ya saa 24. Asante.",
    },
    "no_active": {
        "en": "You have no upcoming visit. Thank you for completing your care.",
        "sw": "Huna miadi inayokuja. Asante kwa kukamilisha huduma yako.",
    },
    "invalid": {"en": "Invalid choice. Please dial again.", "sw": "Chaguo si sahihi. Tafadhali piga tena."},
}
RESCHEDULE_OFFSETS = [3, 7, 14]


def _t(key: str, lang: str, **kw) -> str:
    return T[key][lang].format(**kw)


def _normalise(phone: str) -> str:
    digits = "".join(ch for ch in phone if ch.isdigit())
    if digits.startswith("0"):
        digits = "254" + digits[1:]
    return "+" + digits


def handle(db: Session, phone: str, text: str, lang_override: str | None = None) -> str:
    patient = (db.query(Patient).filter(Patient.phone == _normalise(phone))
               .order_by(Patient.id.desc()).first())
    lang = lang_override or (patient.language if patient else "sw")
    parts = [x for x in text.split("*") if x != ""] if text else []
    # Leading "5" toggles language (it can be pressed repeatedly).
    while parts and parts[0] == "5":
        lang = "en" if lang == "sw" else "sw"
        parts = parts[1:]

    counties = [c.name for c in geography.COUNTIES]
    county_menu = "\n".join(f"{i}. {name}" for i, name in enumerate(counties, start=1))

    def clinics(choice: str) -> str:
        if not choice.isdigit() or not 1 <= int(choice) <= len(counties):
            return "END " + _t("invalid", lang)
        c = geography.COUNTIES[int(choice) - 1]
        return "END " + _t("clinics", lang, treat=c.treatment_facility, screen=", ".join(c.screening_sites[:2]))

    if patient is None or patient.status not in ACTIVE_STATUSES:
        if not parts:
            if patient is not None:
                return "END " + _t("no_active", lang)
            return "CON " + _t("guest", lang)
        if parts[0] == "1":
            return "CON " + _t("pick_county", lang) + "\n" + county_menu if len(parts) == 1 else clinics(parts[1])
        return "END " + _t("invalid", lang)

    p = patient
    p.language = lang  # remember the language she chose
    site = messaging.short_site(p.treatment_facility)
    date_str = messaging.fmt_date(p.appointment_on, lang) if p.appointment_on else "-"

    if not parts:
        return "CON " + _t("welcome", lang, first=p.first_name) + "\n" + _t("menu", lang, date=date_str)

    choice = parts[0]
    if choice == "1":
        pathway.confirm_appointment(db, p, via="USSD")
        return "END " + _t("confirmed", lang, first=p.first_name, date=date_str, site=site)
    if choice == "2":
        options = [p.appointment_on + timedelta(days=d) for d in RESCHEDULE_OFFSETS]
        if len(parts) == 1:
            menu = "\n".join(f"{i}. {messaging.fmt_date(d, lang)}" for i, d in enumerate(options, start=1))
            return "CON " + _t("pick_date", lang) + "\n" + menu
        if parts[1] in ("1", "2", "3"):
            new_date = options[int(parts[1]) - 1]
            pathway.reschedule(db, p, new_date, via="USSD")
            return "END " + _t("rescheduled", lang, date=messaging.fmt_date(new_date, lang), site=site)
        return "END " + _t("invalid", lang)
    if choice == "3":
        return "CON " + _t("pick_county", lang) + "\n" + county_menu if len(parts) == 1 else clinics(parts[1])
    if choice == "4":
        chp = pathway.request_callback(db, p)
        who = chp.name.split(" ")[0] if chp else ("Mhudumu wa afya" if lang == "sw" else "A health worker")
        return "END " + _t("callback", lang, chp=who)
    return "END " + _t("invalid", lang)
