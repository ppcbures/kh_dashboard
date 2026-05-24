"use client";

import { useState, useEffect } from "react";

interface Property {
  name: string;
  displayName: string;
}

interface PropertySelectorProps {
  accessToken: string;
  selectedProperty: string | null;
  onSelect: (propertyId: string, displayName: string) => void;
}

export default function PropertySelector({ accessToken, selectedProperty, onSelect }: PropertySelectorProps) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProperties() {
      try {
        const res = await fetch("/api/ga/properties", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error("Nepodařilo se načíst properties");
        const data = await res.json();
        setProperties(data.properties || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Chyba");
      } finally {
        setLoading(false);
      }
    }
    fetchProperties();
  }, [accessToken]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
        Načítám GA4 účty...
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>;
  }

  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
        GA4 property:
      </label>
      <select
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[240px]"
        value={selectedProperty || ""}
        onChange={(e) => {
          const prop = properties.find((p) => p.name === e.target.value);
          if (prop) onSelect(prop.name, prop.displayName);
        }}
      >
        <option value="">— Vyberte property —</option>
        {properties.map((p) => (
          <option key={p.name} value={p.name}>
            {p.displayName}
          </option>
        ))}
      </select>
    </div>
  );
}
