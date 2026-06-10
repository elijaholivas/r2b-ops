import { describe, it, expect } from "vitest";
import {
  parseClassDatetime,
  formatClassTime,
  formatClassDateMedium,
  formatClassShort,
  formatClassDateRange,
} from "./dateUtils";

describe("parseClassDatetime", () => {
  it("treats UTC 08:00 as 8 AM local (not converted to browser timezone)", () => {
    // A class stored as 2026-01-14T08:00:00.000Z should display as 8:00 AM
    const d = parseClassDatetime("2026-01-14T08:00:00.000Z");
    expect(d.getHours()).toBe(8);
    expect(d.getMinutes()).toBe(0);
  });

  it("treats UTC 07:00 as 7 AM local", () => {
    const d = parseClassDatetime("2026-01-28T07:00:00.000Z");
    expect(d.getHours()).toBe(7);
    expect(d.getMinutes()).toBe(0);
  });

  it("accepts a Date object", () => {
    const input = new Date("2026-05-02T07:00:00.000Z");
    const d = parseClassDatetime(input);
    expect(d.getHours()).toBe(7);
  });
});

describe("formatClassTime", () => {
  it("formats 08:00 UTC as 8:00 AM", () => {
    expect(formatClassTime("2026-01-14T08:00:00.000Z")).toBe("8:00 AM");
  });

  it("formats 16:00 UTC as 4:00 PM", () => {
    expect(formatClassTime("2026-01-14T16:00:00.000Z")).toBe("4:00 PM");
  });

  it("formats 07:00 UTC as 7:00 AM", () => {
    expect(formatClassTime("2026-01-28T07:00:00.000Z")).toBe("7:00 AM");
  });
});

describe("formatClassDateMedium", () => {
  it("formats date correctly from UTC timestamp", () => {
    expect(formatClassDateMedium("2026-01-14T08:00:00.000Z")).toBe("Jan 14, 2026");
  });
});

describe("formatClassShort", () => {
  it("shows correct day and time without timezone shift", () => {
    const result = formatClassShort("2026-01-14T08:00:00.000Z");
    expect(result).toBe("Wed, Jan 14 · 8:00 AM");
  });
});

describe("formatClassDateRange", () => {
  it("formats same-day range correctly", () => {
    const result = formatClassDateRange(
      "2026-01-14T08:00:00.000Z",
      "2026-01-14T16:00:00.000Z"
    );
    expect(result).toBe("Wed, Jan 14 · 8:00 AM – 4:00 PM");
  });

  it("formats multi-day range correctly", () => {
    const result = formatClassDateRange(
      "2026-01-24T08:00:00.000Z",
      "2026-01-25T16:00:00.000Z"
    );
    expect(result).toBe("Sat, Jan 24 – Sun, Jan 25");
  });
});
