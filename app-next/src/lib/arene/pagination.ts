/**
 * Pagination helpers for the Community Interactions Arena.
 *
 * Provides URL parameter parsing and metadata building for paginated API responses.
 * Default page size is 20, minimum is 1, maximum is 50.
 *
 * Requirements: 13.3
 */

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 50;
const MIN_PAGE = 1;

/**
 * Parse pagination parameters from URL search params.
 *
 * - `page` defaults to 1, minimum 1. Non-numeric or invalid values fall back to 1.
 * - `pageSize` defaults to 20, minimum 1, maximum 50. Non-numeric or invalid values fall back to 20.
 *
 * @param params - URLSearchParams from the request URL
 * @returns Parsed and clamped page and pageSize values
 */
export function parsePagination(params: URLSearchParams): {
  page: number;
  pageSize: number;
} {
  const rawPage = params.get("page");
  const rawPageSize = params.get("pageSize");

  let page = DEFAULT_PAGE;
  if (rawPage !== null) {
    const parsed = Number(rawPage);
    if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= MIN_PAGE) {
      page = parsed;
    }
  }

  let pageSize = DEFAULT_PAGE_SIZE;
  if (rawPageSize !== null) {
    const parsed = Number(rawPageSize);
    if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= MIN_PAGE_SIZE) {
      pageSize = Math.min(parsed, MAX_PAGE_SIZE);
    }
  }

  return { page, pageSize };
}

/**
 * Build pagination metadata from total count, current page, and page size.
 *
 * @param total - Total number of items across all pages
 * @param page - Current page number (1-based)
 * @param pageSize - Number of items per page
 * @returns Complete pagination metadata
 */
export function buildPaginationMeta(
  total: number,
  page: number,
  pageSize: number
): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
