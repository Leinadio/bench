import warnings
from bs4 import BeautifulSoup, Tag, NavigableString

warnings.filterwarnings("ignore", category=UserWarning, message=".*XMLParsedAsHTMLWarning.*")

HEADING_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6"}
HEADING_DEPTH = {"h1": 1, "h2": 2, "h3": 3, "h4": 4, "h5": 5, "h6": 6}


def _table_to_text(table: Tag) -> str:
    """Convert an HTML table to readable text."""
    rows = []
    for tr in table.find_all("tr"):
        cells = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
        if any(cells):
            rows.append(" | ".join(cells))
    return "\n".join(rows)


def _collect_text_until_next_heading(start_element) -> str:
    """Collect all text content between a heading and the next heading of same or higher level."""
    parts = []
    sibling = start_element.next_sibling
    while sibling:
        if isinstance(sibling, Tag):
            if sibling.name in HEADING_TAGS:
                break
            # Check if any descendant is a heading (nested in divs)
            nested_heading = sibling.find(HEADING_TAGS)
            if nested_heading:
                # Collect text before the nested heading
                text = ""
                for child in sibling.children:
                    if isinstance(child, Tag) and (child.name in HEADING_TAGS or child.find(HEADING_TAGS)):
                        break
                    if isinstance(child, Tag):
                        text += child.get_text(separator=" ", strip=True) + " "
                if text.strip():
                    parts.append(text.strip())
                break
            if sibling.name == "table":
                parts.append(_table_to_text(sibling))
            else:
                text = sibling.get_text(separator=" ", strip=True)
                if text:
                    parts.append(text)
        sibling = sibling.next_sibling
    return "\n\n".join(parts)


def parse_xhtml_sections(xhtml_content: str) -> list[dict]:
    """Parse XHTML content into a list of sections.

    Finds ALL heading tags (h1-h6) anywhere in the document, not just direct
    children of <body>. This handles real ESEF XHTML where headings are nested
    inside multiple layers of <div> elements.

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
        heading_text = heading_tag.get_text(strip=True)
        if not heading_text:
            continue

        depth = HEADING_DEPTH.get(heading_tag.name, 1)

        # Collect content: everything between this heading and the next heading
        content_parts = []
        # Walk next siblings and descendants to gather text
        current = heading_tag
        while True:
            current = current.next_element
            if current is None:
                break
            # Stop at the next heading
            if isinstance(current, Tag) and current.name in HEADING_TAGS and current != heading_tag:
                break
            # Collect text from non-tag elements (NavigableString)
            if isinstance(current, NavigableString) and not isinstance(current, Tag):
                text = current.strip()
                if text:
                    content_parts.append(text)
            # Collect table text specially
            elif isinstance(current, Tag) and current.name == "table":
                content_parts.append(_table_to_text(current))
                # Skip table descendants (we already processed them)
                current = current.next_sibling
                if current is None:
                    break
                continue

        content = "\n\n".join(content_parts)

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
