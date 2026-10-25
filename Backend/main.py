import sqlite3
import time
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from rules import assess, parse_upi

DB_PATH = Path(__file__).parent / "upi.db"
ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIST = ROOT / "Frontend" / "dist"
THIRTY_DAYS = 30 * 24 * 3600

app = FastAPI(title="UPI Safe Scan")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


def conn():
    return sqlite3.connect(DB_PATH)


@app.on_event("startup")
def init_db():
    with conn() as c:
        c.execute(
            """CREATE TABLE IF NOT EXISTS reports (
                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                 vpa TEXT NOT NULL,
                 reason TEXT,
                 ts INTEGER NOT NULL
               )"""
        )
        c.execute("CREATE INDEX IF NOT EXISTS idx_reports_vpa ON reports(vpa)")


def recent_reports(vpa: str) -> int:
    with conn() as c:
        row = c.execute(
            "SELECT COUNT(*) FROM reports WHERE vpa = ? AND ts >= ?",
            (vpa.lower(), int(time.time()) - THIRTY_DAYS),
        ).fetchone()
    return row[0]


class AnalyzeIn(BaseModel):
    qr: str = Field(..., max_length=2000)


class ReportIn(BaseModel):
    vpa: str = Field(..., max_length=256)
    reason: str = Field("user report", max_length=300)


@app.post("/analyze")
def analyze(body: AnalyzeIn):
    params, error = parse_upi(body.qr)
    if error:
        return {"ok": False, "error": error}
    reports = recent_reports(params.get("pa", ""))
    score, level, reasons = assess(params, reports)
    return {
        "ok": True,
        "params": params,
        "score": score,
        "level": level,
        "reasons": reasons,
        "reports": reports,
    }


@app.post("/report")
def report(body: ReportIn):
    with conn() as c:
        c.execute(
            "INSERT INTO reports (vpa, reason, ts) VALUES (?, ?, ?)",
            (body.vpa.lower(), body.reason, int(time.time())),
        )
    return {"ok": True, "reports": recent_reports(body.vpa)}


# Serve the built Vite app (Frontend/dist). Never serve /src/*.jsx — the
# browser cannot run it, which leaves a blank page.
@app.get("/")
def spa_index():
    index = FRONTEND_DIST / "index.html"
    if index.exists():
        return FileResponse(index)
    return HTMLResponse(
        """<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px">
        <h1>UPI Safe Scan API is running</h1>
        <p>The web UI is not built yet. Either:</p>
        <ul>
          <li>Open the Vite app at <a href="http://localhost:5173">http://localhost:5173</a></li>
          <li>Or run <code>npm run build</code> in the Frontend folder, then refresh this page.</li>
        </ul>
        </body></html>""",
        status_code=200,
    )


if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")