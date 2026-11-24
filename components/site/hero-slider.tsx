"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export interface HeroSlide {
  slug: string;
  title: string;
  excerpt: string;
  category: { name: string; slug: string } | null;
  imageUrl: string | null;
  imageAlt: string;
  authorName: string;
  /** Pre-formatted on the server so the slide reads the same as every other date on the page. */
  dateLabel: string;
  dateTime: string | null;
}

const INTERVAL_MS = 7000;

/** The lead stories, one at a time. Moves on its own every 7 s unless the reader is pointing at it, focused inside it, or asked for reduced motion. */
export default function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const root = useRef<HTMLElement>(null);
  const count = slides.length;

  const go = useCallback((next: number) => setIndex((next + count) % count), [count]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (count < 2 || paused || reduced) return;
    const timer = window.setTimeout(() => go(index + 1), INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [index, paused, reduced, count, go]);

  if (!count) return null;

  return (
    <section
      ref={root}
      className="site-hero"
      aria-roledescription="carousel"
      aria-label="Berita utama"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => { if (!root.current?.contains(event.relatedTarget as Node | null)) setPaused(false); }}
      onKeyDown={(event) => { if (event.key === "ArrowRight") go(index + 1); if (event.key === "ArrowLeft") go(index - 1); }}
    >
      <div className="site-hero-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((slide, i) => (
          <article key={slide.slug} className="site-hero-slide" aria-roledescription="slide" aria-label={`${i + 1} dari ${count}`} aria-hidden={i !== index} inert={i !== index}>
            {slide.imageUrl
              ? <Image className="site-hero-image" src={slide.imageUrl} alt={slide.imageAlt} fill sizes="(max-width: 1240px) 100vw, 1200px" priority={i === 0} unoptimized />
              : <div className="site-hero-image site-hero-image-empty" aria-hidden="true" />}
            <div className="site-hero-copy">
              {slide.category && <Link className="site-hero-kicker" href={`/kategori/${slide.category.slug}`}>{slide.category.name}</Link>}
              <h2><Link href={`/articles/${slide.slug}`}>{slide.title}</Link></h2>
              {slide.excerpt && <p className="site-hero-excerpt">{slide.excerpt}</p>}
              <p className="site-hero-byline"><span>Oleh <strong>{slide.authorName}</strong></span><time dateTime={slide.dateTime ?? undefined}>{slide.dateLabel}</time></p>
            </div>
          </article>
        ))}
      </div>
      {count > 1 && (
        <div className="site-hero-controls">
          <button type="button" onClick={() => go(index - 1)} aria-label="Berita sebelumnya">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <div className="site-hero-dots">
            {slides.map((slide, i) => (
              <button key={slide.slug} type="button" aria-label={`Tampilkan berita ${i + 1}: ${slide.title}`} aria-current={i === index ? "true" : undefined} onClick={() => go(i)} />
            ))}
          </div>
          <button type="button" onClick={() => go(index + 1)} aria-label="Berita berikutnya">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      )}
      <p className="site-visually-hidden" aria-live={paused || reduced ? "polite" : "off"}>{`Berita ${index + 1} dari ${count}: ${slides[index]?.title ?? ""}`}</p>
    </section>
  );
}
