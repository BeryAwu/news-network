import type { BlastStatus, PublicationState } from "@/lib/blast-types";
import { asFailure, failure, readBody } from "@/components/plain-errors";

/** Plain words and badge colour for each state of a blast. */
export const statusInfo: Record<BlastStatus, { label: string; badge: string }> = {
  GENERATING: { label: "Sedang dibuat", badge: "badge-yellow" },
  FAILED: { label: "Gagal dibuat", badge: "badge-red" },
  DRAFT: { label: "Siap diperiksa", badge: "badge-blue" },
  SCHEDULED: { label: "Terjadwal", badge: "badge-blue" },
  PUBLISHED: { label: "Sudah terbit", badge: "badge-green" },
  PARTIAL: { label: "Sebagian terbit", badge: "badge-yellow" },
  LEGACY: { label: "Berita lama", badge: "" },
};

export const publicationInfo: Record<PublicationState, { label: string; badge: string }> = {
  QUEUED: { label: "Dalam antrean", badge: "badge-yellow" },
  SCHEDULED: { label: "Terjadwal", badge: "badge-blue" },
  PUBLISHING: { label: "Sedang diterbitkan", badge: "badge-yellow" },
  PUBLISHED: { label: "Sudah tayang", badge: "badge-green" },
  FAILED: { label: "Gagal terbit", badge: "badge-red" },
  CANCELLED: { label: "Dibatalkan", badge: "" },
};

const dateTime = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const names = new Intl.ListFormat("id", { style: "long", type: "conjunction" });

/** "15 November 2026 10.30 WIB", or an empty string for a missing or invalid date. */
export function formatWhen(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : `${dateTime.format(date)} WIB`;
}

/** "A, B, dan C". */
export function listNames(items: string[]) {
  return names.format(items);
}

interface CallOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  signal?: AbortSignal;
  /** API field name to the sentence shown when that field is rejected. */
  fields?: Record<string, string>;
}

/** Calls a blast route and returns the JSON. Throws a `Failure` whose message is plain Indonesian (cause plus fix). */
export async function callApi<T>(url: string, fallback: string, options: CallOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      cache: "no-store",
      signal: options.signal,
      ...(method === "GET" ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(options.body ?? {}) }),
    });
  } catch (error) {
    throw asFailure(error, fallback);
  }
  const data = await readBody(response);
  if (!response.ok) throw failure(response.status, data, options.fields ?? {}, fallback);
  return data as T;
}

export function messageOf(error: unknown, fallback: string) {
  return asFailure(error, fallback).message;
}
