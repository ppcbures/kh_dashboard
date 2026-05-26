"use client";

import { useEffect, useState } from "react";
import DateRangePicker from "@/components/DateRangePicker";
import { useDateRange } from "@/contexts/DateRangeContext";

interface Budget { budget: number; ideal: number; }
interface BudgetData { planPro: string; google: Budget; seznam: Budget; facebook: Budget; bing: Budget; }
interface SpendData { facebook: number; google: number; seznam: number; bing: number; }
interface LeadRow {
  id: string; date: string; name: string;
  realizace: string; marze: number | null; marzeChybi: boolean;
  zdroj: string; kampan: string;
}
interface LeadsData { rows: LeadRow[]; stats: { count: number; realizace: number; totalMarze: number }; }
interface MonthRow { cislo: string; mesic: string; utrata: string; poptavky: string; cpPoptavky: string; realizace: string; cpRealizace: string; marze: string; }
interface HistoryData { y2024: MonthRow[]; y2025: MonthRow[]; y2026: MonthRow[]; }

function fmtKc(n: number) { return n.toLocaleString("cs-CZ") + " Kč"; }
function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

const CHANNELS = [
  { key: "facebook" as const, label: "FB útrata",    color: "#1877F2" },
  { key: "google"   as const, label: "GAds útrata",  color: "#4285F4" },
  { key: "seznam"   as const, label: "Sklik útrata", color: "#E4001C" },
  { key: "bing"     as const, label: "Bing útrata",  color: "#5DA55D" },
];

const Spinner = () => <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin inline-block" />;

export default function OverviewPage() {
  const { dateRange, setDateRange } = useDateRange();
  const [budget, setBudget] = useState<BudgetData | null>(null);
  const [spend, setSpend]   = useState<SpendData | null>(null);
  const [leads, setLeads]   = useState<LeadsData | null>(null);
  const [loadingBudget, setLoadingBudget] = useState(false);
  const [loadingSpend,  setLoadingSpend]  = useState(false);
  const [loadingLeads,  setLoadingLeads]  = useState(false);
  const [channelsOpen,    setChannelsOpen]    = useState(false);
  const [leadsFilter, setLeadsFilter] = useState<"all" | "realizace" | "v_reseni">("all");
  const [historyOpen,     setHistoryOpen]     = useState(false);
  const [history,         setHistory]         = useState<HistoryData | null>(null);
  const [loadingHistory,  setLoadingHistory]  = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingHistory(true);
    fetch("/api/sheets/history")
      .then(r => r.json()).then(d => { if (!d.error) setHistory(d); })
      .finally(() => setLoadingHistory(false));
  }, []);

  useEffect(() => {
    setLoadingBudget(true);
    fetch("/api/sheets/budget")
      .then(r => r.json()).then(d => { if (!d.error) setBudget(d); else setError(d.error); })
      .finally(() => setLoadingBudget(false));
  }, []);

  useEffect(() => {
    setLoadingSpend(true);
    setLoadingLeads(true);
    const q = `startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;
    fetch(`/api/sheets/adspend?${q}`)
      .then(r => r.json()).then(d => { if (!d.error) setSpend(d); else setError(d.error); })
      .finally(() => setLoadingSpend(false));
    fetch(`/api/sheets/leads?${q}`)
      .then(r => r.json()).then(d => { if (!d.error) setLeads(d); else setError(d.error); })
      .finally(() => setLoadingLeads(false));
  }, [dateRange]);

  const totalBudget = budget ? budget.facebook.budget + budget.google.budget + budget.seznam.budget + budget.bing.budget : 0;
  const totalIdeal  = budget ? budget.facebook.ideal  + budget.google.ideal  + budget.seznam.ideal  + budget.bing.ideal  : 0;
  const totalSpend  = spend  ? spend.facebook + spend.google + spend.seznam + spend.bing : 0;
  const leadCount   = leads?.stats.count ?? 0;
  const realCount   = leads?.stats.realizace ?? 0;
  const totalMarze  = leads?.stats.totalMarze ?? 0;
  const cpLead      = leadCount  > 0 ? Math.round(totalSpend / leadCount)  : 0;
  const cpReal      = realCount  > 0 ? Math.round(totalSpend / realCount)  : 0;
  const displayedRows = leadsFilter === "realizace"
    ? (leads?.rows ?? []).filter(r => r.realizace === "Ano")
    : leadsFilter === "v_reseni"
    ? (leads?.rows ?? []).filter(r => r.realizace === "V řešení")
    : (leads?.rows ?? []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <h1 className="text-xl font-bold text-gray-900">Hlavní přehled</h1>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}

        {/* ── Náklady ── */}
        <div>
          <p className="text-xs text-gray-400 mb-3">Plán pro {budget?.planPro ?? "…"}</p>
          <div className="grid grid-cols-3 gap-4 mb-3">
            {[
              { label: "Celkem rozpočet",                          value: totalBudget, loading: loadingBudget },
              { label: "Celkem ideální útrata (ke včerejšímu dni)", value: totalIdeal,  loading: loadingBudget },
              { label: "Celková útrata za vybrané datum",           value: totalSpend,  loading: loadingSpend  },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 font-medium mb-1">{c.label}</p>
                {c.loading ? <Spinner /> : <p className="text-2xl font-bold text-black">{fmtKc(c.value)}</p>}
              </div>
            ))}
          </div>
          {/* Detail kanálů — rozklikávací */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setChannelsOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors"
            >
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Útrata dle kanálů</span>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${channelsOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {channelsOpen && (
              <table className="w-full text-sm border-t border-gray-200">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Kanál</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Rozpočet</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Ideální útrata</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Aktuální útrata</th>
                  </tr>
                </thead>
                <tbody>
                  {CHANNELS.map(ch => (
                    <tr key={ch.key} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ch.color }} />
                        {ch.label}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700">{loadingBudget ? <Spinner /> : fmtKc(budget?.[ch.key].budget ?? 0)}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{loadingBudget ? <Spinner /> : fmtKc(budget?.[ch.key].ideal ?? 0)}</td>
                      <td className="px-4 py-2 text-right font-semibold">{loadingSpend ? <Spinner /> : fmtKc(spend?.[ch.key] ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Poptávky ── */}
        <div>
          {/* Souhrnné karty */}
          <div className="grid grid-cols-5 gap-3 mb-4">
            {[
              { label: "Počet poptávek",    value: leadCount,          unit: "",     loading: loadingLeads },
              { label: "Cena za poptávku",  value: cpLead,             unit: " Kč",  loading: loadingLeads || loadingSpend },
              { label: "Počet realizací",   value: realCount,          unit: "",     loading: loadingLeads },
              { label: "Cena za realizaci", value: cpReal,             unit: " Kč",  loading: loadingLeads || loadingSpend },
              { label: "Hrubá marže",       value: totalMarze,         unit: " Kč",  loading: loadingLeads },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 font-medium mb-1 leading-tight">{c.label}</p>
                {c.loading
                  ? <Spinner />
                  : <p className="text-xl font-bold text-black">{c.value.toLocaleString("cs-CZ")}{c.unit}</p>
                }
              </div>
            ))}
          </div>

          {/* ── Historické výsledky ── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
            <button
              onClick={() => setHistoryOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors"
            >
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Historické výsledky</span>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${historyOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {historyOpen && (
              <div className="border-t border-gray-200 overflow-x-auto">
                {loadingHistory ? (
                  <div className="px-4 py-6 text-center"><Spinner /></div>
                ) : (
                  <div className="grid grid-cols-3 gap-4 p-4 min-w-[860px]">
                    {([
                      { year: 2026, rows: history?.y2026 ?? [] },
                      { year: 2025, rows: history?.y2025 ?? [] },
                      { year: 2024, rows: history?.y2024 ?? [] },
                    ] as { year: number; rows: MonthRow[] }[]).map(({ year, rows }) => {
                      // Pomocná funkce: "60 997 Kč" → 60997
                      const parseKc = (s: string) =>
                        parseFloat(s.replace(/[\s ]/g, "").replace("Kč", "").replace(",", ".")) || 0;

                      const filled       = rows.filter(r => r.utrata);
                      const totUtrata    = filled.reduce((s, r) => s + parseKc(r.utrata), 0);
                      const totPoptavky  = filled.reduce((s, r) => s + (parseInt(r.poptavky) || 0), 0);
                      const totRealizace = filled.reduce((s, r) => s + (parseInt(r.realizace) || 0), 0);
                      const totMarze     = filled.reduce((s, r) => s + parseKc(r.marze), 0);
                      const totCpPop     = totPoptavky  > 0 ? Math.round(totUtrata / totPoptavky)  : 0;
                      const totCpReal    = totRealizace > 0 ? Math.round(totUtrata / totRealizace) : 0;
                      const fmtKcLocal   = (n: number) => n > 0 ? n.toLocaleString("cs-CZ") + " Kč" : "—";

                      return (
                      <div key={year} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* Hlavička roku */}
                        <div className="py-3 text-center font-bold text-gray-800 text-xl tracking-wide border-b border-gray-200 bg-gray-50">
                          {year}
                        </div>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-200 bg-gray-50">
                              <th className="text-left px-2 py-2 font-semibold text-gray-500 whitespace-nowrap">Měsíc</th>
                              <th className="text-right px-2 py-2 font-semibold text-gray-500 whitespace-nowrap">Útrata</th>
                              <th className="text-right px-2 py-2 font-semibold text-gray-500 leading-tight">Počet<br/>poptávek</th>
                              <th className="text-right px-2 py-2 font-semibold text-gray-500 leading-tight">Cena za<br/>poptávku</th>
                              <th className="text-right px-2 py-2 font-semibold text-gray-500 leading-tight">Počet<br/>realizací</th>
                              <th className="text-right px-2 py-2 font-semibold text-gray-500 leading-tight">Cena za<br/>realizaci</th>
                              <th className="text-right px-2 py-2 font-semibold text-gray-500 leading-tight">Hrubá<br/>marže</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r, i) => {
                              const empty = !r.utrata;
                              return (
                                <tr key={r.cislo}
                                  className={`border-b border-gray-100 ${
                                    empty ? "text-gray-300" : i % 2 === 1 ? "bg-gray-50" : "bg-white"
                                  }`}
                                >
                                  <td className="px-2 py-1.5 font-medium text-gray-700 whitespace-nowrap">{r.mesic}</td>
                                  <td className="px-2 py-1.5 text-right whitespace-nowrap">{r.utrata || "—"}</td>
                                  <td className="px-2 py-1.5 text-right">{r.poptavky || "—"}</td>
                                  <td className="px-2 py-1.5 text-right whitespace-nowrap">{r.cpPoptavky || "—"}</td>
                                  <td className="px-2 py-1.5 text-right">{r.realizace || "—"}</td>
                                  <td className="px-2 py-1.5 text-right whitespace-nowrap">{r.cpRealizace || "—"}</td>
                                  <td className="px-2 py-1.5 text-right whitespace-nowrap">{r.marze || "—"}</td>
                                </tr>
                              );
                            })}
                            {/* Souhrnný řádek */}
                            {filled.length > 0 && (
                              <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold text-gray-800">
                                <td className="px-2 py-2 whitespace-nowrap">Celkem</td>
                                <td className="px-2 py-2 text-right whitespace-nowrap">{fmtKcLocal(totUtrata)}</td>
                                <td className="px-2 py-2 text-right">{totPoptavky > 0 ? totPoptavky : "—"}</td>
                                <td className="px-2 py-2 text-right whitespace-nowrap">{fmtKcLocal(totCpPop)}</td>
                                <td className="px-2 py-2 text-right">{totRealizace > 0 ? totRealizace : "—"}</td>
                                <td className="px-2 py-2 text-right whitespace-nowrap">{fmtKcLocal(totCpReal)}</td>
                                <td className="px-2 py-2 text-right whitespace-nowrap">{fmtKcLocal(totMarze)}</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Filtr + tabulka poptávek */}
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setLeadsFilter(f => f === "realizace" ? "all" : "realizace")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                leadsFilter === "realizace"
                  ? "bg-green-600 border-green-600 text-white"
                  : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              Jen realizace
            </button>
            <button
              onClick={() => setLeadsFilter(f => f === "v_reseni" ? "all" : "v_reseni")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                leadsFilter === "v_reseni"
                  ? "bg-orange-500 border-orange-500 text-white"
                  : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              V řešení
            </button>
            {leadsFilter !== "all" && (
              <span className="text-xs text-gray-400 ml-1">
                Zobrazeno {displayedRows.length} z {leads?.rows.length ?? 0} poptávek
              </span>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">č. poptávky</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Datum</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Jméno</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500">Realizace</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Hrubá marže</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">GA zdroj</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">GA kampaň</th>
                </tr>
              </thead>
              <tbody>
                {loadingLeads ? (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400"><Spinner /></td></tr>
                ) : displayedRows.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400 text-sm">
                    {leadsFilter !== "all" ? "Žádné záznamy pro vybraný filtr" : "Žádné poptávky v daném období"}
                  </td></tr>
                ) : (
                  displayedRows.map((row, i) => (
                    <tr key={i}
                      className={`border-b border-gray-100 transition-colors ${
                        row.realizace === "Ano"
                          ? "bg-green-50 hover:bg-green-100"
                          : row.realizace === "V řešení"
                          ? "bg-orange-50 hover:bg-orange-100"
                          : i % 2 === 1 ? "bg-gray-50 hover:bg-gray-100" : "bg-white hover:bg-gray-50"
                      }`}
                    >
                      <td className="px-3 py-2 font-mono text-xs text-gray-600">{row.id}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fmtDate(row.date)}</td>
                      <td className="px-3 py-2 font-medium text-gray-800">{row.name}</td>
                      <td className="px-3 py-2 text-center">
                        {row.realizace === "Ano" ? (
                          <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">Ano</span>
                        ) : row.realizace === "V řešení" ? (
                          <span className="inline-block px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">V řešení</span>
                        ) : row.realizace === "Ne" ? (
                          <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">Ne</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.realizace === "Ano" ? (
                          row.marzeChybi ? (
                            <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded border border-amber-300" title="Marže nebyla vyplněna">?</span>
                          ) : row.marze === 0 ? (
                            <span className="inline-block px-2 py-0.5 bg-red-100 text-red-600 text-xs font-bold rounded border border-red-300" title="Marže je 0 — pravděpodobně ještě nevyplněna">0 Kč</span>
                          ) : (
                            <span className="font-semibold text-gray-800">{fmtKc(row.marze ?? 0)}</span>
                          )
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600 text-xs">{row.zdroj || "—"}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs max-w-[200px] truncate" title={row.kampan}>{row.kampan || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
