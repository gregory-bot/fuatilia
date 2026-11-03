"""Dropout-risk model: logistic regression on synthetic records, with plain-language reasons.

Explanations use each feature's contribution to the log-odds:
    contribution_j = coef_j * (x_j - mean_j) / std_j
which is exact for a standardised linear model, so the "top factors" are honest.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

from ..config import RISK_HIGH_FROM, RISK_MEDIUM_FROM

FEATURES = [
    "distance_km",
    "feature_phone",
    "missed_visits",
    "age_under_30",
    "age_over_50",
    "hiv_positive",
    "hiv_unknown",
    "hpv_screen",
]
# Binary features that are only worth explaining when present (x = 1).
_EXPLAIN_ONLY_WHEN_PRESENT = {"age_under_30", "age_over_50", "hiv_positive", "hiv_unknown", "hpv_screen"}


def featurize(p: dict) -> list[float]:
    """Turn a patient-like dict into the model's feature vector."""
    age = int(p["age"])
    return [
        float(p["distance_km"]),
        1.0 if p["phone_type"] == "feature" else 0.0,
        float(p["missed_visits"]),
        1.0 if age < 30 else 0.0,
        1.0 if age > 50 else 0.0,
        1.0 if p["hiv_status"] == "positive" else 0.0,
        1.0 if p["hiv_status"] == "unknown" else 0.0,
        1.0 if p["screening_method"] == "HPV" else 0.0,
    ]


def band_for(score: int) -> str:
    if score >= RISK_HIGH_FROM:
        return "high"
    if score >= RISK_MEDIUM_FROM:
        return "medium"
    return "low"


def _phrase(feature: str, p: dict, raises: bool) -> tuple[str, str]:
    """English and Kiswahili sentence for one factor."""
    d = round(float(p["distance_km"]))
    n = int(p["missed_visits"])
    if feature == "distance_km":
        if raises:
            return (f"Lives {d} km from the treatment site", f"Anaishi km {d} kutoka kituo cha matibabu")
        return (f"Lives only {d} km from the treatment site", f"Anaishi km {d} tu kutoka kituo cha matibabu")
    if feature == "feature_phone":
        if p["phone_type"] == "feature":
            return ("Uses a feature phone (SMS/USSD only)", "Anatumia simu ya kawaida (SMS/USSD pekee)")
        return ("Has a smartphone for reminders", "Ana simu janja ya kupokea vikumbusho")
    if feature == "missed_visits":
        if n > 0:
            plural = "visit" if n == 1 else "visits"
            return (f"Missed {n} previous clinic {plural}", f"Alikosa miadi {n} ya kliniki hapo awali")
        return ("No missed visits on record", "Hajawahi kukosa miadi ya kliniki")
    if feature == "age_under_30":
        return ("Younger than 30", "Ana umri chini ya miaka 30")
    if feature == "age_over_50":
        return ("Aged over 50", "Ana umri zaidi ya miaka 50")
    if feature == "hiv_positive":
        return ("Already in HIV care, with regular clinic contact", "Yuko kwenye huduma ya VVU, huhudhuria kliniki mara kwa mara")
    if feature == "hiv_unknown":
        return ("HIV status not known", "Hali ya VVU haijulikani")
    if feature == "hpv_screen":
        return ("HPV-positive: needs an extra visit for triage", "HPV chanya: anahitaji ziara ya ziada ya uchunguzi")
    return (feature, feature)


@dataclass
class RiskResult:
    score: int
    band: str
    factors: list[dict] = field(default_factory=list)


class RiskModel:
    def __init__(self) -> None:
        self.scaler = StandardScaler()
        self.model = LogisticRegression(max_iter=1000)
        self.trained_on = 0
        self.accuracy = 0.0

    def fit(self, records: list[dict], lost_labels: list[int]) -> None:
        X = np.array([featurize(r) for r in records])
        y = np.array(lost_labels)
        Xs = self.scaler.fit_transform(X)
        self.model.fit(Xs, y)
        self.trained_on = len(records)
        self.accuracy = float(self.model.score(Xs, y))

    def score(self, p: dict) -> RiskResult:
        x = np.array([featurize(p)])
        xs = self.scaler.transform(x)
        prob = float(self.model.predict_proba(xs)[0, 1])
        score = int(round(prob * 100))
        contributions = self.model.coef_[0] * xs[0]

        candidates = []
        for name, value, contrib in zip(FEATURES, x[0], contributions):
            if name in _EXPLAIN_ONLY_WHEN_PRESENT and value == 0:
                continue
            candidates.append((name, float(contrib)))
        # Factors that raise risk first (largest first), then protective ones to fill to 3.
        raising = sorted([c for c in candidates if c[1] > 0], key=lambda c: -c[1])
        lowering = sorted([c for c in candidates if c[1] <= 0], key=lambda c: c[1])
        factors = []
        for name, contrib in (raising + lowering)[:3]:
            en, sw = _phrase(name, p, contrib > 0)
            factors.append({"feature": name, "direction": "raises" if contrib > 0 else "lowers",
                            "weight": round(contrib, 2), "en": en, "sw": sw})
        return RiskResult(score=score, band=band_for(score), factors=factors)

    def info(self) -> dict:
        return {
            "type": "LogisticRegression (scikit-learn), standardised features",
            "trained_on": self.trained_on,
            "training_accuracy": round(self.accuracy, 3),
            "coefficients": {f: round(float(c), 3) for f, c in zip(FEATURES, self.model.coef_[0])},
            "note": "Trained on synthetic data only. Not clinically validated.",
        }


# Process-wide model instance, trained at startup (see main.py).
risk_model = RiskModel()
