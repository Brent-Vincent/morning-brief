#!/usr/bin/env python3
"""Collect news headlines from a user-editable set of RSS/Atom feeds.

Zero third-party packages. For scheduled use via GitHub Actions or locally:
    python3 scripts/update_news.py
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import hashlib
import html
import json
from pathlib import Path
import re
import sys
import time
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ATOM_NS = "{http://www.w3.org/2005/Atom}"
TAG_PATTERN = re.compile(r"<[^>]*>")
WHITESPACE = re.compile(r"\s+")


def clean_text(raw: str | None) -> str:
    text = html.unescape(TAG_PATTERN.sub("", raw or ""))
    return WHITESPACE.sub(" ", text).strip()


def parse_date(raw: str | None) -> str:
    if not raw:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    try:
        parsed = parsedate_to_datetime(raw)
    except (TypeError, ValueError, IndexError):
        try:
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            parsed = datetime.now(timezone.utc)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def safe_url(raw: str | None) -> str | None:
    value = (raw or "").strip()
    parsed = urlparse(value)
    if parsed.scheme not in ("https", "http") or not parsed.netloc:
        return None
    return value


def article_id(title: str, source: str) -> str:
    """Stable enough for user feedback across daily refreshes."""
    basis = WHITESPACE.sub(" ", title.casefold()).strip() + "|" + source.casefold()
    return hashlib.sha256(basis.encode("utf-8")).hexdigest()[:18]


def parse_rss_or_atom(document: bytes, *, feed_name: str, topic: str) -> list[dict]:
    root = ET.fromstring(document)
    results: list[dict] = []
    is_atom = root.tag == ATOM_NS + "feed"
    entries = root.findall(f"{ATOM_NS}entry") if is_atom else root.findall("./channel/item")

    for item in entries:
        if is_atom:
            title = clean_text(item.findtext(ATOM_NS + "title"))
            atom_link = item.find(ATOM_NS + "link[@rel='alternate']")
            if atom_link is None:
                atom_link = item.find(ATOM_NS + "link")
            link = atom_link.get("href", "") if atom_link is not None else ""
            raw_date = item.findtext(ATOM_NS + "published") or item.findtext(ATOM_NS + "updated")
            source = feed_name
        else:
            title = clean_text(item.findtext("title"))
            link = item.findtext("link", "").strip()
            raw_date = item.findtext("pubDate") or item.findtext("{http://purl.org/dc/elements/1.1/}date")
            # Google News RSS uses a <source> element for the original publisher.
            source = clean_text(item.findtext("source")) or feed_name

        link = safe_url(link)
        if not title or not link:
            continue
        if feed_name.startswith("Google News:") and source and title.endswith(" - " + source):
            title = title[: -len(source) - 3]
        if len(title) > 300:
            title = title[:297] + "..."
        results.append({
            "id": article_id(title, source),
            "title": title,
            "url": link,
            "source": source[:100],
            "topic": topic,
            "published": parse_date(raw_date),
        })
    return results


def get_feed(feed: dict, max_items: int, timeout: int = 14) -> list[dict]:
    url = safe_url(feed.get("url"))
    if url is None:
        raise ValueError("invalid feed URL")
    request = Request(url, headers={
        "User-Agent": "Mozilla/5.0 (compatible; PersonalMorningBrief/1.0; RSS reader)",
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    })
    with urlopen(request, timeout=timeout) as response:
        # Basic limit to avoid downloading an unexpectedly enormous feed.
        document = response.read(2_500_001)
    if len(document) > 2_500_000:
        raise ValueError("feed is unexpectedly large")
    return parse_rss_or_atom(document, feed_name=feed["name"], topic=feed["topic"])[:max_items]


def generate(config_path: Path, output_path: Path) -> dict:
    config = json.loads(config_path.read_text(encoding="utf-8"))
    max_per_feed = max(1, min(int(config.get("max_per_feed", 25)), 100))
    max_total = max(1, min(int(config.get("max_total", 250)), 1000))
    feeds = config.get("feeds", [])
    if not feeds:
        raise ValueError("No feeds configured")

    articles = []
    succeeded = 0
    for feed in feeds:
        name = feed.get("name", "unnamed")
        try:
            batch = get_feed(feed, max_per_feed)
            succeeded += 1
            articles.extend(batch)
            print(f"OK    {name}: {len(batch)} articles", flush=True)
        except (OSError, ValueError, ET.ParseError, KeyError, TimeoutError) as exc:
            print(f"WARN  {name}: {exc}", file=sys.stderr, flush=True)
        time.sleep(0.12)

    if not articles:
        raise RuntimeError("No live articles collected; refusing to replace existing data.")

    # Prefer the newest copy of duplicates across multiple feeds.
    articles.sort(key=lambda article: article["published"], reverse=True)
    distinct = {}
    for article in articles:
        normalized_title = re.sub(r"[^a-z0-9]+", "", article["title"].casefold())
        key = normalized_title or article["id"]
        if key not in distinct:
            distinct[key] = article
        if len(distinct) >= max_total:
            break

    result = {
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "demo": False,
        "feed_count": succeeded,
        "articles": list(distinct.values()),
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = output_path.with_suffix(".tmp")
    temp_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp_path.replace(output_path)
    print(f"Saved {len(result['articles'])} unique articles to {output_path}")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch RSS headlines and write headlines.json")
    parser.add_argument("--config", type=Path, default=ROOT / "feeds.json")
    parser.add_argument("--output", type=Path, default=ROOT / "data" / "headlines.json")
    args = parser.parse_args()
    generate(args.config, args.output)


if __name__ == "__main__":
    main()
