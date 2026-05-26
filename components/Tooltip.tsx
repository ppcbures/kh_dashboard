"use client";

import { useState, useRef } from "react";
import { createPortal } from "react-dom";

export default function Tooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLSpanElement>(null);

  const handleMouseEnter = () => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const TOOLTIP_W = 300;
    const GAP = 8;

    // Vycentrovat na trigger, ale zamezit přetečení přes okraje viewportu
    let left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - TOOLTIP_W - 8));

    setStyle({
      position: "fixed",
      top: rect.bottom + GAP,
      left,
      width: TOOLTIP_W,
      zIndex: 9999,
    });
    setVisible(true);
  };

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setVisible(false)}
        onClick={e => e.stopPropagation()}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-300 text-white text-[10px] font-bold cursor-default leading-none ml-1 align-middle select-none"
      >
        ?
      </span>
      {visible && typeof window !== "undefined" &&
        createPortal(
          <div
            style={style}
            className="pointer-events-none bg-gray-800 text-white text-xs px-3 py-2 rounded-lg shadow-xl leading-snug text-center"
          >
            {text}
          </div>,
          document.body
        )}
    </>
  );
}
