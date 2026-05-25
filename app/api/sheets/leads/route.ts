import { NextRequest, NextResponse } from "next/server";

const SHEET_ID = "1dNbouYH5exODaxr7e3nEK1W8HbBEO7PQh7xE7-NVQBI";

// Sheet definitions
// Main "vše" sheet (no gid): old format, YYYY-MM-DD HH:MM:SS dates
// New year sheets: new format, DD.M.YYYY dates (2024 has no reliable dates)
const YEAR_SHEETS: Record<number, { gid: string; noDate?: boolean }> = {
  2024: { gid: "690344873", noDate: true }, // Datum column has "SČ" not real dates
  2025: { gid: "1245093972" },
  2026: { gid: "1419286740" },
};

function sheetUrl(gid?: string) {
  const base = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
  return gid ? `${base}&gid=${gid}` : base;
}

/** Proper CSV parser — handles multiline quoted fields (cells with embedded newlines). */
function parseCSV(text: string): string[][] {
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

/** Parsuje číslo marže — odstraní mezery jako oddělovač tisíců (např. "10 324" → 10324) */
function parseMarze(raw: string): number | null {
  const cleaned = raw.replace(/[\s ]/g, "").replace(",", ".");
  if (!cleaned || cleaned === "-") return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/** Pomocný klíč pro řazení dle PK čísla vzestupně: PK24-5 → [24, 5] */
function pkSortKey(id: string): [number, number] {
  const m = id.match(/PK(\d+)-(\d+)/i);
  if (m) return [parseInt(m[1]), parseInt(m[2])];
  const n = parseInt(id);
  return [0, isNaN(n) ? 0 : n]; // starší numerická ID dáme před PK
}

/** "6.1.2025" or "22.12.2024" → "2025-01-06" */
function parseNewDate(d: string): string {
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
  realizace: boolean;
  marze: number | null;
  marzeChybi: boolean;
  zdroj: string;
  kampan: string;
}

async function fetchCSV(url: string): Promise<string[][]> {
  const res = await fetch(url, { redirect: "follow", cache: "no-store" });
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
  const text = await res.text();
  return parseCSV(text);
}

/** Parse rows from the old-format "vše" main sheet */
function parseOldRows(rows: string[][], startDate: string, endDate: string): LeadRow[] {
  // Cols: 0=Typ, 1=ID, 2=Datum("2023-01-30 8:46:55"), 3=Jméno,
  //       6=Zdroj Medium, 7=Kampaň, 9=Realizace, 10=Hodnota realizace
  const leads: LeadRow[] = [];
  for (const row of rows.slice(1)) {
    const rawDate = row[2] || "";
    const dateOnly = rawDate.split(" ")[0]; // YYYY-MM-DD
    if (!dateOnly || dateOnly < startDate || dateOnly > endDate) continue;

    const realizace = (row[9] || "").trim().toLowerCase() === "ano";
    const marze = parseMarze(row[10] || "");
    const marzeChybi = realizace && marze === null;

    const zdrojRaw = (row[6] || "").trim();
    const zdroj = zdrojRaw.split("/")[0].trim();

    leads.push({
      id: row[1] || "",
      date: dateOnly,
      name: row[3] || "",
      realizace,
      marze,
      marzeChybi,
      zdroj,
      kampan: row[7] || "",
    });
  }
  return leads;
}

/** Parse rows from new-format year sheets (2024/2025/2026).
 *  Indexy sloupců detekuje dynamicky z headeru — různé roky mají různou strukturu:
 *  - 2024/2025: …, Hrubá marže [7], Adresa [8], GA-zdroj [9], GA-kampaň [10]
 *  - 2026+:     …, Hrubá marže [7], GA-zdroj [8], GA-kampaň [9], Cesta [10]
 */
function parseNewRows(
  rows: string[][],
  startDate: string,
  endDate: string,
  noDate: boolean
): LeadRow[] {
  if (rows.length < 2) return [];

  // Detekce indexů z hlavičky
  const header = rows[0].map(h => h.toLowerCase().trim());
  const zdrojIdx  = header.findIndex(h => h.includes("ga") && h.includes("zdroj"));
  const kampanIdx = header.findIndex(h => h.includes("ga") && h.includes("kamp"));
  const colZdroj  = zdrojIdx  >= 0 ? zdrojIdx  : 9;  // fallback pro případ bez headeru
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

    const realizaceRaw = (row[6] || "").trim().toLowerCase();
    const realizace = realizaceRaw === "ano";
    const marze = parseMarze(row[7] || "");
    const marzeChybi = realizace && marze === null;

    const zdrojRaw = (row[colZdroj] || "").trim();
    const zdroj = zdrojRaw === "???" ? "" : zdrojRaw.split("/")[0].trim();

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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  if (!startDate || !endDate)
    return NextResponse.json({ error: "Chybí parametry" }, { status: 400 });

  try {
    const startYear = parseInt(startDate.substring(0, 4));
    const endYear = parseInt(endDate.substring(0, 4));

    // Build list of year-sheet fetch promises
    const yearSheetFetches: { year: number; noDate: boolean; promise: Promise<string[][] | null> }[] = [];
    for (let y = startYear; y <= endYear; y++) {
      const sheetDef = YEAR_SHEETS[y];
      if (sheetDef) {
        yearSheetFetches.push({
          year: y,
          noDate: sheetDef.noDate ?? false,
          promise: fetchCSV(sheetUrl(sheetDef.gid)).catch(() => null),
        });
      }
    }

    // Fetch main "vše" sheet and all relevant year sheets in parallel
    const [mainResult, ...yearResults] = await Promise.allSettled([
      fetchCSV(sheetUrl()),
      ...yearSheetFetches.map(f => f.promise),
    ]);

    const allLeads: LeadRow[] = [];

    // Process main "vše" sheet (old format)
    if (mainResult.status === "fulfilled" && mainResult.value.length >= 2) {
      allLeads.push(...parseOldRows(mainResult.value, startDate, endDate));
    }

    // Process year sheets (new format)
    yearResults.forEach((result, idx) => {
      const { noDate } = yearSheetFetches[idx];
      if (result.status === "fulfilled" && result.value && result.value.length >= 2) {
        allLeads.push(...parseNewRows(result.value, startDate, endDate, noDate));
      }
    });

    // Řadit vzestupně dle PK čísla (PK24-1, PK24-2, ... PK26-300)
    allLeads.sort((a, b) => {
      const [ay, an] = pkSortKey(a.id);
      const [by, bn] = pkSortKey(b.id);
      if (ay !== by) return ay - by;
      return an - bn;
    });

    const realizaceCount = allLeads.filter(r => r.realizace).length;
    const totalMarze = allLeads
      .filter(r => r.realizace && r.marze !== null)
      .reduce((sum, r) => sum + (r.marze ?? 0), 0);

    return NextResponse.json({
      rows: allLeads,
      stats: {
        count: allLeads.length,
        realizace: realizaceCount,
        totalMarze: Math.round(totalMarze),
      },
    });
  } catch (error) {
    console.error("leads error:", error);
    return NextResponse.json({ error: "Nepodařilo se načíst poptávky" }, { status: 500 });
  }
}
