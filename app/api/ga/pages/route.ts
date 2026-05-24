import { NextRequest, NextResponse } from "next/server";
import { BetaAnalyticsDataClient } from "@googleapis/analyticsdata";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const accessToken = authHeader?.replace("Bearer ", "");
  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId"); // např. "properties/123456789"
  const startDate = searchParams.get("startDate") || "2024-01-01";
  const endDate = searchParams.get("endDate") || "yesterday";

  if (!accessToken || !propertyId) {
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

    // Načíst seznam stránek s metrikami
    const [response] = await analyticsData.runReport({
      property: propertyId,
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: "pagePath" },
        { name: "pageTitle" },
        { name: "sessionSourceMedium" },
      ],
      metrics: [
        { name: "screenPageViews" },
        { name: "averageSessionDuration" },
        { name: "bounceRate" },
        { name: "sessions" },
        { name: "totalUsers" },
      ],
      orderBys: [
        {
          metric: { metricName: "screenPageViews" },
          desc: true,
        },
      ],
      limit: 100,
    });

    return NextResponse.json({ rows: response.rows || [], dimensionHeaders: response.dimensionHeaders, metricHeaders: response.metricHeaders });
  } catch (error) {
    console.error("GA pages error:", error);
    return NextResponse.json({ error: "Nepodařilo se načíst data stránek" }, { status: 500 });
  }
}
