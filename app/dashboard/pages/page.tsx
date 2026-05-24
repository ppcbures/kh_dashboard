"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import PropertySelector from "@/components/PropertySelector";
import DateRangePicker from "@/components/DateRangePicker";
import { useDateRange } from "@/contexts/DateRangeContext";

type GaSortKey = "views" | "sessions" | "users" | "avgDuration" | "bounceRate";

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

interface PathRow {
  path: string;
  sessions: number;
}


interface ClickRow {
  clickText: string;
  clickUrl: string;
  count: number;
  users: number;
}

interface PageDetail {
  views: number;
  sessions: number;
  users: number;
  avgDuration: number;
  bounceRate: number;
  sources: SourceRow[];
  prevPages: PathRow[];
  nextPages: PathRow[];
  clicks: ClickRow[];
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("cs-CZ");
}

/** Odstraní UTM a tracking parametry z URL (včetně utm_* bez ohledu na suffix) */
function stripUtm(url: string): string {
  if (!url) return url;
  const staticTracking = ["gclid", "fbclid", "msclkid", "mc_eid"];
  try {
    const base = url.startsWith("/") ? `https://x${url}` : url;
    const u = new URL(base);
    const toDelete = [...u.searchParams.keys()].filter(
      k => k.startsWith("utm_") || staticTracking.includes(k)
    );
    toDelete.forEach(k => u.searchParams.delete(k));
    // Pokud jsme přidali fake doménu, vrátíme jen path+search
    const result = url.startsWith("/")
      ? u.pathname + (u.search || "")
      : u.toString().replace(/[?&]$/, "");
    return result || "/";
  } catch {
    return url.replace(/[?&]utm_[^=]*=[^&]*/g, "").replace(/[?&](gclid|fbclid|msclkid|mc_eid)=[^&]*/g, "").replace(/[?&]$/, "") || url;
  }
}

const SITE_ORIGIN = "https://klimatizace-hustopece.cz";

const IMG_EXT = /\.(jpe?g|png|gif|webp|svg|ico|avif)(\?.*)?$/i;

/** Vrátí absolutní URL obrázku, nebo null pokud to není obrázek.
 *  Detekuje: <img src="...">, přímou cestu /wp-content/..., nebo URL obrázku. */
function extractImgSrc(text: string): string | null {
  if (!text) return null;

  // 1) <img> tag — extrahujeme src (i ořezaný, bez zavírací uvozovky)
  if (text.includes("<img")) {
    const match = text.match(/src=["']([^"'\s>]*)/i);
    const src = match?.[1] ?? "";
    // Zahazujeme ořezané "https://" nebo "http://" bez dalšího obsahu
    if (src && src !== "https://" && src !== "http://" && !src.endsWith("://")) {
      if (src.startsWith("/")) return `${SITE_ORIGIN}${src}`;
      return src;
    }
    return null;
  }

  // 2) click_text je přímo cesta k souboru (/wp-content/..., /wp-includes/...)
  if (text.startsWith("/wp-content/") || text.startsWith("/wp-includes/")) {
    // Doplnit doménu + odstranit případné oříznutí (neúplná přípona)
    const full = `${SITE_ORIGIN}${text}`;
    return full;
  }

  // 3) click_text je URL obrázku s rozpoznatelnou příponou
  if (IMG_EXT.test(text)) {
    if (text.startsWith("/")) return `${SITE_ORIGIN}${text}`;
    return text;
  }

  return null;
}

/** Vrátí true pokud URL/cesta vede na obrázek nebo je wp-content upload */
function isImagePath(url: string): boolean {
  if (!url) return false;
  return IMG_EXT.test(url) || url.includes("/wp-content/uploads/") || url.includes("/wp-includes/");
}

/** Vrátí pouze název souboru z cesty */
function imgFilename(url: string): string {
  const parts = url.split("/").filter(Boolean);
  return parts[parts.length - 1] || url;
}

export default function PagesAnalysis() {
  const { data: session } = useSession();
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [propertyName, setPropertyName] = useState<string>("");
  const { dateRange, setDateRange } = useDateRange();
  const [pages, setPages] = useState<PageRow[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [selectedPage, setSelectedPage] = useState<PageRow | null>(null);
  const [pageDetail, setPageDetail] = useState<PageDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [journeyDebug, setJourneyDebug] = useState<Record<string, unknown> | null>(null);
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sortBy, setSortBy] = useState<GaSortKey>("views");

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

      // Debug — viditelné v DevTools > Console i v UI
      if (data._debug) {
        console.log("[page-detail debug]", data._debug);
        setJourneyDebug(data._debug);
      }

      type ApiRow = { dimensionValues: { value: string }[]; metricValues: { value: string }[] };

      const summary = data.summary;

      const sources: SourceRow[] = (data.sources || []).map((row: ApiRow) => ({
        sourceMedium: row.dimensionValues[1]?.value || "unknown",
        sessions: parseInt(row.metricValues[0]?.value || "0"),
        views: parseInt(row.metricValues[1]?.value || "0"),
        users: parseInt(row.metricValues[2]?.value || "0"),
      }));

      const prevPages: PathRow[] = (data.prevPages || []).map(
        (r: { pathB: string; views: number }) => ({
          path: r.pathB,
          sessions: r.views,
        })
      );

      const nextPages: PathRow[] = (data.nextPages || [])
        .map((row: ApiRow) => ({
          path: row.dimensionValues[0]?.value || "",
          sessions: parseInt(row.metricValues[0]?.value || "0"),
        }))
        .filter((r: PathRow) => !!r.path && r.path !== "(not set)");

      // Kliknutí — strip UTM parametrů + seskup stejné URL
      const clickMap = new Map<string, ClickRow>();
      for (const row of (data.clicks || []) as ApiRow[]) {
        const rawText = row.dimensionValues[0]?.value || "";
        const rawUrl = row.dimensionValues[1]?.value || "";
        if (rawText === "(not set)" && !rawUrl) continue;
        const cleanUrl = stripUtm(rawUrl);
        const key = `${rawText}|||${cleanUrl}`;
        const count = parseInt(row.metricValues[0]?.value || "0");
        const users = parseInt(row.metricValues[1]?.value || "0");
        if (clickMap.has(key)) {
          const ex = clickMap.get(key)!;
          ex.count += count;
          ex.users += users;
        } else {
          clickMap.set(key, { clickText: rawText || "(nezjištěno)", clickUrl: cleanUrl, count, users });
        }
      }
      const clicks: ClickRow[] = Array.from(clickMap.values()).sort((a, b) => b.count - a.count);

      setPageDetail({
        views: parseInt(summary?.metricValues[0]?.value || "0"),
        avgDuration: parseFloat(summary?.metricValues[1]?.value || "0"),
        bounceRate: parseFloat(summary?.metricValues[2]?.value || "0"),
        sessions: parseInt(summary?.metricValues[3]?.value || "0"),
        users: parseInt(summary?.metricValues[4]?.value || "0"),
        sources,
        prevPages,
        nextPages,
        clicks,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  }, [accessToken, selectedProperty, dateRange]);

  const filteredPages = pages
    .filter(
      (p) =>
        p.pagePath.toLowerCase().includes(search.toLowerCase()) ||
        p.pageTitle.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "bounceRate" || sortBy === "avgDuration") {
        return a[sortBy] - b[sortBy]; // vzestupně (nižší odchod / kratší doba = lepší)
      }
      return b[sortBy] - a[sortBy]; // sestupně
    });

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b-2 bg-white" style={{ borderBottomColor: "#e30613" }}>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Analýza stránek</h1>
          {propertyName && <p className="text-sm text-gray-500 mt-0.5">{propertyName}</p>}
        </div>
        <div className="flex items-center gap-4">
          {/* PropertySelector skrytý — auto-selectuje jedinou property na pozadí */}
          {accessToken && !selectedProperty && (
            <div className="hidden">
              <PropertySelector
                accessToken={accessToken}
                selectedProperty={selectedProperty}
                onSelect={(id, name) => {
                  setSelectedProperty(id);
                  setPropertyName(name);
                }}
              />
            </div>
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
          {sidebarOpen ? (
            <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50 flex-shrink-0">
              {/* Hlavička panelu */}
              <div className="p-3 border-b border-gray-200 flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Hledat stránku..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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

              {/* Sort pills */}
              <div className="px-3 py-2 border-b border-gray-200 flex flex-wrap gap-1">
                {([
                  { key: "views", label: "Zobrazení", asc: false },
                  { key: "sessions", label: "Relace", asc: false },
                  { key: "users", label: "Uživatelé", asc: false },
                  { key: "avgDuration", label: "Doba", asc: true },
                  { key: "bounceRate", label: "Odchod", asc: true },
                ] as { key: GaSortKey; label: string; asc: boolean }[]).map(({ key, label, asc }) => (
                  <button
                    key={key}
                    onClick={() => setSortBy(key)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                      sortBy === key
                        ? "text-white"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                    style={sortBy === key ? { backgroundColor: "#e30613" } : {}}
                  >
                    {label}
                    {sortBy === key && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d={asc ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                      </svg>
                    )}
                  </button>
                ))}
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
          ) : (
            /* Sidebar skrytý — zobraz jen tlačítko otevřít */
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

                {/* Tok návštěvníků */}
                <div className="mb-8 mt-6">
                  <h3 className="text-base font-semibold text-gray-800 mb-4">Tok návštěvníků</h3>

                  {/* Debug panel — zobrazí se pouze pokud jsou chyby nebo nulová data */}
                  {journeyDebug && (journeyDebug.prevPagesStatus === "rejected" || journeyDebug.nextPagesStatus === "rejected") && (
                    <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 font-mono">
                      {journeyDebug.prevPagesError ? <div>prevPages chyba: {String(journeyDebug.prevPagesError)}</div> : null}
                      {journeyDebug.nextPagesError ? <div>nextPages chyba: {String(journeyDebug.nextPagesError)}</div> : null}
                    </div>
                  )}

                  <div className="flex gap-3 items-start">
                    {/* Předchozí stránky */}
                    <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">← Odkud přišli</p>
                      </div>
                      {pageDetail.prevPages.length === 0 ? (
                        <p className="text-sm text-gray-400 px-4 py-3">Žádná data</p>
                      ) : (
                        pageDetail.prevPages.map((r, i) => (
                          <div key={i} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50">
                            {r.path === "(entrance)" ? (
                              <span className="text-sm text-blue-600 italic">↗ Přímý vstup (Google / odkaz)</span>
                            ) : (
                              <span className="text-sm text-gray-700 truncate font-mono" title={r.path}>{r.path}</span>
                            )}
                            <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{formatNumber(r.sessions)}×</span>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Analyzovaná stránka uprostřed */}
                    <div className="flex flex-col items-center justify-center gap-1 pt-8">
                      <div className="w-px h-4 bg-gray-300" />
                      <div className="bg-black text-white text-xs font-mono px-3 py-2 rounded-lg text-center max-w-[120px] break-all">
                        {selectedPage.pagePath}
                      </div>
                      <div className="w-px h-4 bg-gray-300" />
                    </div>

                    {/* Následující stránky */}
                    <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kam šli dál →</p>
                      </div>
                      {pageDetail.nextPages.length === 0 ? (
                        <p className="text-sm text-gray-400 px-4 py-3">Žádná data</p>
                      ) : (
                        pageDetail.nextPages.map((r, i) => {
                          const isExit = r.path === "(exit)";
                          return (
                            <div key={i} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50">
                              {isExit ? (
                                <span className="text-sm text-red-500 italic">✕ Opustili web</span>
                              ) : (
                                <span className="text-sm text-gray-700 truncate font-mono" title={r.path}>{r.path}</span>
                              )}
                              <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{formatNumber(r.sessions)}×</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Kliknutí na stránce */}
                {pageDetail.clicks.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-base font-semibold text-gray-800 mb-3">Na co klikali</h3>
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-4 py-3 text-gray-600 font-semibold">Text kliknutí</th>
                            <th className="text-left px-4 py-3 text-gray-600 font-semibold">Cílová URL</th>
                            <th className="text-right px-4 py-3 text-gray-600 font-semibold">Uživatelé</th>
                            <th className="text-right px-4 py-3 text-gray-600 font-semibold">Kliknutí</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageDetail.clicks.map((c, i) => {
                            // Zjistit zda click_text nebo click_url odkazuje na obrázek
                            const urlIsImage = isImagePath(c.clickUrl);
                            const textImgSrc = extractImgSrc(c.clickText);
                            // Preferovat click_url jako zdroj náhledu pokud je to obrázek (je méně oříznutý)
                            const thumbUrl = urlIsImage
                              ? (c.clickUrl.startsWith("/") ? `${SITE_ORIGIN}${c.clickUrl}` : c.clickUrl)
                              : textImgSrc;
                            const isImg = !!thumbUrl;

                            return (
                              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                {/* Text kliknutí */}
                                <td className="px-4 py-3 text-gray-800 font-medium max-w-xs">
                                  {isImg ? (
                                    <a href={thumbUrl!} target="_blank" rel="noopener noreferrer"
                                      className="flex items-center gap-2 group" title={thumbUrl!}>
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={thumbUrl!} alt="" className="h-8 w-12 object-cover rounded border border-gray-200 flex-shrink-0"
                                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                      <span className="text-blue-600 group-hover:underline text-xs font-mono break-all">
                                        🖼 {imgFilename(c.clickUrl || thumbUrl!)}
                                      </span>
                                    </a>
                                  ) : (
                                    <span className="break-words">{c.clickText}</span>
                                  )}
                                </td>
                                {/* Cílová URL — pokud je to obrázek, ukáž jinak */}
                                <td className="px-4 py-3">
                                  {c.clickUrl ? (
                                    urlIsImage ? (
                                      // Obrázek — odkaz na soubor, zobrazit jako "📂 název"
                                      <a href={c.clickUrl.startsWith("/") ? `${SITE_ORIGIN}${c.clickUrl}` : c.clickUrl}
                                        target="_blank" rel="noopener noreferrer"
                                        className="text-gray-500 hover:underline text-xs font-mono break-all italic"
                                        title={c.clickUrl}>
                                        soubor: {imgFilename(c.clickUrl)}
                                      </a>
                                    ) : (
                                      <a href={c.clickUrl} target="_blank" rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline text-xs font-mono break-all"
                                        title={c.clickUrl}>
                                        {c.clickUrl.replace(/^https?:\/\/[^/]+/, "") || c.clickUrl}
                                      </a>
                                    )
                                  ) : (
                                    <span className="text-gray-400 text-xs">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-800 font-semibold">{formatNumber(c.users)}</td>
                                <td className="px-4 py-3 text-right text-gray-600">{formatNumber(c.count)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
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
    <div className="bg-white rounded-xl border border-gray-200 p-4 border-t-2" style={{ borderTopColor: "#e30613" }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-black">{value}</p>
    </div>
  );
}
