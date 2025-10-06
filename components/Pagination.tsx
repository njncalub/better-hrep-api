interface PaginationProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
  limit: string;
}

/**
 * Generate array of page numbers to display
 * Shows: First ... (current-2) (current-1) current (current+1) (current+2) ... Last
 */
function getPageNumbers(
  currentPage: number,
  totalPages: number,
): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    // Show all pages if 7 or fewer
    return Array.from({ length: totalPages }, (_, i) => i);
  }

  const pages: (number | "ellipsis")[] = [];
  const showLeft = currentPage > 2;
  const showRight = currentPage < totalPages - 3;

  // Always show first page
  pages.push(0);

  // Left ellipsis
  if (showLeft) {
    pages.push("ellipsis");
  }

  // Pages around current
  const start = Math.max(1, currentPage - 1);
  const end = Math.min(totalPages - 2, currentPage + 1);

  for (let i = start; i <= end; i++) {
    if (!pages.includes(i)) {
      pages.push(i);
    }
  }

  // Right ellipsis
  if (showRight) {
    pages.push("ellipsis");
  }

  // Always show last page
  if (totalPages > 1) {
    pages.push(totalPages - 1);
  }

  return pages;
}

export const Pagination = (
  { currentPage, totalPages, baseUrl, limit }: PaginationProps,
) => {
  const pageNumbers = getPageNumbers(currentPage, totalPages);

  return (
    <nav class="pagination">
      <ul>
        {currentPage > 0 && (
          <li>
            <a
              href={`${baseUrl}?page=${currentPage - 1}&limit=${limit}`}
              class="pagination-link"
            >
              ← Previous
            </a>
          </li>
        )}

        {pageNumbers.map((pageNum, idx) => {
          if (pageNum === "ellipsis") {
            return (
              <li key={`ellipsis-${idx}`} class="pagination-ellipsis">…</li>
            );
          }

          return (
            <li key={pageNum}>
              {pageNum === currentPage
                ? (
                  <span class="pagination-link pagination-current">
                    {pageNum + 1}
                  </span>
                )
                : (
                  <a
                    href={`${baseUrl}?page=${pageNum}&limit=${limit}`}
                    class="pagination-link"
                  >
                    {pageNum + 1}
                  </a>
                )}
            </li>
          );
        })}

        {currentPage < totalPages - 1 && (
          <li>
            <a
              href={`${baseUrl}?page=${currentPage + 1}&limit=${limit}`}
              class="pagination-link"
            >
              Next →
            </a>
          </li>
        )}
      </ul>
    </nav>
  );
};
