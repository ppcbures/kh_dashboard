"use client";

import { useState } from "react";

type Section = "overview" | "conversion" | "pages" | "search";

const sections: { key: Section; label: string; icon: React.ReactNode }[] = [
  {
    key: "overview",
    label: "Hlavní přehled",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    key: "conversion",
    label: "Konverzní cesty – GA",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    key: "pages",
    label: "Analýza stránek",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    key: "search",
    label: "Search Console",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
];

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-bold text-gray-900 mt-6 mb-2 first:mt-0">{children}</h2>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-gray-700 mt-4 mb-1">{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-600 leading-relaxed mb-2">{children}</p>;
}
function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 text-sm text-gray-600 leading-relaxed">
      <span className="text-gray-400 flex-shrink-0 mt-0.5">•</span>
      <span>{children}</span>
    </li>
  );
}
function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-1 mb-3">{children}</ul>;
}
function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className={`inline-block font-mono text-xs px-2 py-0.5 rounded border font-medium ${color}`}>
      {children}
    </span>
  );
}

const content: Record<Section, React.ReactNode> = {
  overview: (
    <div>
      <H2>Hlavní přehled</H2>
      <P>
        Centrální přehled marketingových výsledků za vybrané časové období. Data jsou
        kombinací rozpočtového plánu (Google Sheets), výdajů za reklamu (Google Sheets)
        a interní evidence poptávek (Google Sheets).
      </P>

      <H3>Výběr období</H3>
      <P>
        Vpravo nahoře je výběr datového rozsahu. Na výběr jsou předdefinovaná období
        (tento měsíc, minulý měsíc, posledních 30 dní…) nebo vlastní rozsah. Vybrané
        období se ukládá a sdílí napříč všemi kartami dashboardu.
      </P>

      <H3>Karty rozpočtu</H3>
      <P>
        Tři karty zobrazují plnění měsíčního plánu. Plán se automaticky načítá
        z Google Sheets a v názvu karty vždy uvádí konkrétní měsíc, pro který platí
        (např. <em>Celkem rozpočet pro Květen 2026</em>).
      </P>
      <Ul>
        <Li><strong>Celkem rozpočet pro [měsíc]</strong> – celkový měsíční plán výdajů na reklamu (součet za všechny kanály)</Li>
        <Li><strong>Ideální útrata ke včerejšímu dni</strong> – přepočtená ideální výše výdajů k včerejšímu datu; vypočítáno v sheetu jako poměrná část měsíčního rozpočtu</Li>
        <Li><strong>Aktuální útrata za vybrané datum</strong> – skutečné výdaje za zvolené období z reklamních systémů</Li>
      </Ul>

      <H3>Útrata dle kanálů</H3>
      <P>
        Rozklikávací tabulka pod kartami rozpočtu rozpadá výdaje dle reklamního kanálu.
        Každý řádek odpovídá jednomu kanálu a zobrazuje tři hodnoty:
      </P>
      <Ul>
        <Li><strong>Google Ads (google / cpc, google / display…)</strong> – výdaje v Google reklamním systému</Li>
        <Li><strong>Sklik (seznam / cpc…)</strong> – výdaje v Sklik reklamním systému</Li>
        <Li><strong>Facebook (facebook / paid…)</strong> – výdaje na Facebooku / Instagramu</Li>
        <Li><strong>Bing (bing / cpc…)</strong> – výdaje na Microsoft Bing Ads</Li>
      </Ul>
      <P>
        Sloupce: <strong>Rozpočet</strong> (měsíční plán z sheetu) ·{" "}
        <strong>Ideální útrata</strong> (přepočtená ke včerejšímu dni z sheetu) ·{" "}
        <strong>Aktuální útrata</strong> (skutečné výdaje za vybrané datum).
      </P>

      <H3>Karty poptávek a realizací</H3>
      <Ul>
        <Li><strong>Počet poptávek</strong> – celkový počet přijatých poptávek za vybrané období</Li>
        <Li><strong>Cena za poptávku</strong> – celková útrata děleno počtem poptávek</Li>
        <Li><strong>Počet realizací</strong> – poptávky, které se proměnily v zakázku (sloupec Realizace = ANO)</Li>
        <Li><strong>Cena za realizaci</strong> – celková útrata děleno počtem realizací</Li>
        <Li><strong>Hrubá marže</strong> – součet marží ze všech realizovaných zakázek</Li>
      </Ul>

      <H3>Tabulka poptávek</H3>
      <P>
        Pod historickými výsledky se zobrazí nadpis <strong>Poptávky za vybrané období</strong>
        a pod ním tabulka jednotlivých poptávek načtených z Google Sheets (roky 2024, 2025, 2026).
        Řazení je vzestupné dle čísla PK.
      </P>
      <Ul>
        <Li>
          <strong>Checkboxy filtrů</strong> – tři nezávislé checkboxy:{" "}
          <Badge color="bg-green-100 text-green-800 border-green-200">Realizace</Badge>{" "}
          <Badge color="bg-orange-100 text-orange-800 border-orange-200">V řešení</Badge>{" "}
          <Badge color="bg-red-100 text-red-800 border-red-200">Nevyšlo</Badge>{" "}
          — lze kombinovat (OR logika); bez zaškrtnutí se zobrazí vše
        </Li>
        <Li>Řádky jsou barevně rozlišeny: <span className="text-green-700 font-medium">zelená</span> = realizace, <span className="text-orange-600 font-medium">oranžová</span> = v řešení, ostatní střídají šedou a bílou</Li>
        <Li><strong>GA zdroj</strong> – zdroj zákazníka dle Google Analytics ve formátu <em>zdroj / médium</em>, např. <code className="bg-gray-100 px-1 rounded text-xs">google / cpc</code>, <code className="bg-gray-100 px-1 rounded text-xs">facebook / paid</code>; pokud se nepodařilo spárovat, zobrazí se kurzívou <span className="italic text-gray-400">???</span></Li>
        <Li><strong>GA kampaň</strong> – název kampaně, ze které zákazník přišel</Li>
        <Li><strong>Marže 0 Kč</strong> – červeně zvýrazněná hodnota znamená, že marže ještě nebyla doplněna do sheetu</Li>
        <Li><strong>Marže ?</strong> – oranžový otazník znamená prázdnou nebo chybějící hodnotu marže</Li>
      </Ul>

      <H3>Historické výsledky</H3>
      <P>
        Rozbalovací sekce na konci stránky srovnává výsledky za roky 2024, 2025 a 2026
        v tabulkách vedle sebe. Každá tabulka obsahuje tučný souhrnný řádek s celkovými
        hodnotami za rok (útrata, počty, ceny za poptávku/realizaci, celková marže).
      </P>
    </div>
  ),

  conversion: (
    <div>
      <H2>Konverzní cesty – z Google Analytics</H2>
      <P>
        Přehled konverzních událostí z Google Analytics 4. Ukazuje, přes které stránky
        zákazník prošel, než provedl konverzní akci, a kde ke konverzi došlo.
        Data pochází výhradně z GA4 — informace o realizacích ze Sheets zde nejsou dostupné.
      </P>

      <H3>Typy konverzí</H3>
      <Ul>
        <Li><Badge color="bg-green-100 text-green-800 border-green-200">Odeslání formuláře</Badge> – zákazník odeslal poptávkový formulář</Li>
        <Li><Badge color="bg-blue-100 text-blue-800 border-blue-200">Kliknutí na telefon</Badge> – zákazník klikl na telefonní číslo</Li>
        <Li><Badge color="bg-purple-100 text-purple-800 border-purple-200">Kliknutí na email</Badge> – zákazník klikl na e-mailovou adresu</Li>
        <Li><Badge color="bg-sky-100 text-sky-800 border-sky-200">Zkopírování telefonu</Badge> – zákazník zkopíroval telefonní číslo</Li>
        <Li><Badge color="bg-violet-100 text-violet-800 border-violet-200">Zkopírování emailu</Badge> – zákazník zkopíroval e-mailovou adresu</Li>
      </Ul>

      <H3>Sloupce tabulky</H3>
      <Ul>
        <Li><strong>Název události</strong> – typ konverzní akce (přeložený název); kliknutím na záhlaví lze seřadit</Li>
        <Li><strong>Konverzní stránka</strong> – stránka webu, kde ke konverzi došlo; kliknutím na záhlaví lze seřadit</Li>
        <Li><strong>Cesta uživatele</strong> – sekvence stránek, které zákazník navštívil před konverzí (až 15 kroků); řazení probíhá dle <em>počtu kroků cesty</em> (ne dle uživatelů)</Li>
        <Li><strong>Počet uživatelů</strong> – kolik unikátních uživatelů provedlo danou akci na dané cestě; záhlaví je klikatelné pro řazení</Li>
      </Ul>

      <H3>Volitelné sloupce</H3>
      <Ul>
        <Li><strong>Datum</strong> – zapnutím se zobrazí datum konverze a záznamy se přestanou seskupovat přes více dní</Li>
        <Li><strong>Jméno zákazníka</strong> – dostupné pouze u odeslaných formulářů; po zaškrtnutí se každý zákazník zobrazí na samostatném řádku</Li>
      </Ul>

      <H3>Seskupování řádků</H3>
      <P>
        Výchozí zobrazení seskupuje záznamy se stejnou událostí, konverzní stránkou a
        cestou uživatele do jednoho řádku. Počet uživatelů odpovídá součtu všech
        seskupených záznamů. Zapnutí sloupce Datum nebo Jméno zákazníka skupiny dále
        rozdělí.
      </P>

      <H3>Filtry</H3>
      <Ul>
        <Li><strong>Událost</strong> – rozbalovací seznam s typy konverzí; v závorce je uveden celkový počet uživatelů pro každý typ</Li>
        <Li><strong>Konverzní stránka</strong> – filtrování dle stránky, kde ke konverzi došlo; v závorce je celkový počet uživatelů na dané stránce</Li>
      </Ul>

      <H3>Řazení</H3>
      <P>
        Kliknutím na záhlaví sloupce se tabulka seřadí — prvním kliknutím vzestupně,
        druhým sestupně. Aktivní sloupec a směr zobrazuje šipka (↑ / ↓). Sloupec
        „Cesta uživatele" řadí dle počtu kroků cesty (od nejkratší po nejdelší nebo naopak).
      </P>
    </div>
  ),

  pages: (
    <div>
      <H2>Analýza stránek</H2>
      <P>
        Detailní pohled na výkon jednotlivých stránek webu na základě dat z Google Analytics 4.
      </P>

      <H3>Přehled webu (bez vybrané stránky)</H3>
      <P>
        Před výběrem konkrétní stránky se zobrazí celkový přehled webu za vybrané období:
      </P>
      <Ul>
        <Li><strong>KPI karty</strong> – celkový počet zobrazení stránek, relací, unikátních uživatelů, průměrná doba na webu a průměrná míra odchodu</Li>
        <Li>
          <strong>Top stránky</strong> – tabulka nejnavštěvovanějších stránek s relativními pruhy a stránkováním po 10 položkách (tlačítka ← →); kliknutím na řádek zobrazíte detail dané stránky
        </Li>
        <Li>
          <strong>Řazení v tabulce top stránek</strong> – kliknutím na záhlaví sloupce (Zobrazení, Relace, Uživatelé, Doba, Odchod) lze tabulku seřadit; šipka ↑/↓ ukazuje aktivní řazení, druhým kliknutím se obrátí směr
        </Li>
      </Ul>

      <H3>Levý panel – seznam stránek</H3>
      <Ul>
        <Li>Vyhledávací pole pro filtrování dle URL nebo názvu stránky</Li>
        <Li>Tlačítka pro řazení: Zobrazení, Relace, Uživatelé, Doba, Odchod — aktivní metrika je zvýrazněna červeně a zobrazuje se jako primární hodnota u každé stránky v panelu; vedle ní je sekundárně zobrazeno číslo zobrazení (pokud je zvolena jiná metrika)</Li>
        <Li>Panel lze skrýt/zobrazit šipkou vlevo</Li>
      </Ul>

      <H3>Detail stránky</H3>
      <P>Kliknutím na stránku v levém panelu se zobrazí:</P>
      <Ul>
        <Li><strong>KPI karty</strong> – metriky konkrétní stránky (zobrazení, relace, unikátní uživatelé, průměrná doba, míra odchodu)</Li>
        <Li><strong>Zdroje návštěvnosti</strong> – odkud návštěvníci na danou stránku přicházejí (zdroj / médium)</Li>
        <Li><strong>Tok návštěvníků</strong> – odkud přišli (předchozí stránky nebo přímý vstup) a kam šli dál (nebo kde opustili web)</Li>
        <Li><strong>Na co klikali</strong> – přehled kliknutí na stránce s textem odkazu, cílovou URL, počtem uživatelů a kliknutí; obrázky se zobrazují jako náhledy</Li>
      </Ul>
    </div>
  ),

  search: (
    <div>
      <H2>Search Console</H2>
      <P>
        Tato sekce zobrazuje data z Google Search Console — organická viditelnost webu
        ve vyhledávání Google.
      </P>
      <div className="mt-6 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
        </svg>
        <p className="text-sm text-amber-700">
          Dokumentace pro tuto sekci bude doplněna po jejím dokončení.
        </p>
      </div>
    </div>
  ),
};

interface HelpModalProps {
  onClose: () => void;
  initialSection?: Section;
}

export default function HelpModal({ onClose, initialSection = "overview" }: HelpModalProps) {
  const [active, setActive] = useState<Section>(initialSection);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h1 className="text-lg font-bold text-gray-900">Nápověda</h1>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Levý panel – rozcestník */}
          <div className="w-56 flex-shrink-0 border-r border-gray-200 bg-gray-50 p-3 flex flex-col gap-1">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide px-2 mb-2">Sekce</p>
            {sections.map(s => (
              <button
                key={s.key}
                onClick={() => setActive(s.key)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors w-full ${
                  active === s.key
                    ? "text-white"
                    : "text-gray-600 hover:bg-gray-200"
                }`}
                style={active === s.key ? { backgroundColor: "#e30613" } : {}}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>

          {/* Pravý panel – obsah */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            {content[active]}
          </div>
        </div>
      </div>
    </div>
  );
}
