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
    const sc = google.searchconsole({ version: "v1", auth });

    const res = await sc.sites.list();
    const sites = (res.data.siteEntry ?? []).map((s) => ({
      siteUrl: s.siteUrl,
      permissionLevel: s.permissionLevel,
    }));

    return NextResponse.json({ sites });
  } catch (error) {
    console.error("SC sites error:", error);
    return NextResponse.json({ error: "Nepodařilo se načíst weby" }, { status: 500 });
  }
}
