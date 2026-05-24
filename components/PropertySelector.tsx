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
        const props: Property[] = data.properties || [];
        setProperties(props);

        // Automaticky vyber property podle klíčového slova z env, jinak první
        if (props.length > 0 && !selectedProperty) {
          const keyword = process.env.NEXT_PUBLIC_GA_PROPERTY_KEYWORD?.toLowerCase();
          const match = keyword
            ? props.find((p) => p.displayName.toLowerCase().includes(keyword) || p.name.toLowerCase().includes(keyword))
            : null;
          const chosen = match ?? props[0];
          onSelect(chosen.name, chosen.displayName);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Chyba");
      } finally {
        setLoading(false);
      }
    }
    fetchProperties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
        Načítám GA4...
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>;
  }

  // Pokud je jen jedna property — zobraz jen název, žádný dropdown
  if (properties.length === 1) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="font-medium">{properties[0].displayName}</span>
      </div>
    );
  }

  // Více properties — zobraz dropdown
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
