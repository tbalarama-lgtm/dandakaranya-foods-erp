"""Local Indian electoral-roll PDF extraction (searchable PDFs only)."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable

import pdfplumber
from openpyxl import Workbook
from openpyxl.styles import Font

try:
    from pdfminer.pdfdocument import PDFPasswordIncorrect
except ImportError:  # pragma: no cover - depends on pdfminer layout
    PDFPasswordIncorrect = type("PDFPasswordIncorrect", (Exception,), {})

ProgressCallback = Callable[[int, int], None]

COLUMNS = [
    "Serial No.",
    "EPIC ID",
    "Voter Name",
    "Relation Type",
    "Relation Name",
    "House Number",
    "Age",
    "Gender",
    "Section No and Name",
    "Source Page",
]

EPIC_RE = re.compile(r"\b([A-Z]{3}[0-9]{7})\b")
AGE_GENDER_RE = re.compile(
    r"Age\s*[:\-]?\s*(?P<age>\d{1,3})\s*(?:Years?)?\s*Gender\s*[:\-]?\s*(?P<gender>[A-Za-z][A-Za-z /]*)",
    re.IGNORECASE,
)
SECTION_RE = re.compile(
    r"(?im)^(?:Section\s*No(?:\.|\s+and\s+Name)?|Street\s*Name)\s*[:\-]\s*(.+?)\s*$"
)
SERIAL_RE = re.compile(
    r"(?m)^\s*(?P<serial>\d{1,5})(?:\s+(?P<epic>[A-Z]{3}[0-9]{7}))?\s*$"
)
NAME_RE = re.compile(
    r"(?im)^(?:Voter\s+)?Name\s*:\s*(?P<name>.+?)\s*$"
)
RELATION_RE = re.compile(
    r"(?im)^(?P<kind>Father'?s|Husband'?s|Mother'?s|Other'?s|Others|Guardian'?s)\s+Name\s*:\s*(?P<name>.+?)\s*$"
)
HOUSE_RE = re.compile(
    r"(?im)^House\s*(?:Number|No\.?)\s*[:\-]\s*(?P<house>.+?)\s*$"
)


@dataclass
class ExtractResult:
    rows: list[dict[str, object]]
    output_path: str
    source_path: str
    pages_scanned: int

    def __len__(self) -> int:
        return len(self.rows)


class VoterParseError(Exception):
    """Recoverable extraction failure meant for UI display."""


class PasswordProtectedPdfError(VoterParseError):
    """The PDF requires a password and cannot be opened locally without it."""


class CorruptedPdfError(VoterParseError):
    """The file is not a readable PDF."""


class NonSearchablePdfError(VoterParseError):
    """The PDF has no extractable text (typically a scan/image-only roll)."""


class OutputPermissionError(VoterParseError):
    """The Excel destination cannot be created or written."""


def clean_text(value: object) -> str:
    if value is None:
        return ""
    text = str(value).replace("\u00a0", " ")
    return re.sub(r"[ \t]+", " ", text).strip()


def _normalize_gender(value: str) -> str:
    token = clean_text(value).lower()
    if token in {"m", "male"}:
        return "Male"
    if token in {"f", "female"}:
        return "Female"
    if "third" in token or token in {"tg", "other", "o"}:
        return "Third Gender"
    return clean_text(value).title()


def _normalize_relation_type(kind: str) -> str:
    token = clean_text(kind).lower().replace("'", "")
    if token.startswith("father"):
        return "Father"
    if token.startswith("husband"):
        return "Husband"
    if token.startswith("mother"):
        return "Mother"
    if token.startswith("guardian"):
        return "Guardian"
    return "Other"


def _first_line_match(pattern: re.Pattern[str], text: str) -> re.Match[str] | None:
    for line in text.splitlines():
        match = pattern.match(line.strip()) if pattern.pattern.startswith("(?im)^") else pattern.search(line)
        if match:
            return match
    return pattern.search(text)


def parse_voter_block(block: str, section: str, page_number: int) -> dict[str, object] | None:
    age_match = AGE_GENDER_RE.search(block)
    if not age_match:
        return None

    serial_match = SERIAL_RE.search(block)
    epic_match = EPIC_RE.search(block)
    name_match = None
    for line in block.splitlines():
        stripped = line.strip()
        if re.match(r"(?i)^(father|husband|mother|other|guardian)", stripped):
            continue
        candidate = NAME_RE.match(stripped)
        if candidate:
            name_match = candidate
            break
    relation_match = RELATION_RE.search(block)
    house_match = HOUSE_RE.search(block)

    serial = clean_text(serial_match.group("serial") if serial_match else "")
    epic = ""
    if serial_match and serial_match.groupdict().get("epic"):
        epic = serial_match.group("epic")
    elif epic_match:
        epic = epic_match.group(1)

    age_raw = age_match.group("age")
    try:
        age = int(age_raw)
    except (TypeError, ValueError):
        return None

    record = {
        "Serial No.": serial,
        "EPIC ID": clean_text(epic).upper(),
        "Voter Name": clean_text(name_match.group("name") if name_match else ""),
        "Relation Type": _normalize_relation_type(relation_match.group("kind")) if relation_match else "",
        "Relation Name": clean_text(relation_match.group("name") if relation_match else ""),
        "House Number": clean_text(house_match.group("house") if house_match else ""),
        "Age": age,
        "Gender": _normalize_gender(age_match.group("gender")),
        "Section No and Name": clean_text(section),
        "Source Page": page_number,
    }
    if not record["Voter Name"] and not record["EPIC ID"] and not record["Serial No."]:
        return None
    return record


def extract_section(text: str, fallback: str = "") -> str:
    matches = list(SECTION_RE.finditer(text))
    if not matches:
        return clean_text(fallback)
    return clean_text(matches[-1].group(1))


def parse_page_text(text: str, page_number: int, current_section: str = "") -> tuple[list[dict[str, object]], str]:
    page_text = text or ""
    section = extract_section(page_text, current_section) or current_section
    markers = list(AGE_GENDER_RE.finditer(page_text))
    if not markers:
        return [], section

    records: list[dict[str, object]] = []
    for index, match in enumerate(markers):
        start = 0 if index == 0 else markers[index - 1].end()
        block = page_text[start : match.end()]
        parsed = parse_voter_block(block, section, page_number)
        if parsed:
            records.append(parsed)
    return records, section


def _default_output_path(pdf_path: Path) -> Path:
    return pdf_path.with_name(f"{pdf_path.stem}_voters.xlsx")


def _emit_progress(callback: ProgressCallback | None, current: int, total: int, message: str = "") -> None:
    if callback is None:
        return
    try:
        callback(current, total, message)  # type: ignore[misc]
    except TypeError:
        callback(current, total)


def _open_pdf(pdf_path: Path):
    try:
        return pdfplumber.open(str(pdf_path))
    except PDFPasswordIncorrect as exc:
        raise PasswordProtectedPdfError(
            "This PDF is password-protected. Unlock a local copy before converting."
        ) from exc
    except FileNotFoundError as exc:
        raise CorruptedPdfError(f"The file was not found: {pdf_path}") from exc
    except VoterParseError:
        raise
    except Exception as exc:
        message = str(exc).lower()
        if "password" in message or "encrypted" in message:
            raise PasswordProtectedPdfError(
                "This PDF is password-protected. Unlock a local copy before converting."
            ) from exc
        raise CorruptedPdfError(
            "The file could not be opened as a PDF. It may be corrupted or incomplete."
        ) from exc


_OCR_ENGINE = None
_OCR_ENGINE_NAME = ""


def ocr_packages_installed() -> bool:
    import importlib.util

    return (
        importlib.util.find_spec("rapidocr") is not None
        or importlib.util.find_spec("rapidocr_onnxruntime") is not None
    )


def ocr_backend_name() -> str:
    """Return a short OCR status for the UI log, without loading the model."""
    if _OCR_ENGINE_NAME:
        return _OCR_ENGINE_NAME
    if ocr_packages_installed():
        return "rapidocr"
    return "unavailable"


def _ocr_result_to_text(result: object) -> str:
    if result is None:
        return ""
    txts = getattr(result, "txts", None)
    if txts:
        return "\n".join(str(item) for item in txts if item)
    payload: object = result
    if isinstance(result, tuple):
        payload = result[0] if result else None
    if not payload:
        return ""
    lines: list[str] = []
    if isinstance(payload, list):
        for item in payload:
            if isinstance(item, str) and item.strip():
                lines.append(item)
            elif isinstance(item, (list, tuple)) and len(item) >= 2 and item[1]:
                lines.append(str(item[1]))
    return "\n".join(lines)


def _ensure_ocr_engine():
    global _OCR_ENGINE, _OCR_ENGINE_NAME
    if _OCR_ENGINE is not None or _OCR_ENGINE_NAME == "unavailable":
        return _OCR_ENGINE
    try:
        from rapidocr import RapidOCR

        _OCR_ENGINE = RapidOCR()
        _OCR_ENGINE_NAME = "rapidocr"
        return _OCR_ENGINE
    except Exception:
        pass
    try:
        from rapidocr_onnxruntime import RapidOCR

        _OCR_ENGINE = RapidOCR()
        _OCR_ENGINE_NAME = "rapidocr_onnxruntime"
        return _OCR_ENGINE
    except Exception:
        _OCR_ENGINE_NAME = "unavailable"
        _OCR_ENGINE = None
        return None


def _fitz_document(pdf_path: Path):
    try:
        import fitz
    except ImportError:
        return None
    try:
        return fitz.open(str(pdf_path))
    except Exception:
        return None


def _fitz_text(doc, index_zero: int) -> str:
    if doc is None:
        return ""
    try:
        return doc.load_page(index_zero).get_text("text") or ""
    except Exception:
        return ""


def _page_has_ink(doc, index_zero: int) -> bool:
    if doc is None:
        return False
    try:
        import numpy as np

        page = doc.load_page(index_zero)
        pix = page.get_pixmap(matrix=__import__("fitz").Matrix(0.4, 0.4), alpha=False)
        samples = np.frombuffer(pix.samples, dtype=np.uint8)
        return bool(samples.size) and float(samples.std()) > 8.0
    except Exception:
        try:
            return bool(doc.load_page(index_zero).get_images())
        except Exception:
            return False


def _ocr_page(doc, index_zero: int) -> str:
    if doc is None:
        return ""
    engine = _ensure_ocr_engine()
    if engine is None:
        return ""
    try:
        import numpy as np
        import fitz
    except ImportError:
        return ""
    page = doc.load_page(index_zero)
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    image = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    try:
        result = engine(image)
    except Exception:
        return ""
    return _ocr_result_to_text(result)


def extract_page_text(plumber_page, fitz_doc, index_zero: int) -> tuple[str, str]:
    """Return (text, source) where source is plumber, fitz, or ocr."""
    try:
        plumber_text = plumber_page.extract_text() or ""
    except Exception:
        plumber_text = ""
    if clean_text(plumber_text):
        return plumber_text, "plumber"
    fitz_text = _fitz_text(fitz_doc, index_zero)
    if clean_text(fitz_text):
        return fitz_text, "fitz"
    if not _page_has_ink(fitz_doc, index_zero):
        return "", "empty"
    ocr_text = _ocr_page(fitz_doc, index_zero)
    if clean_text(ocr_text):
        return ocr_text, "ocr"
    return "", "empty"


def extract_voter_data(
    pdf_path: str | Path,
    progress_callback: ProgressCallback | None = None,
    output_path: str | Path | None = None,
) -> ExtractResult:
    """Read a searchable or image electoral-roll PDF and write a local Excel workbook."""
    source = Path(pdf_path).expanduser()
    if not source.is_file():
        raise CorruptedPdfError(f"The file was not found: {source}")
    if source.suffix.lower() != ".pdf":
        raise CorruptedPdfError("Choose a .pdf electoral roll file.")

    destination = Path(output_path).expanduser() if output_path else _default_output_path(source)
    destination.parent.mkdir(parents=True, exist_ok=True)

    rows: list[dict[str, object]] = []
    searchable_pages = 0
    ocr_pages = 0
    section = ""

    pdf = None
    fitz_doc = None
    try:
        pdf = _open_pdf(source)
        fitz_doc = _fitz_document(source)
        pages = list(pdf.pages)
        total = len(pages)
        if total == 0:
            raise CorruptedPdfError("The PDF has no pages.")
        _emit_progress(progress_callback, 0, total, f"Opened roll · {total} page(s)")

        for index, page in enumerate(pages, start=1):
            text, origin = extract_page_text(page, fitz_doc, index - 1)
            if origin == "ocr":
                ocr_pages += 1
                _emit_progress(progress_callback, index, total, f"OCR page {index} of {total} (image roll)...")
            else:
                _emit_progress(progress_callback, index, total, f"Scanning Page {index} of {total}...")
            if clean_text(text):
                searchable_pages += 1
            page_rows, section = parse_page_text(text, index, section)
            rows.extend(page_rows)
    finally:
        if pdf is not None:
            pdf.close()
        if fitz_doc is not None:
            fitz_doc.close()

    if searchable_pages == 0:
        if not ocr_packages_installed():
            raise NonSearchablePdfError(
                "This roll is an image scan and local OCR is not installed. "
                "In the converter folder run:  .venv\\Scripts\\python.exe -m pip install rapidocr onnxruntime"
            )
        raise NonSearchablePdfError(
            "No extractable text was found, including after local OCR. "
            "The file may be empty, damaged, or too low-quality to read."
        )
    if not rows:
        raise VoterParseError(
            "The PDF was read, but no voter cards with Age and Gender were found. "
            "This layout may differ from the standard Indian electoral-roll card format."
        )

    try:
        write_excel(rows, destination)
    except PermissionError as exc:
        raise OutputPermissionError(
            f"Could not write Excel to {destination}. Check folder permissions and that the file is not open."
        ) from exc
    return ExtractResult(
        rows=rows,
        output_path=str(destination),
        source_path=str(source),
        pages_scanned=searchable_pages,
    )


def write_excel(rows: list[dict[str, object]], destination: Path) -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "voters"
    header_font = Font(bold=True)
    sheet.append(list(COLUMNS))
    for cell in sheet[1]:
        cell.font = header_font
    for row in rows:
        sheet.append([row.get(column, "") for column in COLUMNS])
    try:
        workbook.save(destination)
    except PermissionError as exc:
        raise OutputPermissionError(
            f"Could not write Excel to {destination}. Check folder permissions and that the file is not open."
        ) from exc
    except OSError as exc:
        raise OutputPermissionError(
            f"Could not write Excel to {destination}: {exc}"
        ) from exc


def iter_column_headers() -> Iterable[str]:
    return tuple(COLUMNS)
