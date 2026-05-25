import { NextRequest, NextResponse } from "next/server";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1tptPD0plitUuPn9_8lk17bNCbBT2kDdLzuV9Kglu5xg/export?format=csv&gid=201491332";

/** Jednoduchý CSV parser — zvládne uvozovkované pole */
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "Chybí startDate / endDate" }, { status: 400 });
  }

  try {
    const res = await fetch(SHEET_CSV_URL, { redirect: "follow", cache: "no-store" });
    if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
    const csvText = await res.text();

    const rows = parseCSV(csvText);
    if (rows.length < 2) return NextResponse.json({ facebook: 0, google: 0, seznam: 0, bing: 0 });

    const headers = rows[0].map((h) => h.toLowerCase().replace(/\s/g, "_"));
    const dateIdx = headers.indexOf("date");
    const sourceIdx = headers.indexOf("source");
    const costIdx = headers.indexOf("cost");

    if (dateIdx < 0 || sourceIdx < 0 || costIdx < 0) {
      return NextResponse.json({ error: "Neočekávané sloupce v sheetu" }, { status: 500 });
    }

    const totals = { facebook: 0, google: 0, seznam: 0, bing: 0 };

    for (const row of rows.slice(1)) {
      const date = row[dateIdx];
      const source = (row[sourceIdx] || "").toLowerCase().trim();
      const cost = parseFloat(row[costIdx]) || 0;

      if (!date || date < startDate || date > endDate) continue;

      if (source === "facebook") totals.facebook += cost;
      else if (source === "google") totals.google += cost;
      else if (source === "seznam" || source === "sklik") totals.seznam += cost;
      else if (source === "bing") totals.bing += cost;
    }

    // Zaokrouhlit na 2 desetinná místa
    return NextResponse.json({
      facebook: Math.round(totals.facebook),
      google: Math.round(totals.google),
      seznam: Math.round(totals.seznam),
      bing: Math.round(totals.bing),
    });
  } catch (error) {
    console.error("adspend error:", error);
    return NextResponse.json({ error: "Nepodařilo se načíst data" }, { status: 500 });
  }
}
