import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const CONVERSION_EVENTS = [
  "generate_lead",
  "contact_click_tel",
  "contact_click_email",
  "contact_copy_tel",
  "contact_copy_email",
];

function buildPath(values: (string | undefined)[]): string {
  return (values || [])
    .map(v => v || "")
    .filter(v => v && v !== "(not set)")
    .join(" - ");
}

function formatDate(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd;
  const d = parseInt(yyyymmdd.slice(6, 8));
  const m = parseInt(yyyymmdd.slice(4, 6));
  const y = yyyymmdd.slice(0, 4);
  return `${d}. ${m}. ${y}`;
}

function val(row: { dimensionValues?: { value?: string | null }[] }, idx: number): string {
  return row.dimensionValues?.[idx]?.value || "";
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
    const ga = google.analyticsdata({ version: "v1beta", auth });

    const property = propertyId.startsWith("properties/") ? propertyId : `properties/${propertyId}`;

    const baseFilter = {
      filter: {
        fieldName: "eventName",
        inListFilter: { values: CONVERSION_EVENTS },
      },
    };

    const baseOptions = {
      dateRanges: [{ startDate, endDate }],
      metrics: [{ name: "totalUsers" }],
      dimensionFilter: baseFilter,
      limit: "10000",
    };

    // 3 paralelní requesty — max 9 dimenzí každý
    // Sdílený join klíč: date + eventName + cesta_1 + cesta_2 + cesta_3

    const [r1, r2, r3] = await Promise.all([
      // Request 1: date, eventName, cesta_1..7  (9 dims)
      ga.properties.runReport({
        property,
        requestBody: {
          ...baseOptions,
          dimensions: [
            { name: "date" },
            { name: "eventName" },
            { name: "customEvent:cesta_1" },
            { name: "customEvent:cesta_2" },
            { name: "customEvent:cesta_3" },
            { name: "customEvent:cesta_4" },
            { name: "customEvent:cesta_5" },
            { name: "customEvent:cesta_6" },
            { name: "customEvent:cesta_7" },
          ],
          orderBys: [{ dimension: { dimensionName: "date" }, desc: true }],
        },
      }),

      // Request 2: date, eventName, cesta_1..3, cesta_8..11  (9 dims)
      ga.properties.runReport({
        property,
        requestBody: {
          ...baseOptions,
          dimensions: [
            { name: "date" },
            { name: "eventName" },
            { name: "customEvent:cesta_1" },
            { name: "customEvent:cesta_2" },
            { name: "customEvent:cesta_3" },
            { name: "customEvent:cesta_8" },
            { name: "customEvent:cesta_9" },
            { name: "customEvent:cesta_10" },
            { name: "customEvent:cesta_11" },
          ],
        },
      }),

      // Request 3: date, eventName, cesta_1..3, cesta_12..14, form_fullname  (9 dims)
      ga.properties.runReport({
        property,
        requestBody: {
          ...baseOptions,
          dimensions: [
            { name: "date" },
            { name: "eventName" },
            { name: "customEvent:cesta_1" },
            { name: "customEvent:cesta_2" },
            { name: "customEvent:cesta_3" },
            { name: "customEvent:cesta_12" },
            { name: "customEvent:cesta_13" },
            { name: "customEvent:cesta_14" },
            { name: "customEvent:form_fullname" },
          ],
        },
      }),
    ]);

    // --- Join ---
    // Klíč = date | eventName | cesta_1 | cesta_2 | cesta_3
    type Ext2 = { c8: string; c9: string; c10: string; c11: string };
    type Ext3 = { c12: string; c13: string; c14: string; formFullname: string };

    const map2 = new Map<string, Ext2>();
    for (const row of r2.data.rows || []) {
      const key = `${val(row, 0)}|${val(row, 1)}|${val(row, 2)}|${val(row, 3)}|${val(row, 4)}`;
      map2.set(key, {
        c8:  val(row, 5),
        c9:  val(row, 6),
        c10: val(row, 7),
        c11: val(row, 8),
      });
    }

    const map3 = new Map<string, Ext3>();
    for (const row of r3.data.rows || []) {
      const key = `${val(row, 0)}|${val(row, 1)}|${val(row, 2)}|${val(row, 3)}|${val(row, 4)}`;
      map3.set(key, {
        c12:          val(row, 5),
        c13:          val(row, 6),
        c14:          val(row, 7),
        formFullname: val(row, 8),
      });
    }

    const rows = (r1.data.rows || []).map((row) => {
      const dateRaw   = val(row, 0);
      const eventName = val(row, 1);
      const c1 = val(row, 2);
      const c2 = val(row, 3);
      const c3 = val(row, 4);
      const c4 = val(row, 5);
      const c5 = val(row, 6);
      const c6 = val(row, 7);
      const c7 = val(row, 8);

      const key = `${dateRaw}|${eventName}|${c1}|${c2}|${c3}`;
      const ext2 = map2.get(key);
      const ext3 = map3.get(key);

      const userPath = buildPath([
        c1, c2, c3, c4, c5, c6, c7,
        ext2?.c8,  ext2?.c9,  ext2?.c10, ext2?.c11,
        ext3?.c12, ext3?.c13, ext3?.c14,
      ]);

      return {
        dateRaw,
        date:         formatDate(dateRaw),
        eventName,
        userPath,
        formFullname: ext3?.formFullname || "",
        users:        parseInt(row.metricValues?.[0]?.value || "0"),
      };
    });

    return NextResponse.json({ rows });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Conversions API error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
