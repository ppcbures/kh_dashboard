import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const CONVERSION_EVENTS = [
  "generate_lead",
  "contact_click_tel",
  "contact_click_email",
  "contact_copy_tel",
  "contact_copy_email",
];

function buildPath(values: string[]): string {
  return values.map(v => v || "").filter(v => v && v !== "(not set)").join(" - ");
}

function formatDate(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd;
  const d = parseInt(yyyymmdd.slice(6, 8));
  const m = parseInt(yyyymmdd.slice(4, 6));
  const y = yyyymmdd.slice(0, 4);
  return `${d}. ${m}. ${y}`;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const accessToken = authHeader?.replace("Bearer ", "");
  if (!accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId") || "";
  const startDate  = searchParams.get("startDate")  || "30daysAgo";
  const endDate    = searchParams.get("endDate")    || "today";

  if (!propertyId) return NextResponse.json({ error: "propertyId required" }, { status: 400 });

  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const analyticsData = google.analyticsdata({ version: "v1beta", auth });

    // Dimensions: [0] date, [1] eventName, [2..16] cesta_1..15, [17] form_fullname
    const dimensions = [
      { name: "date" },
      { name: "eventName" },
      ...Array.from({ length: 15 }, (_, i) => ({ name: `customEvent:cesta_${i + 1}` })),
      { name: "customEvent:form_fullname" },
    ];

    const property = propertyId.startsWith("properties/") ? propertyId : `properties/${propertyId}`;
    const response = await analyticsData.properties.runReport({
      property,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions,
        metrics: [{ name: "eventCount" }, { name: "totalUsers" }],
        dimensionFilter: {
          filter: {
            fieldName: "eventName",
            inListFilter: { values: CONVERSION_EVENTS },
          },
        },
        orderBys: [{ dimension: { dimensionName: "date" }, desc: true }],
        limit: "10000",
      },
    });

    const rows = (response.data.rows || []).map((r) => {
      const dims = r.dimensionValues || [];
      return {
        dateRaw:      dims[0]?.value || "",
        date:         formatDate(dims[0]?.value || ""),
        eventName:    dims[1]?.value || "",
        userPath:     buildPath(dims.slice(2, 17).map((d) => d.value || "")),
        formFullname: dims[17]?.value || "",
        users:        parseInt(r.metricValues?.[1]?.value || "0"),
      };
    });

    return NextResponse.json({ rows });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const detail = (error as { errors?: unknown })?.errors;
    console.error("Conversions API error:", msg, detail);
    return NextResponse.json({ error: msg, detail }, { status: 500 });
  }
}
