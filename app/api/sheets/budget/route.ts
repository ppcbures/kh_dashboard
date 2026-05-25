import { NextResponse } from "next/server";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1jfwleBkdF5hlqPwbJ1CQh2aZzpHJ47_d_DPXB9GbZCE/export?format=csv&gid=2080600156";

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

export async function GET() {
  try {
    const res = await fetch(SHEET_CSV_URL, { redirect: "follow", cache: "no-store" });
    if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
    const csvText = await res.text();

    const rows = parseCSV(csvText);
    if (rows.length < 2) throw new Error("Prázdný sheet");

    // Řádek 2 = data (index 1)
    const d = rows[1];
    // Sloupce: A=Jméno, B=Ads-rozp, C=Ads-ideal, D=Sklik-rozp, E=Sklik-ideal,
    //          F=FB-rozp, G=FB-ideal, H=Bing-rozp, I=Bing-ideal, J=Plán pro

    return NextResponse.json({
      planPro: d[9] || "",          // J
      google:  { budget: parseFloat(d[1]) || 0, ideal: parseFloat(d[2]) || 0 },
      seznam:  { budget: parseFloat(d[3]) || 0, ideal: parseFloat(d[4]) || 0 },
      facebook:{ budget: parseFloat(d[5]) || 0, ideal: parseFloat(d[6]) || 0 },
      bing:    { budget: parseFloat(d[7]) || 0, ideal: parseFloat(d[8]) || 0 },
    });
  } catch (error) {
    console.error("budget error:", error);
    return NextResponse.json({ error: "Nepodařilo se načíst rozpočet" }, { status: 500 });
  }
}
