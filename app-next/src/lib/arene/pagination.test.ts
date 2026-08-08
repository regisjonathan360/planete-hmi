import { describe, expect, it } from "vitest";
import { parsePagination, buildPaginationMeta, type PaginationMeta } from "./pagination";

describe("parsePagination", () => {
  it("returns defaults when no params are provided", () => {
    const params = new URLSearchParams();
    expect(parsePagination(params)).toEqual({ page: 1, pageSize: 20 });
  });

  it("parses valid page and pageSize", () => {
    const params = new URLSearchParams({ page: "3", pageSize: "10" });
    expect(parsePagination(params)).toEqual({ page: 3, pageSize: 10 });
  });

  it("defaults page to 1 when value is non-numeric", () => {
    const params = new URLSearchParams({ page: "abc", pageSize: "15" });
    expect(parsePagination(params)).toEqual({ page: 1, pageSize: 15 });
  });

  it("defaults pageSize to 20 when value is non-numeric", () => {
    const params = new URLSearchParams({ page: "2", pageSize: "xyz" });
    expect(parsePagination(params)).toEqual({ page: 2, pageSize: 20 });
  });

  it("clamps page to minimum 1 when value is 0 or negative", () => {
    expect(parsePagination(new URLSearchParams({ page: "0" }))).toEqual({ page: 1, pageSize: 20 });
    expect(parsePagination(new URLSearchParams({ page: "-5" }))).toEqual({ page: 1, pageSize: 20 });
  });

  it("clamps pageSize to minimum 1", () => {
    const params = new URLSearchParams({ pageSize: "0" });
    expect(parsePagination(params)).toEqual({ page: 1, pageSize: 20 });
  });

  it("clamps pageSize to maximum 50", () => {
    const params = new URLSearchParams({ pageSize: "100" });
    expect(parsePagination(params)).toEqual({ page: 1, pageSize: 50 });
  });

  it("falls back to defaults for floating point values", () => {
    const params = new URLSearchParams({ page: "2.5", pageSize: "10.7" });
    expect(parsePagination(params)).toEqual({ page: 1, pageSize: 20 });
  });

  it("falls back to defaults for NaN-producing values", () => {
    const params = new URLSearchParams({ page: "NaN", pageSize: "Infinity" });
    expect(parsePagination(params)).toEqual({ page: 1, pageSize: 20 });
  });

  it("falls back to defaults for empty string values", () => {
    const params = new URLSearchParams({ page: "", pageSize: "" });
    expect(parsePagination(params)).toEqual({ page: 1, pageSize: 20 });
  });

  it("accepts pageSize of exactly 1", () => {
    const params = new URLSearchParams({ pageSize: "1" });
    expect(parsePagination(params)).toEqual({ page: 1, pageSize: 1 });
  });

  it("accepts pageSize of exactly 50", () => {
    const params = new URLSearchParams({ pageSize: "50" });
    expect(parsePagination(params)).toEqual({ page: 1, pageSize: 50 });
  });
});

describe("buildPaginationMeta", () => {
  it("computes correct metadata for first page", () => {
    const meta = buildPaginationMeta(100, 1, 20);
    expect(meta).toEqual<PaginationMeta>({
      page: 1,
      pageSize: 20,
      total: 100,
      totalPages: 5,
      hasNextPage: true,
      hasPreviousPage: false,
    });
  });

  it("computes correct metadata for last page", () => {
    const meta = buildPaginationMeta(100, 5, 20);
    expect(meta).toEqual<PaginationMeta>({
      page: 5,
      pageSize: 20,
      total: 100,
      totalPages: 5,
      hasNextPage: false,
      hasPreviousPage: true,
    });
  });

  it("computes correct metadata for middle page", () => {
    const meta = buildPaginationMeta(100, 3, 20);
    expect(meta).toEqual<PaginationMeta>({
      page: 3,
      pageSize: 20,
      total: 100,
      totalPages: 5,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it("handles total of 0 items", () => {
    const meta = buildPaginationMeta(0, 1, 20);
    expect(meta).toEqual<PaginationMeta>({
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it("handles total not evenly divisible by pageSize", () => {
    const meta = buildPaginationMeta(25, 1, 20);
    expect(meta).toEqual<PaginationMeta>({
      page: 1,
      pageSize: 20,
      total: 25,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false,
    });
  });

  it("handles single item total", () => {
    const meta = buildPaginationMeta(1, 1, 20);
    expect(meta).toEqual<PaginationMeta>({
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it("handles pageSize of 1 (maximum pages)", () => {
    const meta = buildPaginationMeta(5, 3, 1);
    expect(meta).toEqual<PaginationMeta>({
      page: 3,
      pageSize: 1,
      total: 5,
      totalPages: 5,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it("handles large total with max pageSize", () => {
    const meta = buildPaginationMeta(1000, 1, 50);
    expect(meta).toEqual<PaginationMeta>({
      page: 1,
      pageSize: 50,
      total: 1000,
      totalPages: 20,
      hasNextPage: true,
      hasPreviousPage: false,
    });
  });
});
