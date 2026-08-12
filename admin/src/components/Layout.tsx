import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/store/auth';

const navItems = [
  { path: '/', label: '数据总览', icon: '📊' },
  { path: '/players', label: '玩家管理', icon: '👥' },
  { path: '/games', label: '对局记录', icon: '🎮' },
];

export default function Layout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <aside
        style={{
          width: 220,
          background: 'linear-gradient(180deg, #4F46E5 0%, #6366F1 100%)',
          color: 'white',
          padding: '20px 0',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 20px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          <span style={{ fontSize: 28 }}>🎨</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>你画我猜</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>管理后台</div>
          </div>
        </div>
        <nav
          style={{
            flex: 1,
            padding: '16px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 16px',
                  borderRadius: 8,
                  color: active ? 'white' : 'rgba(255,255,255,0.85)',
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                  background: active ? 'rgba(255,255,255,0.2)' : 'transparent',
                  cursor: 'pointer',
                  border: 'none',
                  width: '100%',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header
          style={{
            height: 56,
            padding: '0 24px',
            background: 'white',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: 14, color: '#4B5563' }}>欢迎,{admin?.nickname || '管理员'}</div>
          <button
            onClick={handleLogout}
            style={{
              padding: '6px 16px',
              borderRadius: 6,
              background: '#F1F0F7',
              color: '#4B5563',
              fontSize: 13,
              cursor: 'pointer',
              border: 'none',
              fontWeight: 500,
            }}
          >
            退出登录
          </button>
        </header>
        <main style={{ flex: 1, padding: 24, overflow: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
