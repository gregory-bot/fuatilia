# Fuatilia: two commands to run locally.
#   make install   # once: Python venv + npm packages
#   make dev       # API on :8000 and web app on :5173 (Ctrl+C stops both)

PYTHON ?= python3
VENV := backend/.venv

.PHONY: install dev api web reset video

install:
	$(PYTHON) -m venv $(VENV)
	$(VENV)/bin/pip install -q -r backend/requirements.txt
	cd frontend && npm install

dev:
	@trap 'kill 0' INT TERM EXIT; \
	$(MAKE) --no-print-directory api & \
	$(MAKE) --no-print-directory web & \
	wait

api:
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

web:
	cd frontend && npm run dev -- --host

# Delete the synthetic database and uploads; they are re-seeded on next start.
reset:
	rm -f backend/fuatilia.db && rm -rf backend/uploads

# Export the film as a 1080p MP4 into video/ (needs ffmpeg + Google Chrome, and `make dev` running).
#   make video            English narration
#   make video LANG=sw    Kiswahili narration
video:
	scripts/render-film/render.sh $(or $(LANG_CODE),$(if $(filter sw,$(LANG)),sw,en))
