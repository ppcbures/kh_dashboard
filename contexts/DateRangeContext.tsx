"use client";

import { createContext, useContext, useState } from "react";
import { DateRange, getDefaultRange } from "@/components/DateRangePicker";

interface DateRangeContextValue {
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
}

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultRange());
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
