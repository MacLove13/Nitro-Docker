"""
converter.py – Downloads SWF files and triggers their conversion to .nitro
format by executing the nitro-converter inside the `nitro` Docker container.

The auto-updater container has read-write access to the same volumes as the
nitro container (nitro-swf and nitro-assets).  After placing SWF files in the
correct sub-directory of nitro-swf the converter is triggered via
``docker exec``.
"""

from __future__ import annotations

import logging
import os
import re
import time
import zipfile
from pathlib import Path
from typing import List, Optional, Tuple

import docker
import requests

logger = logging.getLogger(__name__)

NITRO_CONTAINER_NAME = os.getenv("NITRO_CONTAINER_NAME", "nitro")
NITRO_SWF_DIR = os.getenv("NITRO_SWF_DIR", "/nitro-swf")
NITRO_ASSETS_DIR = os.getenv("NITRO_ASSETS_DIR", "/nitro-assets")

FURNITURE_SWF_SUBDIR = "dcr/hof_furni"
EFFECTS_SWF_SUBDIR = "gordon/PRODUCTION"
PACKS_SWF_SUBDIR = "gordon/PRODUCTION"

FURNITURE_ASSET_SUBDIR = "bundled/furniture"
EFFECT_ASSET_SUBDIR = "bundled/effect"

DOWNLOAD_TIMEOUT = int(os.getenv("DOWNLOAD_TIMEOUT", 120))
CONVERT_TIMEOUT = int(os.getenv("CONVERT_TIMEOUT", 600))

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; NitroDocker-AutoUpdater/1.0; "
        "+https://github.com/MacLove13/Nitro-Docker)"
    )
}


# ---------------------------------------------------------------------------
# Docker client (lazy-initialised)
# ---------------------------------------------------------------------------

_docker_client: Optional[docker.DockerClient] = None


def _get_docker() -> docker.DockerClient:
    global _docker_client
    if _docker_client is None:
        _docker_client = docker.from_env()
    return _docker_client


# ---------------------------------------------------------------------------
# Download helpers
# ---------------------------------------------------------------------------

def _download_file(url: str, dest: Path) -> bool:
    """Download *url* to *dest*.  Returns True on success."""
    try:
        with requests.get(url, headers=HEADERS, stream=True, timeout=DOWNLOAD_TIMEOUT) as resp:
            resp.raise_for_status()
            dest.parent.mkdir(parents=True, exist_ok=True)
            with open(dest, "wb") as fh:
                for chunk in resp.iter_content(chunk_size=65536):
                    fh.write(chunk)
        logger.info("Downloaded %s → %s", url, dest)
        return True
    except Exception as exc:
        logger.error("Download failed %s: %s", url, exc)
        return False


def _extract_zip(zip_path: Path, dest_dir: Path) -> List[str]:
    """Extract a ZIP archive and return a list of extracted filenames."""
    extracted: List[str] = []
    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(dest_dir)
            extracted = zf.namelist()
        logger.info("Extracted %d files from %s", len(extracted), zip_path)
    except zipfile.BadZipFile as exc:
        logger.error("Bad ZIP %s: %s", zip_path, exc)
    return extracted


# ---------------------------------------------------------------------------
# Nitro-converter trigger
# ---------------------------------------------------------------------------

def _trigger_conversion() -> Tuple[bool, str]:
    """
    Run the TypeScript nitro-converter inside the ``nitro`` Docker container.
    Returns (success, output_text).
    """
    cmd = (
        "bash -c '"
        "cp /app/configuration/nitro-converter/configuration.json "
        "/app/nitro-converter/src/configuration.json && "
        "cd /app/nitro-converter && "
        "yarn ts-node-dev --transpile-only src/Main.ts && "
        "rsync -r /app/nitro-converter/assets/ /app/nitro-assets/"
        "'"
    )
    try:
        client = _get_docker()
        container = client.containers.get(NITRO_CONTAINER_NAME)
        exit_code, output = container.exec_run(cmd, demux=False, tty=False)
        output_text = output.decode("utf-8", errors="replace") if output else ""
        if exit_code == 0:
            logger.info("nitro-converter finished successfully")
            return True, output_text
        else:
            logger.error("nitro-converter exited with code %d: %s", exit_code, output_text[-500:])
            return False, output_text[-1000:]
    except Exception as exc:
        logger.error("Failed to trigger nitro-converter: %s", exc)
        return False, str(exc)


# ---------------------------------------------------------------------------
# List already-converted files
# ---------------------------------------------------------------------------

def _list_nitro_files(subdir: str) -> set:
    """Return the set of .nitro stems already present in *subdir*."""
    path = Path(NITRO_ASSETS_DIR) / subdir
    if not path.exists():
        return set()
    return {f.stem for f in path.rglob("*.nitro")}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def process_swf_pack(revision_name: str, download_url: str) -> Tuple[int, str]:
    """
    1. Download the pack ZIP/SWF.
    2. Extract SWF files to the nitro-swf volume.
    3. Trigger conversion.
    4. Count newly-added .nitro files.

    Returns (files_added, error_message).
    """
    # Sanitize revision_name to prevent path traversal
    safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", revision_name)
    if not safe_name:
        return 0, "Invalid revision name"

    tmp_dir = Path(f"/tmp/pack_{safe_name}")
    tmp_dir.mkdir(parents=True, exist_ok=True)

    # Destination inside the shared volume
    swf_dest_dir = Path(NITRO_SWF_DIR) / PACKS_SWF_SUBDIR

    # 1. Download
    ext = ".zip" if download_url.endswith(".zip") else ".swf"
    tmp_file = tmp_dir / f"pack{ext}"
    if not _download_file(download_url, tmp_file):
        return 0, f"Download failed: {download_url}"

    # 2. Extract if ZIP; otherwise copy single SWF
    before_swfs = set()
    if ext == ".zip":
        files = _extract_zip(tmp_file, tmp_dir / "extracted")
        swf_files = [f for f in files if f.lower().endswith(".swf")]
        swf_dest_dir.mkdir(parents=True, exist_ok=True)
        for rel in swf_files:
            src = tmp_dir / "extracted" / rel
            dst = swf_dest_dir / Path(rel).name
            if src.exists():
                dst.parent.mkdir(parents=True, exist_ok=True)
                src.rename(dst)
    else:
        swf_dest_dir.mkdir(parents=True, exist_ok=True)
        tmp_file.rename(swf_dest_dir / f"{safe_name}.swf")

    # 3. Record which .nitro files exist before conversion
    before_furni = _list_nitro_files(FURNITURE_ASSET_SUBDIR)
    before_effect = _list_nitro_files(EFFECT_ASSET_SUBDIR)

    # 4. Trigger conversion
    success, output = _trigger_conversion()
    if not success:
        return 0, f"Conversion failed: {output[:500]}"

    # 5. Count new files
    after_furni = _list_nitro_files(FURNITURE_ASSET_SUBDIR)
    after_effect = _list_nitro_files(EFFECT_ASSET_SUBDIR)
    new_count = len(after_furni - before_furni) + len(after_effect - before_effect)

    return new_count, ""


def process_furniture(class_name: str, download_url: Optional[str]) -> Tuple[bool, str]:
    """
    Download a single furniture SWF, place it in the nitro-swf volume and
    trigger conversion.

    Returns (success, error_message).
    """
    if not download_url:
        return False, "No download URL provided"

    safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", class_name)
    if not safe_name:
        return False, "Invalid class name"

    swf_dest = Path(NITRO_SWF_DIR) / FURNITURE_SWF_SUBDIR / f"{safe_name}.swf"

    if not _download_file(download_url, swf_dest):
        return False, f"Download failed: {download_url}"

    success, output = _trigger_conversion()
    if not success:
        return False, f"Conversion failed: {output[:500]}"

    return True, ""


def process_effect(effect_name: str, download_url: Optional[str]) -> Tuple[bool, str]:
    """
    Download a single effect SWF, place it in the nitro-swf volume and
    trigger conversion.

    Returns (success, error_message).
    """
    if not download_url:
        return False, "No download URL provided"

    safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", effect_name)
    if not safe_name:
        return False, "Invalid effect name"

    swf_dest = Path(NITRO_SWF_DIR) / EFFECTS_SWF_SUBDIR / f"{safe_name}.swf"

    if not _download_file(download_url, swf_dest):
        return False, f"Download failed: {download_url}"

    success, output = _trigger_conversion()
    if not success:
        return False, f"Conversion failed: {output[:500]}"

    return True, ""
