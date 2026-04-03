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


def _extract_content_between(start_heading, next_heading, heading_ids: set) -> str:
    """Extract all text content between two headings."""
    parts = []
    seen_ids = set()

    current = start_heading
    while True:
        current = current.next_element
        if current is None:
            break
        if current == next_heading:
            break
        if isinstance(current, Tag) and current != start_heading:
            if current.name in HEADING_TAGS:
                break
            if id(current) in heading_ids:
                break

        if not isinstance(current, Tag):
            continue

        el_id = id(current)
        if el_id in seen_ids:
            continue

        if current.name == "table":
            parts.append(_table_to_text(current))
            for desc in current.descendants:
                seen_ids.add(id(desc))

        elif current.name in BLOCK_TAGS:
            text = current.get_text(separator=" ", strip=True)
            if text:
                parts.append(text)
            for desc in current.descendants:
                seen_ids.add(id(desc))

    return "\n\n".join(parts)


def parse_xhtml_sections(xhtml_content: str) -> list[dict]:
    """Parse XHTML content into sections.

    First tries semantic h1-h6 tags. Falls back to <p class="titre"> for
    documents like LVMH that use CSS classes instead of heading tags.
    """
    soup = BeautifulSoup(xhtml_content, "lxml")
    body = soup.find("body")
    if not body:
        return []

    all_headings = body.find_all(HEADING_TAGS)
    css_depth_map: dict[int, int] = {}

    # Fallback: CSS class-based headings (e.g. LVMH uses <p class="titre">)
    if not all_headings:
        all_headings = body.find_all("p", class_=lambda c: c and "titre" in c)
        for tag in all_headings:
            classes = tag.get("class", [])
            if "sommaire" in classes or "button" in classes:
                css_depth_map[id(tag)] = 1
            elif classes == ["titre"]:
                css_depth_map[id(tag)] = 2
            else:
                css_depth_map[id(tag)] = 3

    if not all_headings:
        return []

    heading_ids = {id(h) for h in all_headings}

    sections = []
    for i, heading_tag in enumerate(all_headings):
        heading_text = heading_tag.get_text(separator=" ", strip=True)
        if not heading_text:
            continue

        depth = css_depth_map.get(id(heading_tag)) or HEADING_DEPTH.get(heading_tag.name, 1)
        next_heading = all_headings[i + 1] if i + 1 < len(all_headings) else None

        content = _extract_content_between(heading_tag, next_heading, heading_ids)

        if len(content) < 10 and depth > 3:
            continue

        sections.append({
            "heading": heading_text,
            "depth": depth,
            "content": content,
            "order_index": len(sections),
        })

    return sections
