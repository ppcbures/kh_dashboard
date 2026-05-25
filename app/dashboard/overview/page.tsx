"use client";

import { useEffect, useState } from "react";
import DateRangePicker from "@/components/DateRangePicker";
import { useDateRange } from "@/contexts/DateRangeContext";

interface AdSpend {
  facebook: number;
  google: number;
  seznam: number;
  bing: number;
}

function fmtKc(n: number): string {
  return n.toLocaleString("cs-CZ") + " Kč";
}

function SpendCard({
  label,
  value,
  color,
  logo,
  loading,
}: {
  label: string;
  value: number;
  color: string;
  logo: string;
  loading: boolean;
}) {
  return (
    <div
      className="bg-white rounded-xl border border-gray-200 border-t-4 p-5 flex flex-col gap-3"
      style={{ borderTopColor: color }}
    >
      <div className="flex items-center gap-2">
        <span className="text-xl">{logo}</span>
        <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      {loading ? (
        <div className="h-8 flex items-center">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
        </div>
      ) : (
        <p className="text-3xl font-bold text-black">{fmtKc(value)}</p>
      )}
      <p className="text-xs text-gray-400">útrata za vybrané období</p>
    </div>
  );
}

export default function OverviewPage() {
  const { dateRange, setDateRange } = useDateRange();
  const [spend, setSpend] = useState<AdSpend | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSpend() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/sheets/adspend?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
        );
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setSpend(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Chyba");
      } finally {
        setLoading(false);
      }
    }
    fetchSpend();
  }, [dateRange]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Hlavička */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <h1 className="text-xl font-bold text-gray-900">Přehled</h1>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Obsah */}
      <div className="flex-1 overflow-y-auto p-6">

        {error && (
          <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Útrata za reklamu */}
        <h2 className="text-base font-semibold text-gray-700 mb-4">Útrata za reklamu</h2>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <SpendCard
            label="FB útrata"
            value={spend?.facebook ?? 0}
            color="#1877F2"
            logo="📘"
            loading={loading}
          />
          <SpendCard
            label="GAds útrata"
            value={spend?.google ?? 0}
            color="#4285F4"
            logo="🔵"
            loading={loading}
          />
          <SpendCard
            label="Sklik útrata"
            value={spend?.seznam ?? 0}
            color="#E4001C"
            logo="🔴"
            loading={loading}
          />
          <SpendCard
            label="Bing útrata"
            value={spend?.bing ?? 0}
            color="#008272"
            logo="🟢"
            loading={loading}
          />
        </div>

        {/* Celková útrata */}
        {spend && (
          <div className="bg-gray-50 rounded-xl border border-gray-200 px-6 py-4 inline-flex items-center gap-4">
            <span className="text-sm text-gray-500 font-medium">Celková útrata za reklamu:</span>
            <span className="text-2xl font-bold text-black">
              {fmtKc(spend.facebook + spend.google + spend.seznam + spend.bing)}
            </span>
          </div>
        )}

      </div>
    </div>
  );
}
