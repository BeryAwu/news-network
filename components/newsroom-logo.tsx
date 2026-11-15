import { newsroomMarkInner } from "@/lib/newsroom-mark";

/** The Newsroom product logo for the dashboard (sidebar, login). Decorative: the product name is always written next to it. */
export default function NewsroomLogo({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false">
      <g dangerouslySetInnerHTML={{ __html: newsroomMarkInner }} />
    </svg>
  );
}
