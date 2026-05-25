"use client";

export default function ConversionPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <h1 className="text-xl font-bold text-gray-900">Konverzní cesty</h1>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-gray-700 mb-1">Připravujeme</p>
          <p className="text-sm text-gray-400">Tato sekce bude brzy k dispozici.</p>
        </div>
      </div>
    </div>
  );
}
