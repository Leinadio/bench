import os
import tempfile
from unittest.mock import patch, MagicMock
from pipeline.download import download_and_extract

def test_download_and_extract_zip():
    import zipfile, io
    xhtml_content = b"<html><body><h1>Test DEU</h1></body></html>"
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.writestr("test_document.xhtml", xhtml_content)
    mock_response = MagicMock()
    mock_response.content = zip_buffer.getvalue()
    mock_response.raise_for_status = MagicMock()
    with tempfile.TemporaryDirectory() as tmpdir:
        with patch("pipeline.download.requests.get", return_value=mock_response):
            xhtml_path = download_and_extract("https://example.com/test.zip", tmpdir)
        assert xhtml_path is not None
        assert xhtml_path.endswith(".xhtml")
        assert os.path.exists(xhtml_path)
        with open(xhtml_path, "rb") as f:
            assert f.read() == xhtml_content

def test_download_and_extract_no_xhtml_in_zip():
    import zipfile, io
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.writestr("readme.txt", b"no xhtml here")
    mock_response = MagicMock()
    mock_response.content = zip_buffer.getvalue()
    mock_response.raise_for_status = MagicMock()
    with tempfile.TemporaryDirectory() as tmpdir:
        with patch("pipeline.download.requests.get", return_value=mock_response):
            xhtml_path = download_and_extract("https://example.com/test.zip", tmpdir)
        assert xhtml_path is None
