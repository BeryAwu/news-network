# Dashboard design system

Applies to every screen behind the login (`app/(dashboard)`), plus `/login`, `/setup` and the 404 page. The public news sites use a separate system (`app/site.css`, one shared layout coloured per media) and must not be touched.

Audience: newsroom staff who are not technical. The tool should read like a to-do list, not an admin console.

## Look

- Theme: Hallmark **Coral** (genre playful, app-screen scope), warm paper, soft rounded surfaces, one coral accent, dark warm sidebar. Cheerful but professional: colour marks state and the primary action, nothing else.
- Font: Plus Jakarta Sans (`--nf-app`), one family. Scale (`--app-text-*`): 12, 13, 15, 17, 20, 24, 30 px. Body 15 px.
- Tokens live in `app/app.css` `:root` with the `--app-` prefix. Never write a literal colour, font or spacing value outside that block. Use `var(--app-…)`.
- Icons: `lucide-react`, 16 to 20 px, always with a text label next to them unless the button has an `aria-label`. No emoji, no icon tiles on stats.
- Charts are inline SVG (`components/charts.tsx`): one accent series, zero baseline, no donuts or gauges.

## Class vocabulary (already styled in `app/app.css`)

| Need | Classes |
| --- | --- |
| Page title | `<PageHeading title subtitle action>` from `@/components/ui` |
| Surface | `card`, `card card-soft` (highlight), `card flush` (no padding, for tables) |
| Layout | `stack` (gap 16), `stack-sm` (gap 8), `row`, `row-between`, `actions`, `grid-2`, `grid-3`, `grid-4`, `divider` |
| Buttons | `btn`, `btn btn-primary` (one per screen region), `btn btn-quiet`, `btn btn-danger`, add `btn-sm` or `btn-block` |
| Form | `field` wraps `label` + control + `field-help` / `field-error`; `checkline`; `choice-list` with `choice` rows (selectable cards, `:has(input:checked)` highlights) |
| Feedback | `notice` + `notice-error` / `notice-warn` / `notice-success`; `badge` + `badge-green` / `badge-yellow` / `badge-red` / `badge-blue`; `<StatusBadge status>`; `<EmptyState>`; `skeleton` |
| Data | `table-wrap` > `table`; `stat` (`stat-label`, `stat-figure`, `stat-hint`); `tabs` > `tab` (`aria-current="true"` marks the active one) |
| Text | `muted`, `eyebrow` (plain small label, never capitals), `subtitle`, `num` (tabular digits) |

Page-specific styles go in `app/css/<area>.css`, imported by the page or component that needs it, written as `.app { .your-class { … } }` (native nesting) with `--app-` tokens only. Do not edit `app/app.css`, `components/ui.tsx`, `components/ui/*`, `components/charts.tsx`, `app/(dashboard)/layout.tsx` or `components/dashboard-navigation.tsx`; ask for a change in your final report instead.

## Hallmark floor for app screens (sloplint enforces it)

No `transition: all`; never animate width, height, top or left. Every interactive element has `:focus-visible`. `prefers-reduced-motion` fallback. No eyebrows or tracked-capital labels. No middle-dot-joined meta strings, no arrows glued to link text. No card inside a card (use a `divider` or a `well` instead). No gradients. 44 px minimum hit target (`btn` is 44 px, `btn-sm` 36 px only inside dense tables). Never an invented figure: a stat shows a real number or nothing.

## UX rules (non-technical users)

1. One primary action per screen region, worded as a verb the user would say: "Buat draf", "Setujui", "Terbitkan sekarang". No jargon in labels (see the glossary).
2. Say what happens next. Every form ends with a button that names the result; after success show a `notice-success` with the next step as a link.
3. Every region that loads or lists data handles four states: loading (`skeleton`), empty (`EmptyState` with the one action that fills it), error (`notice-error` saying what broke and what to do), full.
4. Destructive or irreversible actions ask first (`window.confirm` with plain words is acceptable) and say what will and will not be lost.
5. Defaults do the work: pre-select what is almost always right, hide advanced fields behind a `<details>` titled in plain words ("Pengaturan lanjutan").
6. State that a user may want to share or return to lives in the URL (tabs, filters, page).
7. Errors: say the cause in one sentence and the fix in another. No stack traces, no HTTP codes in the main text.
8. Mobile first: every screen works at 390 px; tables scroll horizontally inside `table-wrap`.

## Glossary: say this, not that

| Say | Not |
| --- | --- |
| Tulis berita, topik | brief, source brief |
| Draf AI, buat draf | generate, generation run |
| Daftar berita (periksa dan terbitkan) | editorial review, queue, publish target |
| Berita (satu narasi untuk banyak media) | blast, brief |
| Pengarang | author, createdBy |
| Setujui, minta perbaikan, tolak | approve, needs changes, reject |
| Perbaiki dengan AI | AI revision |
| Sumber dan bukti | evidence snapshot, claims, facts |
| Terbitkan, jadwalkan, tarik dari publikasi | publish target, unpublish |
| Alamat situs (domain), konfirmasi alamat | domain verification |
| Alamat artikel | slug |
| Media saya | media sites |
| Koneksi layanan | integrations |
| Penjadwalan otomatis | worker, Redis, BullMQ |
| Gaya penulisan | writing skill |
| Tim dan akses | users and RBAC |

## Copy

Write like a person at the next desk (stop-slop): active voice, name the thing, no filler openers, no adverbs, no "not X but Y", no em dashes, no triplet lists for rhythm. Sentence case everywhere. Numbers and dates in Indonesian format. Keep every `name`, `id`, `href`, API route and handler exactly as is; only wording and markup change.

## Verification per area

1. `npx tsc --noEmit` and `npx eslint <your files>` clean.
2. `node ~/.omp/agent/skills/hallmark/scripts/sloplint.mjs <your css and tsx files> --genre playful --scope app` reports 0 FAIL and 0 REFLEX (waive a REFLEX only with a real reason in the stamp style of `gates.md` § 2, in your own CSS file's first lines).
3. Look at the real screen in the browser at 1280 px and 390 px, logged in. Exercise the main action end to end.

## Operator-first rules (added: the daily users are older and not technical)

- Base text is 17 px, small text 15 px, never below 13 px. Buttons and inputs are 52 px tall (`btn-sm` 44 px for secondary actions). Nothing the user must press is smaller than 44 px.
- Four daily destinations only: Beranda, Tulis berita, Daftar berita, Laporan. Everything else lives under Pengaturan and Bantuan.
- One primary button per screen region, named with the result: "Setujui dan terbitkan", "Buat draf", "Unduh Excel".
- Wizards show "Langkah 2 dari 4" and a way back at every step. Never lose typed text when going back.
- Confirmations are in-page (a `notice` with two buttons) and say what will happen and what can be undone. Avoid `window.confirm` for new work.
- After any action show the outcome in a `notice-success` or `notice-error` near the button, in one plain sentence, with the next step as a link or button.
- Never show a raw error. Map API errors to a sentence that says the cause and the fix.
- Roles: the OPERATOR role does the whole daily flow (write, check, publish) on its assigned media. `currentUser()` already expands OPERATOR into EDITOR, REVIEWER and PUBLISHER, so existing page-level role checks keep working.
