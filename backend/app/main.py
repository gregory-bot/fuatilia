"""Fuatilia API entry point.

    uvicorn app.main:app --reload      (run from the backend/ folder)

On first start the SQLite database is created and seeded with ~500 synthetic women,
then the dropout-risk model is trained on their (synthetic) outcomes.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import FRONTEND_ORIGINS, UPLOAD_DIR
from .database import Base, SessionLocal, engine
from .models import Patient
from .routers import chp, demo, insights, pathology, patients, ussd
from .services import synthetic


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    with SessionLocal() as db:
        if db.query(Patient).count() == 0:
            synthetic.seed(db)  # also trains the model
        else:
            synthetic.train(db)
    yield


app = FastAPI(
    title="Fuatilia API",
    version="1.0.0",
    description="AI cancer care navigator (hackathon MVP). SYNTHETIC DATA ONLY.",
    lifespan=lifespan,
)
app.add_middleware(CORSMiddleware, allow_origins=FRONTEND_ORIGINS, allow_methods=["*"], allow_headers=["*"])

for module in (patients, chp, ussd, pathology, insights, demo):
    app.include_router(module.router, prefix="/api")

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "synthetic_data_only": True}
