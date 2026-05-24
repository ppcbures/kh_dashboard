import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const accessToken = authHeader?.replace("Bearer ", "");
  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId");
  const pagePath = searchParams.get("pagePath");
  const startDate = searchParams.get("startDate") || "2024-01-01";
  const endDate = searchParams.get("endDate") || "yesterday";

  if (!accessToken || !propertyId || !pagePath) {
    return NextResponse.json({ error: "Chybí parametry" }, { status: 400 });
  }

  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const analyticsData = google.analyticsdata({ version: "v1beta", auth });

    // Detail konkrétní stránky — zdroje/média
    const sourcesRes = await analyticsData.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: "pagePath" },
          { name: "sessionSourceMedium" },
        ],
        metrics: [
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "totalUsers" },
        ],
        dimensionFilter: {
          filter: {
            fieldName: "pagePath",
            stringFilter: { matchType: "EXACT", value: pagePath },
          },
        },
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: "20",
      },
    });

    // Souhrnné metriky pro stránku
    const summaryRes = await analyticsData.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "pagePath" }],
        metrics: [
          { name: "screenPageViews" },
          { name: "averageSessionDuration" },
          { name: "bounceRate" },
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "userEngagementDuration" },
        ],
        dimensionFilter: {
          filter: {
            fieldName: "pagePath",
            stringFilter: { matchType: "EXACT", value: pagePath },
          },
        },
      },
    });

    return NextResponse.json({
      sources: sourcesRes.data.rows || [],
      summary: summaryRes.data.rows?.[0] || null,
      sourceHeaders: sourcesRes.data.metricHeaders,
      summaryHeaders: summaryRes.data.metricHeaders,
    });
  } catch (error) {
    console.error("GA page-detail error:", error);
    return NextResponse.json({ error: "Nepodařilo se načíst detail stránky" }, { status: 500 });
  }
}
