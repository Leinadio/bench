from pipeline.parse import parse_xhtml_sections

SAMPLE_XHTML = """<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Test DEU</title></head>
<body>
  <h1>1. Risk Factors</h1>
  <p>The company faces several risks including market volatility.</p>
  <p>Currency risk is also significant in our operations.</p>
  <h2>1.1 Market Risk</h2>
  <p>Market conditions may adversely affect our business.</p>
  <h2>1.2 Regulatory Risk</h2>
  <p>Changes in regulation could impact operations.</p>
  <h1>2. Strategy and Objectives</h1>
  <p>Our strategy focuses on sustainable growth.</p>
  <h2>2.1 Growth Targets</h2>
  <p>We aim to grow revenue by 10% annually.</p>
  <table>
    <tr><th>Year</th><th>Target</th></tr>
    <tr><td>2025</td><td>+10%</td></tr>
    <tr><td>2026</td><td>+12%</td></tr>
  </table>
</body>
</html>"""

def test_parse_xhtml_sections_extracts_all_sections():
    sections = parse_xhtml_sections(SAMPLE_XHTML)
    assert len(sections) == 5
    assert sections[0]["heading"] == "1. Risk Factors"
    assert sections[0]["depth"] == 1
    assert "market volatility" in sections[0]["content"]

def test_parse_xhtml_sections_preserves_hierarchy():
    sections = parse_xhtml_sections(SAMPLE_XHTML)
    assert [s["depth"] for s in sections] == [1, 2, 2, 1, 2]

def test_parse_xhtml_sections_includes_table_text():
    sections = parse_xhtml_sections(SAMPLE_XHTML)
    assert "2025" in sections[4]["content"]
    assert "+10%" in sections[4]["content"]

def test_parse_xhtml_sections_order_index():
    sections = parse_xhtml_sections(SAMPLE_XHTML)
    assert [s["order_index"] for s in sections] == [0, 1, 2, 3, 4]
