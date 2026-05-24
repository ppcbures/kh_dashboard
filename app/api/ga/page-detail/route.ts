import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://klimatizace-hustopece.cz";

/** Převede pageReferrer na interní cestu nebo "(entrance)" */
function referrerToPath(referrer: string): string {
  if (!referrer || referrer === "(direct)") return "(entrance)";
  if (referrer.startsWith(SITE_ORIGIN)) {
    try { return new URL(referrer).pathname; } catch { return referrer.replace(SITE_ORIGIN, ""); }
  }
  return "(entrance)"; // vše externe seskupíme
}

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

    // ── Fáze 1: hlavní dotazy ────────────────────────────────────────────────
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

      // B stránky — pageReferrer při zobrazení aktuální stránky C
      analyticsData.properties.runReport({
        property: propertyId,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: "pageReferrer" }],
          metrics: [{ name: "screenPageViews" }],
          dimensionFilter: pageFilter,
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
          limit: "20",
        },
      }),

      // Následující stránky — pagePath kde pageReferrer = plná URL aktuální stránky
      analyticsData.properties.runReport({
        property: propertyId,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: "pagePath" }],
          metrics: [{ name: "screenPageViews" }],
          dimensionFilter: {
            filter: {
              fieldName: "pageReferrer",
              stringFilter: { matchType: "EXACT" as const, value: `${SITE_ORIGIN}${pagePath}` },
            },
          },
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
          limit: "10",
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

    const get = <T>(res: PromiseSettledResult<T>) =>
      res.status === "fulfilled" ? res.value : null;
    const getErr = (res: PromiseSettledResult<unknown>) =>
      res.status === "rejected" ? String((res.reason as { message?: string })?.message || res.reason) : null;

    const sources = get(sourcesRes);
    const summary = get(summaryRes);
    const prevPagesRaw = get(prevPagesRes);
    const nextPages = get(nextPagesRes);
    const clicks = get(clicksRes);

    if (prevPagesRes.status === "rejected") console.warn("prevPages failed:", prevPagesRes.reason);
    if (nextPagesRes.status === "rejected") console.warn("nextPages failed:", nextPagesRes.reason);
    if (clicksRes.status === "rejected") console.warn("link_click failed:", clicksRes.reason);

    // ── Zpracování B stránek ─────────────────────────────────────────────────
    // Seskupit: interní cesta nebo (entrance)
    const prevMapB = new Map<string, number>();
    for (const row of prevPagesRaw?.data?.rows || []) {
      const label = referrerToPath(row.dimensionValues?.[0]?.value || "");
      const views = parseInt(row.metricValues?.[0]?.value || "0");
      prevMapB.set(label, (prevMapB.get(label) || 0) + views);
    }
    const bPages = Array.from(prevMapB.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

    // ── Sestavení prevRows: [{pathB, views}] ────────────────────────────────
    const prevRows = bPages.map(([pathB, views]) => ({ pathB, views }));

    // ── Následující stránky ──────────────────────────────────────────────────
    const nextRows = (nextPages?.data?.rows || [])
      .map((row) => ({
        dimensionValues: [{ value: row.dimensionValues?.[0]?.value || "" }],
        metricValues: row.metricValues,
      }))
      .filter((r) => !!r.dimensionValues[0].value);

    return NextResponse.json({
      summary: summary?.data?.rows?.[0] || null,
      sources: sources?.data?.rows || [],
      prevPages: prevRows,
      nextPages: nextRows,
      clicks: clicks?.data?.rows || [],
      _debug: {
        prevPagesStatus: prevPagesRes.status,
        prevPagesError: getErr(prevPagesRes),
        prevPagesRawCount: prevPagesRaw?.data?.rows?.length ?? 0,
        prevPagesCount: prevRows.length,
        nextPagesStatus: nextPagesRes.status,
        nextPagesError: getErr(nextPagesRes),
        nextPagesCount: nextRows.length,
        clicksStatus: clicksRes.status,
        clicksError: getErr(clicksRes),
        pagePath,
      },
    });
  } catch (error) {
    console.error("GA page-detail error:", error);
    return NextResponse.json({ error: "Nepodařilo se načíst detail stránky" }, { status: 500 });
  }
}
