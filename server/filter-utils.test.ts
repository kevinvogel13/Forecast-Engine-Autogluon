import { describe, it, expect } from "vitest";
import { testRowCondition, applyFilterTransform } from "./filter-utils";

describe("testRowCondition", () => {
  it("compares numbers numerically", () => {
    expect(testRowCondition("10", "gt", "5")).toBe(true);
    expect(testRowCondition("10", "gt", "50")).toBe(false);
    expect(testRowCondition(10, "eq", 10)).toBe(true);
    expect(testRowCondition("10", "lte", "10")).toBe(true);
  });

  it("falls back to string comparison for non-numbers", () => {
    expect(testRowCondition("north", "eq", "north")).toBe(true);
    expect(testRowCondition("north", "neq", "south")).toBe(true);
    expect(testRowCondition("Hello", "contains", "ell")).toBe(true);
    expect(testRowCondition("Hello", "not_contains", "xyz")).toBe(true);
    expect(testRowCondition("Hello", "starts_with", "He")).toBe(true);
    expect(testRowCondition("Hello", "ends_with", "lo")).toBe(true);
  });

  it("handles isin / notin with arrays", () => {
    expect(testRowCondition("a", "isin", ["a", "b"])).toBe(true);
    expect(testRowCondition("c", "isin", ["a", "b"])).toBe(false);
    expect(testRowCondition("c", "notin", ["a", "b"])).toBe(true);
  });

  it("handles isnull / notnull", () => {
    expect(testRowCondition("", "isnull", null)).toBe(true);
    expect(testRowCondition(null, "isnull", null)).toBe(true);
    expect(testRowCondition("x", "notnull", null)).toBe(true);
    expect(testRowCondition("", "notnull", null)).toBe(false);
  });

  it("contains is case-insensitive", () => {
    expect(testRowCondition("HELLO", "contains", "ell")).toBe(true);
  });

  it("unknown operator passes through (returns true)", () => {
    expect(testRowCondition("x", "bogus", "y")).toBe(true);
  });
});

describe("applyFilterTransform", () => {
  const rows = [
    { region: "north", sales: 100 },
    { region: "south", sales: 200 },
    { region: "north", sales: 300 },
  ];

  it("filters by a single condition", () => {
    const out = applyFilterTransform(rows, { column: "region", operator: "eq", value: "north" });
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.region === "north")).toBe(true);
  });

  it("AND-combines multiple conditions by default", () => {
    const out = applyFilterTransform(rows, {
      conditions: [
        { column: "region", op: "eq", value: "north" },
        { column: "sales", op: "gt", value: "150" },
      ],
    });
    expect(out).toEqual([{ region: "north", sales: 300 }]);
  });

  it("OR-combines when logic is OR", () => {
    const out = applyFilterTransform(rows, {
      conditions: [
        { column: "region", op: "eq", value: "south" },
        { column: "sales", op: "gt", value: "250", logic: "OR" },
      ],
    });
    expect(out).toHaveLength(2);
  });

  it("returns all rows when filter is incomplete", () => {
    expect(applyFilterTransform(rows, { column: "", operator: "" })).toHaveLength(3);
  });
});
