"""Synthetic data generator and first-run database seed.

Nothing here is real. The outcome label is drawn from a hand-written logistic process in
which dropout rises with distance, feature-phone-only access and past missed visits,
so the trained model has something realistic to learn.
"""
from __future__ import annotations

import json
import math
import random
from datetime import date, datetime, time, timedelta

from sqlalchemy.orm import Session

from ..adapters.mpesa import fake_mpesa_id
from ..config import RANDOM_SEED, SEED_PATIENTS
from ..models import (CHECKED_IN, CHP, LOST, NAVIGATING, RESCREEN_DUE, SCREENED_POSITIVE, TREATED,
                      Message, Patient, PathologyCase, Voucher)
from . import geography, messaging, pathway
from .risk_model import risk_model

FIRST_NAMES = {
    "Samburu": ["Naisiae", "Nashipai", "Naeku", "Naimutie", "Nasieku", "Seleyian", "Nkoitoi", "Nalangu"],
    "Baringo": ["Chebet", "Jepkosgei", "Jeptoo", "Cherono", "Jerotich", "Jepchirchir", "Chepkoech", "Chepkurui"],
    "Turkana": ["Akiru", "Nakiru", "Akoru", "Akai", "Nachuru", "Ngasike", "Esinyen", "Atabo"],
    "West Pokot": ["Chepto", "Chemutai", "Chepkemoi", "Cheyech", "Chelimo", "Cheposait"],
    "Laikipia": ["Wanjiru", "Naserian", "Wambui", "Nyokabi", "Resian", "Muthoni"],
    "Nakuru": ["Wanjiku", "Njeri", "Wairimu", "Chepngetich", "Nyambura", "Faith"],
    "Kisumu": ["Achieng", "Atieno", "Awino", "Akinyi", "Adhiambo", "Anyango"],
    "Nairobi": ["Zawadi", "Wanjiku", "Mercy", "Fatuma", "Mwende", "Hodan", "Akinyi"],
    "Kakamega": ["Nafula", "Nekesa", "Khavele", "Mmbone", "Naliaka", "Anyango"],
    "Kilifi": ["Halima", "Mwanaisha", "Kadzo", "Sidi", "Riziki", "Mwanajuma"],
}
SURNAMES = {
    "Samburu": ["Lenaseiyan", "Lekimain", "Lolkirr", "Lesoipa", "Lemerketo", "Lenolosi"],
    "Baringo": ["Kiptoo", "Chepkwony", "Kibet", "Kimoi", "Lokwawi", "Kamar"],
    "Turkana": ["Ekiru", "Lokwang", "Ewoi", "Nakadio", "Lomuria", "Akuwom"],
    "West Pokot": ["Loyatum", "Krop", "Pkemoi", "Lotee", "Siren"],
    "Laikipia": ["Maina", "Lesiamon", "Kariuki", "Ole Ntimama", "Gitau"],
    "Nakuru": ["Kamau", "Njoroge", "Cheruiyot", "Wafula", "Mutai"],
    "Kisumu": ["Odhiambo", "Otieno", "Onyango", "Ouma", "Okoth"],
    "Nairobi": ["Mwangi", "Wekesa", "Ali", "Mutua", "Owino", "Kimani"],
    "Kakamega": ["Wekesa", "Shikuku", "Ambasa", "Makokha", "Wanyama"],
    "Kilifi": ["Bakari", "Kazungu", "Charo", "Baya", "Kahindi"],
}

AMINA = {
    "name": "Amina Lenaseiyan", "age": 34, "county": "Samburu", "village": "Lodung'okwe",
    "phone": "+254700000384", "phone_type": "feature", "language": "sw",
    "distance_km": 68.0, "missed_visits": 2, "hiv_status": "unknown", "screening_method": "VIA",
    "screening_facility": "Lodung'okwe Dispensary",
}
AMINA_CODE = "FT-AMINA"


def _true_lost_probability(r: dict) -> float:
    """The hidden 'real world' the model must learn (synthetic)."""
    z = (-2.15
         + 0.032 * (r["distance_km"] - 25)
         + 0.80 * (r["phone_type"] == "feature")
         + 0.50 * r["missed_visits"]
         + 0.30 * (r["age"] < 30)
         + 0.25 * (r["age"] > 50)
         - 0.35 * (r["hiv_status"] == "positive")
         + 0.30 * (r["hiv_status"] == "unknown")
         + 0.25 * (r["screening_method"] == "HPV"))
    return 1 / (1 + math.exp(-z))


def generate(n: int, rng: random.Random) -> list[dict]:
    counties = list(geography.COUNTIES)
    weights = [c.weight for c in counties]
    rows = []
    for i in range(n):
        c = rng.choices(counties, weights)[0]
        distance = max(1.0, rng.gauss(c.distance_mean_km, c.distance_mean_km * 0.35))
        p_feature = 0.65 if c.rural else 0.30
        missed_lambda = 0.9 if c.rural else 0.5
        hiv = rng.choices(["positive", "negative", "unknown"], [0.13, 0.75, 0.12])[0]
        r = {
            "name": f"{rng.choice(FIRST_NAMES[c.name])} {rng.choice(SURNAMES[c.name])}",
            "age": int(min(65, max(25, rng.gauss(38, 8)))),
            "county": c.name,
            "village": rng.choice(c.villages),
            "phone": f"+2547{rng.randint(10, 99)}{rng.randint(100000, 999999)}",
            "phone_type": "feature" if rng.random() < p_feature else "smartphone",
            "language": "sw" if (c.rural or rng.random() < 0.55) else "en",
            "distance_km": round(distance, 1),
            "missed_visits": min(5, _poisson(rng, missed_lambda)),
            "hiv_status": hiv,
            "screening_method": "HPV" if rng.random() < 0.3 else "VIA",
            "screening_facility": rng.choice(c.screening_sites),
            # 18 months of history (so some treated women are due a rescreen), with ~20%
            # screened in the last month so the live pipeline and CHP worklists look busy.
            "screened_on": date.today() - timedelta(days=rng.randint(0, 30) if rng.random() < 0.2
                                                    else rng.randint(0, 540)),
        }
        r["lost"] = rng.random() < _true_lost_probability(r)
        rows.append(r)
    return rows


def _poisson(rng: random.Random, lam: float) -> int:
    k, p, threshold = 0, 1.0, math.exp(-lam)
    while True:
        p *= rng.random()
        if p <= threshold:
            return k
        k += 1


def _at(d: date, rng: random.Random) -> datetime:
    return datetime.combine(d, time(rng.randint(8, 16), rng.choice([0, 15, 30, 45])))


def train(db: Session) -> None:
    """(Re)train the dropout model on every labelled synthetic record in the DB."""
    rows = db.query(Patient).filter(Patient.outcome_completed.is_not(None)).all()
    records = [{"distance_km": p.distance_km, "phone_type": p.phone_type, "missed_visits": p.missed_visits,
                "age": p.age, "hiv_status": p.hiv_status, "screening_method": p.screening_method} for p in rows]
    risk_model.fit(records, [0 if p.outcome_completed else 1 for p in rows])


def seed(db: Session) -> None:
    """Populate an empty database: CHPs, ~500 women with timelines, messages, vouchers, slides."""
    rng = random.Random(RANDOM_SEED)
    random.seed(RANDOM_SEED)  # adapters use the global RNG for fake transaction IDs

    for c in geography.COUNTIES:
        for name, area in c.chps:
            db.add(CHP(name=name, county=c.name, area=area, phone=f"+2547{rng.randint(10, 99)}{rng.randint(100000, 999999)}"))
    db.flush()
    chps: dict[str, list[CHP]] = {}
    for c in db.query(CHP).all():
        chps.setdefault(c.county, []).append(c)
    load: dict[int, int] = {}

    rows = generate(SEED_PATIENTS - 1, rng)  # Amina is the 500th woman
    records = [{k: r[k] for k in ("distance_km", "phone_type", "missed_visits", "age", "hiv_status", "screening_method")} for r in rows]
    risk_model.fit(records, [int(r["lost"]) for r in rows])

    today = date.today()
    for i, r in enumerate(rows, start=1):
        result = risk_model.score(r)
        c = geography.county(r["county"])
        p = Patient(code=f"FT-{i:04d}", name=r["name"], age=r["age"], county=r["county"], village=r["village"],
                    phone=r["phone"], phone_type=r["phone_type"], language=r["language"],
                    distance_km=r["distance_km"], missed_visits=r["missed_visits"], hiv_status=r["hiv_status"],
                    screening_method=r["screening_method"], screening_facility=r["screening_facility"],
                    treatment_facility=c.treatment_facility, screened_on=r["screened_on"],
                    risk_score=result.score, risk_band=result.band,
                    risk_factors_json=json.dumps(result.factors), outcome_completed=not r["lost"])
        p.appointment_on = pathway.appointment_for(p.screened_on, p.risk_band)
        db.add(p)
        _seed_timeline(db, p, r["lost"], rng, today, chps, load)

    db.flush()
    _seed_pathology(db, rng)
    db.commit()

    amina = pathway.register(db, dict(AMINA), code=AMINA_CODE)
    amina.outcome_completed = None  # live demo patient, not training data
    db.commit()


def _seed_timeline(db: Session, p: Patient, lost: bool, rng: random.Random, today: date,
                   chps: dict[str, list[CHP]], load: dict[int, int]) -> None:
    """Back-fill a believable history for one seeded woman, consistent with her label."""
    s = p.screened_on
    age_days = (today - s).days
    pathway.add_event(db, p, "screened", f"Screened positive ({p.screening_method})",
                      f"At {p.screening_facility}. Referred to {p.treatment_facility}.", _at(s, rng))
    pathway.add_event(db, p, "risk", f"Dropout risk {p.risk_score}/100 ({p.risk_band})",
                      "; ".join(f["en"] for f in p.risk_factors), _at(s, rng))
    if p.risk_band == "high":
        chp = pathway.pick_chp(chps[p.county], p.village, load)
        if chp:
            p.chp = chp
            load[chp.id] = load.get(chp.id, 0) + 1
            pathway.add_event(db, p, "chp", f"Assigned to CHP {chp.name}",
                              f"High dropout risk. {chp.name} covers {chp.area} and will visit.", _at(s, rng))
    db.add(Message(patient=p, language=p.language, purpose="intro", body=messaging.render("intro", p),
                   status="sent", provider_ref=f"ATSim_seed{p.code}", send_at=_at(s, rng)))

    # Decide where she is today. Days to treatment grow with distance (synthetic).
    days_to_treat = int(max(5, rng.gauss(12 + 0.35 * p.distance_km, 7)))
    if lost:
        p.status = LOST if age_days > 45 else rng.choice([SCREENED_POSITIVE, NAVIGATING])
    elif age_days < days_to_treat:
        p.status = rng.choice([SCREENED_POSITIVE, NAVIGATING, NAVIGATING, CHECKED_IN])
    else:
        p.status = TREATED

    if p.status != SCREENED_POSITIVE:
        pathway.add_event(db, p, "ussd", "Appointment confirmed via USSD", "", _at(s + timedelta(days=2), rng))
        if p.chp_id and rng.random() < 0.8:
            p.chp_visited_at = _at(s + timedelta(days=4), rng)
            pathway.add_event(db, p, "chp_visit", f"Home visit by {p.chp.name}",
                              "Explained the visit, planned transport.", p.chp_visited_at)
    if p.status == LOST:
        pathway.add_event(db, p, "lost", "Lost to follow-up",
                          rng.choice(["Phone switched off after 3 reminders.", "Moved to another county.",
                                      "Could not afford transport; CHP could not trace.",
                                      "Missed appointment; did not respond to SMS."]),
                          _at(s + timedelta(days=45), rng))
    if p.status not in (CHECKED_IN, TREATED):
        return

    check_day = min(today, s + timedelta(days=days_to_treat))
    p.checked_in_on = check_day
    pathway.add_event(db, p, "checked_in", f"Checked in at {p.treatment_facility}",
                      f"{(check_day - s).days} days after positive screen.", _at(check_day, rng))
    # Vouchers are written directly (never through a payout gateway) when seeding.
    amount = 1500 if p.distance_km > 30 else 1000
    txn = fake_mpesa_id()
    db.add(Voucher(patient=p, amount_kes=amount, transaction_id=txn, status="paid", mode="simulated",
                   created_at=_at(check_day, rng)))
    pathway.add_event(db, p, "voucher", f"M-Pesa transport voucher: KES {amount:,}",
                      f"Transaction {txn} (simulated).", _at(check_day, rng))
    if p.status == CHECKED_IN:
        return

    p.treated_on = check_day
    p.appointment_on = check_day + timedelta(days=365)
    pathway.add_event(db, p, "treated", "Treatment completed",
                      f"{(check_day - s).days} days from positive screen.", _at(check_day, rng))
    if (today - check_day).days >= 330:
        p.status = RESCREEN_DUE
        pathway.add_event(db, p, "rescreen", "Rescreen due", "12-month check after treatment.",
                          _at(check_day + timedelta(days=330), rng))


def _seed_pathology(db: Session, rng: random.Random) -> None:
    from .pathology import band_for_urgency, NOTES  # local import avoids a cycle

    patients = db.query(Patient).filter(Patient.status.in_([CHECKED_IN, NAVIGATING])).limit(40).all()
    for i, p in enumerate(rng.sample(patients, min(8, len(patients))), start=1):
        score = rng.randint(12, 96)
        band = band_for_urgency(score)
        db.add(PathologyCase(case_code=f"PX-{i:04d}", patient=p, image_path=None,
                             original_filename=f"slide_{p.code.lower()}_x40.jpg", urgency_score=score,
                             urgency_band=band, ai_note=NOTES[band],
                             created_at=datetime.now() - timedelta(hours=rng.randint(1, 96))))


def reset_amina(db: Session) -> Patient:
    """Delete and re-register Amina so the demo can be replayed from the start."""
    old = db.query(Patient).filter(Patient.code == AMINA_CODE).first()
    if old:
        db.query(PathologyCase).filter(PathologyCase.patient_id == old.id).delete()
        db.delete(old)
        db.commit()
    return pathway.register(db, dict(AMINA), code=AMINA_CODE)

