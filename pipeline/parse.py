import warnings
from bs4 import BeautifulSoup, Tag, NavigableString

warnings.filterwarnings("ignore", category=UserWarning, message=".*XMLParsedAsHTMLWarning.*")

HEADING_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6"}
HEADING_DEPTH = {"h1": 1, "h2": 2, "h3": 3, "h4": 4, "h5": 5, "h6": 6}

# Block-level elements that contain readable text
BLOCK_TAGS = {"p", "li", "blockquote", "figcaption", "caption"}


def _table_to_text(table: Tag) -> str:
    """Convert an HTML table to readable text."""
    rows = []
    for tr in table.find_all("tr"):
        cells = [td.get_text(separator=" ", strip=True) for td in tr.find_all(["td", "th"])]
        if any(cells):
            rows.append(" | ".join(cells))
    return "\n".join(rows)


def _extract_content_between(start_heading, next_heading, soup) -> str:
    """Extract all text content between two headings.

    Uses get_text() on block-level elements (p, li, table) which correctly
    handles all inline tags (span, a, ix:nonFraction, etc.).
    """
    parts = []
    seen_ids = set()

    current = start_heading
    while True:
        current = current.next_element
        if current is None:
            break
        # Stop at the next heading
        if current == next_heading:
            break
        if isinstance(current, Tag) and current.name in HEADING_TAGS and current != start_heading:
            break

        if not isinstance(current, Tag):
            continue

        # Skip already-processed elements (children of a block we already handled)
        el_id = id(current)
        if el_id in seen_ids:
            continue

        if current.name == "table":
            parts.append(_table_to_text(current))
            # Mark all descendants as seen
            for desc in current.descendants:
                seen_ids.add(id(desc))

        elif current.name in BLOCK_TAGS:
            # Use get_text() which correctly handles span, a, ix:*, etc.
            text = current.get_text(separator=" ", strip=True)
            if text:
                parts.append(text)
            # Mark all descendants as seen
            for desc in current.descendants:
                seen_ids.add(id(desc))

    return "\n\n".join(parts)


def parse_xhtml_sections(xhtml_content: str) -> list[dict]:
    """Parse XHTML content into a list of sections.

    Finds ALL heading tags (h1-h6) anywhere in the document, not just direct
    children of <body>. This handles real ESEF XHTML where headings are nested
    inside multiple layers of <div> elements.

    Uses get_text() on block elements (p, li, table) to correctly extract text
    from inline tags (span, a, ix:nonFraction, ix:nonNumeric, etc.).

    Each section has: heading, depth, content, order_index.
    """
    soup = BeautifulSoup(xhtml_content, "lxml")
    body = soup.find("body")
    if not body:
        return []

    # Find ALL headings in document order
    all_headings = body.find_all(HEADING_TAGS)

    if not all_headings:
        return []

    sections = []
    for i, heading_tag in enumerate(all_headings):
        heading_text = heading_tag.get_text(separator=" ", strip=True)
        if not heading_text:
            continue

        depth = HEADING_DEPTH.get(heading_tag.name, 1)

        # Next heading (or None if last)
        next_heading = all_headings[i + 1] if i + 1 < len(all_headings) else None

        content = _extract_content_between(heading_tag, next_heading, soup)

        # Skip empty sections and very short ones (likely decorative)
        if len(content) < 10 and depth > 3:
            continue

        sections.append({
            "heading": heading_text,
            "depth": depth,
            "content": content,
            "order_index": len(sections),
        })

    return sections
