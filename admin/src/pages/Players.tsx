import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { playerApi } from '@/api/player';
import Table, { Column } from '@/components/Table';
import Pagination from '@/components/Pagination';
import SearchBar from '@/components/SearchBar';
import Modal from '@/components/Modal';
import Tag from '@/components/Tag';
import { formatDateTime } from '@/utils/format';
import { useAdminSocketEvents } from '@/hooks/useAdminSocket';
import type { Player } from '@/types';

export default function Players() {
  const navigate = useNavigate();
  const [list, setList] = useState<Player[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<'' | 'online' | 'offline' | 'banned'>('');
  const [loading, setLoading] = useState(false);

  const [banTarget, setBanTarget] = useState<Player | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banLoading, setBanLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await playerApi.list({ page, pageSize, keyword, status });
      setList(data.list);
      setTotal(data.total);
    } catch (err: any) {
      console.error('加载玩家列表失败:', err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, status]);

  useEffect(() => {
    load();
  }, [load]);

  // 是否处于「默认视图」（无筛选、第一页）→ 可以本地合并，体验更顺滑
  const isDefaultView = !keyword && !status && page === 1;

  // 实时事件 → 本地合并 / 重新拉取
  useAdminSocketEvents({
    // 新用户注册：默认视图 unshift 到最前
    'admin:player-registered': ({ player }: { player: Player }) => {
      if (isDefaultView) {
        setList((prev) => {
          if (!player?._id) return prev;
          if (prev.some((p) => p._id === player._id)) return prev;
          return [player, ...prev].slice(0, pageSize);
        });
        setTotal((t) => t + 1);
      } else {
        load();
      }
    },
    // 封禁：直接替换列表中匹配行
    'admin:player-banned': ({ player }: { player: Player }) => {
      if (!player?._id) return;
      setList((prev) => prev.map((p) => (p._id === player._id ? { ...p, ...player } : p)));
    },
    // 解封
    'admin:player-unbanned': ({ player }: { player: Player }) => {
      if (!player?._id) return;
      setList((prev) => prev.map((p) => (p._id === player._id ? { ...p, ...player } : p)));
    },
    // 玩家上下线（openid, status）
    'admin:user-status': ({ openid, status: st }: { openid: string; status: 'online' | 'offline' }) => {
      setList((prev) => prev.map((p) => (p.openid === openid ? { ...p, status: st } : p)));
    },
    // 全局统计变化 → 如果有筛选/分页，可能总数也变化了，重拉一次
    'admin:stats-changed': () => {
      if (!isDefaultView) load();
    },
  });

  const handleSearch = () => {
    setPage(1);
    // 用 setTimeout 让 page 变更在下一帧（避免 race 状态不一致）
    setTimeout(() => load(), 0);
  };

  const handleBan = async () => {
    if (!banTarget || !banReason.trim()) return;
    setBanLoading(true);
    try {
      await playerApi.ban(banTarget._id, banReason.trim());
      setBanTarget(null);
      setBanReason('');
      // 封/解封成功后，Socket 会收到 admin:player-banned / admin:stats-changed
      // → 本地自动合并，不需要自己 load()（也避免列表抖动）
    } catch (err: any) {
      alert(err.message || '封禁失败');
    } finally {
      setBanLoading(false);
    }
  };

  const handleUnban = async (player: Player) => {
    if (!confirm(`确定解封用户 ${player.nickname} 吗?`)) return;
    try {
      await playerApi.unban(player._id);
      // socket 会推 admin:player-unbanned → 列表自动更新
    } catch (err: any) {
      alert(err.message || '解封失败');
    }
  };

  const columns: Column<Player>[] = useMemo(() => [
    {
      title: '头像',
      key: 'avatar',
      width: '60px',
      render: (row) =>
        row.avatar ? (
          <img src={row.avatar} alt="" className="avatar-p" />
        ) : (
          <div className="avatar-p avatar-fallback-p">{row.nickname.slice(0, 1)}</div>
        ),
    },
    { title: '用户名', key: 'username', render: (r) => <span className="mono">{r.username}</span> },
    { title: '昵称', key: 'nickname' },
    {
      title: '状态',
      key: 'status',
      render: (r) => {
        if (r.banStatus?.banned) return <Tag type="banned" />;
        if (r.status === 'online') return <Tag type="online" />;
        return <Tag type="offline" />;
      },
    },
    { title: '游戏场次', key: 'gamesPlayed' },
    { title: '胜场', key: 'gamesWon' },
    { title: '总分', key: 'totalScore' },
    { title: '注册时间', key: 'createTime', render: (r) => formatDateTime(r.createTime) },
    {
      title: '操作',
      key: 'actions',
      render: (r) =>
        r.banStatus?.banned ? (
          <button
            className="btn btn-ghost btn-sm"
            onClick={(e) => { e.stopPropagation(); handleUnban(r); }}
          >
            解封
          </button>
        ) : (
          <button
            className="btn btn-danger btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              setBanTarget(r);
              setBanReason('');
            }}
          >
            封禁
          </button>
        ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  return (
    <div>
      <h1 className="page-title">玩家管理</h1>

      <SearchBar keyword={keyword} onKeywordChange={setKeyword} onSearch={handleSearch} placeholder="搜索用户名/昵称">
        <select
          className="input status-select"
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
        >
          <option value="">全部状态</option>
          <option value="online">在线</option>
          <option value="offline">离线</option>
          <option value="banned">已封禁</option>
        </select>
      </SearchBar>

      <Table
        columns={columns}
        data={list}
        loading={loading}
        onRowClick={(r) => navigate(`/players/${r._id}`)}
      />

      <Pagination page={page} pageSize={pageSize} total={total} onChange={setPage} />

      <Modal
        visible={!!banTarget}
        title="封禁玩家"
        onClose={() => setBanTarget(null)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setBanTarget(null)}>
              取消
            </button>
            <button
              className="btn btn-danger"
              disabled={banLoading || !banReason.trim()}
              onClick={handleBan}
            >
              {banLoading ? '处理中...' : '确认封禁'}
            </button>
          </>
        }
      >
        {banTarget && (
          <div>
            <div className="ban-info">
              确定要封禁 <b>{banTarget.nickname}</b> ({banTarget.username}) 吗?
              封禁后该玩家将无法登录和操作。
            </div>
            <div className="form-group-p">
              <label>封禁原因</label>
              <textarea
                className="input ban-reason"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="请填写封禁原因"
                rows={3}
              />
            </div>
          </div>
        )}
      </Modal>

      <style>{`
        .page-title { font-size: 22px; font-weight: 600; color: #1E1B4B; margin-bottom: 24px; }
        .status-select { width: 130px; }
        .avatar-p {
          width: 36px; height: 36px; border-radius: 50%;
          object-fit: cover; display: block;
        }
        .avatar-fallback-p {
          background: linear-gradient(135deg, #6366F1, #818CF8);
          color: white; display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 600;
        }
        .mono { font-family: 'SF Mono', Consolas, monospace; font-size: 13px; }
        .btn-sm { padding: 4px 12px; font-size: 12px; }
        .ban-info {
          padding: 12px; background: #F8F7FC; border-radius: 8px;
          margin-bottom: 16px; font-size: 14px; color: #4B5563;
        }
        .ban-reason { resize: vertical; min-height: 80px; font-family: inherit; }
        .form-group-p label {
          display: block; font-size: 13px; color: #4B5563;
          margin-bottom: 6px; font-weight: 500;
        }
      `}</style>
    </div>
  );
}
