import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const accessToken = authHeader?.replace("Bearer ", "");
  const { searchParams } = new URL(req.url);
  const siteUrl = searchParams.get("siteUrl");
  const startDate = searchParams.get("startDate") || "2024-01-01";
  const endDate = searchParams.get("endDate") || "yesterday";

  if (!accessToken || !siteUrl) {
    return NextResponse.json({ error: "Chybí parametry" }, { status: 400 });
  }

  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const sc = google.searchconsole({ version: "v1", auth });

    const [summaryRes, queriesRes, pagesRes, dateRes] = await Promise.all([
      // Celkové metriky (bez dimenze)
      sc.searchanalytics.query({
        siteUrl,
        requestBody: { startDate, endDate, rowLimit: 1 },
      }),
      // Top dotazy — seřadíme klientsky
      sc.searchanalytics.query({
        siteUrl,
        requestBody: { startDate, endDate, dimensions: ["query"], rowLimit: 25 },
      }),
      // Top stránky
      sc.searchanalytics.query({
        siteUrl,
        requestBody: { startDate, endDate, dimensions: ["page"], rowLimit: 50 },
      }),
      // Kliknutí po dnech
      sc.searchanalytics.query({
        siteUrl,
        requestBody: { startDate, endDate, dimensions: ["date"], rowLimit: 90 },
      }),
    ]);

    // Seřadit klientsky podle kliků
    const sortByClicks = (rows: typeof queriesRes.data.rows) =>
      [...(rows ?? [])].sort((a, b) => (b.clicks ?? 0) - (a.clicks ?? 0));

    const sortByDate = (rows: typeof dateRes.data.rows) =>
      [...(rows ?? [])].sort((a, b) =>
        (a.keys?.[0] ?? "").localeCompare(b.keys?.[0] ?? "")
      );

    return NextResponse.json({
      summary: summaryRes.data.rows?.[0] ?? null,
      queries: sortByClicks(queriesRes.data.rows).slice(0, 10),
      pages: sortByClicks(pagesRes.data.rows).slice(0, 50),
      dates: sortByDate(dateRes.data.rows),
    });
  } catch (error) {
    console.error("SC overview error:", error);
    return NextResponse.json({ error: "Nepodařilo se načíst Search Console data" }, { status: 500 });
  }
}
