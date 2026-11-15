import { describe, expect, it } from "vitest";
import { parseReportDate } from "../lib/reports";

describe("report date filters", () => {
  it("reads a day as Asia/Jakarta, start and end of day", () => {
    expect(parseReportDate("2026-11-07")?.toISOString()).toBe("2026-11-06T17:00:00.000Z");
    expect(parseReportDate("2026-11-07", true)?.toISOString()).toBe("2026-11-07T16:59:59.999Z");
  });

  it("ignores anything that is not a plain YYYY-MM-DD date", () => {
    for (const bad of [null, "", "07-11-2026", "2026-13-40", "2026-11-07T10:00", "abc"]) expect(parseReportDate(bad)).toBeUndefined();
  });
});
