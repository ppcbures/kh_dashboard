"use client";

import { useEffect, useState } from "react";
import DateRangePicker from "@/components/DateRangePicker";
import { useDateRange } from "@/contexts/DateRangeContext";

interface Budget { budget: number; ideal: number; }
interface BudgetData {
  planPro: string;
  google: Budget; seznam: Budget; facebook: Budget; bing: Budget;
}
interface SpendData {
  facebook: number; google: number; seznam: number; bing: number;
}

function fmtKc(n: number) {
  return n.toLocaleString("cs-CZ") + " Kč";
}

const CHANNELS = [
  { key: "facebook" as const, label: "FB útrata",   color: "#1877F2" },
  { key: "google"   as const, label: "GAds útrata", color: "#4285F4" },
  { key: "seznam"   as const, label: "Sklik útrata", color: "#E4001C" },
  { key: "bing"     as const, label: "Bing útrata",  color: "#5DA55D" },
];

export default function OverviewPage() {
  const { dateRange, setDateRange } = useDateRange();
  const [budget, setBudget] = useState<BudgetData | null>(null);
  const [spend, setSpend] = useState<SpendData | null>(null);
  const [loadingBudget, setLoadingBudget] = useState(false);
  const [loadingSpend, setLoadingSpend] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingBudget(true);
    fetch("/api/sheets/budget")
      .then(r => r.json())
      .then(d => { if (!d.error) setBudget(d); else setError(d.error); })
      .catch(() => setError("Nepodařilo se načíst rozpočet"))
      .finally(() => setLoadingBudget(false));
  }, []);

  useEffect(() => {
    setLoadingSpend(true);
    fetch(`/api/sheets/adspend?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setSpend(d); else setError(d.error); })
      .catch(() => setError("Nepodařilo se načíst útratu"))
      .finally(() => setLoadingSpend(false));
  }, [dateRange]);

  const totalBudget = budget ? budget.facebook.budget + budget.google.budget + budget.seznam.budget + budget.bing.budget : 0;
  const totalIdeal  = budget ? budget.facebook.ideal  + budget.google.ideal  + budget.seznam.ideal  + budget.bing.ideal  : 0;
  const totalSpend  = spend  ? spend.facebook + spend.google + spend.seznam + spend.bing : 0;

  const Spinner = () => <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <h1 className="text-xl font-bold text-gray-900">Přehled</h1>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {error && <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}

        <p className="text-xs text-gray-400 mb-4">Plán pro {budget?.planPro ?? "…"}</p>

        {/* ── Souhrnné karty ── */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Celkem rozpočet",        value: totalBudget, loading: loadingBudget },
            { label: "Celkem ideální útrata",  value: totalIdeal,  loading: loadingBudget },
            { label: "Celkem aktuální útrata", value: totalSpend,  loading: loadingSpend  },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs text-gray-500 font-medium mb-2">{c.label}</p>
              {c.loading
                ? <Spinner />
                : <p className="text-3xl font-bold text-black">{fmtKc(c.value)}</p>
              }
            </div>
          ))}
        </div>

        {/* ── Detail po kanálech ── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Kanál</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Rozpočet</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Ideální útrata</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Aktuální útrata</th>
              </tr>
            </thead>
            <tbody>
              {CHANNELS.map(ch => {
                const bud = budget?.[ch.key];
                const actual = spend?.[ch.key] ?? 0;
                return (
                  <tr key={ch.key} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: ch.color }} />
                      {ch.label}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700">
                      {loadingBudget ? <Spinner /> : fmtKc(bud?.budget ?? 0)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700">
                      {loadingBudget ? <Spinner /> : fmtKc(bud?.ideal ?? 0)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-black">
                      {loadingSpend ? <Spinner /> : fmtKc(actual)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
