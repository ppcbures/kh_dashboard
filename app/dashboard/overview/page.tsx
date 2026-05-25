"use client";

import { useEffect, useState } from "react";
import DateRangePicker from "@/components/DateRangePicker";
import { useDateRange } from "@/contexts/DateRangeContext";

interface Budget {
  budget: number;
  ideal: number;
}
interface BudgetData {
  planPro: string;
  google: Budget;
  seznam: Budget;
  facebook: Budget;
  bing: Budget;
}
interface SpendData {
  facebook: number;
  google: number;
  seznam: number;
  bing: number;
}

function fmtKc(n: number): string {
  return n.toLocaleString("cs-CZ") + " Kč";
}

const CHANNELS = [
  {
    key: "facebook" as const,
    label: "FB",
    color: "#1877F2",
    bg: "#1877F2",
  },
  {
    key: "google" as const,
    label: "GAds",
    color: "#4285F4",
    bg: "#4285F4",
  },
  {
    key: "seznam" as const,
    label: "Sklik",
    color: "#E4001C",
    bg: "#E4001C",
  },
  {
    key: "bing" as const,
    label: "Bing",
    color: "#5DA55D",
    bg: "#5DA55D",
  },
];

function MetricCard({
  label,
  value,
  loading,
  accent,
  noData,
}: {
  label: string;
  value: number;
  loading: boolean;
  accent?: boolean;
  noData?: boolean;
}) {
  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-1 ${accent ? "ring-2 ring-blue-100" : ""}`}>
      <p className="text-xs font-semibold text-gray-500 text-center leading-tight">{label}</p>
      <div className="flex items-center justify-center mt-1">
        {loading ? (
          <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
        ) : noData ? (
          <span className="text-gray-400 text-sm font-medium">Žádná data</span>
        ) : (
          <span className="text-2xl font-bold text-black">{fmtKc(value)}</span>
        )}
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const { dateRange, setDateRange } = useDateRange();
  const [budget, setBudget] = useState<BudgetData | null>(null);
  const [spend, setSpend] = useState<SpendData | null>(null);
  const [loadingBudget, setLoadingBudget] = useState(false);
  const [loadingSpend, setLoadingSpend] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Načíst rozpočet (jednou, nemění se s datem)
  useEffect(() => {
    setLoadingBudget(true);
    fetch("/api/sheets/budget")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setBudget(d); else setError(d.error); })
      .catch(() => setError("Nepodařilo se načíst rozpočet"))
      .finally(() => setLoadingBudget(false));
  }, []);

  // Načíst útratů dle data
  useEffect(() => {
    setLoadingSpend(true);
    fetch(`/api/sheets/adspend?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setSpend(d); else setError(d.error); })
      .catch(() => setError("Nepodařilo se načíst útratu"))
      .finally(() => setLoadingSpend(false));
  }, [dateRange]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Hlavička */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <h1 className="text-xl font-bold text-gray-900">Přehled</h1>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
        )}

        {/* Nadpis sekce — z column J */}
        <h2 className="text-lg font-bold text-gray-800 mb-5">
          Plán pro {budget?.planPro ?? "…"}
        </h2>

        {/* Grid kanálů */}
        <div className="flex flex-col gap-4">
          {CHANNELS.map((ch) => {
            const bud = budget?.[ch.key];
            const actualSpend = spend?.[ch.key] ?? 0;
            const hasSpend = spend !== null && actualSpend > 0;

            return (
              <div key={ch.key} className="grid grid-cols-3 gap-3 items-stretch">
                {/* Levý sloupec — barevná hlavička + rozpočet */}
                <div className="rounded-lg overflow-hidden border border-gray-200">
                  <div
                    className="px-4 py-2 text-white text-sm font-bold text-center"
                    style={{ backgroundColor: ch.bg }}
                  >
                    {ch.label} rozpočet
                  </div>
                  <div className="bg-white px-4 py-3 flex items-center justify-center">
                    {loadingBudget ? (
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
                    ) : (
                      <span className="text-2xl font-bold text-black">{fmtKc(bud?.budget ?? 0)}</span>
                    )}
                  </div>
                </div>

                {/* Střední sloupec — ideální útrata */}
                <div className="rounded-lg overflow-hidden border border-gray-200">
                  <div className="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-semibold text-center leading-tight">
                    Ideální útrata<br />(ke včerejšímu dni)
                  </div>
                  <div className="bg-white px-4 py-3 flex items-center justify-center">
                    {loadingBudget ? (
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
                    ) : (
                      <span className="text-2xl font-bold text-black">{fmtKc(bud?.ideal ?? 0)}</span>
                    )}
                  </div>
                </div>

                {/* Pravý sloupec — aktuální útrata */}
                <div className="rounded-lg overflow-hidden border border-gray-200">
                  <div className="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-semibold text-center leading-tight">
                    Aktuální útrata<br />(k vybranému datu)
                  </div>
                  <div className="bg-white px-4 py-3 flex items-center justify-center">
                    {loadingSpend ? (
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
                    ) : !hasSpend ? (
                      <span className="text-gray-400 text-sm font-medium">Žádná data</span>
                    ) : (
                      <span className="text-2xl font-bold text-black">{fmtKc(actualSpend)}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
