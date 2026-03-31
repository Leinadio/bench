from unittest.mock import MagicMock
from pipeline.index import insert_sections, get_or_create_company

def test_get_or_create_company_creates_new():
    mock_cursor = MagicMock()
    mock_cursor.fetchone.return_value = None
    company_id = get_or_create_company(mock_cursor, "TotalEnergies", "TTE", "CAC40", "Energy", "FR")
    assert mock_cursor.execute.call_count == 2
    assert company_id is not None

def test_get_or_create_company_returns_existing():
    mock_cursor = MagicMock()
    mock_cursor.fetchone.return_value = ("existing-id-123",)
    company_id = get_or_create_company(mock_cursor, "TotalEnergies", "TTE", "CAC40", "Energy", "FR")
    assert company_id == "existing-id-123"
    assert mock_cursor.execute.call_count == 1

def test_insert_sections_inserts_all():
    mock_cursor = MagicMock()
    sections = [
        {"heading": "Risk", "depth": 1, "category": "risk", "content": "Some risk.", "order_index": 0},
        {"heading": "Strategy", "depth": 1, "category": "strategy", "content": "Our plan.", "order_index": 1},
    ]
    insert_sections(mock_cursor, "filing-id-123", sections)
    assert mock_cursor.execute.call_count == 2
