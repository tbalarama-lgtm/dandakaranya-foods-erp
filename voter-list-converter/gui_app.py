#!/usr/bin/env python3
"""Offline desktop UI for the local voter-roll PDF to Excel converter."""

from __future__ import annotations

import queue
import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

import sys

from voter_parser import VoterParseError, extract_voter_data, ocr_backend_name

WINDOW_TITLE = "Secure Local Voter Roll Converter"
WINDOW_SIZE = "720x520"
MIN_SIZE = (640, 440)

BG = "#0f172a"
PANEL = "#1e293b"
BORDER = "#334155"
TEXT = "#e2e8f0"
MUTED = "#94a3b8"
ACCENT = "#22c55e"
ACCENT_ACTIVE = "#16a34a"
DANGER = "#f87171"
ENTRY_BG = "#0b1220"


class VoterRollConverterApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title(WINDOW_TITLE)
        self.root.geometry(WINDOW_SIZE)
        self.root.minsize(*MIN_SIZE)
        self.root.configure(bg=BG)

        self.ui_queue: queue.Queue[tuple] = queue.Queue()
        self.worker: threading.Thread | None = None
        self.stop_event = threading.Event()
        self._poll_after_id: str | None = None

        self.pdf_var = tk.StringVar()
        self.output_dir_var = tk.StringVar()
        self.output_name_var = tk.StringVar(value="voters_export.xlsx")
        self.status_var = tk.StringVar(value="Ready. Processing stays on this computer.")
        self.progress_var = tk.DoubleVar(value=0.0)

        self._build_style()
        self._build_layout()
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)
        self._poll_after_id = self.root.after(80, self._drain_queue)
        backend = ocr_backend_name()
        pyver = f"{sys.version_info.major}.{sys.version_info.minor}"
        if sys.version_info[:2] >= (3, 14):
            self._append_log(
                f"Python {pyver} cannot install onnxruntime. Install Python 3.12 from python.org and run run.bat again.",
                "error",
            )
        elif backend == "unavailable":
            self._append_log("OCR not installed. Text PDFs still work. For image rolls: pip install rapidocr onnxruntime", "error")
        else:
            self._append_log(f"Python {pyver} · local OCR ready ({backend}). Image-scanned ECI rolls stay on this computer.", "ok")

    def _build_style(self) -> None:
        style = ttk.Style(self.root)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass
        style.configure(".", background=BG, foreground=TEXT, fieldbackground=ENTRY_BG)
        style.configure("TFrame", background=BG)
        style.configure("Card.TFrame", background=PANEL)
        style.configure("TLabel", background=BG, foreground=TEXT, font=("Segoe UI", 10))
        style.configure("Card.TLabel", background=PANEL, foreground=TEXT, font=("Segoe UI", 10))
        style.configure("Muted.TLabel", background=PANEL, foreground=MUTED, font=("Segoe UI", 9))
        style.configure("Header.TLabel", background=BG, foreground=TEXT, font=("Segoe UI", 16, "bold"))
        style.configure("TEntry", fieldbackground=ENTRY_BG, foreground=TEXT, insertcolor=TEXT)
        style.configure(
            "Accent.TButton",
            background=ACCENT,
            foreground="#052e16",
            font=("Segoe UI", 11, "bold"),
            padding=(14, 8),
        )
        style.map("Accent.TButton", background=[("disabled", BORDER), ("pressed", ACCENT_ACTIVE), ("active", ACCENT_ACTIVE)])
        style.configure("Ghost.TButton", background=PANEL, foreground=TEXT, padding=(10, 6))
        style.configure("Horizontal.TProgressbar", troughcolor=ENTRY_BG, background=ACCENT, bordercolor=BORDER)

    def _build_layout(self) -> None:
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)

        shell = ttk.Frame(self.root, padding=18)
        shell.grid(row=0, column=0, sticky="nsew")
        shell.columnconfigure(0, weight=1)
        shell.rowconfigure(4, weight=1)

        ttk.Label(shell, text=WINDOW_TITLE, style="Header.TLabel").grid(row=0, column=0, sticky="w")
        ttk.Label(
            shell,
            text="100% Secure Local Offline Processing  ·  files never leave this machine  ·  no cloud upload",
            foreground=ACCENT,
            background=BG,
            font=("Segoe UI", 9, "bold"),
        ).grid(row=1, column=0, sticky="w", pady=(4, 14))

        files = ttk.Frame(shell, style="Card.TFrame", padding=14)
        files.grid(row=2, column=0, sticky="ew")
        files.columnconfigure(1, weight=1)

        ttk.Label(files, text="Input electoral-roll PDF", style="Card.TLabel").grid(row=0, column=0, columnspan=3, sticky="w")
        ttk.Entry(files, textvariable=self.pdf_var).grid(row=1, column=0, columnspan=2, sticky="ew", pady=(6, 10), padx=(0, 8))
        ttk.Button(files, text="Browse File", style="Ghost.TButton", command=self.browse_pdf).grid(row=1, column=2, pady=(6, 10))

        ttk.Label(files, text="Export folder", style="Card.TLabel").grid(row=2, column=0, columnspan=3, sticky="w")
        ttk.Entry(files, textvariable=self.output_dir_var).grid(row=3, column=0, columnspan=2, sticky="ew", pady=(6, 10), padx=(0, 8))
        ttk.Button(files, text="Browse Folder", style="Ghost.TButton", command=self.browse_output_dir).grid(row=3, column=2, pady=(6, 10))

        ttk.Label(files, text="Excel file name", style="Card.TLabel").grid(row=4, column=0, sticky="w")
        ttk.Entry(files, textvariable=self.output_name_var).grid(row=4, column=1, columnspan=2, sticky="ew", padx=(8, 0), pady=6)

        controls = ttk.Frame(shell)
        controls.grid(row=3, column=0, sticky="ew", pady=(14, 8))
        controls.columnconfigure(0, weight=1)
        self.progress = ttk.Progressbar(controls, variable=self.progress_var, maximum=100)
        self.progress.grid(row=0, column=0, sticky="ew", padx=(0, 12))
        self.start_button = ttk.Button(
            controls,
            text="Start Secure Conversion",
            style="Accent.TButton",
            command=self.start_conversion,
        )
        self.start_button.grid(row=0, column=1)

        log_card = ttk.Frame(shell, style="Card.TFrame", padding=10)
        log_card.grid(row=4, column=0, sticky="nsew")
        log_card.columnconfigure(0, weight=1)
        log_card.rowconfigure(1, weight=1)
        ttk.Label(log_card, text="Conversion log", style="Muted.TLabel").grid(row=0, column=0, sticky="w")
        self.log = tk.Text(
            log_card,
            height=10,
            wrap="word",
            bg=ENTRY_BG,
            fg=TEXT,
            insertbackground=TEXT,
            relief="flat",
            highlightthickness=1,
            highlightbackground=BORDER,
            font=("Consolas", 9),
        )
        self.log.grid(row=1, column=0, sticky="nsew", pady=(6, 0))
        self.log.tag_configure("error", foreground=DANGER)
        self.log.tag_configure("ok", foreground=ACCENT)
        self.log.tag_configure("info", foreground=MUTED)
        self.log.configure(state="disabled")

        self.status_label = tk.Label(
            shell,
            textvariable=self.status_var,
            bg=BG,
            fg=MUTED,
            anchor="w",
            font=("Segoe UI", 9),
        )
        self.status_label.grid(row=5, column=0, sticky="ew", pady=(8, 0))

    def browse_pdf(self) -> None:
        path = filedialog.askopenfilename(
            title="Select electoral roll PDF",
            filetypes=[("PDF files", "*.pdf"), ("All files", "*.*")],
        )
        if not path:
            return
        self.pdf_var.set(path)
        source = Path(path)
        if not self.output_dir_var.get():
            self.output_dir_var.set(str(source.parent))
        if self.output_name_var.get() in {"", "voters_export.xlsx"}:
            self.output_name_var.set(f"{source.stem}_voters.xlsx")
        self._append_log(f"Selected {source.name}", "info")

    def browse_output_dir(self) -> None:
        path = filedialog.askdirectory(title="Select Excel export folder")
        if path:
            self.output_dir_var.set(path)

    def start_conversion(self) -> None:
        if self.worker and self.worker.is_alive():
            self._append_log("A conversion is already running.", "error")
            return
        pdf_path = Path(self.pdf_var.get().strip())
        if not pdf_path.is_file():
            self._append_log("Choose a valid local PDF file first.", "error")
            messagebox.showerror(WINDOW_TITLE, "Choose a valid local PDF file first.")
            return
        folder = Path(self.output_dir_var.get().strip() or pdf_path.parent)
        name = self.output_name_var.get().strip() or f"{pdf_path.stem}_voters.xlsx"
        if not name.lower().endswith(".xlsx"):
            name += ".xlsx"
        output_path = folder / name

        self.stop_event.clear()
        self.progress_var.set(0)
        self.progress.configure(mode="determinate", maximum=100)
        self.start_button.configure(state="disabled")
        self.status_var.set("Converting locally…")
        self._append_log(f"Starting secure conversion of {pdf_path.name}", "info")

        self.worker = threading.Thread(
            target=self._run_extraction,
            args=(str(pdf_path), str(output_path)),
            name="voter-extract",
            daemon=True,
        )
        self.worker.start()

    def _run_extraction(self, pdf_path: str, output_path: str) -> None:
        def on_progress(current: int, total: int, message: str = "") -> None:
            self._post(("progress", current, total, message))

        try:
            result = extract_voter_data(pdf_path, progress_callback=on_progress, output_path=output_path)
            if self.stop_event.is_set():
                self._post(("cancelled",))
                return
            self._post(("done", len(result), result.output_path))
        except VoterParseError as exc:
            self._post(("error", str(exc)))
        except Exception as exc:  # pragma: no cover - last-resort UI guard
            self._post(("error", f"Conversion stopped: {exc}"))

    def _post(self, item: tuple) -> None:
        if self.stop_event.is_set():
            return
        try:
            self.ui_queue.put(item)
        except Exception:
            return

    def _drain_queue(self) -> None:
        try:
            while True:
                message = self.ui_queue.get_nowait()
                kind = message[0]
                if kind == "progress":
                    current = message[1]
                    total = message[2]
                    detail = message[3] if len(message) > 3 else ""
                    total = max(int(total), 1)
                    current = max(0, int(current))
                    percent = min(100.0, (current / total) * 100.0)
                    self.progress.configure(mode="determinate", maximum=100)
                    self.progress_var.set(percent)
                    line = detail or (
                        f"Opened roll · {total} page(s)" if current == 0 else f"Scanning Page {current} of {total}..."
                    )
                    self._append_log(line, "info")
                    self.status_label.configure(fg=MUTED)
                    self.status_var.set(line)
                elif kind == "done":
                    _, rows, destination = message
                    self._append_log("Compiling Rows...", "info")
                    self.progress_var.set(100)
                    self._finish_success(rows, destination)
                elif kind == "error":
                    self._finish_error(message[1])
                elif kind == "cancelled":
                    self._reset_controls()
                    self.status_var.set("Conversion cancelled.")
                    self._append_log("Background conversion stopped.", "info")
        except queue.Empty:
            pass
        if not self.stop_event.is_set():
            self._poll_after_id = self.root.after(80, self._drain_queue)

    def _finish_success(self, rows: int, destination: str) -> None:
        self._reset_controls(progress_value=100)
        self.status_label.configure(fg=ACCENT)
        self.status_var.set(f"Finished · {rows} row(s) · {destination}")
        self._append_log(f"Wrote {rows} voter row(s) to {destination}", "ok")
        messagebox.showinfo(
            WINDOW_TITLE,
            f"Conversion complete.\n\nProcessed rows: {rows}\nExcel file:\n{destination}",
        )

    def _finish_error(self, message: str) -> None:
        self._reset_controls(progress_value=0)
        self.status_label.configure(fg=DANGER)
        self.status_var.set(message)
        self._append_log(message, "error")

    def _reset_controls(self, progress_value: float | None = None) -> None:
        self.progress.stop()
        self.progress.configure(mode="determinate")
        if progress_value is not None:
            self.progress_var.set(progress_value)
        self.start_button.configure(state="normal")

    def _append_log(self, text: str, tag: str = "info") -> None:
        self.log.configure(state="normal")
        self.log.insert("end", text + "\n", tag)
        self.log.see("end")
        self.log.configure(state="disabled")

    def on_close(self) -> None:
        self.stop_event.set()
        if self._poll_after_id is not None:
            try:
                self.root.after_cancel(self._poll_after_id)
            except tk.TclError:
                pass
            self._poll_after_id = None
        worker = self.worker
        if worker is not None and worker.is_alive() and worker is not threading.current_thread():
            worker.join(timeout=3.0)
        try:
            self.root.destroy()
        except tk.TclError:
            pass


def main() -> None:
    root = tk.Tk()
    VoterRollConverterApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
