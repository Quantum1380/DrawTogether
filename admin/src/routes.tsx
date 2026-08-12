import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Players from '@/pages/Players';
import PlayerDetail from '@/pages/PlayerDetail';
import Games from '@/pages/Games';
import GameDetail from '@/pages/GameDetail';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAuth();
  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF' }}>加载中...</div>;
  if (!admin) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function AppRoutes() {
  const { admin, loading } = useAuth();
  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF' }}>加载中...</div>;

  return (
    <Routes>
      <Route path="/login" element={admin ? <Navigate to="/" replace /> : <Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/players" element={<Players />} />
        <Route path="/players/:id" element={<PlayerDetail />} />
        <Route path="/games" element={<Games />} />
        <Route path="/games/:id" element={<GameDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
