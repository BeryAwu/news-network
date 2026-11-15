import "@/app/css/blasts.css";

/** Placeholder rows while the list of berita loads. */
export function BlastListSkeleton() {
  return (
    <div role="status" aria-label="Memuat daftar berita" className="bl-sk">
      <div className="skeleton"/>
      <div className="skeleton"/>
      <div className="skeleton"/>
    </div>
  );
}

/** Placeholder for the one-page hub of a single berita. */
export function BlastHubSkeleton() {
  return (
    <div role="status" aria-label="Memuat berita" className="bl-column">
      <div className="bl-sk">
        <div className="skeleton bl-sk-line"/>
        <div className="skeleton bl-sk-tall"/>
        <div className="skeleton"/>
      </div>
    </div>
  );
}
