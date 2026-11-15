import NewsroomLogo from "@/components/newsroom-logo";

/** Left panel of the login and setup screens: the brand, one plain promise, and a drawn desk (SVG, no photo). */
export default function AuthArt() {
  return (
    <aside className="auth-art" aria-hidden="false">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true"><NewsroomLogo size={36} /></span>
        <span>Newsroom<small>Pusat kerja redaksi</small></span>
      </div>
      <h2>Satu tempat untuk semua media Anda.</h2>
      <p>Tulis topik, periksa draf, lalu terbitkan ke setiap situs berita dari satu layar.</p>
      <svg viewBox="0 0 420 260" role="img" aria-label="Ilustrasi tiga halaman berita yang terhubung ke satu dasbor">
        <rect x="150" y="20" width="120" height="86" rx="14" fill="var(--app-primary)" />
        <rect x="166" y="40" width="64" height="8" rx="4" fill="var(--app-primary-ink)" />
        <rect x="166" y="58" width="88" height="6" rx="3" fill="var(--app-primary-ink)" opacity="0.55" />
        <rect x="166" y="72" width="76" height="6" rx="3" fill="var(--app-primary-ink)" opacity="0.55" />
        <rect x="166" y="86" width="52" height="6" rx="3" fill="var(--app-primary-ink)" opacity="0.55" />
        <path d="M210 106 L210 150 M210 150 L90 170 M210 150 L330 170" stroke="var(--app-board-muted)" strokeWidth="2" fill="none" />
        {[{ x: 30, c: "var(--app-success)" }, { x: 150, c: "var(--app-info)" }, { x: 270, c: "var(--app-warn-soft)" }].map((card) => (
          <g key={card.x}>
            <rect x={card.x} y="170" width="120" height="76" rx="14" fill="var(--app-board-2)" stroke="var(--app-board-muted)" />
            <rect x={card.x + 14} y="186" width="44" height="8" rx="4" fill={card.c} />
            <rect x={card.x + 14} y="204" width="90" height="6" rx="3" fill="var(--app-board-muted)" opacity="0.7" />
            <rect x={card.x + 14} y="218" width="70" height="6" rx="3" fill="var(--app-board-muted)" opacity="0.7" />
          </g>
        ))}
      </svg>
    </aside>
  );
}

/** Brand line for the light panel; only visible when the art panel is hidden (narrow screens). */
export function AuthBrand() {
  return (
    <div className="auth-brand brand">
      <span className="brand-mark" aria-hidden="true"><NewsroomLogo size={36} /></span>
      <span>Newsroom<small>Pusat kerja redaksi</small></span>
    </div>
  );
}
