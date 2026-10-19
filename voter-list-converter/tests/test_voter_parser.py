from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pandas as pd
import pytest
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from voter_parser import (
    CorruptedPdfError,
    NonSearchablePdfError,
    OutputPermissionError,
    PasswordProtectedPdfError,
    extract_voter_data,
    parse_page_text,
)


SAMPLE_PAGE = """
Assembly Constituency No and Name : 55 - Tanuku
Section No and Name : 1-SASI ROAD

1    ZOW0935116
Name : RAMA RAO
Father's Name : KRISHNA RAO
House Number : 12-3
Age : 42 Gender: Male

2    ABC1234567
Name : LAKSHMI
Husband's Name : RAMA RAO
House Number : 12-3
Age : 38 Gender: Female
"""


def test_parse_page_tags_section_and_relation_fields() -> None:
    rows, section = parse_page_text(SAMPLE_PAGE, 1, "")
    assert section == "1-SASI ROAD"
    assert len(rows) == 2
    first, second = rows
    assert first["Serial No."] == "1"
    assert first["EPIC ID"] == "ZOW0935116"
    assert first["Voter Name"] == "RAMA RAO"
    assert first["Relation Type"] == "Father"
    assert first["Relation Name"] == "KRISHNA RAO"
    assert first["House Number"] == "12-3"
    assert first["Age"] == 42
    assert first["Gender"] == "Male"
    assert first["Section No and Name"] == "1-SASI ROAD"
    assert second["Relation Type"] == "Husband"
    assert second["Gender"] == "Female"


def test_street_name_header_is_used_when_section_missing() -> None:
    text = """
Street Name : 4-TEMPLE STREET
3    ZOW0001111
Name : ANAND
Mother's Name : SITA
House Number : 9
Age : 21 Gender: Male
"""
    rows, section = parse_page_text(text, 4, "old")
    assert section == "4-TEMPLE STREET"
    assert rows[0]["Source Page"] == 4
    assert rows[0]["Relation Type"] == "Mother"


def write_roll_pdf(path: Path, pages: list[str]) -> None:
    pdf = canvas.Canvas(str(path), pagesize=A4)
    for page in pages:
        y = 780
        for line in page.strip().splitlines():
            pdf.drawString(40, y, line.strip())
            y -= 16
        pdf.showPage()
    pdf.save()


def test_extract_voter_data_writes_excel_and_reports_progress(tmp_path: Path) -> None:
    pdf_path = tmp_path / "roll.pdf"
    write_roll_pdf(pdf_path, [SAMPLE_PAGE, "Street Name : 2-MARKET ROAD\n\n3 ZOW9999999\nName : GOPI\nFather's Name : RAO\nHouse Number : 1\nAge : 60 Gender: Male\n"])
    seen: list[tuple[int, int]] = []
    frame = extract_voter_data(pdf_path, progress_callback=lambda cur, tot: seen.append((cur, tot)))
    assert seen[0] == (0, 2)
    assert seen[-1] == (2, 2)
    assert len(frame) == 3
    assert frame.iloc[2]["Section No and Name"] == "2-MARKET ROAD"
    output = Path(frame.attrs["output_path"])
    assert output.suffix == ".xlsx"
    loaded = pd.read_excel(output, engine="openpyxl")
    assert list(loaded.columns)[:3] == ["Serial No.", "EPIC ID", "Voter Name"]
    assert int(loaded.iloc[0]["Age"]) == 42


def test_missing_file_is_flagged(tmp_path: Path) -> None:
    with pytest.raises(CorruptedPdfError):
        extract_voter_data(tmp_path / "missing.pdf")


def test_non_searchable_pdf_is_flagged(tmp_path: Path) -> None:
    pdf_path = tmp_path / "scan.pdf"
    write_roll_pdf(pdf_path, ["   "])
    with pytest.raises(NonSearchablePdfError):
        extract_voter_data(pdf_path)


def test_password_protected_is_flagged(tmp_path: Path) -> None:
    pdf_path = tmp_path / "locked.pdf"
    write_roll_pdf(pdf_path, [SAMPLE_PAGE])

    with patch("voter_parser.pdfplumber.open", side_effect=PasswordProtectedPdfError("locked")):
        with pytest.raises(PasswordProtectedPdfError):
            extract_voter_data(pdf_path)


def test_output_permission_is_flagged(tmp_path: Path) -> None:
    pdf_path = tmp_path / "roll.pdf"
    write_roll_pdf(pdf_path, [SAMPLE_PAGE])
    blocked = tmp_path / "missing-dir" / "out.xlsx"
    with patch("pandas.DataFrame.to_excel", side_effect=PermissionError("denied")):
        with pytest.raises(OutputPermissionError):
            extract_voter_data(pdf_path, output_path=blocked)
