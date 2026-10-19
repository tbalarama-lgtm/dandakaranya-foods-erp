from __future__ import annotations

import threading
import time
from pathlib import Path
from unittest.mock import patch

import pytest

from voter_parser import ExtractResult, NonSearchablePdfError

tkinter = pytest.importorskip("tkinter")


def _pump(app, rounds: int = 20) -> None:
    for _ in range(rounds):
        app._drain_queue()
        app.root.update_idletasks()


def _shutdown(app) -> None:
    app.stop_event.set()
    if app._poll_after_id is not None:
        try:
            app.root.after_cancel(app._poll_after_id)
        except tkinter.TclError:
            pass
        app._poll_after_id = None
    if app.worker is not None and app.worker.is_alive():
        app.worker.join(timeout=5)
    try:
        app.root.destroy()
    except tkinter.TclError:
        pass


def test_background_success_updates_progress_and_log(tmp_path: Path) -> None:
    try:
        root = tkinter.Tk()
        root.withdraw()
    except tkinter.TclError:
        pytest.skip("Tk display is not available")

    from gui_app import VoterRollConverterApp

    app = VoterRollConverterApp(root)
    output = tmp_path / "out.xlsx"
    result = ExtractResult(rows=[{"Serial No.": "1"}], output_path=str(output), source_path="roll.pdf", pages_scanned=1)

    def fake_extract(pdf_path, progress_callback=None, output_path=None):
        if progress_callback:
            progress_callback(0, 2)
            progress_callback(1, 2)
            progress_callback(2, 2)
        return result

    with patch("gui_app.extract_voter_data", side_effect=fake_extract), patch("gui_app.messagebox.showinfo"):
        app.pdf_var.set(str(tmp_path / "roll.pdf"))
        (tmp_path / "roll.pdf").write_bytes(b"%PDF-1.4")
        app.output_dir_var.set(str(tmp_path))
        app.output_name_var.set("out.xlsx")
        app.start_conversion()
        worker = app.worker
        assert worker is not None
        worker.join(timeout=5)
        _pump(app)
        log_text = app.log.get("1.0", "end")
        assert "Scanning Page 1" in log_text
        assert "Wrote 1 voter row(s)" in log_text
        assert app.progress_var.get() == 100
        assert str(app.start_button.cget("state")) == "normal"

    _shutdown(app)


def test_background_error_resets_progress_and_logs_red(tmp_path: Path) -> None:
    try:
        root = tkinter.Tk()
        root.withdraw()
    except tkinter.TclError:
        pytest.skip("Tk display is not available")

    from gui_app import VoterRollConverterApp

    app = VoterRollConverterApp(root)
    pdf = tmp_path / "scan.pdf"
    pdf.write_bytes(b"%PDF-1.4")

    def fake_extract(*args, **kwargs):
        raise NonSearchablePdfError("No extractable text was found.")

    with patch("gui_app.extract_voter_data", side_effect=fake_extract):
        app.pdf_var.set(str(pdf))
        app.output_dir_var.set(str(tmp_path))
        app.start_conversion()
        app.worker.join(timeout=5)
        log_text = ""
        deadline = time.time() + 2
        while time.time() < deadline:
            _pump(app, rounds=10)
            log_text = app.log.get("1.0", "end")
            if "No extractable text was found." in log_text:
                break
        assert "No extractable text was found." in log_text
        assert app.progress_var.get() == 0
        assert str(app.start_button.cget("state")) == "normal"

    _shutdown(app)


def test_close_signals_background_stop() -> None:
    try:
        root = tkinter.Tk()
        root.withdraw()
    except tkinter.TclError:
        pytest.skip("Tk display is not available")

    from gui_app import VoterRollConverterApp

    app = VoterRollConverterApp(root)
    started = threading.Event()
    release = threading.Event()

    def hang(*args, **kwargs):
        started.set()
        release.wait(timeout=2)
        return ExtractResult(rows=[], output_path="", source_path="", pages_scanned=0)

    app.worker = threading.Thread(target=hang, daemon=True)
    app.worker.start()
    started.wait(timeout=1)
    app.stop_event.set()
    release.set()
    app.worker.join(timeout=5)
    assert app.stop_event.is_set()
    _shutdown(app)
