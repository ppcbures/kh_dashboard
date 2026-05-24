"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import DateRangePicker, { DateRange, getDefaultRange } from "@/components/DateRangePicker";

const SITE_KEYWORD = process.env.NEXT_PUBLIC_SITE_KEYWORD || "klimatizace-hustopece";

interface ScRow {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface Overview {
  summary: ScRow | null;
  queries: ScRow[];
  pages: ScRow[];
  dates: ScRow[];
}

interface PageDetail {
  summary: ScRow | null;
  queries: ScRow[];
}

function fmt(n: number, dec = 0) {
  return n.toLocaleString("cs-CZ", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtPct(n: number) { return (n * 100).toFixed(1) + " %"; }
function fmtPos(n: number) { return n.toFixed(1); }

function ScCard({ label, value, sub, color, active, onClick, sortAsc }: {
  label: string; value: string; sub?: string; color?: string;
  active?: boolean; onClick?: () => void; sortAsc?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-xl border p-4 border-t-2 text-left w-full transition-all ${
        active ? "ring-2 ring-offset-1 shadow-md" : "border-gray-200 hover:shadow-sm"
      }`}
      style={{ borderTopColor: color || "#e30613", ...(active ? { ringColor: color || "#e30613" } : {}) }}
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        {active && (
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d={sortAsc ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
          </svg>
        )}
      </div>
      <p className="text-2xl font-bold text-black">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </button>
  );
}

export default function SearchConsolePage() {
  const { data: session } = useSession();
  const accessToken = (session as { accessToken?: string })?.accessToken;

  const [dateRange, setDateRange] = useState<DateRange>(getDefaultRange());
  const [siteUrl, setSiteUrl] = useState<string | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [errorOverview, setErrorOverview] = useState<string | null>(null);

  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [pageDetail, setPageDetail] = useState<PageDetail | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [search, setSearch] = useState("");
  type SortKey = "clicks" | "impressions" | "ctr" | "position";
  const [sortBy, setSortBy] = useState<SortKey>("clicks");

  // Načíst seznam webů a vybrat správný
  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/sc/sites", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((data) => {
        const sites: { siteUrl: string }[] = data.sites || [];
        const match = sites.find((s) => s.siteUrl.includes(SITE_KEYWORD)) ?? sites[0];
        if (match) setSiteUrl(match.siteUrl);
      })
      .catch(console.error);
  }, [accessToken]);

  // Načíst přehled
  const fetchOverview = useCallback(async () => {
    if (!accessToken || !siteUrl) return;
    setLoadingOverview(true);
    setErrorOverview(null);
    try {
      const res = await fetch(
        `/api/sc/overview?siteUrl=${encodeURIComponent(siteUrl)}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOverview(data);
    } catch (e) {
      setErrorOverview(e instanceof Error ? e.message : "Chyba");
    } finally {
      setLoadingOverview(false);
    }
  }, [accessToken, siteUrl, dateRange]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  // Načíst detail stránky
  const fetchPage = useCallback(async (pageKey: string) => {
    if (!accessToken || !siteUrl) return;
    setSelectedPage(pageKey);
    setLoadingPage(true);
    setPageDetail(null);
    try {
      const res = await fetch(
        `/api/sc/page?siteUrl=${encodeURIComponent(siteUrl)}&pageUrl=${encodeURIComponent(pageKey)}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await res.json();
      setPageDetail(data);
    } catch (e) { console.error(e); }
    finally { setLoadingPage(false); }
  }, [accessToken, siteUrl, dateRange]);

  // Když se změní datum, přenačti detail
  useEffect(() => {
    if (selectedPage) fetchPage(selectedPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  const filteredPages = (overview?.pages ?? [])
    .filter((p) => (p.keys?.[0] ?? "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sortBy === "position"
        ? (a.position ?? 0) - (b.position ?? 0)        // vzestupně (1 je nejlepší)
        : sortBy === "ctr"
        ? (b.ctr ?? 0) - (a.ctr ?? 0)                  // sestupně
        : sortBy === "impressions"
        ? (b.impressions ?? 0) - (a.impressions ?? 0)  // sestupně
        : (b.clicks ?? 0) - (a.clicks ?? 0)            // sestupně (výchozí)
    );

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b-2 bg-white" style={{ borderBottomColor: "#e30613" }}>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Google Search Console</h1>
          {siteUrl && <p className="text-sm text-gray-500 mt-0.5">{siteUrl}</p>}
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {loadingOverview ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-red-600 rounded-full animate-spin" />
        </div>
      ) : errorOverview ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-red-500 text-sm">{errorOverview}</p>
        </div>
      ) : overview ? (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Celkové KPI — kliknutím seřadíš stránky */}
          <div className="px-6 py-4 border-b border-gray-200 bg-white">
            <p className="text-xs text-gray-400 mb-2">Kliknutím na kartu seřadíš stránky vlevo</p>
            <div className="grid grid-cols-4 gap-4">
              <ScCard label="Kliky" value={fmt(overview.summary?.clicks ?? 0)}
                active={sortBy === "clicks"} sortAsc={false}
                onClick={() => setSortBy("clicks")} />
              <ScCard label="Zobrazení" value={fmt(overview.summary?.impressions ?? 0)} color="#1a1a1a"
                active={sortBy === "impressions"} sortAsc={false}
                onClick={() => setSortBy("impressions")} />
              <ScCard label="Průměrná CTR" value={fmtPct(overview.summary?.ctr ?? 0)} color="#374151"
                active={sortBy === "ctr"} sortAsc={false}
                onClick={() => setSortBy("ctr")} />
              <ScCard label="Průměrná pozice" value={fmtPos(overview.summary?.position ?? 0)}
                sub="čím nižší, tím lepší" color="#6b7280"
                active={sortBy === "position"} sortAsc={true}
                onClick={() => setSortBy("position")} />
            </div>
          </div>

          {/* Spodní část — stránky + detail */}
          <div className="flex flex-1 overflow-hidden">
            {/* Levý panel — seznam stránek */}
            {sidebarOpen ? (
              <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50 flex-shrink-0">
                <div className="p-3 border-b border-gray-200 flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Hledat stránku..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
                  />
                  <button
                    onClick={() => setSidebarOpen(false)}
                    title="Skrýt výpis stránek"
                    className="flex-shrink-0 p-2 rounded-lg text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {filteredPages.map((p) => {
                    const url = p.keys?.[0] ?? "";
                    const isActive = selectedPage === url;
                    return (
                      <button
                        key={url}
                        onClick={() => fetchPage(url)}
                        className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-white transition-colors ${isActive ? "bg-white border-l-2 border-l-red-500" : ""}`}
                      >
                        <p className="text-sm font-medium text-gray-800 truncate" title={url}>
                          {url.replace(/^https?:\/\/[^/]+/, "") || "/"}
                        </p>
                        <div className="flex gap-3 mt-1">
                          <span className="text-xs text-gray-600"><span className="font-semibold">{fmt(p.clicks)}</span> kliků</span>
                          <span className="text-xs text-gray-400">pos. {fmtPos(p.position)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="border-r border-gray-200 bg-gray-50 flex flex-col items-center py-4">
                <button
                  onClick={() => setSidebarOpen(true)}
                  title="Otevřít seznam stránek"
                  className="p-2 rounded-lg text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}

            {/* Pravý panel */}
            <div className="flex-1 overflow-y-auto p-6">
              {!selectedPage ? (
                <div className="flex flex-col gap-8">
                  {/* Top dotazy */}
                  <div>
                    <h3 className="text-base font-semibold text-gray-800 mb-3">Top dotazy</h3>
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-4 py-3 text-gray-600 font-semibold">Dotaz</th>
                            <th className="text-right px-4 py-3 text-gray-600 font-semibold">Kliky</th>
                            <th className="text-right px-4 py-3 text-gray-600 font-semibold">Zobrazení</th>
                            <th className="text-right px-4 py-3 text-gray-600 font-semibold">CTR</th>
                            <th className="text-right px-4 py-3 text-gray-600 font-semibold">Pozice</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overview.queries.map((q, i) => (
                            <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="px-4 py-3 text-gray-700 font-medium">{q.keys?.[0]}</td>
                              <td className="px-4 py-3 text-right text-gray-800 font-semibold">{fmt(q.clicks)}</td>
                              <td className="px-4 py-3 text-right text-gray-600">{fmt(q.impressions)}</td>
                              <td className="px-4 py-3 text-right text-gray-600">{fmtPct(q.ctr)}</td>
                              <td className="px-4 py-3 text-right text-gray-600">{fmtPos(q.position)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : loadingPage ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-8 h-8 border-2 border-gray-300 border-t-red-500 rounded-full animate-spin" />
                </div>
              ) : pageDetail ? (
                <div>
                  <div className="mb-6">
                    <h2 className="text-lg font-bold text-gray-900 break-all">
                      {selectedPage.replace(/^https?:\/\/[^/]+/, "") || "/"}
                    </h2>
                    <a
                      href={selectedPage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-0.5 font-mono"
                    >
                      {selectedPage}
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <ScCard label="Kliky" value={fmt(pageDetail.summary?.clicks ?? 0)} />
                    <ScCard label="Zobrazení" value={fmt(pageDetail.summary?.impressions ?? 0)} color="#1a1a1a" />
                    <ScCard label="CTR" value={fmtPct(pageDetail.summary?.ctr ?? 0)} color="#374151" />
                    <ScCard label="Průměrná pozice" value={fmtPos(pageDetail.summary?.position ?? 0)} color="#6b7280" />
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-gray-800 mb-3">Dotazy pro tuto stránku</h3>
                    {pageDetail.queries.length === 0 ? (
                      <p className="text-gray-400 text-sm">Žádná data</p>
                    ) : (
                      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="text-left px-4 py-3 text-gray-600 font-semibold">Dotaz</th>
                              <th className="text-right px-4 py-3 text-gray-600 font-semibold">Kliky</th>
                              <th className="text-right px-4 py-3 text-gray-600 font-semibold">Zobrazení</th>
                              <th className="text-right px-4 py-3 text-gray-600 font-semibold">CTR</th>
                              <th className="text-right px-4 py-3 text-gray-600 font-semibold">Pozice</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pageDetail.queries.map((q, i) => (
                              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="px-4 py-3 text-gray-700 font-medium">{q.keys?.[0]}</td>
                                <td className="px-4 py-3 text-right text-gray-800 font-semibold">{fmt(q.clicks)}</td>
                                <td className="px-4 py-3 text-right text-gray-600">{fmt(q.impressions)}</td>
                                <td className="px-4 py-3 text-right text-gray-600">{fmtPct(q.ctr)}</td>
                                <td className="px-4 py-3 text-right text-gray-600">{fmtPos(q.position)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
