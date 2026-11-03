"""Central configuration. Every value can be overridden with an environment variable."""
from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]

DB_PATH = Path(os.getenv("FUATILIA_DB", BASE_DIR / "fuatilia.db"))
UPLOAD_DIR = Path(os.getenv("FUATILIA_UPLOADS", BASE_DIR / "uploads"))

# Synthetic seed size and RNG seed (fixed so every demo machine sees the same data).
SEED_PATIENTS = int(os.getenv("FUATILIA_SEED_PATIENTS", "500"))
RANDOM_SEED = int(os.getenv("FUATILIA_RANDOM_SEED", "254"))

# Transport voucher released at check-in. Can also be changed at runtime via PUT /api/settings.
VOUCHER_AMOUNT_KES = int(os.getenv("FUATILIA_VOUCHER_KES", "1500"))

# USSD short code shown to patients (Africa's Talking shared code style).
USSD_CODE = os.getenv("FUATILIA_USSD_CODE", "*384*12#")

# Risk bands (score is 0-100 = predicted probability of loss to follow-up).
RISK_MEDIUM_FROM = 30
RISK_HIGH_FROM = 55

# Integrations. Default is fully simulated; set to "sandbox" (with credentials) to call
# the providers' SANDBOX endpoints. There is deliberately no production mode in this MVP.
SMS_MODE = os.getenv("FUATILIA_SMS_MODE", "simulated")  # simulated | sandbox
MPESA_MODE = os.getenv("FUATILIA_MPESA_MODE", "simulated")  # simulated | sandbox

FRONTEND_ORIGINS = os.getenv(
    "FUATILIA_FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",")
