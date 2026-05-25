import { NextRequest, NextResponse } from "next/server";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1dNbouYH5exODaxr7e3nEK1W8HbBEO7PQh7xE7-NVQBI/export?format=csv";

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const fields: string[] = [];
    let field = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { fields.push(field.trim()); field = ""; }
      else { field += ch; }
    }
    fields.push(field.trim());
    rows.push(fields);
  }
  return rows;
}

export interface LeadRow {
  id: string;
  date: string;       // YYYY-MM-DD
  name: string;
  realizace: boolean; // true = "Ano"
  marze: number | null; // null = nevyplněno u realizace
  marzeChybi: boolean;  // realizace=Ano ale marže nevyplněna
  zdroj: string;      // první část "google / cpc" → "google"
  kampan: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  if (!startDate || !endDate)
    return NextResponse.json({ error: "Chybí parametry" }, { status: 400 });

  try {
    const res = await fetch(SHEET_CSV_URL, { redirect: "follow", cache: "no-store" });
    if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
    const csvText = await res.text();

    const rows = parseCSV(csvText);
    if (rows.length < 2) return NextResponse.json({ rows: [], stats: { count: 0, realizace: 0, totalMarze: 0 } });

    // Sloupce: 0=Typ, 1=ID, 2=Datum, 3=Jméno, 4=Email, 5=Poznámka,
    //          6=Zdroj Medium, 7=Kampaň, 8=Aktualizace, 9=Realizace,
    //          10=Hodnota realizace, 11=Poznámka klient
    const leads: LeadRow[] = [];
    let totalMarze = 0;
    let realizaceCount = 0;

    for (const row of rows.slice(1)) {
      // Datum: "2023-01-30 8:46:55" → vzít jen datum část
      const rawDate = row[2] || "";
      const dateOnly = rawDate.split(" ")[0]; // YYYY-MM-DD
      if (!dateOnly || dateOnly < startDate || dateOnly > endDate) continue;

      const realizace = (row[9] || "").trim().toLowerCase() === "ano";
      const rawMarze = (row[10] || "").trim();
      const marze = rawMarze && rawMarze !== "-" && rawMarze !== "" && !isNaN(parseFloat(rawMarze))
        ? parseFloat(rawMarze)
        : null;
      const marzeChybi = realizace && marze === null;

      if (realizace) {
        realizaceCount++;
        if (marze !== null) totalMarze += marze;
      }

      // Zdroj: "google / cpc" → "google"
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

    // Seřadit sestupně dle data
    leads.sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({
      rows: leads,
      stats: {
        count: leads.length,
        realizace: realizaceCount,
        totalMarze: Math.round(totalMarze),
      },
    });
  } catch (error) {
    console.error("leads error:", error);
    return NextResponse.json({ error: "Nepodařilo se načíst poptávky" }, { status: 500 });
  }
}
