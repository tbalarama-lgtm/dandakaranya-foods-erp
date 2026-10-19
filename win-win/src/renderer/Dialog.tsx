import { useEffect, type ReactNode } from "react";

export function Dialog({
  open,
  title,
  onClose,
  children,
  testId,
  wide
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  testId?: string;
  wide?: boolean;
}): JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <article
        className={`card dialog grid${wide ? " dialog-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        data-testid={testId}
      >
        <div className="dialog-head">
          <h2 id="dialog-title">{title}</h2>
          <button className="btn secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </article>
    </div>
  );
}
