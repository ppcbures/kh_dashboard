import { NextResponse } from "next/server";
import {
  LEADS_YEAR_SHEETS,
  leadsSheetUrl,
  fetchCSV,
  parseNewRows,
} from "@/lib/sheets";

// Ruční historický sheet — používá se jen pro 2024 (leads sheet pro ten rok
// nemá spolehlivá data, sloupec Datum obsahuje "SČ" místo skutečného data).
const HISTORY_SHEET_ID = "1w4mcPVe3Xhj46Lj0I4CYjaPivwCGRQ5q0jl7QtwetPc";
const HISTORY_GID_2024 = "0";

// Denní útrata dle kanálů — používá se pro dopočet měsíční útraty za 2025/2026.
const ADSPEND_SHEET_ID = "1tptPD0plitUuPn9_8lk17bNCbBT2kDdLzuV9Kglu5xg";
const ADSPEND_GID = "201491332";

const MONTH_NAMES = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
];

function sheetCsvUrl(sheetId: string, gid: string) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

export interface MonthRow {
  cislo: string;
  mesic: string;
  utrata: string;
  poptavky: string;
  cpPoptavky: string;
  realizace: string;
  cpRealizace: string;
  marze: string;
}

/** Parsuje řádky z ručního historického sheetu (dnes už jen pro 2024). */
function parseManualRows(rows: string[][]): MonthRow[] {
  if (rows.length < 2) return [];
  // Cols: 0=č., 1=Měsíc, 2=Útrata, 3=Počet poptávek, 4=Cena za poptávku,
  //       5=Počet realizací, 6=Cena za realizaci, 7=Hrubá marže realizací
  return rows.slice(1)
    .filter(r => r[0] && !isNaN(parseInt(r[0]))) // jen řádky s číslem měsíce
    .map(r => ({
      cislo:       r[0] || "",
      mesic:       (r[1] || "").trim(),
      utrata:      r[2] || "",
      poptavky:    r[3] || "",
      cpPoptavky:  r[4] || "",
      realizace:   r[5] || "",
      cpRealizace: r[6] || "",
      marze:       r[7] || "",
    }));
}

function fmtKc(n: number): string {
  return Math.round(n).toLocaleString("cs-CZ") + " Kč";
}

/** Součet denní útraty (všechny kanály) po měsících pro daný rok. Index 0 = leden. */
async function fetchMonthlySpend(year: number): Promise<number[]> {
  const rows = await fetchCSV(sheetCsvUrl(ADSPEND_SHEET_ID, ADSPEND_GID));
  const totals = new Array(12).fill(0);
  if (rows.length < 2) return totals;

  const header = rows[0].map(h => h.toLowerCase().trim());
  const dateIdx = header.indexOf("date");
  const costIdx = header.indexOf("cost");
  if (dateIdx < 0 || costIdx < 0) return totals;

  const prefix = `${year}-`;
  for (const row of rows.slice(1)) {
    const date = row[dateIdx];
    if (!date || !date.startsWith(prefix)) continue;
    const month = parseInt(date.substring(5, 7), 10);
    if (month < 1 || month > 12) continue;
    totals[month - 1] += parseFloat(row[costIdx]) || 0;
  }
  return totals;
}

/** Dopočítá měsíční přehled roku z leads sheetu (poptávky/realizace/marže) a ad-spend sheetu (útrata). */
async function computeYearRows(year: number): Promise<MonthRow[]> {
  const sheetDef = LEADS_YEAR_SHEETS[year];
  if (!sheetDef) return [];

  const [leadsCsv, monthlySpend] = await Promise.all([
    fetchCSV(leadsSheetUrl(sheetDef.gid)).catch(() => []),
    fetchMonthlySpend(year).catch(() => new Array(12).fill(0)),
  ]);

  const leads = parseNewRows(leadsCsv, `${year}-01-01`, `${year}-12-31`, sheetDef.noDate ?? false);

  const rows: MonthRow[] = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, "0");
    const monthLeads = leads.filter(l => l.date.startsWith(`${year}-${mm}`));

    const poptavky = monthLeads.length;
    const realizace = monthLeads.filter(l => l.realizace === "Ano").length;
    const marzeSum = monthLeads
      .filter(l => l.realizace === "Ano" && l.marze !== null)
      .reduce((sum, l) => sum + (l.marze ?? 0), 0);
    const utrata = Math.round(monthlySpend[m - 1] || 0);

    const hasData = poptavky > 0 || utrata > 0;

    rows.push({
      cislo: String(m),
      mesic: MONTH_NAMES[m - 1],
      utrata:      hasData ? fmtKc(utrata) : "",
      poptavky:    hasData ? String(poptavky) : "",
      cpPoptavky:  hasData && poptavky > 0  ? fmtKc(utrata / poptavky)  : "",
      realizace:   hasData ? String(realizace) : "",
      cpRealizace: hasData && realizace > 0 ? fmtKc(utrata / realizace) : "",
      marze:       hasData ? fmtKc(marzeSum) : "",
    });
  }
  return rows;
}

export async function GET() {
  try {
    const [manualResult, y2025, y2026] = await Promise.allSettled([
      fetchCSV(sheetCsvUrl(HISTORY_SHEET_ID, HISTORY_GID_2024)),
      computeYearRows(2025),
      computeYearRows(2026),
    ]);

    return NextResponse.json({
      y2024: manualResult.status === "fulfilled" ? parseManualRows(manualResult.value) : [],
      y2025: y2025.status === "fulfilled" ? y2025.value : [],
      y2026: y2026.status === "fulfilled" ? y2026.value : [],
    });
  } catch (error) {
    console.error("history error:", error);
    return NextResponse.json({ error: "Nepodařilo se načíst historii" }, { status: 500 });
  }
}
