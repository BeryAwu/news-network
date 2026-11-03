import { z } from "zod";

export const editorialEvidenceSnapshotSchema = z.object({
  sourceFacts: z.array(z.object({
    id: z.string(),
    claimText: z.string(),
    supportStatus: z.enum(["SUPPORTED", "CONFLICTED", "UNVERIFIED"]),
    evidenceNote: z.string(),
    sourceReferenceId: z.string().nullable()
  })),
  sourceReferences: z.array(z.object({
    id: z.string(),
    url: z.string(),
    title: z.string(),
    publisherName: z.string(),
    retrievedAt: z.string().datetime().nullable()
  }))
});

export type EditorialEvidenceSnapshot = z.infer<typeof editorialEvidenceSnapshotSchema>;

export function createEditorialEvidenceSnapshot(brief: {
  facts: { id: string; claimText: string; supportStatus: string; evidenceNote: string; sourceReferenceId: string | null }[];
  references: { id: string; url: string; canonicalUrl: string | null; title: string; publisherName: string; retrievalStatus: string; retrievedAt: Date | null }[];
}): EditorialEvidenceSnapshot {
  return editorialEvidenceSnapshotSchema.parse({
    sourceFacts: brief.facts.map(({ id, claimText, supportStatus, evidenceNote, sourceReferenceId }) => ({ id, claimText, supportStatus, evidenceNote, sourceReferenceId })),
    sourceReferences: brief.references.filter((reference) => reference.retrievalStatus === "SUCCESS").map((reference) => ({
      id: reference.id,
      url: reference.canonicalUrl || reference.url,
      title: reference.title,
      publisherName: reference.publisherName,
      retrievedAt: reference.retrievedAt?.toISOString() ?? null
    }))
  });
}
