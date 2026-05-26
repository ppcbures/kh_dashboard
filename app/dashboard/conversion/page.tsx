"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import DateRangePicker from "@/components/DateRangePicker";
import { useDateRange } from "@/contexts/DateRangeContext";

interface ConversionRow {
  dateRaw: string;
  date: string;
  eventName: string;
  userPath: string;
  formFullname: string;
  users: number;
}

interface GroupedRow extends ConversionRow {
  count: number;
}

const EVENT_COLORS: Record<string, string> = {
  generate_lead:       "bg-green-100 text-green-800",
  contact_click_tel:   "bg-blue-100 text-blue-800",
  contact_click_email: "bg-purple-100 text-purple-800",
  contact_copy_tel:    "bg-sky-100 text-sky-800",
  contact_copy_email:  "bg-violet-100 text-violet-800",
};

export default function ConversionPage() {
  const { data: session } = useSession();
  const { dateRange, setDateRange } = useDateRange();

  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);

  const [rows, setRows] = useState<ConversionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showDate, setShowDate] = useState(false);
  const [showName, setShowName] = useState(false);
  const [filterEvent, setFilterEvent] = useState("all");

  const accessToken = (session as { accessToken?: string })?.accessToken;

  // Auto-select GA4 property
  useEffect(() => {
    if (!accessToken || selectedProperty) return;
    (async () => {
      try {
        const res = await fetch("/api/ga/properties", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.status === 401 || res.status === 403 || res.status === 500) {
          setAuthError(true);
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const props: { name: string; displayName: string }[] = data.properties || [];
        if (props.length === 0) return;
        const keyword = process.env.NEXT_PUBLIC_GA_PROPERTY_KEYWORD?.toLowerCase();
        const match = keyword
          ? props.find(p => p.displayName.toLowerCase().includes(keyword) || p.name.toLowerCase().includes(keyword))
          : null;
        setSelectedProperty((match ?? props[0]).name);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [accessToken, selectedProperty]);

  // Fetch conversion data
  const fetchData = useCallback(async () => {
    if (!accessToken || !selectedProperty) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/ga/conversions?propertyId=${encodeURIComponent(selectedProperty)}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(data.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba načítání dat");
    } finally {
      setLoading(false);
    }
  }, [accessToken, selectedProperty, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Group rows by active columns
  const grouped: GroupedRow[] = (() => {
    const filtered = filterEvent === "all" ? rows : rows.filter(r => r.eventName === filterEvent);
    const map = new Map<string, GroupedRow>();
    for (const row of filtered) {
      const keyParts: string[] = [row.eventName, row.userPath];
      if (showDate) keyParts.unshift(row.dateRaw);
      if (showName) keyParts.push(row.formFullname);
      const key = keyParts.join("|||");
      if (map.has(key)) {
        map.get(key)!.users += row.users;
        map.get(key)!.count += 1;
      } else {
        map.set(key, { ...row, count: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (showDate && a.dateRaw !== b.dateRaw) return b.dateRaw.localeCompare(a.dateRaw);
      return b.users - a.users;
    });
  })();

  const eventNames = [...new Set(rows.map(r => r.eventName))].sort();

  // Auth error state
  if (authError) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
          <h1 className="text-xl font-bold text-gray-900">Konverzní cesty</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-xs">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-11a7 7 0 100 14 7 7 0 000-14z" />
              </svg>
            </div>
            <div className="text-gray-800 font-semibold text-sm mb-1">Platnost přihlášení vypršela</div>
            <div className="text-gray-400 text-xs mb-4">Pro zobrazení dat je nutné se znovu přihlásit přes Google.</div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="px-5 py-2 text-sm font-medium text-white rounded-lg transition-colors"
              style={{ backgroundColor: "#e30613" }}
            >
              Přihlásit se znovu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Konverzní cesty</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            * konverze = odeslání formuláře, kliknutí na tel/email, zkopírování tel/emailu
          </p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Filters + toggles */}
      <div className="flex items-center flex-wrap gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0">
        {/* Event filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 font-medium">Událost:</span>
          <select
            value={filterEvent}
            onChange={e => setFilterEvent(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            <option value="all">Všechny</option>
            {eventNames.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        <div className="h-4 w-px bg-gray-300" />

        {/* Column toggles */}
        <span className="text-sm text-gray-500 font-medium">Zobrazit sloupce:</span>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showDate}
            onChange={e => setShowDate(e.target.checked)}
            className="w-4 h-4 rounded accent-red-600"
          />
          <span className="text-sm text-gray-700">Datum</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showName}
            onChange={e => setShowName(e.target.checked)}
            className="w-4 h-4 rounded accent-red-600"
          />
          <span className="text-sm text-gray-700">Jméno zákazníka</span>
        </label>

        {!loading && rows.length > 0 && (
          <span className="ml-auto text-sm text-gray-400">
            {grouped.length}&nbsp;
            {grouped.length === 1 ? "záznam" : grouped.length < 5 ? "záznamy" : "záznamů"}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {!selectedProperty ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-3 text-gray-400">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
              <span className="text-sm">Načítám data...</span>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-red-500 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className="text-red-500 text-sm font-medium">Nepodařilo se načíst data</p>
            <p className="text-gray-400 text-xs">{error}</p>
            <button
              onClick={fetchData}
              className="mt-2 px-4 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
            >
              Zkusit znovu
            </button>
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Žádné konverzní události v daném období
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b-2 border-gray-200">
                {showDate && (
                  <th className="text-left px-4 py-3 text-gray-600 font-semibold whitespace-nowrap">Datum</th>
                )}
                <th className="text-left px-4 py-3 text-gray-600 font-semibold whitespace-nowrap">Název události</th>
                {showName && (
                  <th className="text-left px-4 py-3 text-gray-600 font-semibold whitespace-nowrap">Jméno zákazníka</th>
                )}
                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Cesta uživatele</th>
                <th className="text-right px-4 py-3 text-gray-600 font-semibold whitespace-nowrap">Počet uživatelů</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((row, i) => (
                <tr
                  key={i}
                  className={`border-b border-gray-100 transition-colors hover:bg-blue-50 ${
                    i % 2 === 1 ? "bg-gray-50" : "bg-white"
                  }`}
                >
                  {showDate && (
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{row.date}</td>
                  )}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`font-mono text-xs px-2 py-1 rounded font-medium ${
                        EVENT_COLORS[row.eventName] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {row.eventName}
                    </span>
                  </td>
                  {showName && (
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {row.formFullname && row.formFullname !== "(not set)"
                        ? row.formFullname
                        : <span className="text-gray-300">—</span>}
                    </td>
                  )}
                  <td className="px-4 py-3 max-w-2xl">
                    {row.userPath ? (
                      <div className="flex flex-wrap items-center gap-1">
                        {row.userPath.split(" - ").map((step, j) => (
                          <span key={j} className="flex items-center gap-1">
                            {j > 0 && (
                              <svg className="w-3 h-3 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            )}
                            <span className="font-mono text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                              {step}
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-800">{row.users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
