"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import PropertySelector from "@/components/PropertySelector";
import DateRangePicker, { DateRange, getDefaultRange } from "@/components/DateRangePicker";

interface PageRow {
  pagePath: string;
  pageTitle: string;
  views: number;
  sessions: number;
  users: number;
  avgDuration: number; // sekundy
  bounceRate: number;  // 0–1
}

interface SourceRow {
  sourceMedium: string;
  sessions: number;
  views: number;
  users: number;
}

interface PageDetail {
  views: number;
  sessions: number;
  users: number;
  avgDuration: number;
  bounceRate: number;
  sources: SourceRow[];
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("cs-CZ");
}

export default function PagesAnalysis() {
  const { data: session } = useSession();
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [propertyName, setPropertyName] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultRange());
  const [pages, setPages] = useState<PageRow[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [selectedPage, setSelectedPage] = useState<PageRow | null>(null);
  const [pageDetail, setPageDetail] = useState<PageDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [search, setSearch] = useState("");

  const accessToken = (session as { accessToken?: string })?.accessToken;

  // Načíst seznam stránek
  const fetchPages = useCallback(async () => {
    if (!accessToken || !selectedProperty) return;
    setLoadingPages(true);
    setSelectedPage(null);
    setPageDetail(null);

    try {
      const res = await fetch(
        `/api/ga/pages?propertyId=${encodeURIComponent(selectedProperty)}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await res.json();

      // Agregovat řádky — stejná stránka může mít více řádků (různé zdroje)
      const pageMap = new Map<string, PageRow>();
      for (const row of data.rows || []) {
        const path = row.dimensionValues[0]?.value || "";
        const title = row.dimensionValues[1]?.value || path;
        const views = parseInt(row.metricValues[0]?.value || "0");
        const avgDur = parseFloat(row.metricValues[1]?.value || "0");
        const bounce = parseFloat(row.metricValues[2]?.value || "0");
        const sess = parseInt(row.metricValues[3]?.value || "0");
        const users = parseInt(row.metricValues[4]?.value || "0");

        if (pageMap.has(path)) {
          const existing = pageMap.get(path)!;
          existing.views += views;
          existing.sessions += sess;
          existing.users += users;
        } else {
          pageMap.set(path, { pagePath: path, pageTitle: title, views, sessions: sess, users, avgDuration: avgDur, bounceRate: bounce });
        }
      }

      const sorted = Array.from(pageMap.values()).sort((a, b) => b.views - a.views);
      setPages(sorted);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPages(false);
    }
  }, [accessToken, selectedProperty, dateRange]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  // Načíst detail stránky
  const fetchDetail = useCallback(async (page: PageRow) => {
    if (!accessToken || !selectedProperty) return;
    setSelectedPage(page);
    setLoadingDetail(true);
    setPageDetail(null);

    try {
      const res = await fetch(
        `/api/ga/page-detail?propertyId=${encodeURIComponent(selectedProperty)}&pagePath=${encodeURIComponent(page.pagePath)}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await res.json();

      const summary = data.summary;
      const sources: SourceRow[] = (data.sources || []).map((row: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }) => ({
        sourceMedium: row.dimensionValues[1]?.value || "unknown",
        sessions: parseInt(row.metricValues[0]?.value || "0"),
        views: parseInt(row.metricValues[1]?.value || "0"),
        users: parseInt(row.metricValues[2]?.value || "0"),
      }));

      setPageDetail({
        views: parseInt(summary?.metricValues[0]?.value || "0"),
        avgDuration: parseFloat(summary?.metricValues[1]?.value || "0"),
        bounceRate: parseFloat(summary?.metricValues[2]?.value || "0"),
        sessions: parseInt(summary?.metricValues[3]?.value || "0"),
        users: parseInt(summary?.metricValues[4]?.value || "0"),
        sources,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  }, [accessToken, selectedProperty, dateRange]);

  const filteredPages = pages.filter(
    (p) =>
      p.pagePath.toLowerCase().includes(search.toLowerCase()) ||
      p.pageTitle.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Analýza stránek</h1>
          {propertyName && <p className="text-sm text-gray-500 mt-0.5">{propertyName}</p>}
        </div>
        <div className="flex items-center gap-4">
          {accessToken && (
            <PropertySelector
              accessToken={accessToken}
              selectedProperty={selectedProperty}
              onSelect={(id, name) => {
                setSelectedProperty(id);
                setPropertyName(name);
              }}
            />
          )}
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* Content */}
      {!selectedProperty ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">Vyberte GA4 property</p>
            <p className="text-gray-400 text-sm mt-1">Poté se zobrazí analýza stránek</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Levý panel — seznam stránek */}
          <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50">
            <div className="p-3 border-b border-gray-200">
              <input
                type="text"
                placeholder="Hledat stránku..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingPages ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                </div>
              ) : filteredPages.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">Žádné stránky nenalezeny</p>
              ) : (
                filteredPages.map((page) => (
                  <button
                    key={page.pagePath}
                    onClick={() => fetchDetail(page)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-white transition-colors ${
                      selectedPage?.pagePath === page.pagePath ? "bg-white border-l-2 border-l-blue-500" : ""
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-800 truncate" title={page.pagePath}>
                      {page.pagePath}
                    </p>
                    <p className="text-xs text-gray-400 truncate mt-0.5" title={page.pageTitle}>
                      {page.pageTitle}
                    </p>
                    <div className="flex gap-3 mt-1.5">
                      <span className="text-xs text-gray-600">
                        <span className="font-semibold">{formatNumber(page.views)}</span> zobrazení
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Pravý panel — detail stránky */}
          <div className="flex-1 overflow-y-auto p-6">
            {!selectedPage ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
                  </svg>
                  <p className="font-medium">Vyberte stránku vlevo</p>
                  <p className="text-sm mt-1">Zobrazí se detailní statistiky</p>
                </div>
              </div>
            ) : loadingDetail ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : pageDetail ? (
              <div>
                {/* Název stránky */}
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-gray-900">{selectedPage.pageTitle}</h2>
                  <a
                    href={`https://${propertyName.replace(/^GA4\s*-\s*/i, "").trim()}${selectedPage.pagePath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline mt-0.5 font-mono"
                  >
                    {selectedPage.pagePath}
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>

                {/* KPI karty */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  <StatCard label="Zobrazení stránky" value={formatNumber(pageDetail.views)} icon="👁" />
                  <StatCard label="Relace" value={formatNumber(pageDetail.sessions)} icon="📊" />
                  <StatCard label="Unikatní uživatelé" value={formatNumber(pageDetail.users)} icon="👤" />
                  <StatCard label="Průměrná doba" value={formatDuration(pageDetail.avgDuration)} icon="⏱" />
                  <StatCard label="Míra odchodu" value={`${(pageDetail.bounceRate * 100).toFixed(1)} %`} icon="🚪" />
                </div>

                {/* Zdroje / média */}
                <div>
                  <h3 className="text-base font-semibold text-gray-800 mb-3">Zdroje návštěvnosti</h3>
                  {pageDetail.sources.length === 0 ? (
                    <p className="text-gray-400 text-sm">Žádná data o zdrojích</p>
                  ) : (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-4 py-3 text-gray-600 font-semibold">Zdroj / Médium</th>
                            <th className="text-right px-4 py-3 text-gray-600 font-semibold">Relace</th>
                            <th className="text-right px-4 py-3 text-gray-600 font-semibold">Zobrazení</th>
                            <th className="text-right px-4 py-3 text-gray-600 font-semibold">Uživatelé</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageDetail.sources.map((src, i) => (
                            <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-gray-700">{src.sourceMedium}</td>
                              <td className="px-4 py-3 text-right text-gray-800 font-medium">{formatNumber(src.sessions)}</td>
                              <td className="px-4 py-3 text-right text-gray-800 font-medium">{formatNumber(src.views)}</td>
                              <td className="px-4 py-3 text-right text-gray-800 font-medium">{formatNumber(src.users)}</td>
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
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
