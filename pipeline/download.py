import os
import zipfile
import io
import requests


def download_and_extract(url: str, output_dir: str) -> str | None:
    response = requests.get(url, timeout=120)
    response.raise_for_status()
    zip_buffer = io.BytesIO(response.content)
    with zipfile.ZipFile(zip_buffer, "r") as zf:
        xhtml_files = [
            name for name in zf.namelist()
            if name.lower().endswith((".xhtml", ".htm", ".html"))
            and not name.startswith("__MACOSX")
        ]
        if not xhtml_files:
            return None
        largest = max(xhtml_files, key=lambda n: zf.getinfo(n).file_size)
        extracted_path = os.path.join(output_dir, os.path.basename(largest))
        with open(extracted_path, "wb") as f:
            f.write(zf.read(largest))
        return extracted_path
