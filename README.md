# KH Dashboard

Analytický dashboard pro web **klimatizace-hustopece.cz** — zobrazuje data z Google Analytics 4 a Google Search Console.

## Co dashboard umí

### Analýza stránek (GA4)
- Seznam všech stránek seřazený podle zobrazení / sessions / uživatelů / doby na stránce / bounce rate
- Detail stránky:
  - KPI metriky (zobrazení, sessions, uživatelé, průměrná doba, bounce rate)
  - Zdroje návštěvnosti (source/medium)
  - Cesta uživatele — odkud přišli / kam šli dál
  - Kliknutí na stránce (událost `link_click` s parametry `click_text` a `click_url`)

### Search Console
- Přehled KPI (kliky, zobrazení, CTR, průměrná pozice)
- Top dotazy
- Výkon jednotlivých stránek s možností rozkliknout detail dotazů

### Globální funkce
- Výběr datového rozsahu — přetrvá při přepínání mezi záložkami
- Přihlášení přes Google OAuth (přístup pouze pro oprávněné účty)

## Tech stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS v4)
- **NextAuth.js v4** — Google OAuth (scopes: analytics.readonly + webmasters.readonly)
- **Google Analytics Data API v1beta** (`googleapis`)
- **Google Search Console API v1**
- **Vercel** — hosting

## Lokální spuštění

```bash
npm install
npm run dev
```

Vyžaduje soubor `.env.local` s těmito proměnnými:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_GA_PROPERTY_KEYWORD=klimatizace-hustopece
NEXT_PUBLIC_SITE_KEYWORD=klimatizace-hustopece
NEXT_PUBLIC_SITE_ORIGIN=https://klimatizace-hustopece.cz
```

> `.env.local` není commitován do gitu.

## Struktura projektu

```
app/
  api/
    auth/           # NextAuth handler
    ga/             # GA4 API routes (pages, page-detail)
    sc/             # Search Console API routes
  dashboard/
    pages/          # Záložka Analýza stránek
    search-console/ # Záložka Search Console
  login/            # Přihlašovací stránka
components/
  Sidebar.tsx
  DateRangePicker.tsx
  PropertySelector.tsx
contexts/
  DateRangeContext.tsx   # Globální stav datového rozsahu
```
