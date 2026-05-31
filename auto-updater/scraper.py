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

_FURNI_ID_RE = re.compile(r"/furniture/(\d+)")
_FURNI_CLASSNAME_RE = re.compile(r"^(.*?)\s+(?:name|desc)$", re.IGNORECASE)


def _parse_furniture_listing(soup: BeautifulSoup) -> List[dict]:
    """
    Extract furniture items from a listing page soup.
    Returns list of {furniture_id, class_name, icon_url}.
    """
    items = []
    for link in soup.find_all("a", attrs={"x-on:click.prevent": True}):
        onclick = link.get("x-on:click.prevent", "")
        m = _FURNI_ID_RE.search(onclick)
        if not m:
            continue
        furni_id = m.group(1)

        # class_name from img alt, e.g. "nft_h26_haf_junglesantini name" → strip suffix
        img = link.find("img")
        class_name = furni_id
        if img:
            alt = img.get("alt", "")
            cm = _FURNI_CLASSNAME_RE.match(alt)
            if cm:
                class_name = cm.group(1)
            elif alt:
                class_name = alt

        # Skip sandbox items
        if SANDBOX_PATTERN.search(class_name):
            logger.debug("Skipping sandbox furniture: %s", class_name)
            continue

        items.append({"furniture_id": furni_id, "class_name": class_name})

    return items


def _fetch_furniture_detail(furni_id: str) -> dict:
    """
    Fetch the detail page for a single furniture item and extract
    SQL, XML, revision and download_url.
    Returns a dict with those fields (may be None if not found).
    """
    url = f"{BASE_URL}/furniture/{furni_id}"
    soup = _get(url)
    if soup is None:
        return {}

    # Download SWF link
    download_url = None
    for a in soup.find_all("a", href=True):
        href = a["href"]
        txt = a.get_text(strip=True).lower()
        if "download" in txt or "swf" in txt or href.endswith(".swf") or href.endswith(".zip"):
            download_url = href if href.startswith("http") else urljoin(BASE_URL, href)
            break

    # SQL INSERT
    sql_insert = None
    for code in soup.find_all("code", class_="language-sql"):
        sql_insert = code.get_text(strip=True)
        break

    # XML
    xml_data = None
    revision = 0
    for code in soup.find_all("code", class_="language-xml"):
        xml_data = code.get_text(strip=True)
        # Extract revision from XML
        rev_m = re.search(r"<revision>(\d+)</revision>", xml_data)
        if rev_m:
            revision = int(rev_m.group(1))
        break

    return {
        "download_url": download_url,
        "sql_insert": sql_insert,
        "xml_data": xml_data,
        "revision": revision,
    }


def fetch_furniture(stop_at_id: Optional[str] = None) -> List[dict]:
    """
    Scrape all furniture listing pages, paginating until stop_at_id is found
    or there are no more pages.

    If stop_at_id is set, iteration stops as soon as an item with that
    furniture_id is encountered (the item itself is not included).

    For each new item, also fetches the detail page for SQL/XML/revision/download_url.

    Returns a list of dicts:
      { furniture_id, class_name, revision, download_url, sql_insert, xml_data }
    """
    results: List[dict] = []
    stop_reached = False
    page = 1

    while True:
        url = f"{FURNITURE_URL}?page={page}"
        soup = _get(url)
        if soup is None:
            logger.warning("fetch_furniture: failed to load page %d, stopping", page)
            break

        page_items = _parse_furniture_listing(soup)

        if not page_items:
            logger.info("fetch_furniture: no items on page %d, stopping", page)
            break

        for item in page_items:
            if stop_at_id and str(item["furniture_id"]) == str(stop_at_id):
                stop_reached = True
                break

            detail = _fetch_furniture_detail(item["furniture_id"])
            item.update(detail)
            results.append(item)

        if stop_reached:
            break

        # Check if there is a next page button
        next_btn = soup.find(attrs={"wire:click": lambda v: v and "nextPage" in v})
        has_next = next_btn is not None and not next_btn.get("disabled")
        if not has_next:
            break

        page += 1
        # Be polite
        import time as _time
        _time.sleep(0.5)

    if stop_reached:
        logger.info(
            "fetch_furniture: stopped at cursor %s after %d pages, returning %d new items",
            stop_at_id, page, len(results),
        )
    else:
        logger.info("fetch_furniture: scraped %d pages, found %d items total", page, len(results))

    return results


# ---------------------------------------------------------------------------
# Effects
# ---------------------------------------------------------------------------

_EFFECT_ID_RE = re.compile(r"/swfs/effects/(\d+)")
_PACK_REVISION_RE = re.compile(r"PRODUCTION-(\d+)-")


def fetch_effects(stop_at_id: Optional[str] = None) -> List[dict]:
    """
    Scrape the effects listing page.

    The page renders a plain HTML table (no pagination needed — all effects
    are on a single page).  Each row contains:
      col 0 – effect filename  (e.g. "DuckGod.swf")
      col 1 – pack/revision   (e.g. "flash-assets-PRODUCTION-202604231443-…")
      col 2 – download link   (e.g. https://habboassets.com/swfs/effects/5767)

    If stop_at_id is set, stops when an effect_id matching it is found.

    Returns a list of dicts:
      { effect_id, effect_name, revision, download_url }
    """
    soup = _get(EFFECTS_URL)
    if soup is None:
        return []

    results: List[dict] = []
    stop_reached = False

    rows = soup.select("table tbody tr")

    for row in rows:
        tds = row.find_all("td")
        if len(tds) < 3:
            continue

        # Effect name from first TD (strip ".swf" suffix)
        raw_name = tds[0].get_text(strip=True)
        effect_name = re.sub(r"\.swf$", "", raw_name, flags=re.IGNORECASE)
        if not effect_name:
            continue

        # Download link & effect_id from third TD
        link = tds[2].find("a", href=True)
        if not link:
            continue
        href = link["href"]
        id_m = _EFFECT_ID_RE.search(href)
        if not id_m:
            continue
        effect_id = id_m.group(1)
        download_url = href if href.startswith("http") else urljoin(BASE_URL, href)

        if stop_at_id and str(effect_id) == str(stop_at_id):
            stop_reached = True
            break

        # Revision from second TD pack string
        pack_str = tds[1].get_text(strip=True)
        rev_m = _PACK_REVISION_RE.search(pack_str)
        revision = int(rev_m.group(1)) if rev_m else 0

        results.append(
            {
                "effect_id": effect_id,
                "effect_name": effect_name,
                "revision": revision,
                "download_url": download_url,
            }
        )

    if stop_reached:
        logger.info(
            "fetch_effects: stopped at cursor %s, returning %d new items",
            stop_at_id, len(results),
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
