import { queryAll, queryOne } from './localDb'

export interface PaginationParams {
  page?: string | number
  limit?: string | number
}

export interface PaginatedResult<T> {
  data: T[]
  page: number
  limit: number
  totalCount: number
  totalPages: number
}

/**
 * Parses page & limit from request query params with default limit = 5
 * Allowed limit options: 5, 10, 25, 50, 100
 */
export function parsePaginationParams(query: any, defaultLimit = 5): { page: number; limit: number; offset: number; isPaginated: boolean } {
  const isPaginated = query.page !== undefined || query.limit !== undefined
  let page = parseInt(String(query.page || 1), 10)
  if (isNaN(page) || page < 1) page = 1

  let limit = parseInt(String(query.limit || defaultLimit), 10)
  const allowedLimits = [5, 10, 25, 50, 100]
  if (isNaN(limit) || limit < 1) {
    limit = defaultLimit
  } else if (!allowedLimits.includes(limit)) {
    // Round or snap to nearest valid or keep as requested clamped between 1 and 100
    limit = Math.min(Math.max(limit, 1), 100)
  }

  const offset = (page - 1) * limit
  return { page, limit, offset, isPaginated }
}

/**
 * Executes a paginated query returning rows along with pagination metadata
 */
export async function executePaginatedQuery<T = any>(
  baseSelectQuery: string,
  baseCountQuery: string,
  params: any[] = [],
  pagination: { page: number; limit: number; offset: number }
): Promise<PaginatedResult<T>> {
  const { page, limit, offset } = pagination

  // 1. Fetch total count
  const countRow = await queryOne<{ count: number }>(baseCountQuery, params)
  const totalCount = countRow ? Number(countRow.count) : 0
  const totalPages = Math.max(1, Math.ceil(totalCount / limit))

  // 2. Fetch paginated data with LIMIT and OFFSET
  const paginatedSql = `${baseSelectQuery} LIMIT ? OFFSET ?`
  const data = await queryAll<T>(paginatedSql, [...params, limit, offset])

  return {
    data,
    page,
    limit,
    totalCount,
    totalPages,
  }
}

