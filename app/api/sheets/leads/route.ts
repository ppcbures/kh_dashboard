import { NextRequest, NextResponse } from "next/server";
import {
  LEADS_YEAR_SHEETS as YEAR_SHEETS,
  leadsSheetUrl as sheetUrl,
  fetchCSV,
  parseMarze,
  parseRealizace,
  parseNewRows,
  type LeadRow,
} from "@/lib/sheets";

export type { LeadRow };

/** Pomocný klíč pro řazení dle PK čísla vzestupně: PK24-5 → [24, 5] */
function pkSortKey(id: string): [number, number] {
  const m = id.match(/PK(\d+)-(\d+)/i);
  if (m) return [parseInt(m[1]), parseInt(m[2])];
  const n = parseInt(id);
  return [0, isNaN(n) ? 0 : n]; // starší numerická ID dáme před PK
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

    const realizace = parseRealizace(row[9] || "");
    const marze = parseMarze(row[10] || "");
    const marzeChybi = realizace === "Ano" && marze === null;

    const zdroj = (row[6] || "").trim();

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

    const realizaceCount = allLeads.filter(r => r.realizace === "Ano").length;
    const totalMarze = allLeads
      .filter(r => r.realizace === "Ano" && r.marze !== null)
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
