export default function Loading() {
  return <div className="stack" role="status" aria-label="Memuat halaman">
    <div className="skeleton" style={{ height: 40, width: "40%" }}/>
    <div className="skeleton" style={{ height: 160 }}/>
    <div className="skeleton" style={{ height: 240 }}/>
  </div>;
}
