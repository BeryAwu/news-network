import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { AUTHOR_COOKIE, verifyAuthorToken } from "@/lib/author-link";
import ShareBar from "@/components/site/share-bar";
import { SectionTitle, SiteShell, StoryCard, StoryRow, formatLongDate, formatTime } from "@/components/site/shell";
import { adjacentPublished, cloudinaryUrl, findPublished, listPublished, paragraphs, requestOrigin, resolveSite, type SiteListItem } from "@/lib/site";

/** True when the visitor holds a valid author cookie for this host and wrote the story (or is an owner or admin). */
async function viewerCanEdit(hostname: string, authorId: string) {
  const token = (await cookies()).get(AUTHOR_COOKIE)?.value;
  const viewerId = token ? await verifyAuthorToken(token, hostname) : null;
  if (!viewerId) return false;
  if (viewerId === authorId) return true;
  return Boolean(await db.userRole.findFirst({ where: { userId: viewerId, role: { in: ["OWNER", "ADMIN"] } }, select: { userId: true } }));
}

type Props = { params: Promise<{ articleSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { articleSlug } = await params;
  const site = await resolveSite();
  const found = await findPublished(site, articleSlug);
  if (!found) notFound();
  const { snapshot } = found;
  const origin = await requestOrigin();
  const url = `${origin}/articles/${snapshot.slug}`;
  const title = snapshot.seoTitle || snapshot.title;
  const description = snapshot.metaDescription || snapshot.excerpt;
  const image = snapshot.featuredAsset ? cloudinaryUrl(snapshot.featuredAsset.secureUrl, "f_auto,q_auto,c_fill,w_1200,h_630") : undefined;
  return {
    icons: { icon: [{ url: "/site-icon", type: "image/svg+xml" }] },
    title: { absolute: `${title} · ${site.media.displayName}` }, description, keywords: snapshot.tags, alternates: { canonical: url },
    openGraph: { type: "article", title, description, url, siteName: site.media.displayName, publishedTime: found.publishedAt?.toISOString(), tags: snapshot.tags, ...(image ? { images: [{ url: image, width: 1200, height: 630, alt: snapshot.featuredAsset?.altText }] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { articleSlug } = await params;
  const site = await resolveSite();
  const found = await findPublished(site, articleSlug);
  if (!found) notFound();
  const { snapshot, publishedAt, category } = found;
  const bylineName = snapshot.authorName || site.media.newsroomByline;
  const showEdit = Boolean(found.blastId) && (await viewerCanEdit(site.hostname, found.authorId));
  const adminBase = (process.env.ADMIN_BASE_URL || "").replace(/\/$/, "");
  const origin = await requestOrigin();
  const image = snapshot.featuredAsset;
  const url = `${origin}/articles/${snapshot.slug}`;
  // Every suggestion on this page comes from the same writer; prev/next follow the site's publishing order.
  const [{ items: byAuthor }, { previous, next }] = await Promise.all([
    listPublished(site, { authorId: found.authorId, excludeSlug: snapshot.slug, take: 11 }),
    adjacentPublished(site, publishedAt, snapshot.slug),
  ]);
  const readAlso = byAuthor.slice(0, 2);
  const related = byAuthor.length > 2 ? byAuthor.slice(2, 5) : byAuthor;
  const moreFromAuthor = byAuthor.slice(5, 11);
  const body = paragraphs(snapshot.body);
  /** "Baca juga" boxes after the 3rd and 7th paragraph, as long as the story is long enough to carry them. */
  const inlineAfter = new Map<number, SiteListItem>();
  readAlso.forEach((item, i) => { const at = 2 + i * 4; if (at < body.length - 1) inlineAfter.set(at, item); });
  const jsonLd = {
    "@context": "https://schema.org", "@type": "NewsArticle",
    headline: snapshot.title, description: snapshot.metaDescription || snapshot.excerpt,
    mainEntityOfPage: `${origin}/articles/${snapshot.slug}`,
    datePublished: publishedAt?.toISOString(), inLanguage: site.media.defaultLocale,
    author: snapshot.authorName ? { "@type": "Person", name: snapshot.authorName } : { "@type": "Organization", name: site.media.newsroomByline },
    publisher: { "@type": "Organization", name: site.media.displayName },
    ...(image ? { image: [image.secureUrl] } : {}), keywords: snapshot.tags.join(", "),
  };
  return (
    <SiteShell site={site} current={category?.slug}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article className="site-article">
        <nav className="site-crumbs" aria-label="Lokasi halaman">
          <Link href="/">Beranda</Link>
          {category && <><span aria-hidden="true">/</span><Link href={`/kategori/${category.slug}`}>{category.name}</Link></>}
        </nav>
        <header className="site-article-head">
          <h1>{snapshot.title}</h1>
          {snapshot.excerpt && <p className="site-lede">{snapshot.excerpt}</p>}
          <div className="site-article-meta">
            <div className="site-author">
              <span className="site-author-initial" aria-hidden="true">{bylineName.trim().charAt(0).toUpperCase()}</span>
              <div>
                <p className="site-author-name">Oleh <strong>{bylineName}</strong></p>
                <p className="site-author-date"><time dateTime={publishedAt?.toISOString()}>{formatLongDate(publishedAt)}, {formatTime(publishedAt)}</time></p>
              </div>
              {showEdit && <a className="site-edit" href={`${adminBase}/blasts/${found.blastId}`}>Edit berita</a>}
            </div>
            <ShareBar url={url} title={snapshot.title} />
          </div>
        </header>
        {image && (
          <figure className="site-article-figure">
            <Image src={cloudinaryUrl(image.secureUrl, "f_auto,q_auto,w_1600")} alt={image.altText} width={image.width} height={image.height} sizes="(max-width: 980px) 100vw, 960px" priority unoptimized />
            {(image.caption || image.credit || image.isAiGenerated) && <figcaption>{[image.caption, image.credit, image.isAiGenerated ? "Ilustrasi buatan AI" : ""].filter(Boolean).join(", ")}</figcaption>}
          </figure>
        )}
        <div className="site-body">
          {body.map((p, i) => {
            const also = inlineAfter.get(i);
            return (
              <Fragment key={i}>
                <p>{p}</p>
                {also && (
                  <aside className="site-readalso" aria-label="Baca juga">
                    <span>Baca juga</span>
                    <Link href={`/articles/${also.slug}`}>{also.title}</Link>
                  </aside>
                )}
              </Fragment>
            );
          })}
        </div>
        {snapshot.gallery.length > 0 && (
          <div className="site-gallery">
            {snapshot.gallery.map((g) => (
              <figure key={g.secureUrl}>
                <Image src={cloudinaryUrl(g.secureUrl, "f_auto,q_auto,w_1000")} alt={g.altText} width={g.width} height={g.height} sizes="(max-width: 760px) 100vw, 720px" unoptimized />
                {(g.caption || g.credit || g.isAiGenerated) && <figcaption>{[g.caption, g.credit, g.isAiGenerated ? "Ilustrasi buatan AI" : ""].filter(Boolean).join(", ")}</figcaption>}
              </figure>
            ))}
          </div>
        )}
        {snapshot.tags.length > 0 && <ul className="site-tags" aria-label="Topik">{snapshot.tags.map((t) => <li key={t}>{t}</li>)}</ul>}
        <div className="site-article-share-end"><ShareBar url={url} title={snapshot.title} /></div>
        {snapshot.aiAssisted && <p className="site-well">Naskah ini dibuat dengan bantuan AI. Redaksi {site.media.displayName} memeriksa dan menyetujuinya sebelum terbit.</p>}
        {snapshot.uncertainties.length > 0 && (
          <section className="site-evidence">
            <h2>Catatan redaksi</h2>
            <ul>{snapshot.uncertainties.map((u, i) => <li key={i}>{u}</li>)}</ul>
          </section>
        )}
        {snapshot.claimsUsed.length > 0 && (
          <section className="site-evidence">
            <h2>Dasar klaim</h2>
            <ul>
              {snapshot.claimsUsed.map((claim, i) => (
                <li key={i}>
                  {claim.claimText}
                  {claim.sourceFactIds.map((factId) => {
                    const fact = snapshot.sourceFacts.find((f) => f.id === factId);
                    const source = fact?.sourceReferenceId ? snapshot.sourceReferences.find((r) => r.id === fact.sourceReferenceId) : undefined;
                    const label = source ? source.publisherName || source.title || source.url : null;
                    return <span key={factId}> [{fact?.supportStatus === "SUPPORTED" ? "terverifikasi" : "belum terverifikasi"}{source && label ? <>, {/^https?:\/\//i.test(source.url) ? <a href={source.url} target="_blank" rel="noopener noreferrer nofollow">{label}</a> : label}</> : null}]</span>;
                  })}
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
      {(previous || next) && (
        <nav className="site-prevnext" aria-label="Artikel sebelumnya dan berikutnya">
          {previous ? <Link href={`/articles/${previous.slug}`} rel="prev" className="is-prev"><span>Artikel sebelumnya</span><strong>{previous.title}</strong></Link> : <span />}
          {next ? <Link href={`/articles/${next.slug}`} rel="next" className="is-next"><span>Artikel berikutnya</span><strong>{next.title}</strong></Link> : <span />}
        </nav>
      )}
      {related.length > 0 && (
        <section className="site-related" aria-labelledby="terkait">
          <SectionTitle id="terkait">Berita terkait dari {bylineName}</SectionTitle>
          <div className="site-cards">{related.map((item) => <StoryCard key={item.slug} item={item} />)}</div>
        </section>
      )}
      {moreFromAuthor.length > 0 && (
        <section className="site-related" aria-labelledby="rekomendasi-penulis">
          <SectionTitle id="rekomendasi-penulis">Rekomendasi lain dari {bylineName}</SectionTitle>
          <div className="site-rows site-rows-2">{moreFromAuthor.map((item) => <StoryRow key={item.slug} item={item} showExcerpt={false} />)}</div>
        </section>
      )}
    </SiteShell>
  );
}
