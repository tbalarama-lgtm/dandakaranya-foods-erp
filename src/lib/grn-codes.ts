/** Batch trace & label codes for GRN (barcode pattern + QR payload). */

export function buildTraceCode(grnNumber: string, productSku: string, seq: number): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `DF-${ymd}-${grnNumber.replace(/[^A-Z0-9]/gi, "").slice(-6)}-${productSku.slice(0, 6).toUpperCase()}-${String(seq).padStart(3, "0")}`;
}

export function buildWarehouseBatch(supplierBatch: string | null, traceCode: string): string {
  return supplierBatch ? `WH-${supplierBatch}-${traceCode.slice(-8)}` : traceCode;
}

export function buildQrPayload(traceCode: string, grnNumber: string, productName: string): string {
  return JSON.stringify({
    v: 1,
    trace: traceCode,
    grn: grnNumber,
    product: productName,
    org: "Dandakaranya Foods",
  });
}

export function barcodeSvg(data: string, width = 180, height = 48): string {
  let hash = 0;
  for (let i = 0; i < data.length; i += 1) hash = (hash * 31 + data.charCodeAt(i)) >>> 0;
  const bars: string[] = [];
  let x = 4;
  for (let i = 0; i < 40; i += 1) {
    const bit = (hash >> (i % 32)) & 1;
    const w = bit ? 3 : 1;
    if (bit) bars.push(`<rect x="${x}" y="4" width="${w}" height="${height - 12}" fill="#1a1a1a"/>`);
    x += w + 1;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fff"/>${bars.join("")}<text x="${width / 2}" y="${height - 2}" text-anchor="middle" font-size="8" fill="#333">${data.slice(0, 18)}</text></svg>`;
}

export function qrSvg(payload: string, size = 120): string {
  const n = 21;
  const cell = size / n;
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i += 1) hash = (hash ^ payload.charCodeAt(i)) * 16777619;
  const cells: string[] = [];
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      const corner =
        (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
      const bit = corner || ((hash + r * 17 + c * 31) & 3) === 0;
      if (bit) cells.push(`<rect x="${c * cell}" y="${r * cell}" width="${cell}" height="${cell}" fill="#111"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" fill="#fff"/>${cells.join("")}</svg>`;
}

export function codesToDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
