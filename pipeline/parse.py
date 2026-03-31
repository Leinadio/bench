from bs4 import BeautifulSoup, Tag

HEADING_TAGS = {"h1", "h2", "h3", "h4"}
HEADING_DEPTH = {"h1": 1, "h2": 2, "h3": 3, "h4": 4}

def _extract_text(elements: list) -> str:
    parts = []
    for el in elements:
        if isinstance(el, Tag) and el.name == "table":
            parts.append(_table_to_text(el))
        elif isinstance(el, Tag):
            text = el.get_text(separator=" ", strip=True)
            if text:
                parts.append(text)
    return "\n\n".join(parts)

def _table_to_text(table: Tag) -> str:
    rows = []
    for tr in table.find_all("tr"):
        cells = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
        rows.append(" | ".join(cells))
    return "\n".join(rows)

def parse_xhtml_sections(xhtml_content: str) -> list[dict]:
    soup = BeautifulSoup(xhtml_content, "lxml")
    body = soup.find("body")
    if not body:
        return []
    sections = []
    current_heading = None
    current_depth = 1
    current_elements = []

    def _flush():
        if current_heading is not None:
            content = _extract_text(current_elements)
            sections.append({
                "heading": current_heading,
                "depth": current_depth,
                "content": content,
                "order_index": len(sections),
            })

    for element in body.children:
        if not isinstance(element, Tag):
            continue
        if element.name in HEADING_TAGS:
            _flush()
            current_heading = element.get_text(strip=True)
            current_depth = HEADING_DEPTH.get(element.name, 1)
            current_elements = []
        elif current_heading is not None:
            current_elements.append(element)
    _flush()
    return sections
