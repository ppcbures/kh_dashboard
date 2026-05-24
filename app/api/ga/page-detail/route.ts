import { NextRequest, NextResponse } from "next/server";
import { BetaAnalyticsDataClient } from "@googleapis/analyticsdata";

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
    const analyticsData = new BetaAnalyticsDataClient({
      authClient: {
        getRequestHeaders: async () => ({
          Authorization: `Bearer ${accessToken}`,
        }),
      } as never,
    });

    // Detail konkrétní stránky — zdroje/média
    const [sourcesResponse] = await analyticsData.runReport({
      property: propertyId,
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
          stringFilter: {
            matchType: "EXACT",
            value: pagePath,
          },
        },
      },
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 20,
    });

    // Souhrnné metriky pro stránku
    const [summaryResponse] = await analyticsData.runReport({
      property: propertyId,
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
          stringFilter: {
            matchType: "EXACT",
            value: pagePath,
          },
        },
      },
    });

    return NextResponse.json({
      sources: sourcesResponse.rows || [],
      summary: summaryResponse.rows?.[0] || null,
      sourceHeaders: sourcesResponse.metricHeaders,
      summaryHeaders: summaryResponse.metricHeaders,
    });
  } catch (error) {
    console.error("GA page-detail error:", error);
    return NextResponse.json({ error: "Nepodařilo se načíst detail stránky" }, { status: 500 });
  }
}
