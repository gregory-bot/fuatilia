"""SMS gateway adapter: Africa's Talking, SANDBOX ONLY.

The rest of the app depends on the `SmsGateway` interface, so swapping in a production
provider later is a one-class change (after consent, DPA 2019 and security review).
"""
from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from typing import Protocol

from ..config import SMS_MODE

# Hard-coded sandbox host: this adapter cannot reach the live messaging API.
AT_SANDBOX_SMS_URL = "https://api.sandbox.africastalking.com/version1/messaging"


@dataclass
class SmsResult:
    status: str  # sent | failed
    provider_ref: str
    mode: str


class SmsGateway(Protocol):
    mode: str

    def send(self, to: str, message: str) -> SmsResult: ...


class SimulatedSmsGateway:
    """Default: nothing leaves the machine; we just log a fake provider reference."""

    mode = "simulated"

    def send(self, to: str, message: str) -> SmsResult:
        return SmsResult("sent", f"ATSim_{uuid.uuid4().hex[:10]}", self.mode)


class AfricasTalkingSandboxGateway:
    """Posts to the Africa's Talking sandbox. Needs AT_API_KEY; username is always 'sandbox'."""

    mode = "sandbox"

    def __init__(self, api_key: str, sender_id: str | None = None) -> None:
        self.api_key = api_key
        self.sender_id = sender_id

    def send(self, to: str, message: str) -> SmsResult:
        data = {"username": "sandbox", "to": to, "message": message}
        if self.sender_id:
            data["from"] = self.sender_id
        req = urllib.request.Request(
            AT_SANDBOX_SMS_URL,
            data=urllib.parse.urlencode(data).encode(),
            headers={"apiKey": self.api_key, "Accept": "application/json",
                     "Content-Type": "application/x-www-form-urlencoded"},
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                body = json.loads(resp.read())
            recipient = body["SMSMessageData"]["Recipients"][0]
            return SmsResult("sent", recipient.get("messageId", "unknown"), self.mode)
        except Exception as exc:  # network/credential problems should not break the demo
            return SmsResult("failed", f"error:{type(exc).__name__}", self.mode)


def build_sms_gateway() -> SmsGateway:
    if SMS_MODE == "sandbox" and os.getenv("AT_API_KEY"):
        return AfricasTalkingSandboxGateway(os.environ["AT_API_KEY"], os.getenv("AT_SENDER_ID"))
    return SimulatedSmsGateway()


sms_gateway = build_sms_gateway()
