'use client'

import React from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'

export interface PaginationProps {
  currentPage: number
  pageSize: number
  totalCount: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  pageSizeOptions?: number[]
  isLoading?: boolean
}

export function Pagination({
  currentPage,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 25, 50, 100],
  isLoading = false,
}: PaginationProps) {
  // Calculate range display (e.g., Showing 1-5 of 120 records)
  const startRecord = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endRecord = Math.min(currentPage * pageSize, totalCount)

  // Generate compact page numbers with ellipses
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const total = Math.max(1, totalPages)

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i)
      return pages
    }

    // Always include page 1
    pages.push(1)

    const leftSibling = Math.max(currentPage - 1, 2)
    const rightSibling = Math.min(currentPage + 1, total - 1)

    if (leftSibling > 2) {
      pages.push('...')
    }

    for (let i = leftSibling; i <= rightSibling; i++) {
      if (i > 1 && i < total) {
        pages.push(i)
      }
    }

    if (rightSibling < total - 1) {
      pages.push('...')
    }

    // Always include last page
    pages.push(total)
    return pages
  }

  const pageNumbers = getPageNumbers()

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-slate-900/70 border-t border-slate-800 text-xs text-slate-400 select-none">
      {/* Left side: Rows per page & record range count */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            disabled={isLoading}
            className="bg-slate-950 border border-slate-800 text-white rounded-md px-2 py-1 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer disabled:opacity-50"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div className="text-slate-300 font-medium">
          {totalCount === 0 ? (
            <span>Showing 0 records</span>
          ) : (
            <span>
              Showing <span className="font-semibold text-white">{startRecord}</span>–
              <span className="font-semibold text-white">{endRecord}</span> of{' '}
              <span className="font-semibold text-white">{totalCount}</span> records
            </span>
          )}
        </div>

        {isLoading && (
          <span className="inline-flex items-center text-[11px] text-indigo-400 font-medium animate-pulse">
            Loading...
          </span>
        )}
      </div>

      {/* Right side: First, Previous, Page Numbers, Next, Last */}
      <div className="flex items-center gap-1">
        {/* First Page */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1 || isLoading || totalCount === 0}
          title="First Page"
          className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 cursor-pointer disabled:cursor-not-allowed transition"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        {/* Previous Page */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || isLoading || totalCount === 0}
          title="Previous Page"
          className="px-2.5 py-1 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 cursor-pointer disabled:cursor-not-allowed text-xs font-medium transition flex items-center gap-1"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Previous</span>
        </button>

        {/* Numbered Page Buttons */}
        <div className="flex items-center gap-1 mx-1">
          {pageNumbers.map((num, idx) => {
            if (typeof num === 'string') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-1.5 text-slate-500 font-mono"
                >
                  ...
                </span>
              )
            }

            const isActive = num === currentPage
            return (
              <button
                key={`page-${num}`}
                type="button"
                onClick={() => onPageChange(num)}
                disabled={isLoading}
                className={`min-w-[28px] h-7 px-1.5 rounded-md text-xs font-medium transition flex items-center justify-center cursor-pointer disabled:cursor-not-allowed ${
                  isActive
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {num}
              </button>
            )
          })}
        </div>

        {/* Next Page */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || isLoading || totalCount === 0}
          title="Next Page"
          className="px-2.5 py-1 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 cursor-pointer disabled:cursor-not-allowed text-xs font-medium transition flex items-center gap-1"
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Last Page */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages || isLoading || totalCount === 0}
          title="Last Page"
          className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 cursor-pointer disabled:cursor-not-allowed transition"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

