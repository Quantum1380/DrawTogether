import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/store/auth";
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "登录失败");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="login-page">
      {" "}
      <div className="login-card">
        {" "}
        <div className="login-header">
          {" "}
          <div className="login-icon">🎨</div>{" "}
          <h1 className="login-title">你画我猜</h1>{" "}
          <div className="login-sub">管理后台</div>{" "}
        </div>{" "}
        <form onSubmit={handleSubmit}>
          {" "}
          <div className="form-group">
            {" "}
            <label>用户名</label>{" "}
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoComplete="username"
            />{" "}
          </div>{" "}
          <div className="form-group">
            {" "}
            <label>密码</label>{" "}
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
            />{" "}
          </div>{" "}
          {error && <div className="error-msg">{error}</div>}{" "}
          <button
            type="submit"
            className="btn btn-primary login-btn"
            disabled={loading}
          >
            {" "}
            {loading ? "登录中..." : "登 录"}{" "}
          </button>{" "}
          <div className="hint">
            默认账号: admin / admin123
          </div>{" "}
        </form>{" "}
      </div>{" "}
      <style>{`        .login-page {          min-height: 100%;          display: flex;          align-items: center;          justify-content: center;          background: linear-gradient(145deg, #4F46E5 0%, #6366F1 40%, #8B5CF6 100%);          padding: 20px;        }        .login-card {          background: white;          border-radius: 20px;          padding: 40px;          width: 380px;          max-width: 100%;          box-shadow: 0 24px 64px rgba(30, 27, 75, 0.3);        }        .login-header {          text-align: center;          margin-bottom: 32px;        }        .login-icon { font-size: 48px; }        .login-title {          font-size: 24px;          font-weight: 700;          color: #1E1B4B;          margin-top: 8px;        }        .login-sub {          font-size: 13px;          color: #9CA3AF;          margin-top: 4px;        }        .form-group { margin-bottom: 16px; }        .form-group label {          display: block;          font-size: 13px;          color: #4B5563;          margin-bottom: 6px;          font-weight: 500;        }        .error-msg {          background: rgba(239, 68, 68, 0.1);          color: #EF4444;          padding: 8px 12px;          border-radius: 8px;          font-size: 13px;          margin-bottom: 12px;        }        .login-btn {          width: 100%;          padding: 12px;          font-size: 15px;          margin-top: 8px;        }        .hint {          font-size: 12px;          color: #9CA3AF;          text-align: center;          margin-top: 16px;        }      `}</style>{" "}
    </div>
  );
}
