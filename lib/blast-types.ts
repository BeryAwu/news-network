/**
 * Shared shapes for the blast feature (one narrative, one content, many media).
 * A "blast" is a SourceBrief with `contentMode` set. Server code builds these; UI code only reads them.
 */

export type BlastMode = "AI" | "AS_WRITTEN";

/** Derived, never stored. LEGACY = an older brief whose per-media drafts differ (read-only in the new screens). */
export type BlastStatus = "GENERATING" | "FAILED" | "DRAFT" | "SCHEDULED" | "PUBLISHED" | "PARTIAL" | "LEGACY";

export interface BlastAsset {
  id: string;
  secureUrl: string;
  altText: string;
  caption: string;
  credit: string;
  width: number;
  height: number;
  isAiGenerated: boolean;
}

export interface BlastContent {
  title: string;
  excerpt: string;
  body: string;
  seoTitle: string;
  metaDescription: string;
  tags: string[];
  featured: BlastAsset | null;
  gallery: BlastAsset[];
}

export type PublicationState = "QUEUED" | "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "FAILED" | "CANCELLED";

export interface BlastMedia {
  mediaSiteId: string;
  name: string;
  articleId: string | null;
  /** Article status enum name, or null before the content exists. */
  articleStatus: string | null;
  /** Confirmed public address used for publishing, or null when the media has none. */
  hostname: string | null;
  canPublish: boolean;
  /** Plain Indonesian reason when canPublish is false. */
  problem: string | null;
  publication: { status: PublicationState; url: string | null; error: string | null; publishedAt: string | null } | null;
}

export interface BlastLink {
  mediaName: string;
  title: string;
  url: string;
}

export interface BlastDetail {
  id: string;
  status: BlastStatus;
  mode: BlastMode | null;
  createdAt: string;
  author: { id: string; name: string };
  /** What the operator typed in the narrative step, untouched by AI or edits. */
  originalNarrative: string;
  /** Null while GENERATING or FAILED. The same content is used for every media. */
  content: BlastContent | null;
  generation: { state: "PENDING" | "FAILED" | "DONE"; error: string | null } | null;
  media: BlastMedia[];
  /** Live links only (publication PUBLISHED), in media order. */
  links: BlastLink[];
  canEdit: boolean;
  canPublish: boolean;
}

export interface BlastListItem {
  id: string;
  title: string;
  createdAt: string;
  author: { id: string; name: string };
  status: BlastStatus;
  mode: BlastMode | null;
  mediaCount: number;
  publishedCount: number;
  failedCount: number;
}

/** PATCH /api/blasts/[id] body. Every field optional; omitted fields stay as they are. Applies to every media at once. */
export interface BlastEditInput {
  title?: string;
  excerpt?: string;
  body?: string;
  seoTitle?: string;
  metaDescription?: string;
  tags?: string[];
  featuredAssetId?: string | null;
  galleryAssetIds?: string[];
}
