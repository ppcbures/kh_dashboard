// Sdílené parsování Google Sheets CSV pro leads a history API routy.

export const LEADS_SHEET_ID = "1dNbouYH5exODaxr7e3nEK1W8HbBEO7PQh7xE7-NVQBI";

// Main "vše" sheet (no gid): old format, YYYY-MM-DD HH:MM:SS dates
// New year sheets: new format, DD.M.YYYY dates (2024 has no reliable dates)
export const LEADS_YEAR_SHEETS: Record<number, { gid: string; noDate?: boolean }> = {
  2024: { gid: "690344873", noDate: true }, // Datum column has "SČ" not real dates
  2025: { gid: "1245093972" },
  2026: { gid: "1419286740" },
};

export function leadsSheetUrl(gid?: string) {
  const base = `https://docs.google.com/spreadsheets/d/${LEADS_SHEET_ID}/export?format=csv`;
  return gid ? `${base}&gid=${gid}` : base;
}

/** Proper CSV parser — handles multiline quoted fields (cells with embedded newlines). */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let field = "";
  let inQ = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQ && text[i + 1] === '"') {
        field += '"'; i++; // escaped double-quote inside quoted field
      } else {
        inQ = !inQ;
      }
    } else if (ch === "," && !inQ) {
      currentRow.push(field.trim());
      field = "";
    } else if ((ch === "\n" || ch === "\r") && !inQ) {
      if (ch === "\r" && text[i + 1] === "\n") i++; // consume CRLF as one
      currentRow.push(field.trim());
      field = "";
      if (currentRow.some(f => f !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      field += ch;
    }
  }
  // Last row (no trailing newline)
  currentRow.push(field.trim());
  if (currentRow.some(f => f !== "")) rows.push(currentRow);

  return rows;
}

export async function fetchCSV(url: string): Promise<string[][]> {
  const res = await fetch(url, { redirect: "follow", cache: "no-store" });
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
  const text = await res.text();
  return parseCSV(text);
}

/** Parsuje číslo marže — odstraní mezery jako oddělovač tisíců (např. "10 324" → 10324) */
export function parseMarze(raw: string): number | null {
  const cleaned = raw.replace(/[\s ]/g, "").replace(",", ".");
  if (!cleaned || cleaned === "-") return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/** Normalizuje hodnotu realizace z buňky sheetu */
export function parseRealizace(raw: string): string {
  const r = raw.toLowerCase().trim();
  if (r === "ano") return "Ano";
  if (r === "ne" || r === "nevyšlo" || r === "nevyslo") return "Nevyšlo";
  if (r.startsWith("v ř") || r.startsWith("v r") || r === "v řešení" || r === "v reseni") return "V řešení";
  return "";
}

/** "6.1.2025" or "22.12.2024" → "2025-01-06" */
export function parseNewDate(d: string): string {
  const parts = d.trim().split(".");
  if (parts.length !== 3) return "";
  const [day, month, year] = parts;
  if (!year || !month || !day) return "";
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export interface LeadRow {
  id: string;
  date: string;         // YYYY-MM-DD (empty for 2024 no-date rows)
  name: string;
  realizace: string;    // "Ano" | "V řešení" | "Ne" | ""
  marze: number | null;
  marzeChybi: boolean;
  zdroj: string;
  kampan: string;
}

/** Parse rows from new-format year sheets (2024/2025/2026).
 *  Indexy sloupců detekuje dynamicky z headeru — různé roky mají různou strukturu:
 *  - 2024/2025: …, Hrubá marže [7], Adresa [8], GA-zdroj [9], GA-kampaň [10]
 *  - 2026+:     …, Hrubá marže [7], GA-zdroj [8], GA-kampaň [9], Cesta [10]
 */
export function parseNewRows(
  rows: string[][],
  startDate: string,
  endDate: string,
  noDate: boolean
): LeadRow[] {
  if (rows.length < 2) return [];

  // Detekce indexů z hlavičky
  const header = rows[0].map(h => h.toLowerCase().trim());
  const zdrojIdx  = header.findIndex(h =>
    (h.includes("ga") && h.includes("zdroj")) || h === "zdroj" || h === "ga-zdroj" || h === "ga zdroj"
  );
  const kampanIdx = header.findIndex(h =>
    (h.includes("ga") && h.includes("kamp")) || h === "kampaň" || h === "kampan" || h === "ga-kampaň"
  );
  const colZdroj  = zdrojIdx  >= 0 ? zdrojIdx  : 9;  // fallback
  const colKampan = kampanIdx >= 0 ? kampanIdx : 10;

  const leads: LeadRow[] = [];
  for (const row of rows.slice(1)) {
    const id = (row[0] || "").trim();
    if (!id || !id.includes("PK")) continue; // přeskočit prázdné řádky a nadpisy měsíců (LEDEN…)

    let dateOnly = "";
    if (noDate) {
      dateOnly = ""; // 2024 sheet: spolehlivé datum chybí, zahrnout vše
    } else {
      dateOnly = parseNewDate(row[1] || "");
      if (!dateOnly || dateOnly < startDate || dateOnly > endDate) continue;
    }

    const realizace = parseRealizace(row[6] || "");
    const marze = parseMarze(row[7] || "");
    const marzeChybi = realizace === "Ano" && marze === null;

    const zdroj = (row[colZdroj] || "").trim();

    leads.push({
      id,
      date: dateOnly,
      name: (row[3] || "").split("\n")[0].trim(),
      realizace,
      marze,
      marzeChybi,
      zdroj,
      kampan: (row[colKampan] || "").split("\n")[0].trim(),
    });
  }
  return leads;
}
