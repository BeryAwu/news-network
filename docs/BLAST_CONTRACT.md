# Blast: one narrative, one content, many media

Owner request: a user writes ONE news item; the same content goes to every media site they choose. A blast is a `SourceBrief` with `contentMode` set (`"AI"` or `"AS_WRITTEN"`). `contentMode = null` is a legacy brief (per-media drafts) and is read-only in the new screens (status `LEGACY`).

Internally each media still has its own `Article` row (address, status and slug differ), but the content is identical and edits apply to all of them. Types live in `lib/blast-types.ts`: import them, do not redefine.

## Dashboard routes

| Route | Purpose |
| --- | --- |
| `/briefs` (sidebar "Tulis berita") | The wizard that creates a blast |
| `/blasts` (sidebar "Daftar berita") | List of blasts (owner and admin see all, others see their own) |
| `/blasts/[id]` | The hub for one blast: progress, check, edit, publish, result (links, copy, downloads) |
| `/editorial`, `/publishing` | Redirect to `/blasts` (old links) |
| `/users` (sidebar "Tim dan akses") | Owner assigns the media each user can blast to |

## API (all JSON; mutations need same-origin; `{error}` is plain Indonesian on 4xx)

### Create
1. `POST /api/briefs` (existing): `{workingTitle, narrative, editorNotes:"", references: string[], mediaSiteIds: string[]}` returns the brief; use its `id` as `sourceBriefId`. The narrative is the operator's own words.
2. `POST /api/blasts`: `{sourceBriefId, mode: "AI"|"AS_WRITTEN", styleSkillSlug?: string, styleNote?: string (<=500), featuredAssetId?: string, galleryAssetIds?: string[] (<=4)}` returns `201 {id}` (id = sourceBriefId).
   - `AS_WRITTEN`: content exists immediately (status DRAFT). Needs narrative >= 120 chars and title >= 8 chars, else 400 with a plain message.
   - `AI`: returns right away; content appears after 20 to 90 s (status GENERATING then DRAFT, or FAILED). Poll `GET /api/blasts/[id]` every 4 s.
   - Images: `featuredAssetId` is the main picture, `galleryAssetIds` up to 4 more (shown under the text). Both come from the shared upload below.
   - 409 `{error}` when AI is not configured and mode is AI.

### Read
- `GET /api/blasts?page=1` returns `{items: BlastListItem[], total, page, pages}`, newest first, 20 per page.
- `GET /api/blasts/[id]` returns `BlastDetail`.

### Edit (before or after publishing)
- `PATCH /api/blasts/[id]` body `BlastEditInput`. Applies to all media. Before publishing the content goes back to "needs check" (it is re-approved by the publish button). After publishing the changes go live immediately on every media and the address (slug) never changes. Returns the new `BlastDetail`.
- Limits: title 8..180, excerpt 12..500, body 120..30000, seoTitle <=180, metaDescription <=300, tags <=12 items of <=40, gallery <=4.

### Publish
- `POST /api/blasts/[id]/publish` body `{scheduledAt?: ISO datetime}` approves the content (human decision by pressing the button) and publishes to every media that has a confirmed address. Media without one are skipped and listed in the response. Failed targets are retried by calling it again. Returns `200 {detail: BlastDetail, skipped: {mediaName, reason}[]}`.
- `POST /api/blasts/[id]/unpublish` takes the content off every media and returns `BlastDetail`.

### Downloads (use plain anchors; `content-disposition: attachment`)
- `GET /api/blasts/[id]/links?format=xlsx` columns: No, Media, Judul, Link.
- `GET /api/blasts/[id]/report?format=docx|pdf`: author name, date, title, final text, original narrative, then every live link.
- "Salin semua link" is client side from `BlastDetail.links` (one link per line, `Media: url` is NOT used: only the URLs, one per line).

### Shared images
- `POST /api/assets/sign` (multipart, existing) now accepts a missing `mediaSiteId`: the image is stored once and can be used on every media. Fields: `file`, `originalFilename`, `altText`, `caption`, `credit`, `licenseType` (default `USER_PROVIDED`; others need extra proof, see `lib/asset-provenance.ts`). Returns the Asset (`id`, `secureUrl`, `width`, `height`...). Max 10 MB; jpg, png, webp, avif.

### Users and media
- `PATCH /api/users` `{userId, action: "set-media", mediaSiteIds: string[]}`: OWNER only; replaces the user's media list. Users cannot change their own list. `GET /api/users` already returns each user's media scope; read `app/(dashboard)/users/page.tsx` for the shape in use.

## Public site (done server side, no UI work needed)
Published articles show the author name (the blast's author, an account name). The author, when opening a link from the dashboard, sees an "Edit" button on the live article that opens `/blasts/[id]` on the dashboard. The dashboard link to use for "Lihat di situs" is `GET /api/blasts/[id]/open?media=<mediaSiteId>` (redirects to the live article with a one-time sign-in so the Edit button shows).

### Writing styles in the wizard
`GET /api/skills` (no `mediaSiteId`) returns `{skills: {id, slug, name, description, enabled}[]}`: every active style. The wizard shows them as choices ("Tanpa gaya khusus" plus each style) and sends the chosen `slug` as `styleSkillSlug`. Per-media style toggles are not used by blasts.

### Media list for the wizard
`GET /api/media` returns the media the signed-in user may use (owner and admin: all; others: the media the owner linked to them). Each item has `id`, `displayName`, `slug`, `status`, `domains[]` (`hostname`, `isActive`, `verificationStatus`). A media without a confirmed address can still be chosen; the hub then explains it cannot publish there yet.
