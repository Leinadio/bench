from unittest.mock import patch, MagicMock
from pipeline.classify import classify_sections

SAMPLE_SECTIONS = [
    {"heading": "1. Risk Factors", "depth": 1, "content": "The company faces market risks.", "order_index": 0},
    {"heading": "2. Strategy", "depth": 1, "content": "Our strategy for growth.", "order_index": 1},
    {"heading": "3. Corporate Governance", "depth": 1, "content": "Board composition.", "order_index": 2},
    {"heading": "4. Financial Statements", "depth": 1, "content": "Revenue was EUR 200B.", "order_index": 3},
    {"heading": "5. Environmental", "depth": 1, "content": "Carbon reduction.", "order_index": 4},
]

def test_classify_sections_returns_categories():
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text='["risk","strategy","governance","financial","esg"]')]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response
    with patch("pipeline.classify.get_client", return_value=mock_client):
        result = classify_sections(SAMPLE_SECTIONS)
    assert len(result) == 5
    assert result[0]["category"] == "risk"
    assert result[1]["category"] == "strategy"
    assert result[2]["category"] == "governance"
    assert result[3]["category"] == "financial"
    assert result[4]["category"] == "esg"

def test_classify_sections_handles_unknown_category():
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text='["risk","unknown_thing"]')]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response
    sections = SAMPLE_SECTIONS[:2]
    with patch("pipeline.classify.get_client", return_value=mock_client):
        result = classify_sections(sections)
    assert result[0]["category"] == "risk"
    assert result[1]["category"] == "other"
