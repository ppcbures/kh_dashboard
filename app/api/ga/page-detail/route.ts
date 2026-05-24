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

    const pageFilter = {
      filter: {
        fieldName: "pagePath",
        stringFilter: { matchType: "EXACT" as const, value: pagePath },
      },
    };

    const [sourcesRes, summaryRes, prevPagesRes, nextPagesRes, clicksRes] = await Promise.allSettled([

      // Zdroje / média
      analyticsData.properties.runReport({
        property: propertyId,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: "pagePath" }, { name: "sessionSourceMedium" }],
          metrics: [{ name: "sessions" }, { name: "screenPageViews" }, { name: "totalUsers" }],
          dimensionFilter: pageFilter,
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: "20",
        },
      }),

      // Souhrnné metriky
      analyticsData.properties.runReport({
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
          dimensionFilter: pageFilter,
        },
      }),

      // Předchozí stránky — co uživatelé navštívili PŘED touto stránkou
      // pagePath = aktuální stránka, previousPagePath = odkud přišli
      analyticsData.properties.runReport({
        property: propertyId,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: "pagePath" }, { name: "previousPagePath" }],
          metrics: [{ name: "screenPageViews" }],
          dimensionFilter: pageFilter,
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
          limit: "11",
        },
      }),

      // Následující stránky — kam uživatelé šli PO této stránce
      // previousPagePath = aktuální stránka, pagePath = kam šli
      analyticsData.properties.runReport({
        property: propertyId,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: "previousPagePath" }, { name: "pagePath" }],
          metrics: [{ name: "screenPageViews" }],
          dimensionFilter: {
            filter: {
              fieldName: "previousPagePath",
              stringFilter: { matchType: "EXACT" as const, value: pagePath },
            },
          },
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
          limit: "11",
        },
      }),

      // Kliknutí — vlastní událost link_click
      analyticsData.properties.runReport({
        property: propertyId,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [
            { name: "customEvent:click_text" },
            { name: "customEvent:click_url" },
          ],
          metrics: [{ name: "eventCount" }, { name: "totalUsers" }],
          dimensionFilter: {
            andGroup: {
              expressions: [
                {
                  filter: {
                    fieldName: "eventName",
                    stringFilter: { matchType: "EXACT", value: "link_click" },
                  },
                },
                pageFilter,
              ],
            },
          },
          orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
          limit: "20",
        },
      }),
    ]);

    // Promise.allSettled — selhání jednoho dotazu nerozbije ostatní
    const get = <T>(res: PromiseSettledResult<T>) =>
      res.status === "fulfilled" ? res.value : null;

    const getErr = (res: PromiseSettledResult<unknown>) =>
      res.status === "rejected" ? String((res.reason as { message?: string })?.message || res.reason) : null;

    const sources = get(sourcesRes);
    const summary = get(summaryRes);
    const prevPages = get(prevPagesRes);
    const nextPages = get(nextPagesRes);
    const clicks = get(clicksRes);

    // Logovat chyby pro debugging
    if (prevPagesRes.status === "rejected") console.warn("prevPages failed:", prevPagesRes.reason);
    if (nextPagesRes.status === "rejected") console.warn("nextPages failed:", nextPagesRes.reason);
    if (clicksRes.status === "rejected") console.warn("link_click failed:", clicksRes.reason);

    // prevPages: dimenze jsou [pagePath, previousPagePath] — bereme index 1 (previousPagePath)
    const prevRows = (prevPages?.data?.rows || [])
      .map((row) => ({
        dimensionValues: [{ value: row.dimensionValues?.[1]?.value || "" }],
        metricValues: row.metricValues,
      }))
      .filter((r) => r.dimensionValues[0].value && r.dimensionValues[0].value !== "(entrance)");

    // nextPages: dimenze jsou [previousPagePath, pagePath] — bereme index 1 (pagePath)
    const nextRows = (nextPages?.data?.rows || [])
      .map((row) => ({
        dimensionValues: [{ value: row.dimensionValues?.[1]?.value || "" }],
        metricValues: row.metricValues,
      }))
      .filter((r) => r.dimensionValues[0].value && r.dimensionValues[0].value !== "(exit)");

    return NextResponse.json({
      summary: summary?.data?.rows?.[0] || null,
      sources: sources?.data?.rows || [],
      prevPages: prevRows,
      nextPages: nextRows,
      clicks: clicks?.data?.rows || [],
      _debug: {
        prevPagesStatus: prevPagesRes.status,
        prevPagesError: getErr(prevPagesRes),
        prevPagesRawCount: prevPages?.data?.rows?.length ?? 0,
        prevPagesCount: prevRows.length,
        nextPagesStatus: nextPagesRes.status,
        nextPagesError: getErr(nextPagesRes),
        nextPagesRawCount: nextPages?.data?.rows?.length ?? 0,
        nextPagesCount: nextRows.length,
        clicksStatus: clicksRes.status,
        clicksError: getErr(clicksRes),
        pagePath,
        startDate,
        endDate,
      },
    });
  } catch (error) {
    console.error("GA page-detail error:", error);
    return NextResponse.json({ error: "Nepodařilo se načíst detail stránky" }, { status: 500 });
  }
}
