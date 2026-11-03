"""M-Pesa payout adapter: Safaricom Daraja B2C, SANDBOX ONLY.

The default gateway simulates the payout and returns an M-Pesa-style transaction ID.
The sandbox gateway shows the real Daraja call shape (OAuth, then B2C payment request)
against sandbox.safaricom.co.ke; it can never move real money.
"""
from __future__ import annotations

import base64
import json
import os
import random
import string
import urllib.request
from dataclasses import dataclass
from typing import Protocol

from ..config import MPESA_MODE

DARAJA_SANDBOX = "https://sandbox.safaricom.co.ke"


@dataclass
class PayoutResult:
    status: str  # paid | pending | failed
    transaction_id: str
    mode: str


class PayoutGateway(Protocol):
    mode: str

    def pay(self, phone: str, amount_kes: int, remarks: str) -> PayoutResult: ...


def fake_mpesa_id() -> str:
    """M-Pesa receipts look like 'SKB3XQ7T9M': 10 upper-case alphanumerics."""
    return "S" + "".join(random.choices(string.ascii_uppercase + string.digits, k=9))


class SimulatedPayoutGateway:
    mode = "simulated"

    def pay(self, phone: str, amount_kes: int, remarks: str) -> PayoutResult:
        return PayoutResult("paid", fake_mpesa_id(), self.mode)


class DarajaB2CSandboxGateway:
    """Requires DARAJA_CONSUMER_KEY, DARAJA_CONSUMER_SECRET, DARAJA_SECURITY_CREDENTIAL,
    DARAJA_INITIATOR, DARAJA_SHORTCODE and DARAJA_RESULT_URL (all sandbox values)."""

    mode = "sandbox"

    def __init__(self) -> None:
        self.key = os.environ["DARAJA_CONSUMER_KEY"]
        self.secret = os.environ["DARAJA_CONSUMER_SECRET"]

    def _token(self) -> str:
        creds = base64.b64encode(f"{self.key}:{self.secret}".encode()).decode()
        req = urllib.request.Request(
            f"{DARAJA_SANDBOX}/oauth/v1/generate?grant_type=client_credentials",
            headers={"Authorization": f"Basic {creds}"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())["access_token"]

    def pay(self, phone: str, amount_kes: int, remarks: str) -> PayoutResult:
        payload = {
            "InitiatorName": os.getenv("DARAJA_INITIATOR", "testapi"),
            "SecurityCredential": os.getenv("DARAJA_SECURITY_CREDENTIAL", ""),
            "CommandID": "BusinessPayment",
            "Amount": amount_kes,
            "PartyA": os.getenv("DARAJA_SHORTCODE", "600000"),
            "PartyB": phone.lstrip("+"),
            "Remarks": remarks[:100],
            "QueueTimeOutURL": os.getenv("DARAJA_RESULT_URL", "https://example.org/timeout"),
            "ResultURL": os.getenv("DARAJA_RESULT_URL", "https://example.org/result"),
            "Occasion": "Fuatilia transport",
        }
        try:
            req = urllib.request.Request(
                f"{DARAJA_SANDBOX}/mpesa/b2c/v3/paymentrequest",
                data=json.dumps(payload).encode(),
                headers={"Authorization": f"Bearer {self._token()}", "Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                body = json.loads(resp.read())
            # Daraja is async: the final receipt arrives on ResultURL. Keep the conversation ID.
            return PayoutResult("pending", body.get("ConversationID", fake_mpesa_id()), self.mode)
        except Exception:
            return PayoutResult("failed", fake_mpesa_id(), self.mode)


def build_payout_gateway() -> PayoutGateway:
    if MPESA_MODE == "sandbox" and os.getenv("DARAJA_CONSUMER_KEY") and os.getenv("DARAJA_CONSUMER_SECRET"):
        return DarajaB2CSandboxGateway()
    return SimulatedPayoutGateway()


payout_gateway = build_payout_gateway()
