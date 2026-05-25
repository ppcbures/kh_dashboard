import { NextResponse } from "next/server";

const SHEET_ID = "1w4mcPVe3Xhj46Lj0I4CYjaPivwCGRQ5q0jl7QtwetPc";

const YEAR_GIDS: Record<number, string> = {
  2024: "0",
  2025: "544010130",
  2026: "456676493",
};

function sheetUrl(gid: string) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQ && text[i + 1] === '"') { field += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      currentRow.push(field.trim()); field = "";
    } else if ((ch === "\n" || ch === "\r") && !inQ) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      currentRow.push(field.trim()); field = "";
      if (currentRow.some(f => f !== "")) rows.push(currentRow);
      currentRow = [];
    } else {
      field += ch;
    }
  }
  currentRow.push(field.trim());
  if (currentRow.some(f => f !== "")) rows.push(currentRow);
  return rows;
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

function parseRows(csv: string): MonthRow[] {
  const rows = parseCSV(csv);
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

export async function GET() {
  try {
    const results = await Promise.allSettled(
      Object.entries(YEAR_GIDS).map(async ([year, gid]) => {
        const res = await fetch(sheetUrl(gid), { redirect: "follow", cache: "no-store" });
        if (!res.ok) throw new Error(`${year}: HTTP ${res.status}`);
        const text = await res.text();
        return { year: parseInt(year), rows: parseRows(text) };
      })
    );

    const data: Record<number, MonthRow[]> = {};
    for (const r of results) {
      if (r.status === "fulfilled") {
        data[r.value.year] = r.value.rows;
      }
    }

    return NextResponse.json({
      y2024: data[2024] ?? [],
      y2025: data[2025] ?? [],
      y2026: data[2026] ?? [],
    });
  } catch (error) {
    console.error("history error:", error);
    return NextResponse.json({ error: "Nepodařilo se načíst historii" }, { status: 500 });
  }
}
