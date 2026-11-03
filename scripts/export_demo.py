"""Export the synthetic demo data + trained model for the static (GitHub Pages) build.

Seeds a fresh database in a temp file (same deterministic seed as the API), trains the
dropout model, and writes frontend/public/demo/snapshot.json. The browser demo API
(frontend/src/lib/demoApi.js) serves the site from this file, so no server is needed.

    backend/.venv/bin/python scripts/export_demo.py
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.environ["FUATILIA_DB"] = str(Path(tempfile.mkdtemp()) / "demo.db")
sys.path.insert(0, str(ROOT / "backend"))

from app.config import RISK_HIGH_FROM, RISK_MEDIUM_FROM, USSD_CODE  # noqa: E402
from app.database import Base, SessionLocal, engine  # noqa: E402
from app.models import CHP, PathologyCase, Patient  # noqa: E402
from app.schemas import PatientDetail  # noqa: E402
from app.services import geography, metrics, synthetic  # noqa: E402
from app.services.messaging import REMINDER_DAYS, TEMPLATES  # noqa: E402
from app.services.risk_model import FEATURES, risk_model  # noqa: E402
from app.services.settings import runtime  # noqa: E402

Base.metadata.create_all(engine)
with SessionLocal() as db:
    synthetic.seed(db)
    patients = [PatientDetail.model_validate(p).model_dump(mode="json")
                for p in db.query(Patient).order_by(Patient.id).all()]
    # Ground-truth labels drive the impact simulation; they are synthetic too.
    labels = {p.id: p.outcome_completed for p in db.query(Patient).all()}
    fake_chp = {c.id: f"+25470009{c.id:04d}" for c in db.query(CHP).all()}
    for p in patients:
        if p["chp"]:
            p["chp"]["phone"] = fake_chp[p["chp"]["id"]]
        p["outcome_completed"] = labels[p["id"]]
        # The seed draws random Kenyan-format numbers; a public file must not contain numbers
        # that could belong to real people, so use an obviously fake block (Amina keeps hers).
        if p["code"] != synthetic.AMINA_CODE:
            p["phone"] = f"+25470001{p['id']:04d}"
    chps = [{"id": c.id, "name": c.name, "county": c.county, "area": c.area, "phone": f"+25470009{c.id:04d}"}
            for c in db.query(CHP).order_by(CHP.id).all()]
    cases = [{"id": c.id, "case_code": c.case_code, "patient_id": c.patient_id, "image_url": None,
              "original_filename": c.original_filename, "urgency_score": c.urgency_score,
              "urgency_band": c.urgency_band, "ai_note": c.ai_note, "status": c.status,
              "reviewer_note": c.reviewer_note, "created_at": c.created_at.isoformat(), "reviewed_at": None}
             for c in db.query(PathologyCase).order_by(PathologyCase.id).all()]
    impact = metrics.impact(db)

snapshot = {
    "exported_on": date.today().isoformat(),
    "synthetic_data_only": True,
    "model": {
        "features": FEATURES,
        "mean": risk_model.scaler.mean_.round(6).tolist(),
        "scale": risk_model.scaler.scale_.round(6).tolist(),
        "coef": risk_model.model.coef_[0].round(6).tolist(),
        "intercept": round(float(risk_model.model.intercept_[0]), 6),
        "bands": {"medium_from": RISK_MEDIUM_FROM, "high_from": RISK_HIGH_FROM},
    },
    "ussd_code": USSD_CODE,
    "settings": dict(runtime),
    "templates": TEMPLATES,
    "reminder_days": REMINDER_DAYS,
    "counties": [{"name": c.name, "treatment_facility": c.treatment_facility, "screening_sites": list(c.screening_sites),
                  "villages": list(c.villages), "typical_distance_km": c.distance_mean_km} for c in geography.COUNTIES],
    "amina": synthetic.AMINA,
    "impact": impact,
    "chps": chps,
    "patients": patients,
    "pathology": cases,
}
out = ROOT / "frontend" / "public" / "demo" / "snapshot.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(snapshot, separators=(",", ":")))
print(f"wrote {out.relative_to(ROOT)} ({out.stat().st_size / 1024:.0f} KB, {len(patients)} patients)")
