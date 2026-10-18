import { useEffect, useId, useRef, useState } from "react";

export interface ScopeOption {
  id: string;
  name: string;
  nameTe?: string;
}

function fullLabel(item: ScopeOption): string {
  return item.nameTe ? `${item.name} / ${item.nameTe}` : item.name;
}

export function ScopeSelect({
  id,
  label,
  value,
  emptyLabel,
  options,
  onChange
}: {
  id: string;
  label: string;
  value: string;
  emptyLabel: string;
  options: ScopeOption[];
  onChange: (id: string) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((item) => item.id === value);
  const summary = selected ? fullLabel(selected) : emptyLabel;

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="scope-field" ref={wrapRef}>
      <span className="scope-caption">{label}</span>
      <select
        id={id}
        data-testid={id}
        className="scope-native"
        value={value}
        title={summary}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        onMouseDown={(event) => {
          event.preventDefault();
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <option value="">{emptyLabel}</option>
        {options.map((item) => (
          <option key={item.id} value={item.id} title={fullLabel(item)}>
            {fullLabel(item)}
          </option>
        ))}
      </select>
      <div className="scope-facade" aria-hidden="true">
        <span className="scope-facade-text">{summary}</span>
      </div>
      {open ? (
        <ul className="scope-menu" id={listId} role="listbox" aria-label={label}>
          <li>
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className={!value ? "active" : ""}
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              {emptyLabel}
            </button>
          </li>
          {options.map((item) => {
            const text = fullLabel(item);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  role="option"
                  title={text}
                  aria-selected={item.id === value}
                  className={item.id === value ? "active" : ""}
                  onClick={() => {
                    onChange(item.id);
                    setOpen(false);
                  }}
                >
                  <span className="scope-option-en">{item.name}</span>
                  {item.nameTe ? <span className="scope-option-te">{item.nameTe}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
