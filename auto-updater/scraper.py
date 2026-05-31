"""
scraper.py – Scrapes habboassets.com for SWF packs, furniture and effects.

All methods return lists of dicts ready to be stored in the DB.
"""

from __future__ import annotations

import logging
import re
from typing import List, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

BASE_URL = "https://www.habboassets.com"
PACKS_URL = f"{BASE_URL}/swfs/packs"
FURNITURE_URL = f"{BASE_URL}/furniture"
EFFECTS_URL = f"{BASE_URL}/swfs/effects"

# Habbo Sandbox revision names contain "sandbox" (case-insensitive).
SANDBOX_PATTERN = re.compile(r"sandbox", re.IGNORECASE)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; NitroDocker-AutoUpdater/1.0; "
        "+https://github.com/MacLove13/Nitro-Docker)"
    )
}

SESSION = requests.Session()
SESSION.headers.update(HEADERS)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get(url: str, timeout: int = 30) -> Optional[BeautifulSoup]:
    """Perform a GET request and return a BeautifulSoup object, or None on failure."""
    try:
        resp = SESSION.get(url, timeout=timeout)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "lxml")
    except Exception as exc:
        logger.warning("GET %s failed: %s", url, exc)
        return None


def _get_json(url: str, timeout: int = 30) -> Optional[dict | list]:
    """Perform a GET request and return parsed JSON, or None on failure."""
    try:
        resp = SESSION.get(url, timeout=timeout)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        logger.warning("GET JSON %s failed: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# SWF Packs
# ---------------------------------------------------------------------------

def fetch_swf_packs() -> List[dict]:
    """
    Scrape the packs listing page and return a list of dicts:
      { revision_name, download_url }

    Only COM-hotel revisions are returned (sandbox revisions are skipped).
    """
    soup = _get(PACKS_URL)
    if soup is None:
        return []

    results: List[dict] = []

    # habboassets.com renders packs as table rows or list items.
    # Try common patterns: <tr> with a link, or <li> with a link.
    rows = soup.select("table tbody tr") or soup.select("ul li")

    for row in rows:
        link = row.find("a", href=True)
        if link is None:
            continue

        revision_name = link.get_text(strip=True)
        if not revision_name:
            # Fall back to any text in the row
            revision_name = row.get_text(separator=" ", strip=True).split()[0] if row.get_text(strip=True) else ""

        if not revision_name:
            continue

        # Skip sandbox
        if SANDBOX_PATTERN.search(revision_name):
            logger.debug("Skipping sandbox revision: %s", revision_name)
            continue

        href = link["href"]
        download_url = urljoin(BASE_URL, href) if not href.startswith("http") else href

        results.append(
            {
                "revision_name": revision_name,
                "download_url": download_url,
            }
        )

    if not results:
        # Fallback: look for any link that looks like a pack
        for link in soup.find_all("a", href=True):
            text = link.get_text(strip=True)
            href = link["href"]
            if not text or not href:
                continue
            # Pack URLs usually contain "swfs" and are not navigation links
            if "swf" not in href.lower() and "pack" not in href.lower() and "revision" not in href.lower():
                continue
            if SANDBOX_PATTERN.search(text):
                continue
            download_url = urljoin(BASE_URL, href) if not href.startswith("http") else href
            results.append({"revision_name": text, "download_url": download_url})

    logger.info("fetch_swf_packs: found %d COM revisions", len(results))
    return results


# ---------------------------------------------------------------------------
# Furniture
# ---------------------------------------------------------------------------

def fetch_furniture(stop_at_id: Optional[str] = None) -> List[dict]:
    """
    Scrape the furniture listing page.

    If stop_at_id is set, iteration stops as soon as an item with that
    furniture_id is encountered (the item itself is not included), since all
    items after it are already known.

    Returns a list of dicts:
      { furniture_id, class_name, revision, download_url, sql_insert, xml_data }
    """
    soup = _get(FURNITURE_URL)
    if soup is None:
        return []

    results: List[dict] = []
    stop_reached = False

    # Each furniture item is typically in a <div> or <tr> with data attributes
    # or in a structured table. Try several selectors.
    items = (
        soup.select("[data-furniture-id]")
        or soup.select("table tbody tr")
        or soup.select(".furniture-item")
        or soup.select(".item-row")
    )

    for item in items:
        furni_id = (
            item.get("data-furniture-id")
            or item.get("data-id")
            or _extract_id_from_row(item)
        )

        if not furni_id:
            continue

        if stop_at_id and str(furni_id) == str(stop_at_id):
            stop_reached = True
            break

        class_name = (
            item.get("data-class-name")
            or item.get("data-classname")
            or _text_of(item, ".class-name")
            or str(furni_id)
        )

        revision_str = item.get("data-revision") or _text_of(item, ".revision") or "0"
        try:
            revision = int(revision_str)
        except ValueError:
            revision = 0

        download_url = _find_download_url(item, BASE_URL)
        sql_insert = _find_sql_insert(item)
        xml_data = _find_xml_data(item)

        # Skip sandbox items
        if SANDBOX_PATTERN.search(class_name):
            continue

        results.append(
            {
                "furniture_id": str(furni_id),
                "class_name": class_name,
                "revision": revision,
                "download_url": download_url,
                "sql_insert": sql_insert,
                "xml_data": xml_data,
            }
        )

    if stop_reached:
        logger.info(
            "fetch_furniture: stopped at cursor %s, returning %d new items",
            stop_at_id,
            len(results),
        )
    else:
        logger.info("fetch_furniture: found %d items", len(results))

    return results


# ---------------------------------------------------------------------------
# Effects
# ---------------------------------------------------------------------------

def fetch_effects(stop_at_id: Optional[str] = None) -> List[dict]:
    """
    Scrape the effects listing page.

    Returns a list of dicts:
      { effect_name, revision, download_url }
    """
    soup = _get(EFFECTS_URL)
    if soup is None:
        return []

    results: List[dict] = []
    stop_reached = False

    rows = soup.select("table tbody tr") or soup.select("ul li")

    for row in rows:
        effect_name = (
            row.get("data-effect-name")
            or row.get("data-name")
            or _text_of(row, ".effect-name")
        )
        if not effect_name:
            link = row.find("a")
            effect_name = link.get_text(strip=True) if link else row.get_text(strip=True).split()[0]

        if not effect_name:
            continue

        if stop_at_id and str(effect_name) == str(stop_at_id):
            stop_reached = True
            break

        revision_str = row.get("data-revision") or _text_of(row, ".revision") or "0"
        try:
            revision = int(revision_str)
        except ValueError:
            revision = 0

        download_url = _find_download_url(row, BASE_URL)

        results.append(
            {
                "effect_name": effect_name,
                "revision": revision,
                "download_url": download_url,
            }
        )

    if stop_reached:
        logger.info(
            "fetch_effects: stopped at cursor %s, returning %d new items",
            stop_at_id,
            len(results),
        )
    else:
        logger.info("fetch_effects: found %d effects", len(results))

    return results


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _extract_id_from_row(tag) -> Optional[str]:
    """Try to extract an ID from common HTML patterns in a table row."""
    td = tag.find("td")
    if td:
        text = td.get_text(strip=True)
        if text.isdigit():
            return text
    for attr in ("id", "data-id", "data-key"):
        val = tag.get(attr)
        if val:
            return val
    return None


def _text_of(tag, selector: str) -> Optional[str]:
    el = tag.select_one(selector)
    if el:
        return el.get_text(strip=True) or None
    return None


def _find_download_url(tag, base: str) -> Optional[str]:
    """Find a download link in a tag."""
    for link in tag.find_all("a", href=True):
        href = link["href"]
        text = link.get_text(strip=True).lower()
        if "download" in text or href.endswith(".swf") or href.endswith(".zip") or "download" in href.lower():
            return urljoin(base, href) if not href.startswith("http") else href
    return None


def _find_sql_insert(tag) -> Optional[str]:
    """Find a SQL INSERT statement embedded in the page (usually in a <code> or <pre> block)."""
    for block in tag.find_all(["code", "pre", "textarea"]):
        text = block.get_text()
        if "INSERT INTO" in text.upper():
            return text.strip()
    # Also check for a dedicated SQL element
    el = tag.select_one(".sql-insert, [data-sql], .furniture-sql")
    if el:
        return el.get_text(strip=True) or None
    return None


def _find_xml_data(tag) -> Optional[str]:
    """Find embedded XML data in the page."""
    for block in tag.find_all(["code", "pre", "textarea"]):
        text = block.get_text(strip=True)
        if text.startswith("<") and ("furnitype" in text.lower() or "<furniture" in text.lower()):
            return text
    el = tag.select_one(".xml-data, [data-xml], .furniture-xml")
    if el:
        return el.get_text(strip=True) or None
    return None
