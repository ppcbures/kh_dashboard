"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import DateRangePicker from "@/components/DateRangePicker";
import { useDateRange } from "@/contexts/DateRangeContext";
import Tooltip from "@/components/Tooltip";

interface ConversionRow {
  dateRaw: string;
  date: string;
  eventName: string;
  conversionPage: string;
  userPath: string;
  formFullname: string;
  users: number;
}

interface GroupedRow extends ConversionRow {
  count: number;
}

type SortKey = "date" | "eventName" | "conversionPage" | "userPath" | "users";

const ALL_EVENTS = [
  "generate_lead",
  "contact_click_tel",
  "contact_click_email",
  "contact_copy_tel",
  "contact_copy_email",
] as const;

const EVENT_LABELS: Record<string, string> = {
  generate_lead:       "Odeslání formuláře",
  contact_click_tel:   "Kliknutí na telefon",
  contact_click_email: "Kliknutí na email",
  contact_copy_tel:    "Zkopírování telefonu",
  contact_copy_email:  "Zkopírování emailu",
};

const EVENT_COLORS: Record<string, string> = {
  generate_lead:       "bg-green-100 text-green-800 border-green-200",
  contact_click_tel:   "bg-blue-100 text-blue-800 border-blue-200",
  contact_click_email: "bg-purple-100 text-purple-800 border-purple-200",
  contact_copy_tel:    "bg-sky-100 text-sky-800 border-sky-200",
  contact_copy_email:  "bg-violet-100 text-violet-800 border-violet-200",
};


interface MultiSelectDropdownProps {
  label: string;
  options: { value: string; label: string }[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  allLabel?: string;
}

function MultiSelectDropdown({ label, options, selected, onToggle, allLabel = "Všechny" }: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Zavřít při kliknutí mimo
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const allSelected = selected.size === 0 || selected.size === options.length;
  const activeCount = allSelected ? options.length : selected.size;
  const buttonLabel = allSelected
    ? allLabel
    : `${activeCount} ${activeCount === 1 ? "vybraná" : activeCount < 5 ? "vybrané" : "vybraných"}`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors"
      >
        <span className="text-gray-700">{label}:</span>
        <span className={`font-medium ${allSelected ? "text-gray-500" : "text-red-600"}`}>{buttonLabel}</span>
        <svg className={`w-3 h-3 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[220px] py-1">
          {/* Vybrat vše */}
          <button
            onClick={() => { options.forEach(o => { if (!allSelected && !selected.has(o.value)) onToggle(o.value); if (allSelected) { /* noop — prázdná = vše */ } }); if (!allSelected) options.forEach(o => { if (selected.has(o.value)) onToggle(o.value); }); }}
            className="w-full text-left px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 border-b border-gray-100 font-medium"
          >
            {allSelected ? "✓ Vše vybráno" : "Vybrat vše"}
          </button>
          {options.map(opt => {
            const checked = selected.size === 0 || selected.has(opt.value);
            return (
              <label key={opt.value} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(opt.value)}
                  className="w-3.5 h-3.5 rounded accent-red-600 flex-shrink-0"
                />
                <span className="text-xs text-gray-700 truncate">{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SortIcon({ dir }: { dir: "asc" | "desc" }) {
  return (
    <svg className="w-3.5 h-3.5 inline ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
        d={dir === "asc" ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
    </svg>
  );
}

export default function ConversionPage() {
  const { data: session } = useSession();
  const { dateRange, setDateRange } = useDateRange();

  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);

  const [rows, setRows] = useState<ConversionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtry (prázdný Set = vše vybráno)
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set<string>());
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set<string>());

  // Sloupce
  const [showDate, setShowDate]   = useState(false);
  const [showName, setShowName]   = useState(false);

  // Řazení
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

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

  // Fetch dat
  const fetchData = useCallback(async () => {
    if (!accessToken || !selectedProperty) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/ga/conversions?propertyId=${encodeURIComponent(selectedProperty)}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setRows(data.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba načítání dat");
    } finally {
      setLoading(false);
    }
  }, [accessToken, selectedProperty, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Toggle pro multi-select filtry (prázdný = vše)
  const makeToggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, allValues: string[]) =>
    (value: string) => {
      setter(prev => {
        // Pokud je vše vybráno (prázdný set), první klik odznačí VŠECHNY ostatní
        const base = prev.size === 0 ? new Set(allValues) : new Set(prev);
        if (base.has(value)) base.delete(value);
        else base.add(value);
        // Pokud jsou vybrány všechny, vrátíme prázdný set (= vše)
        if (base.size === allValues.length) return new Set<string>();
        return base;
      });
    };

  // Toggle řazení
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // Unikátní konverzní stránky pro filtr
  const conversionPages = useMemo(
    () => [...new Set(rows.map(r => r.conversionPage).filter(Boolean))].sort(),
    [rows]
  );

  // Události přítomné v datech
  const eventNamesInData = useMemo(
    () => [...new Set(rows.map(r => r.eventName))],
    [rows]
  );

  // Filtrování + seskupení + řazení
  const grouped: GroupedRow[] = useMemo(() => {
    const filtered = rows.filter(r =>
      (selectedEvents.size === 0 || selectedEvents.has(r.eventName)) &&
      (selectedPages.size === 0 || selectedPages.has(r.conversionPage)) &&
      true
    );

    const map = new Map<string, GroupedRow>();
    for (const row of filtered) {
      const keyParts = [row.eventName, row.conversionPage, row.userPath];
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

    const list = Array.from(map.values());

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "date":           cmp = a.dateRaw.localeCompare(b.dateRaw); break;
        case "eventName":      cmp = (EVENT_LABELS[a.eventName] || a.eventName).localeCompare(EVENT_LABELS[b.eventName] || b.eventName); break;
        case "conversionPage": cmp = a.conversionPage.localeCompare(b.conversionPage); break;
        case "userPath":       cmp = (a.userPath ? a.userPath.split(" - ").length : 0) - (b.userPath ? b.userPath.split(" - ").length : 0); break;
        case "users":          cmp = a.users - b.users; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [rows, selectedEvents, selectedPages, showDate, showName, sortKey, sortDir]);

  // Auth error
  if (authError) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
          <h1 className="text-xl font-bold text-gray-900">Konverzní cesty – z Google Analytics</h1>
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
            <button onClick={() => signOut({ callbackUrl: "/login" })}
              className="px-5 py-2 text-sm font-medium text-white rounded-lg"
              style={{ backgroundColor: "#e30613" }}>
              Přihlásit se znovu
            </button>
          </div>
        </div>
      </div>
    );
  }

  const thClass = "px-4 py-3 text-left text-gray-600 font-semibold whitespace-nowrap cursor-pointer select-none hover:bg-gray-100 transition-colors";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Konverzní cesty – z Google Analytics</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            * konverze = odeslání formuláře, kliknutí na tel/email, zkopírování tel/emailu
          </p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Filtry */}
      <div className="flex flex-col gap-2 px-6 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0">
        {/* Řádek 1: event dropdown + konverzní stránka dropdown */}
        <div className="flex flex-wrap items-center gap-3">
          <MultiSelectDropdown
            label="Událost"
            options={ALL_EVENTS.map(e => ({ value: e, label: EVENT_LABELS[e] || e }))}
            selected={selectedEvents}
            onToggle={makeToggle(setSelectedEvents, [...ALL_EVENTS])}
            allLabel="Všechny události"
          />

          <MultiSelectDropdown
            label="Konverzní stránka"
            options={conversionPages.map(p => ({ value: p, label: p }))}
            selected={selectedPages}
            onToggle={makeToggle(setSelectedPages, conversionPages)}
            allLabel="Všechny stránky"
          />


          {!loading && rows.length > 0 && (
            <span className="ml-auto text-xs text-gray-400">
              {grouped.length}&nbsp;{grouped.length === 1 ? "záznam" : grouped.length < 5 ? "záznamy" : "záznamů"}
            </span>
          )}
        </div>

        {/* Řádek 2: zobrazit sloupce */}
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Zobrazit:</span>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={showDate} onChange={e => setShowDate(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-red-600" />
            <span className="text-xs text-gray-700">Datum</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={showName} onChange={e => setShowName(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-red-600" />
            <span className="text-xs text-gray-700">Jméno zákazníka</span>
            <Tooltip text="Zobrazuje se pouze při odeslaném formuláři" />
          </label>
        </div>
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
            <button onClick={fetchData}
              className="mt-2 px-4 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors">
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
                  <th className={thClass} onClick={() => handleSort("date")}>
                    Datum {sortKey === "date" && <SortIcon dir={sortDir} />}
                  </th>
                )}
                <th className={thClass} onClick={() => handleSort("eventName")}>
                  Název události
                  <Tooltip text="Řazení dle názvu události (A–Z nebo Z–A)" />
                  {sortKey === "eventName" && <SortIcon dir={sortDir} />}
                </th>
                <th className={thClass} onClick={() => handleSort("conversionPage")}>
                  Konverzní stránka
                  <Tooltip text="Stránka, na které proběhla konverze" />
                  {sortKey === "conversionPage" && <SortIcon dir={sortDir} />}
                </th>
                {showName && (
                  <th className="px-4 py-3 text-left text-gray-600 font-semibold whitespace-nowrap">
                    Jméno zákazníka
                  </th>
                )}
                <th className={thClass} onClick={() => handleSort("userPath")}>
                  Cesta uživatele
                  <Tooltip text="Řazení dle počtu kroků v cestě uživatele (od nejkratší po nejdelší a naopak)" />
                  {sortKey === "userPath" && <SortIcon dir={sortDir} />}
                </th>
                <th className={thClass} style={{ textAlign: "right" }} onClick={() => handleSort("users")}>
                  Počet uživatelů
                  {sortKey === "users" && <SortIcon dir={sortDir} />}
                </th>
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
                    <span className={`font-mono text-xs px-2 py-1 rounded border font-medium ${
                      EVENT_COLORS[row.eventName] ?? "bg-gray-100 text-gray-700 border-gray-200"
                    }`}>
                      {EVENT_LABELS[row.eventName] || row.eventName}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.conversionPage ? (
                      <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                        {row.conversionPage}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  {showName && (
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap text-sm">
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
