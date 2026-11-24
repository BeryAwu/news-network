import { markSvg } from "@/lib/logo-mark";

/** The media's logo mark, drawn inline so it needs no image upload. */
export function SiteLogoMark({ color, name, size = 40 }: { color: string; name: string; size?: number }) {
  return (
    <svg className="site-logo-mark" viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: markSvg(color, name, false) }} />
  );
}
