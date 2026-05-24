import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const accessToken = authHeader?.replace("Bearer ", "");

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const analyticsAdmin = google.analyticsadmin({ version: "v1beta", auth });

    // Načíst všechny GA4 properties přes account summaries
    const res = await analyticsAdmin.accountSummaries.list();
    const accountSummaries = res.data.accountSummaries || [];

    const properties: { name: string; displayName: string; account: string }[] = [];

    for (const account of accountSummaries) {
      for (const prop of account.propertySummaries || []) {
        if (prop.property && prop.displayName) {
          properties.push({
            name: prop.property,
            displayName: prop.displayName,
            account: account.displayName || "",
          });
        }
      }
    }

    return NextResponse.json({ properties });
  } catch (error) {
    console.error("GA properties error:", error);
    return NextResponse.json({ error: "Nepodařilo se načíst GA4 properties" }, { status: 500 });
  }
}
