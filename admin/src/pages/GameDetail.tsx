import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { gameApi } from "@/api/game";
import { formatDateTime, durationMinutes } from "@/utils/format";
import type { GameRecord } from "@/types";
export default function GameDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState<GameRecord | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!id) return;
    gameApi
      .detail(id)
      .then(setRecord)
      .catch((err) => alert(err.message || "加载失败"))
      .finally(() => setLoading(false));
  }, [id]);
  if (loading) return <div className="loading">加载中...</div>;
  if (!record) return <div className="loading">记录不存在</div>;
  const ranked = [...record.players].sort((a, b) => b.score - a.score);
  return (
    <div>
      {" "}
      <div className="header-bar">
        {" "}
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate("/games")}
        >
          ‹ 返回
        </button>{" "}
        <h1 className="page-title">对局详情</h1>{" "}
      </div>{" "}
      <div className="detail-grid">
        {" "}
        <div className="card detail-card">
          {" "}
          <h2 className="card-title">对局信息</h2>{" "}
          <div className="info-list">
            {" "}
            <div className="info-item">
              <label>房间号</label>
              <span className="mono">{record.roomCode}</span>
            </div>{" "}
            <div className="info-item">
              <label>房间名</label>
              <span>{record.roomName}</span>
            </div>{" "}
            <div className="info-item">
              <label>回合数</label>
              <span>{record.totalRounds}</span>
            </div>{" "}
            <div className="info-item">
              <label>玩家数</label>
              <span>{record.players.length} 人</span>
            </div>{" "}
            <div className="info-item">
              <label>胜者</label>
              <span className="winner">{record.winner?.nickname || "-"}</span>
            </div>{" "}
            <div className="info-item">
              <label>开始时间</label>
              <span>{formatDateTime(record.startTime)}</span>
            </div>{" "}
            <div className="info-item">
              <label>结束时间</label>
              <span>{formatDateTime(record.endTime)}</span>
            </div>{" "}
            <div className="info-item">
              <label>时长</label>
              <span>{durationMinutes(record.startTime, record.endTime)}</span>
            </div>{" "}
          </div>{" "}
        </div>{" "}
        <div className="card detail-card">
          {" "}
          <h2 className="card-title">词语列表</h2>{" "}
          {record.words.length > 0 ? (
            <div className="words">
              {" "}
              {record.words.map((w, i) => (
                <span key={i} className="word-tag">
                  {w}
                </span>
              ))}{" "}
            </div>
          ) : (
            <div className="empty">无词语记录</div>
          )}{" "}
        </div>{" "}
        <div className="card detail-card full">
          {" "}
          <h2 className="card-title">玩家成绩</h2>{" "}
          <table className="result-table">
            {" "}
            <thead>
              {" "}
              <tr>
                {" "}
                <th>排名</th> <th>玩家</th> <th>头像</th> <th>得分</th>{" "}
              </tr>{" "}
            </thead>{" "}
            <tbody>
              {" "}
              {ranked.map((p, i) => (
                <tr key={p.openid} className={i === 0 ? "first" : ""}>
                  {" "}
                  <td className="rank">
                    {" "}
                    {i === 0
                      ? "🥇"
                      : i === 1
                        ? "🥈"
                        : i === 2
                          ? "🥉"
                          : i + 1}{" "}
                  </td>{" "}
                  <td>{p.nickname}</td>{" "}
                  <td>
                    {" "}
                    {p.avatar ? (
                      <img src={p.avatar} alt="" className="avatar-sm" />
                    ) : (
                      <div className="avatar-sm avatar-fallback">
                        {p.nickname.slice(0, 1)}
                      </div>
                    )}{" "}
                  </td>{" "}
                  <td className="score">{p.score}</td>{" "}
                </tr>
              ))}{" "}
            </tbody>{" "}
          </table>{" "}
        </div>{" "}
      </div>{" "}
      <style>{`        .header-bar { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }        .page-title { font-size: 22px; font-weight: 600; color: #1E1B4B; }        .loading { padding: 60px; text-align: center; color: #9CA3AF; }        .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }        .detail-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 8px rgba(99, 102, 241, 0.06); }        .detail-card.full { grid-column: 1 / -1; }        .card-title { font-size: 15px; font-weight: 600; color: #1E1B4B; margin-bottom: 16px; }        .info-list { display: flex; flex-direction: column; gap: 8px; }        .info-item { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px solid #F3F4F6; }        .info-item label { color: #9CA3AF; }        .mono { font-family: 'SF Mono', Consolas, monospace; color: #6366F1; }        .winner { color: #10B981; font-weight: 600; }        .words { display: flex; flex-wrap: wrap; gap: 8px; }        .word-tag {          padding: 6px 12px; background: #EEF0FF; color: #6366F1;          border-radius: 999px; font-size: 13px; font-weight: 500;        }        .empty { color: #9CA3AF; font-size: 13px; padding: 16px 0; text-align: center; }        .result-table { width: 100%; border-collapse: collapse; }        .result-table th {          background: #F8F7FC; padding: 10px 16px; text-align: left;          font-size: 13px; font-weight: 600; color: #4B5563;          border-bottom: 1px solid #E5E7EB;        }        .result-table td {          padding: 10px 16px; font-size: 13px; color: #1E1B4B;          border-bottom: 1px solid #F3F4F6;        }        .result-table tr.first td { background: rgba(245, 158, 11, 0.05); }        .rank { font-size: 18px; }        .avatar-sm { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }        .avatar-fallback { background: linear-gradient(135deg, #6366F1, #818CF8); color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; }        .score { font-weight: 600; color: #6366F1; }        .btn-sm { padding: 4px 12px; font-size: 12px; }      `}</style>{" "}
    </div>
  );
}
