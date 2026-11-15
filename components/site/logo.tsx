import type { CSSProperties } from "react";
import { inkOn, markInner } from "@/lib/logo-mark";
import type { MarkShape } from "@/lib/site-themes";

/** The media's logo mark: a themed shape holding its first letter. Drawn inline, so it needs no image upload. */
export function SiteLogoMark({ shape, color, name, size = 40 }: { shape: MarkShape; color: string; name: string; size?: number }) {
  const letter = (name.trim().charAt(0) || "N").toUpperCase();
  const ink = shape === "bars" ? "#ffffff" : inkOn(color);
  const style: CSSProperties = { width: size, height: size };
  return (
    <svg className="site-logo-mark" viewBox="0 0 48 48" style={style} aria-hidden="true" focusable="false">
      <g dangerouslySetInnerHTML={{ __html: markInner(shape, color) }} />
      {shape !== "bars" && shape !== "bolt" && <text x="24" y={shape === "flag" ? 25 : shape === "drop" ? 33 : 32} textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700" fontSize="24" fill={ink}>{letter}</text>}
    </svg>
  );
}
