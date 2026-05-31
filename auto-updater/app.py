"""
Auto-Updater Service
====================
Runs daily scheduled scraping of habboassets.com for new SWF packs,
furniture and effects (COM hotel only).  Exposes a REST API consumed by
the CMS Housekeeping panel to check status and trigger individual item
processing.

Environment variables
---------------------
DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASS   – database credentials
NITRO_CONTAINER_NAME   – name of the nitro Docker container (default: nitro)
NITRO_SWF_DIR          – path to shared nitro-swf volume (default: /nitro-swf)
NITRO_ASSETS_DIR       – path to shared nitro-assets volume (default: /nitro-assets)
SCRAPE_HOUR            – hour (UTC, 0-23) at which to run the daily scrape (default: 4)
PORT                   – HTTP port for this service (default: 5001)
"""

from __future__ import annotations

import logging
import os
import time
from datetime import date
from threading import Thread

import pymysql
from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, jsonify, request

import converter
import scraper

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s – %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

DB_HOST = os.getenv("DB_HOST", "mysql")
DB_PORT = int(os.getenv("DB_PORT", 3306))
DB_NAME = os.getenv("DB_NAME", "arcturus")
DB_USER = os.getenv("DB_USER", "arcturus_user")
DB_PASS = os.getenv("DB_PASS", "arcturus_pw")

SCRAPE_HOUR = int(os.getenv("SCRAPE_HOUR", 4))
PORT = int(os.getenv("PORT", 5001))

# ---------------------------------------------------------------------------
# Flask app
# ---------------------------------------------------------------------------

app = Flask(__name__)

# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def get_db():
    return pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        passwd=DB_PASS,
        database=DB_NAME,
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True,
    )


def add_log(category: str, message: str):
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO auto_update_logs (log_date, category, message, created_at) "
                    "VALUES (%s, %s, %s, %s)",
                    (date.today().isoformat(), category, message, int(time.time())),
                )
    except Exception as exc:
        logger.warning("add_log failed: %s", exc)


def _get_cursor(type_: str):
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT last_seen_id FROM auto_update_cursor WHERE type = %s", (type_,)
                )
                row = cur.fetchone()
                return row["last_seen_id"] if row else None
    except Exception as exc:
        logger.warning("_get_cursor failed: %s", exc)
        return None


def _set_cursor(type_: str, last_seen_id: str):
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE auto_update_cursor SET last_seen_id = %s, updated_at = %s "
                    "WHERE type = %s",
                    (last_seen_id, int(time.time()), type_),
                )
    except Exception as exc:
        logger.warning("_set_cursor failed: %s", exc)


# ---------------------------------------------------------------------------
# Daily scrape job
# ---------------------------------------------------------------------------

def daily_scrape():
    """Fetch new items from habboassets.com and store them in the DB."""
    logger.info("=== Daily scrape started ===")
    add_log("system", "Daily scrape started")

    _scrape_packs()
    _scrape_furniture()
    _scrape_effects()

    add_log("system", "Daily scrape finished")
    logger.info("=== Daily scrape finished ===")


def _scrape_packs():
    packs = scraper.fetch_swf_packs()
    added = 0
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                for pack in packs:
                    cur.execute(
                        "INSERT IGNORE INTO auto_update_swf_packs "
                        "(revision_name, download_url, status, created_at, updated_at) "
                        "VALUES (%s, %s, 'pending', %s, %s)",
                        (
                            pack["revision_name"],
                            pack.get("download_url"),
                            int(time.time()),
                            int(time.time()),
                        ),
                    )
                    if cur.rowcount:
                        added += 1
    except Exception as exc:
        logger.error("_scrape_packs DB error: %s", exc)
        add_log("packs", f"Scrape error: {exc}")
        return

    msg = f"SWF Packs: {added} new revisions found"
    logger.info(msg)
    add_log("packs", msg)


def _scrape_furniture():
    cursor_id = _get_cursor("furniture")
    items = scraper.fetch_furniture(stop_at_id=cursor_id)
    added = 0
    first_id = None
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                for item in items:
                    if first_id is None:
                        first_id = item["furniture_id"]
                    cur.execute(
                        "INSERT IGNORE INTO auto_update_furniture "
                        "(furniture_id, class_name, revision, download_url, sql_insert, xml_data, "
                        "status, created_at, updated_at) "
                        "VALUES (%s, %s, %s, %s, %s, %s, 'pending', %s, %s)",
                        (
                            item["furniture_id"],
                            item["class_name"],
                            item.get("revision", 0),
                            item.get("download_url"),
                            item.get("sql_insert"),
                            item.get("xml_data"),
                            int(time.time()),
                            int(time.time()),
                        ),
                    )
                    if cur.rowcount:
                        added += 1
    except Exception as exc:
        logger.error("_scrape_furniture DB error: %s", exc)
        add_log("furniture", f"Scrape error: {exc}")
        return

    # Update cursor to the first (newest) item seen this run
    if first_id:
        _set_cursor("furniture", first_id)

    msg = f"Furniture: {added} new items found"
    logger.info(msg)
    add_log("furniture", msg)


def _scrape_effects():
    cursor_id = _get_cursor("effects")
    items = scraper.fetch_effects(stop_at_id=cursor_id)
    added = 0
    first_id = None
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                for item in items:
                    if first_id is None:
                        first_id = item["effect_id"]
                    cur.execute(
                        "INSERT IGNORE INTO auto_update_effects "
                        "(effect_name, revision, download_url, status, created_at, updated_at) "
                        "VALUES (%s, %s, %s, 'pending', %s, %s)",
                        (
                            item["effect_name"],
                            item.get("revision", 0),
                            item.get("download_url"),
                            int(time.time()),
                            int(time.time()),
                        ),
                    )
                    if cur.rowcount:
                        added += 1
    except Exception as exc:
        logger.error("_scrape_effects DB error: %s", exc)
        add_log("effects", f"Scrape error: {exc}")
        return

    if first_id:
        _set_cursor("effects", first_id)

    msg = f"Effects: {added} new items found"
    logger.info(msg)
    add_log("effects", msg)


# ---------------------------------------------------------------------------
# HTTP API
# ---------------------------------------------------------------------------

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/api/scrape", methods=["POST"])
def trigger_scrape():
    """Manually trigger a scrape of habboassets.com."""
    t = Thread(target=daily_scrape, daemon=True)
    t.start()
    return jsonify({"status": "ok", "message": "Scrape triggered"})


# --- SWF Packs ---

@app.route("/api/packs", methods=["GET"])
def list_packs():
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 50))
    offset = (page - 1) * per_page
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM auto_update_swf_packs ORDER BY id DESC LIMIT %s OFFSET %s",
                    (per_page, offset),
                )
                rows = cur.fetchall()
                cur.execute("SELECT COUNT(*) AS total FROM auto_update_swf_packs")
                total = cur.fetchone()["total"]
        return jsonify({"items": rows, "total": total})
    except Exception as exc:
        logger.error("list_packs: %s", exc)
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/packs/<int:pack_id>/process", methods=["POST"])
def process_pack(pack_id: int):
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM auto_update_swf_packs WHERE id = %s", (pack_id,)
                )
                pack = cur.fetchone()
    except Exception as exc:
        logger.error("process_pack DB lookup: %s", exc)
        return jsonify({"error": "Internal server error"}), 500
    if pack["status"] not in ("pending", "error"):
        return jsonify({"error": f"Pack status is '{pack['status']}', cannot process"}), 400

    _update_pack_status(pack_id, "processing")

    def _do():
        files_added, err = converter.process_swf_pack(
            pack["revision_name"], pack["download_url"] or ""
        )
        if err:
            _update_pack_status(pack_id, "error", error_message=err)
            add_log("packs", f"Pack '{pack['revision_name']}' error: {err}")
        else:
            _update_pack_status(pack_id, "done", files_added=files_added)
            add_log("packs", f"Pack '{pack['revision_name']}' done – {files_added} new file(s)")

    Thread(target=_do, daemon=True).start()
    return jsonify({"status": "processing", "message": "Processing started"})


_PACK_STATUS_ALLOWED_KEYS = frozenset({"status", "updated_at", "files_added", "error_message"})

def _update_pack_status(pack_id, status, files_added=None, error_message=None):
    data = {"status": status, "updated_at": int(time.time())}
    if files_added is not None:
        data["files_added"] = files_added
    if error_message is not None:
        data["error_message"] = error_message
    # Validate keys against allowlist before using them in the query
    assert set(data).issubset(_PACK_STATUS_ALLOWED_KEYS), "Unexpected column name"
    set_clause = ", ".join(f"`{k}` = %s" for k in data)
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE auto_update_swf_packs SET {set_clause} WHERE id = %s",
                    list(data.values()) + [pack_id],
                )
    except Exception as exc:
        logger.error("_update_pack_status: %s", exc)


# --- Furniture ---

@app.route("/api/furniture", methods=["GET"])
def list_furniture():
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 50))
    offset = (page - 1) * per_page
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM auto_update_furniture ORDER BY id DESC LIMIT %s OFFSET %s",
                    (per_page, offset),
                )
                rows = cur.fetchall()
                cur.execute("SELECT COUNT(*) AS total FROM auto_update_furniture")
                total = cur.fetchone()["total"]
        return jsonify({"items": rows, "total": total})
    except Exception as exc:
        logger.error("list_furniture: %s", exc)
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/furniture/<int:furni_id>/process", methods=["POST"])
def process_furniture(furni_id: int):
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM auto_update_furniture WHERE id = %s", (furni_id,)
                )
                item = cur.fetchone()
    except Exception as exc:
        logger.error("process_furniture DB lookup: %s", exc)
        return jsonify({"error": "Internal server error"}), 500

    if not item:
        return jsonify({"error": "Furniture not found"}), 404
    if item["status"] not in ("pending", "error"):
        return jsonify({"error": f"Furniture status is '{item['status']}', cannot process"}), 400

    _update_furni_status(furni_id, "processing")

    def _do():
        success, err = converter.process_furniture(
            item["class_name"], item.get("download_url")
        )
        if not success:
            _update_furni_status(furni_id, "error", error_message=err)
            add_log("furniture", f"Furniture '{item['class_name']}' error: {err}")
        else:
            _update_furni_status(furni_id, "done")
            add_log("furniture", f"Furniture '{item['class_name']}' done")

    Thread(target=_do, daemon=True).start()
    return jsonify({"status": "processing", "message": "Processing started"})


_FURNI_STATUS_ALLOWED_KEYS = frozenset({"status", "updated_at", "error_message"})

def _update_furni_status(furni_id, status, error_message=None):
    data = {"status": status, "updated_at": int(time.time())}
    if error_message is not None:
        data["error_message"] = error_message
    assert set(data).issubset(_FURNI_STATUS_ALLOWED_KEYS), "Unexpected column name"
    set_clause = ", ".join(f"`{k}` = %s" for k in data)
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE auto_update_furniture SET {set_clause} WHERE id = %s",
                    list(data.values()) + [furni_id],
                )
    except Exception as exc:
        logger.error("_update_furni_status: %s", exc)


# --- Effects ---

@app.route("/api/effects", methods=["GET"])
def list_effects():
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 50))
    offset = (page - 1) * per_page
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM auto_update_effects ORDER BY id DESC LIMIT %s OFFSET %s",
                    (per_page, offset),
                )
                rows = cur.fetchall()
                cur.execute("SELECT COUNT(*) AS total FROM auto_update_effects")
                total = cur.fetchone()["total"]
        return jsonify({"items": rows, "total": total})
    except Exception as exc:
        logger.error("list_effects: %s", exc)
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/effects/<int:effect_id>/process", methods=["POST"])
def process_effect(effect_id: int):
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM auto_update_effects WHERE id = %s", (effect_id,)
                )
                item = cur.fetchone()
    except Exception as exc:
        logger.error("process_effect DB lookup: %s", exc)
        return jsonify({"error": "Internal server error"}), 500

    if not item:
        return jsonify({"error": "Effect not found"}), 404
    if item["status"] not in ("pending", "error"):
        return jsonify({"error": f"Effect status is '{item['status']}', cannot process"}), 400

    _update_effect_status(effect_id, "processing")

    def _do():
        success, err = converter.process_effect(
            item["effect_name"], item.get("download_url")
        )
        if not success:
            _update_effect_status(effect_id, "error", error_message=err)
            add_log("effects", f"Effect '{item['effect_name']}' error: {err}")
        else:
            _update_effect_status(effect_id, "done")
            add_log("effects", f"Effect '{item['effect_name']}' done")

    Thread(target=_do, daemon=True).start()
    return jsonify({"status": "processing", "message": "Processing started"})


_EFFECT_STATUS_ALLOWED_KEYS = frozenset({"status", "updated_at", "error_message"})

def _update_effect_status(effect_id, status, error_message=None):
    data = {"status": status, "updated_at": int(time.time())}
    if error_message is not None:
        data["error_message"] = error_message
    assert set(data).issubset(_EFFECT_STATUS_ALLOWED_KEYS), "Unexpected column name"
    set_clause = ", ".join(f"`{k}` = %s" for k in data)
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE auto_update_effects SET {set_clause} WHERE id = %s",
                    list(data.values()) + [effect_id],
                )
    except Exception as exc:
        logger.error("_update_effect_status: %s", exc)


# --- Logs ---

@app.route("/api/logs", methods=["GET"])
def list_logs():
    limit = int(request.args.get("limit", 200))
    category = request.args.get("category")
    log_date = request.args.get("date")
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                query = "SELECT * FROM auto_update_logs"
                params = []
                conditions = []
                if category:
                    conditions.append("category = %s")
                    params.append(category)
                if log_date:
                    conditions.append("log_date = %s")
                    params.append(log_date)
                if conditions:
                    query += " WHERE " + " AND ".join(conditions)
                query += " ORDER BY id DESC LIMIT %s"
                params.append(limit)
                cur.execute(query, params)
                rows = cur.fetchall()
        return jsonify({"logs": rows})
    except Exception as exc:
        logger.error("list_logs: %s", exc)
        return jsonify({"error": "Internal server error"}), 500


# ---------------------------------------------------------------------------
# Scheduler
# ---------------------------------------------------------------------------

def start_scheduler():
    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(
        daily_scrape,
        trigger="cron",
        hour=SCRAPE_HOUR,
        minute=0,
        id="daily_scrape",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started – daily scrape at %02d:00 UTC", SCRAPE_HOUR)
    return scheduler


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    start_scheduler()

    logger.info("Auto-updater HTTP API starting on port %d", PORT)
    app.run(host="0.0.0.0", port=PORT, threaded=True)
