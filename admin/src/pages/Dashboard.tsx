import { useEffect, useState, useCallback } from 'react';
import { statsApi } from '@/api/stats';
import StatCard from '@/components/StatCard';
import { useAdminSocketEvents } from '@/hooks/useAdminSocket';
import type { Stats } from '@/types';

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const next = await statsApi.get();
      setStats(next);
    } catch (err) {
      console.error('加载统计数据失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // —— 实时监听：任何会影响统计数据的事件都触发重新拉取（不会手动刷新） ——
  useAdminSocketEvents({
    'admin:stats-changed': loadStats,
    'admin:player-registered': loadStats,
    'admin:player-banned': loadStats,
    'admin:player-unbanned': loadStats,
    'admin:user-status': loadStats,   // 上下线变化
    'admin:game-ended': loadStats,
    'admin:room-created': loadStats,
    'admin:room-updated': loadStats,
    'admin:room-removed': loadStats,
  });

  return (
    <div>
      <h1 className="page-title">数据总览</h1>
      {loading ? (
        <div className="loading">加载中...</div>
      ) : stats ? (
        <div className="stats-grid">
          <StatCard title="总玩家数" value={stats.totalPlayers} icon="👥" color="#6366F1" />
          <StatCard title="在线玩家" value={stats.onlinePlayers} icon="🟢" color="#10B981" />
          <StatCard title="今日新增" value={stats.todayNewPlayers} icon="📈" color="#F59E0B" />
          <StatCard title="总对局数" value={stats.totalGames} icon="🎮" color="#A78BFA" />
          <StatCard title="今日对局" value={stats.todayGames} icon="🎯" color="#3B82F6" />
          <StatCard title="已封禁用户" value={stats.totalBanned} icon="🚫" color="#EF4444" />
        </div>
      ) : (
        <div className="loading">加载失败</div>
      )}
      <style>{`
        .page-title { font-size: 22px; font-weight: 600; color: #1E1B4B; margin-bottom: 24px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
        .loading { padding: 60px; text-align: center; color: #9CA3AF; }
      `}</style>
    </div>
  );
}
