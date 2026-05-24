"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { DateRange, getDefaultRange } from "@/components/DateRangePicker";

const STORAGE_KEY = "kh-dashboard-date-range";

interface DateRangeContextValue {
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
}

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

function loadRange(): DateRange {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DateRange;
      if (parsed.startDate && parsed.endDate) return parsed;
    }
  } catch {}
  return getDefaultRange();
}

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [dateRange, setDateRangeState] = useState<DateRange>(getDefaultRange());

  // Načíst z localStorage po hydrataci (ne při SSR)
  useEffect(() => {
    setDateRangeState(loadRange());
  }, []);

  function setDateRange(range: DateRange) {
    setDateRangeState(range);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(range)); } catch {}
  }

  return (
    <DateRangeContext.Provider value={{ dateRange, setDateRange }}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext);
  if (!ctx) throw new Error("useDateRange must be used within DateRangeProvider");
  return ctx;
}
