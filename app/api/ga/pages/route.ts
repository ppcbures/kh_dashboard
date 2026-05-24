import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

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
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const analyticsData = google.analyticsdata({ version: "v1beta", auth });

    const response = await analyticsData.properties.runReport({
      property: propertyId,
      requestBody: {
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
        limit: "100",
      },
    });

    return NextResponse.json({
      rows: response.data.rows || [],
      dimensionHeaders: response.data.dimensionHeaders,
      metricHeaders: response.data.metricHeaders,
    });
  } catch (error) {
    console.error("GA pages error:", error);
    return NextResponse.json({ error: "Nepodařilo se načíst data stránek" }, { status: 500 });
  }
}
