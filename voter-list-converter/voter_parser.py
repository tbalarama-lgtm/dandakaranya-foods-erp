"""Local Indian electoral-roll PDF extraction (searchable PDFs only)."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Callable, Iterable

import pandas as pd
import pdfplumber

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
    r"Age\s*:\s*(?P<age>\d{1,3})\s*Gender\s*:\s*(?P<gender>[A-Za-z][A-Za-z /]*)",
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


def _emit_progress(callback: ProgressCallback | None, current: int, total: int) -> None:
    if callback is None:
        return
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


def extract_voter_data(
    pdf_path: str | Path,
    progress_callback: ProgressCallback | None = None,
    output_path: str | Path | None = None,
) -> pd.DataFrame:
    """Read a searchable electoral-roll PDF and write a local Excel workbook."""
    source = Path(pdf_path).expanduser()
    if not source.is_file():
        raise CorruptedPdfError(f"The file was not found: {source}")
    if source.suffix.lower() != ".pdf":
        raise CorruptedPdfError("Choose a .pdf electoral roll file.")

    destination = Path(output_path).expanduser() if output_path else _default_output_path(source)
    destination.parent.mkdir(parents=True, exist_ok=True)

    rows: list[dict[str, object]] = []
    searchable_pages = 0
    section = ""

    pdf = None
    try:
        pdf = _open_pdf(source)
        pages = list(pdf.pages)
        total = len(pages)
        if total == 0:
            raise CorruptedPdfError("The PDF has no pages.")
        _emit_progress(progress_callback, 0, total)

        for index, page in enumerate(pages, start=1):
            try:
                text = page.extract_text() or ""
            except Exception as exc:
                raise CorruptedPdfError(
                    f"Page {index} could not be read. The file may be corrupted."
                ) from exc
            if clean_text(text):
                searchable_pages += 1
            page_rows, section = parse_page_text(text, index, section)
            rows.extend(page_rows)
            _emit_progress(progress_callback, index, total)
    finally:
        if pdf is not None:
            pdf.close()

    if searchable_pages == 0:
        raise NonSearchablePdfError(
            "No extractable text was found. Image-scanned rolls need OCR and are not converted by this local text extractor."
        )

    frame = pd.DataFrame(rows, columns=COLUMNS)
    if not frame.empty:
        frame["Age"] = pd.to_numeric(frame["Age"], errors="coerce").astype("Int64")
        for column in COLUMNS:
            if column in {"Age", "Source Page"}:
                continue
            frame[column] = frame[column].map(clean_text)

    try:
        frame.to_excel(destination, index=False, engine="openpyxl")
    except PermissionError as exc:
        raise OutputPermissionError(
            f"Could not write Excel to {destination}. Check folder permissions and that the file is not open."
        ) from exc
    except OSError as exc:
        raise OutputPermissionError(
            f"Could not write Excel to {destination}: {exc}"
        ) from exc

    frame.attrs["output_path"] = str(destination)
    frame.attrs["source_path"] = str(source)
    frame.attrs["pages_scanned"] = searchable_pages
    return frame


def iter_column_headers() -> Iterable[str]:
    return tuple(COLUMNS)
