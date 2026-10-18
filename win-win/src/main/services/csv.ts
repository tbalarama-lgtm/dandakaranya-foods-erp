/** RFC 4180-style CSV helpers. Values are always treated as Unicode text. */

export function parseCsv(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (ch === "\r") {
      /* skip; handle CRLF via \n */
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((cell) => cell.length > 0) || rows.length === 0) rows.push(row);
  while (rows.length > 1 && rows[rows.length - 1]!.every((cell) => !cell.trim())) {
    rows.pop();
  }
  return rows;
}

export function stringifyCsv(rows: string[][]): string {
  const body = rows
    .map((row) =>
      row
        .map((cell) => {
          const value = cell ?? "";
          if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
          return value;
        })
        .join(",")
    )
    .join("\r\n");
  return `\uFEFF${body}`;
}

export function guardSpreadsheetCell(value: string): string {
  const text = value ?? "";
  if (/^[=+\-@\t\r]/.test(text)) return `'${text}`;
  return text;
}
