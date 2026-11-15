import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { AUTHOR_COOKIE, verifyAuthorToken } from "@/lib/author-link";
import { ArticleCard, SiteShell, formatDate } from "@/components/site/shell";
import { cloudinaryUrl, findPublished, listPublished, paragraphs, requestOrigin, resolveSite } from "@/lib/site";

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
  const related = category
    ? (await listPublished(site, { categoryId: site.media.categories.find((c) => c.slug === category.slug)?.id, take: 4 })).items.filter((i) => i.slug !== snapshot.slug).slice(0, 3)
    : [];
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
    <SiteShell site={site}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article className="site-article">
        {category && <div className="site-meta"><Link href={`/kategori/${category.slug}`}>{category.name}</Link></div>}
        <h1>{snapshot.title}</h1>
        <p className="site-lede">{snapshot.excerpt}</p>
        <div className="site-byline site-small">
          <span>Oleh {bylineName}</span>
          <time dateTime={publishedAt?.toISOString()}>{formatDate(publishedAt)}</time>
          {showEdit && <a className="site-edit" href={`${adminBase}/blasts/${found.blastId}`}>Edit berita</a>}
        </div>
        {image && (
          <figure>
            <Image src={cloudinaryUrl(image.secureUrl, "f_auto,q_auto,w_1440")} alt={image.altText} width={image.width} height={image.height} sizes="(max-width: 760px) 100vw, 720px" priority unoptimized />
            {(image.caption || image.credit || image.isAiGenerated) && <figcaption>{[image.caption, image.credit, image.isAiGenerated ? "Ilustrasi buatan AI" : ""].filter(Boolean).join(", ")}</figcaption>}
          </figure>
        )}
        <div className="site-body site-dropcap">{paragraphs(snapshot.body).map((p, i) => <p key={i}>{p}</p>)}</div>
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
        {snapshot.tags.length > 0 && <div className="site-tags">{snapshot.tags.map((t) => <span key={t}>#{t}</span>)}</div>}
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
      {related.length > 0 && (
        <section className="site-related">
          <h2 className="site-heading">Berita terkait</h2>
          <div className="site-grid">{related.map((item) => <ArticleCard key={item.slug} item={item} />)}</div>
        </section>
      )}
    </SiteShell>
  );
}
