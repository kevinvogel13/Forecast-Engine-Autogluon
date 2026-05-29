import { describe, it, expect } from "vitest";
import { getCoverage, secondaryMetrics, hasSecondaryMetrics } from "./forecast-metrics";

describe("getCoverage", () => {
  it("resolves the dynamic coverage_<nominal> key", () => {
    expect(getCoverage({ coverage_nominal: 80, coverage_80: 92.5 })).toEqual({ nominal: 80, actual: 92.5 });
  });

  it("returns null when nominal is missing", () => {
    expect(getCoverage({ wape: 5 })).toBeNull();
  });

  it("returns null when the matching coverage value is absent", () => {
    expect(getCoverage({ coverage_nominal: 90 })).toBeNull();
  });

  it("handles null/undefined input", () => {
    expect(getCoverage(null)).toBeNull();
    expect(getCoverage(undefined)).toBeNull();
  });
});

describe("secondaryMetrics", () => {
  it("includes only metrics that are present, in order", () => {
    const out = secondaryMetrics({ wape: 12.34, mase: 0.8 });
    expect(out.map((m) => m.label)).toEqual(["WAPE", "MASE"]);
    expect(out[0].value).toBe("12.3%");
    expect(out[1].value).toBe("0.80");
  });

  it("formats every supported metric and appends coverage last", () => {
    const out = secondaryMetrics({
      wape: 10, smape: 11, mase: 0.5, pinball_loss: 1.2,
      coverage_nominal: 80, coverage_80: 78,
    });
    expect(out.map((m) => m.label)).toEqual([
      "WAPE", "sMAPE", "MASE", "Pinball loss", "Coverage (80%)",
    ]);
    expect(out[4].value).toBe("78%");
  });

  it("is empty when nothing is reported", () => {
    expect(secondaryMetrics({})).toEqual([]);
    expect(secondaryMetrics(null)).toEqual([]);
    expect(hasSecondaryMetrics({ rmse: 5 })).toBe(false);
    expect(hasSecondaryMetrics({ wape: 5 })).toBe(true);
  });
});
