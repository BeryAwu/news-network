# Cloudinary Integration — Mandatory Requirement

## 1. Decision

**Cloudinary is the required and primary image/media storage provider for NNMS.** This is a confirmed owner decision. The coding agent must not substitute another provider.

Cloudinary stores image binaries and delivers optimized image URLs. PostgreSQL stores the relationship between each asset, its media site, article usage, and its provenance/licence metadata.

## 2. SDK and security

- Use the official Cloudinary Node.js SDK on the server.
- Prefer signed uploads generated/handled by authenticated server-side code for protected dashboard uploads.
- Keep `CLOUDINARY_API_SECRET` server-only. Never expose it to client bundles, public API responses, logs, source control, or `NEXT_PUBLIC_*` variables.
- Use a least-privilege account/API setup where available.
- Validate file type, size, dimensions, and authenticated user permission before upload.
- Never trust a client-supplied `public_id` or folder path without normalization and authorization.
- Verify upload results and persist metadata before associating the image with an article.

## 3. Environment variables

```env
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""
```

Do not put real values in `.env.example`. Add `.env.local` and all secret-bearing env files to `.gitignore`.

## 4. Asset folder convention

Suggested Cloudinary folder structure:

```text
nnms/
  media/{mediaSlug}/
    logos/
    articles/{articleId}/
    library/
  shared/
    system/
```

The server determines the folder from authenticated tenant context. Do not accept arbitrary folders from the browser.

Suggested `public_id` format:
`nnms/media/{mediaSlug}/articles/{articleId}/{stableAssetKey}`

Use safe slugs and stable IDs, not raw user input. Avoid including personal or confidential data in public IDs.

## 5. Database metadata

Persist at least:
- `provider = CLOUDINARY`
- `cloudinaryPublicId`
- `secureUrl`
- `resourceType`
- `format`
- `width`, `height`, `bytes`
- `etag` and Cloudinary version where returned
- `originalFilename`
- `altText`, `caption`, `credit`
- `sourceUrl`, `sourcePublisher`
- `licenseType`, `licenseUrl`, `attributionText`
- `isAiGenerated`
- `generationPrompt` or prompt reference where useful and safe
- `mediaSiteId`, `createdById`, `createdAt`, `deletedAt`

Do not rely solely on `secureUrl` as the asset identity. Keep `cloudinaryPublicId` so the server can manage, transform, or delete the asset.

## 6. Upload flow

1. Authenticated user selects image in dashboard.
2. Server verifies user role and media-site scope.
3. Server validates MIME type/extension, max bytes, and image constraints.
4. Server either uploads the file through the Node SDK or returns a short-lived signed upload payload.
5. Cloudinary returns the asset metadata.
6. Server validates the response and stores the `Asset` record in PostgreSQL.
7. UI displays the Cloudinary `secure_url` and lets the user set alt text, caption, credit, and licence metadata.
8. Article stores an `featuredAssetId` reference, not an unverified arbitrary remote URL.

If a signed browser upload is used, the browser receives only the signature and constrained upload parameters—not the API secret. Validate the resulting asset server-side before accepting it into the application.

## 7. Image delivery and transformations

- Use Cloudinary delivery URLs and transformations for responsive sizes, format negotiation, and quality optimization.
- Keep the original asset untouched where practical; create delivery variants through transformations.
- Use appropriate Next.js image configuration for the Cloudinary host, or a project-approved image component.
- Specify width/height or aspect ratio to reduce layout shift.
- Provide meaningful alt text; decorative images can use empty alt text where appropriate.

## 8. External image sourcing

- Google Images is a discovery interface, not a licence grant.
- Use an image provider/source only when it offers a usable API and rights/attribution information, or when the user supplies an image with permission.
- Record source URL, creator/publisher, licence/permission, attribution requirements, and retrieval time.
- If reuse rights cannot be verified, do not publish that image. Use an AI-generated illustration or ask the editor for an approved image.
- When external images are selected, ingest/download them through a controlled server process only after rights are confirmed, then store the approved asset in Cloudinary.
- Do not hotlink an unlicensed external image as a workaround.

## 9. Deletion and lifecycle

- Before deletion, check whether the asset is referenced by articles or media logos.
- Prefer archive/soft-delete in the application first.
- Deletion from Cloudinary must be an authenticated server-side operation.
- Log deletion and preserve enough metadata for audit/history.
- If an asset is still referenced by a published article, require replacement or explicit confirmation before destructive deletion.

## 10. Cloudinary test checklist

The server-side integration code is implemented. In the current local environment, Cloudinary credentials passed an authenticated account ping, but a real image upload has not been tested; keep that acceptance item open until a rights-cleared test image is uploaded and its stored metadata is checked.

- [ ] Missing credentials show a clear setup warning, not a silent mock success.
- [ ] Authenticated upload works in a real Cloudinary test account.
- [ ] Wrong media scope is rejected.
- [ ] Unsupported file type and oversized file are rejected.
- [ ] Upload persists `public_id` and `secure_url` in PostgreSQL.
- [ ] API secret is absent from browser bundles, responses, logs, and Git.
- [ ] Asset picker shows only permitted assets.
- [ ] Article featured image renders from Cloudinary.
- [ ] Deleting a referenced asset is prevented or safely handled.
