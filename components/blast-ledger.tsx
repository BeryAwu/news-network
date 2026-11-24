import Link from "next/link";
import { legacyStatusInfo, formatWhen, statusInfo } from "@/components/blast-format";
import type { BlastListItem } from "@/lib/blast-types";

const number = new Intl.NumberFormat("id-ID");

/**
 * The "Lembar" view: one editorial work sheet instead of a stack of cards.
 * Same data, same links, same actions as the card view — only the scanning
 * rhythm changes. Row numbers are real position markers in the queue, not
 * decorative 01/02/03 labels.
 */
export default function BlastLedger({ items, startIndex }: { items: BlastListItem[]; startIndex: number }) {
  return (
    <div className="table-wrap bl-ledger-wrap">
      <table className="bl-ledger">
        <caption className="visually-hidden">Daftar berita dalam tampilan lembar</caption>
        <thead>
          <tr>
            <th scope="col">No.</th>
            <th scope="col">Berita</th>
            <th scope="col">Keadaan</th>
            <th scope="col">Ditulis</th>
            <th scope="col"><span className="visually-hidden">Buka</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const info = item.status === "LEGACY" && item.legacyArticleStatus
              ? legacyStatusInfo[item.legacyArticleStatus] ?? statusInfo[item.status]
              : statusInfo[item.status];
            return (
              <tr key={item.id}>
                <td className="bl-ledger-no num">{number.format(startIndex + index)}</td>
                <th scope="row" className="bl-ledger-title">
                  <Link href={`/blasts/${item.id}`}>{item.title || "Berita tanpa judul"}</Link>
                  <span className="bl-ledger-author">{item.author.name}</span>
                </th>
                <td>
                  <span className={`badge ${info.badge}`.trim()}>{info.label}</span>
                  {item.failedCount > 0 && <span className="bl-ledger-note">{number.format(item.failedCount)} media gagal</span>}
                </td>
                <td className="bl-ledger-when">{formatWhen(item.createdAt)}</td>
                <td className="bl-ledger-open"><Link className="btn" href={`/blasts/${item.id}`} aria-label={`Buka berita ${item.title || "tanpa judul"}`}>Buka</Link></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
