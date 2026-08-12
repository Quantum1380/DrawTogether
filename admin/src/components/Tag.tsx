type TagType =
  | "online"
  | "offline"
  | "banned"
  | "waiting"
  | "playing"
  | "ended"
  | "success"
  | "warning"
  | "default";
interface TagProps {
  type: TagType;
  text?: string;
}
const typeMap: Record<TagType, { bg: string; color: string; label: string }> = {
  online: { bg: "rgba(16, 185, 129, 0.12)", color: "#10B981", label: "在线" },
  offline: { bg: "rgba(156, 163, 175, 0.15)", color: "#6B7280", label: "离线" },
  banned: { bg: "rgba(239, 68, 68, 0.12)", color: "#EF4444", label: "已封禁" },
  waiting: {
    bg: "rgba(245, 158, 11, 0.12)",
    color: "#F59E0B",
    label: "等待中",
  },
  playing: {
    bg: "rgba(99, 102, 241, 0.12)",
    color: "#6366F1",
    label: "游戏中",
  },
  ended: { bg: "rgba(156, 163, 175, 0.15)", color: "#6B7280", label: "已结束" },
  success: { bg: "rgba(16, 185, 129, 0.12)", color: "#10B981", label: "成功" },
  warning: { bg: "rgba(245, 158, 11, 0.12)", color: "#F59E0B", label: "警告" },
  default: { bg: "rgba(99, 102, 241, 0.1)", color: "#6366F1", label: "" },
};
export default function Tag({ type, text }: TagProps) {
  const cfg = typeMap[type];
  return (
    <span className="tag" style={{ background: cfg.bg, color: cfg.color }}>
      {" "}
      {text || cfg.label}{" "}
      <style>{`        .tag {          display: inline-flex;          align-items: center;          padding: 3px 10px;          border-radius: 999px;          font-size: 12px;          font-weight: 500;          line-height: 1.5;        }      `}</style>{" "}
    </span>
  );
}
