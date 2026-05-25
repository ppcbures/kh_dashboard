"use client";

import { useState } from "react";

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  label: string;
}

// Bezpečné formátování bez UTC konverze (toISOString() by posunulo datum při CET/CEST)
function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDefaultRange(): DateRange {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // První den tohoto měsíce
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  return {
    startDate: fmt(firstDay),
    endDate: fmt(yesterday),
    label: "Tento měsíc",
  };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("cs-CZ", { day: "numeric", month: "short", year: "numeric" });
}

const PRESETS: DateRange[] = (() => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const firstThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const last7 = new Date(today); last7.setDate(today.getDate() - 7);
  const last30 = new Date(today); last30.setDate(today.getDate() - 30);

  return [
    { label: "Tento měsíc", startDate: fmt(firstThisMonth), endDate: fmt(yesterday) },
    { label: "Minulý měsíc", startDate: fmt(lastMonth), endDate: fmt(lastMonthEnd) },
    { label: "Posledních 7 dní", startDate: fmt(last7), endDate: fmt(yesterday) },
    { label: "Posledních 30 dní", startDate: fmt(last30), endDate: fmt(yesterday) },
  ];
})();

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState(value.startDate);
  const [customEnd, setCustomEnd] = useState(value.endDate);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const maxDate = yesterday.toISOString().split("T")[0];

  return (
    <div className="relative">
      <button
        onClick={() => {
          if (!open) {
            // při otevření vždy předvyplnit aktuálně vybraný rozsah
            setCustomStart(value.startDate);
            setCustomEnd(value.endDate);
          }
          setOpen(!open);
        }}
        className="flex items-center gap-2 border border-gray-300 rounded-lg px-4 py-2 text-sm bg-white shadow-sm hover:border-blue-400 transition-colors"
      >
        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="font-medium text-gray-700">{value.label}</span>
        <span className="text-gray-400">
          {formatDate(value.startDate)} – {formatDate(value.endDate)}
        </span>
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-4 min-w-[320px]">
          {/* Presets */}
          <div className="space-y-1 mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Rychlý výběr</p>
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => {
                  onChange(preset);
                  setCustomStart(preset.startDate);
                  setCustomEnd(preset.endDate);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  value.label === preset.label
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "hover:bg-gray-50 text-gray-700"
                }`}
              >
                {preset.label}
                <span className="text-gray-400 text-xs ml-2">
                  {formatDate(preset.startDate)} – {formatDate(preset.endDate)}
                </span>
              </button>
            ))}
          </div>

          {/* Custom range */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Vlastní rozsah</p>
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={customStart}
                onChange={(e) => {
                  const newStart = e.target.value;
                  setCustomStart(newStart);
                  // pokud je datum do menší než datum od, posuneme ho na datum od
                  if (customEnd < newStart) setCustomEnd(newStart);
                }}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-400 text-sm">–</span>
              <input
                type="date"
                value={customEnd}
                min={customStart}
                max={maxDate}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => {
                onChange({ startDate: customStart, endDate: customEnd, label: "Vlastní" });
                setOpen(false);
              }}
              className="mt-3 w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Použít
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { getDefaultRange };
