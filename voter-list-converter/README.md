# Secure Local Voter Roll Converter

Offline PDF → Excel tool for **searchable** Indian electoral-roll PDFs. It is a separate local utility from WIN WIN and from the ERP. Files are not uploaded.

## What it extracts

From each voter block marked by `Age :` and `Gender:`:

- Serial No.
- EPIC ID (for example `ZOW0935116`)
- Voter Name
- Relation type and name (Father / Husband / Mother / Other)
- House Number
- Age (integer)
- Gender
- Active **Section No and Name** or **Street Name** from the page header (for example `1-SASI ROAD`)
- Source page

Excel columns match WIN WIN voter import aliases (`electoral_id`, names, age, address-related house numbers, section, page) closely enough to map in WIN WIN after conversion.

## Limits

- Searchable (text) PDFs only. Image-scanned rolls are flagged, not OCR’d.
- Password-protected PDFs are rejected until you unlock a local copy.
- Processing is local only.

## Run

Python 3.10+ with Tk (`python3-tk` on Debian/Ubuntu).

```bash
cd voter-list-converter
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python gui_app.py
```

Or convert from the command line:

```bash
python -c "from voter_parser import extract_voter_data; extract_voter_data('roll.pdf', output_path='roll.xlsx')"
```

## Tests

```bash
pytest -q
```
