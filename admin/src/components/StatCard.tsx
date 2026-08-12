interface StatCardProps {
  title: string;
  value: number | string;
  icon: string;
  color?: string;
  hint?: string;
}
export default function StatCard({
  title,
  value,
  icon,
  color = "#6366F1",
  hint,
}: StatCardProps) {
  return (
    <div className="stat-card">
      {" "}
      <div className="stat-icon" style={{ background: `${color}20`, color }}>
        {" "}
        {icon}{" "}
      </div>{" "}
      <div className="stat-content">
        {" "}
        <div className="stat-title">{title}</div>{" "}
        <div className="stat-value" style={{ color }}>
          {" "}
          {value}{" "}
        </div>{" "}
        {hint && <div className="stat-hint">{hint}</div>}{" "}
      </div>{" "}
      <style>{`        .stat-card {          background: white;          border-radius: 12px;          padding: 20px;          box-shadow: 0 1px 8px rgba(99, 102, 241, 0.06);          display: flex;          align-items: center;          gap: 16px;          transition: all 0.2s;        }        .stat-card:hover {          box-shadow: 0 4px 16px rgba(99, 102, 241, 0.12);          transform: translateY(-2px);        }        .stat-icon {          width: 48px;          height: 48px;          border-radius: 12px;          display: flex;          align-items: center;          justify-content: center;          font-size: 24px;        }        .stat-content { flex: 1; }        .stat-title { font-size: 13px; color: #9CA3AF; margin-bottom: 4px; }        .stat-value { font-size: 28px; font-weight: 700; line-height: 1.2; }        .stat-hint { font-size: 12px; color: #9CA3AF; margin-top: 4px; }      `}</style>{" "}
    </div>
  );
}
