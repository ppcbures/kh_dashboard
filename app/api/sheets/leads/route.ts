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
    const rawMarze = (row[10] || "").trim();
    const marze = rawMarze && rawMarze !== "-" && !isNaN(parseFloat(rawMarze))
      ? parseFloat(rawMarze) : null;
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

/** Parse rows from new-format year sheets (2024/2025/2026) */
function parseNewRows(
  rows: string[][],
  startDate: string,
  endDate: string,
  noDate: boolean
): LeadRow[] {
  // Cols: 0=č.poptávky, 1=Datum(DD.M.YYYY or "SČ"), 2=Čas, 3=Příjmení a jméno,
  //       4=Email, 5=Zdroj kontaktu, 6=Realizace, 7=Hrubá marže,
  //       8=Adresa, 9=GA - zdroj, 10=GA - kampaň
  const leads: LeadRow[] = [];
  for (const row of rows.slice(1)) {
    const id = (row[0] || "").trim();
    if (!id || !id.includes("PK")) continue; // skip empty rows / month headers like "LEDEN"

    let dateOnly = "";
    if (noDate) {
      // 2024 sheet: no reliable dates, include all rows, date shown as empty
      dateOnly = "";
    } else {
      dateOnly = parseNewDate(row[1] || "");
      if (!dateOnly || dateOnly < startDate || dateOnly > endDate) continue;
    }

    const realizaceRaw = (row[6] || "").trim().toLowerCase();
    const realizace = realizaceRaw === "ano";
    const rawMarze = (row[7] || "").trim();
    const marze =
      rawMarze && rawMarze !== "-" && !isNaN(parseFloat(rawMarze))
        ? parseFloat(rawMarze)
        : null;
    const marzeChybi = realizace && marze === null;

    const zdrojRaw = (row[9] || "").trim();
    const zdroj = zdrojRaw === "???" ? "" : zdrojRaw.split("/")[0].trim();

    leads.push({
      id,
      date: dateOnly,
      name: row[3] || "",
      realizace,
      marze,
      marzeChybi,
      zdroj,
      kampan: row[10] || "",
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

    // Sort descending by date; rows without dates (2024 sheet) go to the end
    allLeads.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
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
