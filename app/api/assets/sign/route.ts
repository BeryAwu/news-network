import { z } from "zod";
import { v2 as cloudinary } from "cloudinary";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { db } from "@/lib/db";
import { audit, requireMediaAccess, requireRole, requireSameOrigin } from "@/lib/auth";
import { UploadError, jsonError } from "@/lib/http";
import { assetLicenseRequirementError } from "@/lib/asset-provenance";
import { rateLimit } from "@/lib/rate-limit";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_BYTES + 64 * 1024;
async function readBoundedUploadForm(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("multipart/form-data;")) throw new UploadError("Image uploads must use multipart/form-data.");
  const declaredBytes = request.headers.get("content-length");
  if (declaredBytes && Number(declaredBytes) > MAX_MULTIPART_BYTES) throw new UploadError("Upload request exceeds the 10 MB image limit.");
  if (!request.body) throw new UploadError("Upload request is empty.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > MAX_MULTIPART_BYTES) {
        await reader.cancel();
        throw new RangeError("Upload request exceeds the 10 MB image limit.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  const replay = new Request(request.url, { method: "POST", headers, body: Buffer.concat(chunks) });
  return replay.formData();
}
const provenanceSchema = z.object({ mediaSiteId: z.string().min(1), originalFilename: z.string().min(1).max(255), altText: z.string().max(500).default(""), caption: z.string().max(2000).default(""), credit: z.string().max(500).default(""), sourceUrl: z.string().url().max(2000).optional(), sourcePublisher: z.string().max(250).default(""), licenseType: z.enum(["USER_PROVIDED", "CC0", "CC_BY", "CC_BY_SA", "PUBLIC_DOMAIN", "AI_GENERATED", "OTHER"]).default("USER_PROVIDED"), licenseUrl: z.string().url().max(2000).optional(), attributionText: z.string().max(1000).default(""), isAiGenerated: z.preprocess((value) => value === true || value === "true", z.boolean()).default(false), generationPrompt: z.string().max(1000).optional() });
function configureCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) throw new Error("Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on the server.");
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
}
function sniffImage(bytes: Uint8Array) {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "webp";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp" && String.fromCharCode(...bytes.slice(8, 12)).startsWith("avif")) return "avif";
  return null;
}
interface CloudinaryUploadResult { public_id: string; secure_url: string; resource_type: string; format: string; width: number; height: number; bytes: number; etag?: string; version: number }
async function uploadToCloudinary(file: File, folder: string, publicId: string): Promise<CloudinaryUploadResult> {
  const { promise, resolve, reject } = Promise.withResolvers<CloudinaryUploadResult>();
  const upload = cloudinary.uploader.upload_stream({ folder, public_id: publicId, overwrite: false, resource_type: "image", allowed_formats: ["jpg", "png", "webp", "avif"], transformation: [{ width: 2400, height: 2400, crop: "limit" }] }, (error, result) => {
    if (error) reject(error);
    else if (!result) reject(new Error("Cloudinary returned no upload metadata."));
    else resolve(result as CloudinaryUploadResult);
  });
  Readable.from([Buffer.from(await file.arrayBuffer())]).pipe(upload);
  return promise;
}
export async function GET() {
  try {
    await requireRole("OWNER", "ADMIN", "EDITOR");
    const configured = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
    return Response.json({ configured, provider: "Cloudinary", status: configured ? "ready" : "setup required", maxBytes: MAX_BYTES, formats: ["jpg", "png", "webp", "avif"] });
  } catch (error) { return jsonError(error); }
}
export async function POST(request: Request) {
  let createdPublicId: string | null = null;
  try {
    requireSameOrigin(request);
    const user = await requireRole("OWNER", "ADMIN", "EDITOR");
    if (!rateLimit(`upload:${user.id}`, 10, 60 * 1000)) return Response.json({ error: "Terlalu banyak unggahan. Tunggu sebentar." }, { status: 429 });
    const form = await readBoundedUploadForm(request);
    const rawInput = Object.fromEntries(form.entries());
    for (const field of ["sourceUrl", "licenseUrl", "generationPrompt"] as const) if (rawInput[field] === "") delete rawInput[field];
    const input = provenanceSchema.parse(rawInput);
    const rightsError = assetLicenseRequirementError(input);
    if (rightsError) return Response.json({ error: rightsError }, { status: 400 });
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return Response.json({ error: "Choose a non-empty image file." }, { status: 400 });
    if (file.size > MAX_BYTES) return Response.json({ error: "Image exceeds the 10 MB upload limit." }, { status: 413 });
    const actualFormat = sniffImage(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
    if (!actualFormat) return Response.json({ error: "Only valid JPEG, PNG, WebP, or AVIF image bytes are allowed." }, { status: 415 });
    await requireMediaAccess(user.id, input.mediaSiteId);
    const media = await db.mediaSite.findUnique({ where: { id: input.mediaSiteId }, select: { slug: true } });
    if (!media) return Response.json({ error: "Media not found." }, { status: 404 });
    configureCloudinary();
    const folder = `nnms/media/${media.slug}/library`;
    const publicId = randomUUID();
    createdPublicId = `${folder}/${publicId}`;
    const result = await uploadToCloudinary(file, folder, publicId);
    if (result.public_id !== createdPublicId || result.resource_type !== "image" || result.bytes > MAX_BYTES || result.width > 2400 || result.height > 2400 || result.format.toLowerCase() !== actualFormat) throw new Error("Cloudinary asset metadata does not match the validated image constraints.");
    const asset = await db.asset.create({ data: {
      mediaSiteId: input.mediaSiteId, cloudinaryPublicId: result.public_id, secureUrl: result.secure_url,
      resourceType: result.resource_type, format: result.format, width: result.width, height: result.height,
      bytes: result.bytes, etag: result.etag, cloudinaryVersion: result.version, originalFilename: input.originalFilename,
      altText: input.altText, caption: input.caption, credit: input.credit, sourceUrl: input.sourceUrl,
      sourcePublisher: input.sourcePublisher, licenseType: input.isAiGenerated ? "AI_GENERATED" : input.licenseType,
      licenseUrl: input.licenseUrl, attributionText: input.attributionText,
      isAiGenerated: input.isAiGenerated || input.licenseType === "AI_GENERATED", generationPrompt: input.generationPrompt,
      createdById: user.id
    } });
    await audit(user.id, "ASSET_UPLOADED", "Asset", asset.id, input.mediaSiteId, { cloudinaryPublicId: asset.cloudinaryPublicId, format: asset.format, bytes: asset.bytes, isAiGenerated: asset.isAiGenerated });
    return Response.json(asset, { status: 201 });
  } catch (error) {
    if (createdPublicId && process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
      try { await cloudinary.uploader.destroy(createdPublicId, { resource_type: "image", invalidate: true }); } catch { /* database and provider failures are reported without leaking credentials */ }
    }
    if (error instanceof RangeError) return Response.json({ error: error.message }, { status: 413 });
    return jsonError(error);
  }
}
