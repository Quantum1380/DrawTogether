import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { gameApi } from "@/api/game";
import Table, { Column } from "@/components/Table";
import Pagination from "@/components/Pagination";
import SearchBar from "@/components/SearchBar";
import { formatDateTime, durationMinutes, truncate } from "@/utils/format";
import { useAdminSocketEvents } from "@/hooks/useAdminSocket";
import type { GameRecord } from "@/types";

export default function Games() {
  const navigate = useNavigate();
  const [list, setList] = useState<GameRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gameApi.list({ page, pageSize, keyword });
      setList(data.list);
      setTotal(data.total);
    } catch (err: any) {
      console.error("加载对局列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword]);

  useEffect(() => {
    load();
  }, [load]);

  const isDefaultView = !keyword && page === 1;

  // —— 实时更新：默认视图本地合并，其它视图静默重拉 ——
  useAdminSocketEvents({
    'admin:game-ended': ({ record }: { record: GameRecord }) => {
      if (!record?._id) return;
      if (isDefaultView) {
        setList((prev) => {
          if (prev.some((g) => g._id === record._id)) return prev;
          return [record, ...prev].slice(0, pageSize);
        });
        setTotal((t) => t + 1);
      } else {
        load();
      }
    },
    'admin:stats-changed': () => {
      if (!isDefaultView) load();
    },
  });

  const handleSearch = () => {
    setPage(1);
    setTimeout(() => load(), 0);
  };

  const columns: Column<GameRecord>[] = [
    {
      title: "房间号",
      key: "roomCode",
      render: (r) => <span className="mono">{r.roomCode}</span>,
    },
    {
      title: "房间名",
      key: "roomName",
      render: (r) => truncate(r.roomName, 16),
    },
    {
      title: "玩家数",
      key: "players",
      render: (r) => `${r.players.length} 人`,
    },
    {
      title: "胜者",
      key: "winner",
      render: (r) =>
        r.winner ? <span className="winner">{r.winner.nickname}</span> : "-",
    },
    { title: "回合数", key: "totalRounds" },
    { title: "词数", key: "words", render: (r) => `${r.words.length} 个` },
    {
      title: "开始时间",
      key: "startTime",
      render: (r) => formatDateTime(r.startTime),
    },
    {
      title: "时长",
      key: "duration",
      render: (r) => durationMinutes(r.startTime, r.endTime),
    },
  ];

  return (
    <div>
      <h1 className="page-title">对局记录</h1>
      <SearchBar
        keyword={keyword}
        onKeywordChange={setKeyword}
        onSearch={handleSearch}
        placeholder="搜索房间号/房间名"
      />
      <Table
        columns={columns}
        data={list}
        loading={loading}
        onRowClick={(r) => navigate(`/games/${r._id}`)}
      />
      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onChange={setPage}
      />
      <style>{`
        .page-title { font-size: 22px; font-weight: 600; color: #1E1B4B; margin-bottom: 24px; }
        .mono { font-family: 'SF Mono', Consolas, monospace; font-size: 13px; color: #6366F1; }
        .winner { color: #10B981; font-weight: 600; }
      `}</style>
    </div>
  );
}
