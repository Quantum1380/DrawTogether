interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}
export default function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  for (let i = start; i <= end; i++) pages.push(i);
  return (
    <div className="pagination">
      {" "}
      <span className="info">共 {total} 条</span>{" "}
      <button
        className="btn-page"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        {" "}
        ‹{" "}
      </button>{" "}
      {start > 1 && <span className="ellipsis">…</span>}{" "}
      {pages.map((p) => (
        <button
          key={p}
          className={`btn-page ${p === page ? "active" : ""}`}
          onClick={() => onChange(p)}
        >
          {" "}
          {p}{" "}
        </button>
      ))}{" "}
      {end < totalPages && <span className="ellipsis">…</span>}{" "}
      <button
        className="btn-page"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        {" "}
        ›{" "}
      </button>{" "}
      <style>{`        .pagination {          display: flex;          align-items: center;          justify-content: flex-end;          gap: 6px;          padding: 16px 0;        }        .info { font-size: 13px; color: #9CA3AF; margin-right: 8px; }        .btn-page {          min-width: 32px;          height: 32px;          padding: 0 8px;          border-radius: 6px;          background: white;          color: #4B5563;          font-size: 13px;          border: 1px solid #E5E7EB;          transition: all 0.15s;        }        .btn-page:hover:not(:disabled):not(.active) {          border-color: #6366F1;          color: #6366F1;        }        .btn-page.active {          background: #6366F1;          border-color: #6366F1;          color: white;        }        .btn-page:disabled { opacity: 0.4; cursor: not-allowed; }        .ellipsis { color: #9CA3AF; padding: 0 4px; }      `}</style>{" "}
    </div>
  );
}
