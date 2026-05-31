"""
Furni Generator Service
=======================
Polls the `furnis_custom` database table for items with status 'processing',
generates Nitro asset bundles from the uploaded PNG/GIF images, and updates
each item's status to 'pending' once the assets are ready.

It also exposes a minimal HTTP API used by the CMS housekeeping page to
trigger immediate processing and retrieve item status.
"""

import io
import json
import logging
import os
import struct
import time
import zipfile
from threading import Thread

import pymysql
from flask import Flask, jsonify, request
from generator import NitroGenerator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Configuration (supplied via environment variables / docker-compose)
# ---------------------------------------------------------------------------

DB_HOST = os.getenv("DB_HOST", "mysql")
DB_PORT = int(os.getenv("DB_PORT", 3306))
DB_NAME = os.getenv("DB_NAME", "arcturus")
DB_USER = os.getenv("DB_USER", "arcturus_user")
DB_PASS = os.getenv("DB_PASS", "arcturus_pw")

# Shared volume paths
UPLOADS_DIR = os.getenv("UPLOADS_DIR", "/uploads")
NITRO_ASSETS_DIR = os.getenv("NITRO_ASSETS_DIR", "/nitro-assets")
SWF_DIR = os.getenv("SWF_DIR", "/nitro-swf")

# sprite_id = SPRITE_ID_OFFSET + job_id  (avoids collisions with base furni)
SPRITE_ID_OFFSET = int(os.getenv("SPRITE_ID_OFFSET", 10000))

# Directory inside nitro-assets where custom furni .nitro files are stored
CUSTOM_FURNI_SUBDIR = "hof_furni/custom"

POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", 5))  # seconds


# ---------------------------------------------------------------------------
# Database helpers
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


def fetch_pending_jobs():
    """Return all furnis_custom rows with status='processing'."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM furnis_custom WHERE status = 'processing' ORDER BY id ASC"
            )
            return cur.fetchall()


def update_job(job_id: int, data: dict):
    """Update a furnis_custom row."""
    if not data:
        return
    set_clause = ", ".join(f"`{k}` = %s" for k in data)
    values = list(data.values()) + [job_id]
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE furnis_custom SET {set_clause} WHERE id = %s",
                values,
            )


# ---------------------------------------------------------------------------
# Background processing loop
# ---------------------------------------------------------------------------

def processing_loop():
    logger.info("Furni generator polling loop started (interval=%ds)", POLL_INTERVAL)
    while True:
        try:
            jobs = fetch_pending_jobs()
            for job in jobs:
                try:
                    process_job(job)
                except Exception as exc:
                    logger.exception("Error processing job %s: %s", job["id"], exc)
        except Exception as exc:
            logger.warning("DB error in polling loop: %s", exc)
        time.sleep(POLL_INTERVAL)


def process_job(job: dict):
    job_id = job["id"]
    logger.info("Processing furni job id=%s public_name=%s", job_id, job["public_name"])

    upload_dir = os.path.join(UPLOADS_DIR, str(job_id))
    images_meta = json.loads(job["images"] or "{}")

    # Generate unique item_name and sprite_id from the job id
    item_name = f"custom_furni_{job_id}"
    sprite_id = SPRITE_ID_OFFSET + job_id

    gen = NitroGenerator(
        item_name=item_name,
        sprite_id=sprite_id,
        job=job,
        upload_dir=upload_dir,
        images_meta=images_meta,
    )

    nitro_data = gen.build_nitro()

    # Write .nitro file to shared nitro-assets volume
    nitro_subdir = os.path.join(NITRO_ASSETS_DIR, CUSTOM_FURNI_SUBDIR)
    os.makedirs(nitro_subdir, exist_ok=True)
    nitro_filename = f"{item_name}.nitro"
    nitro_path = os.path.join(nitro_subdir, nitro_filename)
    with open(nitro_path, "wb") as fh:
        fh.write(nitro_data)

    relative_nitro = f"{CUSTOM_FURNI_SUBDIR}/{nitro_filename}"
    logger.info("Written nitro asset: %s", nitro_path)

    update_job(job_id, {
        "item_name": item_name,
        "sprite_id": sprite_id,
        "nitro_file": relative_nitro,
        "status": "pending",
    })
    logger.info("Job id=%s updated to 'pending'", job_id)


# ---------------------------------------------------------------------------
# HTTP API
# ---------------------------------------------------------------------------

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/api/process/<int:job_id>", methods=["POST"])
def trigger_job(job_id: int):
    """Immediately trigger processing of a specific job."""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM furnis_custom WHERE id = %s AND status = 'processing'",
                    (job_id,),
                )
                job = cur.fetchone()
    except Exception as exc:
        logger.exception("DB error fetching job %s", job_id)
        return jsonify({"status": "error", "message": "Database error"}), 500

    if not job:
        return jsonify({"status": "error", "message": "Job not found or not in processing state"}), 404

    try:
        process_job(job)
    except Exception as exc:
        logger.exception("Manual trigger failed for job %s", job_id)
        return jsonify({"status": "error", "message": "Processing failed"}), 500

    return jsonify({"status": "success", "message": "Job processed"})


@app.route("/api/status/<int:job_id>", methods=["GET"])
def job_status(job_id: int):
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, item_name, sprite_id, nitro_file, status FROM furnis_custom WHERE id = %s",
                    (job_id,),
                )
                row = cur.fetchone()
    except Exception as exc:
        logger.exception("DB error fetching status for job %s", job_id)
        return jsonify({"status": "error", "message": "Database error"}), 500

    if not row:
        return jsonify({"status": "error", "message": "Job not found"}), 404

    return jsonify(row)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    bg = Thread(target=processing_loop, daemon=True)
    bg.start()

    port = int(os.getenv("PORT", 5000))
    logger.info("Furni generator HTTP API listening on port %d", port)
    app.run(host="0.0.0.0", port=port)
