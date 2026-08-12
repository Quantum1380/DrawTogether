import { ReactNode } from "react";
export interface Column<T> {
  title: string;
  key: string;
  width?: string;
  render?: (row: T, index: number) => ReactNode;
}
interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyText?: string;
  onRowClick?: (row: T) => void;
}
export default function Table<T extends { _id?: string }>({
  columns,
  data,
  loading,
  emptyText = "暂无数据",
  onRowClick,
}: TableProps<T>) {
  return (
    <div className="table-wrap">
      {" "}
      <table className="table">
        {" "}
        <thead>
          {" "}
          <tr>
            {" "}
            {columns.map((c) => (
              <th key={c.key} style={{ width: c.width }}>
                {" "}
                {c.title}{" "}
              </th>
            ))}{" "}
          </tr>{" "}
        </thead>{" "}
        <tbody>
          {" "}
          {loading ? (
            <tr>
              {" "}
              <td colSpan={columns.length} className="state-cell">
                加载中...
              </td>{" "}
            </tr>
          ) : data.length === 0 ? (
            <tr>
              {" "}
              <td colSpan={columns.length} className="state-cell">
                {emptyText}
              </td>{" "}
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr
                key={(row as any)._id || idx}
                onClick={() => onRowClick?.(row)}
                className={onRowClick ? "clickable" : ""}
              >
                {" "}
                {columns.map((c) => (
                  <td key={c.key}>
                    {" "}
                    {c.render ? c.render(row, idx) : (row as any)[c.key]}{" "}
                  </td>
                ))}{" "}
              </tr>
            ))
          )}{" "}
        </tbody>{" "}
      </table>{" "}
      <style>{`        .table-wrap {          background: white;          border-radius: 12px;          overflow: hidden;          box-shadow: 0 1px 8px rgba(99, 102, 241, 0.06);        }        .table { width: 100%; border-collapse: collapse; }        .table th {          background: #F8F7FC;          padding: 12px 16px;          text-align: left;          font-size: 13px;          font-weight: 600;          color: #4B5563;          border-bottom: 1px solid #E5E7EB;        }        .table td {          padding: 12px 16px;          font-size: 13px;          color: #1E1B4B;          border-bottom: 1px solid #F3F4F6;        }        .table tbody tr:last-child td { border-bottom: none; }        .table tr.clickable { cursor: pointer; transition: background 0.15s; }        .table tr.clickable:hover { background: #F8F7FC; }        .state-cell {          text-align: center !important;          color: #9CA3AF;          padding: 40px 16px !important;        }      `}</style>{" "}
    </div>
  );
}
