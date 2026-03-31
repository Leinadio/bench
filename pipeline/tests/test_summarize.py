import json
from unittest.mock import patch, MagicMock
from pipeline.summarize import generate_theme_summary, generate_global_summary

SAMPLE_SECTIONS = [
    {"heading": "3.1 Risk Factors", "content": "The company faces climate risk and regulatory risk in EU markets."},
    {"heading": "3.2 Geopolitical Risk", "content": "Operations in unstable regions including Mozambique and Libya."},
    {"heading": "3.3 Cyber Risk", "content": "Threats to critical industrial infrastructure from cyber attacks."},
]

MOCK_THEME_RESPONSE = json.dumps({
    "score": 2,
    "scoreJustification": "High exposure to climate and geopolitical risks.",
    "summary": "The company faces significant risks across climate, geopolitical, and cyber dimensions.",
    "bulletPoints": [
        "Climate risk: exposure to EU carbon regulations",
        "Geopolitical risk: operations in unstable regions",
        "Cyber risk: threats to industrial infrastructure",
    ]
})

MOCK_GLOBAL_RESPONSE = json.dumps({
    "score": 3,
    "scoreJustification": "Solid strategy offset by significant risk exposure.",
    "summary": "A diversified energy company with strong fundamentals but elevated risk profile.",
    "bulletPoints": [
        "Elevated climate and geopolitical risk profile",
        "Strong transition strategy toward renewables",
        "Solid governance with experienced board",
    ]
})


def test_generate_theme_summary():
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=MOCK_THEME_RESPONSE)]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response

    with patch("pipeline.summarize.get_client", return_value=mock_client):
        result = generate_theme_summary("risk", SAMPLE_SECTIONS, "TotalEnergies")

    assert result["theme"] == "risk"
    assert result["score"] == 2
    assert len(result["bulletPoints"]) == 3
    assert "climate" in result["bulletPoints"][0].lower()


def test_generate_theme_summary_clamps_score():
    bad_response = json.dumps({
        "score": 99,
        "scoreJustification": "test",
        "summary": "test",
        "bulletPoints": ["a"]
    })
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=bad_response)]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response

    with patch("pipeline.summarize.get_client", return_value=mock_client):
        result = generate_theme_summary("risk", SAMPLE_SECTIONS, "TotalEnergies")

    assert result["score"] == 5


def test_generate_global_summary():
    theme_summaries = [
        {"theme": "risk", "score": 2, "scoreJustification": "High risk.", "summary": "Risky.", "bulletPoints": ["risk1"]},
        {"theme": "strategy", "score": 4, "scoreJustification": "Good strategy.", "summary": "Strategic.", "bulletPoints": ["strat1"]},
    ]
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=MOCK_GLOBAL_RESPONSE)]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response

    with patch("pipeline.summarize.get_client", return_value=mock_client):
        result = generate_global_summary(theme_summaries, "TotalEnergies")

    assert result["theme"] == "global"
    assert result["score"] == 3
    assert len(result["bulletPoints"]) == 3
