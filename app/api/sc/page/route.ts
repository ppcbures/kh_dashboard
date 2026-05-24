import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const accessToken = authHeader?.replace("Bearer ", "");
  const { searchParams } = new URL(req.url);
  const siteUrl = searchParams.get("siteUrl");
  const pageUrl = searchParams.get("pageUrl"); // plná URL stránky
  const startDate = searchParams.get("startDate") || "2024-01-01";
  const endDate = searchParams.get("endDate") || "yesterday";

  if (!accessToken || !siteUrl || !pageUrl) {
    return NextResponse.json({ error: "Chybí parametry" }, { status: 400 });
  }

  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const sc = google.searchconsole({ version: "v1", auth });

    const [summaryRes, queriesRes] = await Promise.all([
      // Souhrn pro stránku
      sc.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate, endDate,
          dimensions: ["page"],
          dimensionFilterGroups: [{
            filters: [{ dimension: "page", operator: "equals", expression: pageUrl }],
          }],
          rowLimit: 1,
        },
      }),
      // Top dotazy pro stránku
      sc.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate, endDate,
          dimensions: ["query"],
          dimensionFilterGroups: [{
            filters: [{ dimension: "page", operator: "equals", expression: pageUrl }],
          }],
          rowLimit: 15,
        },
      }),
    ]);

    const queries = [...(queriesRes.data.rows ?? [])]
      .sort((a, b) => (b.clicks ?? 0) - (a.clicks ?? 0));

    return NextResponse.json({
      summary: summaryRes.data.rows?.[0] ?? null,
      queries,
    });
  } catch (error) {
    console.error("SC page error:", error);
    return NextResponse.json({ error: "Nepodařilo se načíst data stránky" }, { status: 500 });
  }
}
