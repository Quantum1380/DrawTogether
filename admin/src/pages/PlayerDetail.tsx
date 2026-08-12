import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { playerApi } from "@/api/player";
import Modal from "@/components/Modal";
import Tag from "@/components/Tag";
import { formatDateTime } from "@/utils/format";
import type { Player, UserContactsData, UserFriendsData } from "@/types";
export default function PlayerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [banModal, setBanModal] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [contactsData, setContactsData] = useState<UserContactsData | null>(null);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsFilter, setContactsFilter] = useState<"all" | "registered">("all");
  const [contactsSearch, setContactsSearch] = useState("");
  const [friendsData, setFriendsData] = useState<UserFriendsData | null>(null);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsSearch, setFriendsSearch] = useState("");
  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await playerApi.detail(id);
      setPlayer(data);
    } catch (err: any) {
      alert(err.message || "加载失败");
    } finally {
      setLoading(false);
    }
  };
  const loadContacts = async () => {
    if (!id) return;
    setContactsLoading(true);
    try {
      const data = await playerApi.contacts(id, contactsFilter === "registered");
      setContactsData(data);
    } catch (err: any) {
      setContactsData(null);
    } finally {
      setContactsLoading(false);
    }
  };
  const loadFriends = async () => {
    if (!id) return;
    setFriendsLoading(true);
    try {
      const data = await playerApi.friends(id);
      setFriendsData(data);
    } catch (err: any) {
      setFriendsData(null);
    } finally {
      setFriendsLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [id]);
  useEffect(() => {
    loadContacts();
  }, [id, contactsFilter]);
  useEffect(() => {
    loadFriends();
  }, [id]);
  const handleBan = async () => {
    if (!player || !banReason.trim()) return;
    setActionLoading(true);
    try {
      await playerApi.ban(player._id, banReason.trim());
      setBanModal(false);
      setBanReason("");
      load();
    } catch (err: any) {
      alert(err.message || "封禁失败");
    } finally {
      setActionLoading(false);
    }
  };
  const handleUnban = async () => {
    if (!player || !confirm("确定解封?")) return;
    setActionLoading(true);
    try {
      await playerApi.unban(player._id);
      load();
    } catch (err: any) {
      alert(err.message || "解封失败");
    } finally {
      setActionLoading(false);
    }
  };
  if (loading) return <div className="loading">加载中...</div>;
  if (!player) return <div className="loading">玩家不存在</div>;
  return (
    <div>
      {" "}
      <div className="header-bar">
        {" "}
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate("/players")}
        >
          ‹ 返回
        </button>{" "}
        <h1 className="page-title">玩家详情</h1>{" "}
      </div>{" "}
      <div className="detail-grid">
        {" "}
        <div className="card detail-card">
          {" "}
          <h2 className="card-title">基本信息</h2>{" "}
          <div className="info-row">
            {" "}
            <div className="avatar-wrap">
              {" "}
              {player.avatar ? (
                <img src={player.avatar} alt="" className="avatar" />
              ) : (
                <div className="avatar avatar-fallback">
                  {player.nickname.slice(0, 1)}
                </div>
              )}{" "}
            </div>{" "}
            <div className="main-info">
              {" "}
              <div className="name-line">
                {" "}
                <span className="nickname">{player.nickname}</span>{" "}
                {player.banStatus?.banned ? (
                  <Tag type="banned" />
                ) : player.status === "online" ? (
                  <Tag type="online" />
                ) : (
                  <Tag type="offline" />
                )}{" "}
              </div>{" "}
              <div className="meta">@{player.username}</div>{" "}
              <div className="meta">
                openid: <span className="mono">{player.openid}</span>
              </div>{" "}
            </div>{" "}
          </div>{" "}
          <div className="info-list">
            {" "}
            <div className="info-item">
              <label>手机号</label>
              <span>{player.phone || "-"}</span>
            </div>{" "}
            <div className="info-item">
              <label>注册时间</label>
              <span>{formatDateTime(player.createTime)}</span>
            </div>{" "}
          </div>{" "}
        </div>{" "}
        <div className="card detail-card">
          {" "}
          <h2 className="card-title">游戏统计</h2>{" "}
          <div className="stat-list">
            {" "}
            <div className="stat-item">
              {" "}
              <div className="stat-num">{player.gamesPlayed}</div>{" "}
              <div className="stat-label">总场次</div>{" "}
            </div>{" "}
            <div className="stat-item">
              {" "}
              <div className="stat-num">{player.gamesWon}</div>{" "}
              <div className="stat-label">胜场</div>{" "}
            </div>{" "}
            <div className="stat-item">
              {" "}
              <div className="stat-num">{player.totalScore}</div>{" "}
              <div className="stat-label">累计积分</div>{" "}
            </div>{" "}
            <div className="stat-item">
              {" "}
              <div className="stat-num">
                {" "}
                {player.gamesPlayed > 0
                  ? ((player.gamesWon / player.gamesPlayed) * 100).toFixed(1) +
                    "%"
                  : "-"}{" "}
              </div>{" "}
              <div className="stat-label">胜率</div>{" "}
            </div>{" "}
          </div>{" "}
        </div>{" "}
        <div className="card detail-card">
          {" "}
          <h2 className="card-title">账号状态</h2>{" "}
          {player.banStatus?.banned ? (
            <div className="ban-info">
              {" "}
              <div className="ban-status">
                {" "}
                <Tag type="banned" text="已封禁" />{" "}
              </div>{" "}
              <div className="ban-row">
                <label>封禁原因:</label>
                <span>{player.banStatus.banReason || "-"}</span>
              </div>{" "}
              <div className="ban-row">
                <label>封禁时间:</label>
                <span>{formatDateTime(player.banStatus.bannedAt)}</span>
              </div>{" "}
              <button
                className="btn btn-primary"
                disabled={actionLoading}
                onClick={handleUnban}
              >
                {" "}
                {actionLoading ? "处理中..." : "解除封禁"}{" "}
              </button>{" "}
            </div>
          ) : (
            <div className="ban-info">
              {" "}
              <div className="ban-status">
                {" "}
                <Tag type="success" text="账号正常" />{" "}
              </div>{" "}
              <div className="ban-tip">该账号状态正常,可正常使用</div>{" "}
              <button
                className="btn btn-danger"
                disabled={actionLoading}
                onClick={() => setBanModal(true)}
              >
                {" "}
                封禁账号{" "}
              </button>{" "}
            </div>
          )}{" "}
        </div>{" "}
      </div>{" "}
      <div className="card detail-card contacts-card">
        {" "}
        <div className="contacts-header">
          {" "}
          <h2 className="card-title">联系人</h2>{" "}
          {contactsData?.synced && (
            <span className="contacts-sync-time">
              最近同步: {formatDateTime(contactsData.syncTime)}
            </span>
          )}{" "}
        </div>{" "}
        {contactsLoading ? (
          <div className="contacts-empty">加载中...</div>
        ) : !contactsData?.synced ? (
          <div className="contacts-empty">该用户尚未同步联系人</div>
        ) : (
          <>
            <div className="contacts-stats">
              {" "}
              <div className="cs-item">
                <div className="cs-num">{contactsData.total}</div>
                <div className="cs-label">联系人总数</div>
              </div>{" "}
              <div className="cs-item">
                <div className="cs-num cs-num-reg">
                  {contactsData.registeredCount}
                </div>
                <div className="cs-label">已注册游戏</div>
              </div>{" "}
              <div className="cs-item">
                <div className="cs-num cs-num-unreg">
                  {contactsData.total - contactsData.registeredCount}
                </div>
                <div className="cs-label">未注册</div>
              </div>{" "}
            </div>
            <div className="contacts-toolbar">
              {" "}
              <div className="filter-tabs">
                {" "}
                <button
                  className={`ft-btn ${contactsFilter === "all" ? "active" : ""}`}
                  onClick={() => setContactsFilter("all")}
                >
                  全部 ({contactsData.total})
                </button>{" "}
                <button
                  className={`ft-btn ${contactsFilter === "registered" ? "active" : ""}`}
                  onClick={() => setContactsFilter("registered")}
                >
                  已注册 ({contactsData.registeredCount})
                </button>{" "}
              </div>{" "}
              <input
                className="cs-search"
                type="text"
                placeholder="搜索姓名/手机号"
                value={contactsSearch}
                onChange={(e) => setContactsSearch(e.target.value)}
              />{" "}
            </div>
            <div className="contacts-list">
              {" "}
              {contactsData.contacts
                .filter((c) => {
                  if (!contactsSearch.trim()) return true;
                  const kw = contactsSearch.trim().toLowerCase();
                  return (
                    c.name.toLowerCase().includes(kw) ||
                    c.phone.includes(kw)
                  );
                })
                .map((c, idx) => (
                  <div className="contact-row" key={idx}>
                    {" "}
                    <div className="cr-avatar">
                      {" "}
                      {c.registered && c.registeredAvatar ? (
                        <img src={c.registeredAvatar} alt="" />
                      ) : (
                        <div className="cr-avatar-fallback">
                          {c.name.slice(0, 1) || "?"}
                        </div>
                      )}{" "}
                    </div>{" "}
                    <div className="cr-info">
                      {" "}
                      <div className="cr-name">{c.name || "(无姓名)"}</div>
                      <div className="cr-phone">{c.phone || "(无号码)"}</div>{" "}
                    </div>{" "}
                    {c.registered ? (
                      <Tag type="success" text="已注册" />
                    ) : (
                      <Tag type="offline" text="未注册" />
                    )}{" "}
                  </div>
                ))}{" "}
              {contactsData.contacts.filter((c) => {
                if (!contactsSearch.trim()) return true;
                const kw = contactsSearch.trim().toLowerCase();
                return (
                  c.name.toLowerCase().includes(kw) || c.phone.includes(kw)
                );
              }).length === 0 && (
                <div className="contacts-empty">没有匹配的联系人</div>
              )}{" "}
            </div>
          </>
        )}{" "}
      </div>{" "}
      <div className="card detail-card friends-card">
        {" "}
        <div className="contacts-header">
          {" "}
          <h2 className="card-title">好友列表</h2>{" "}
          {friendsData && (
            <span className="contacts-sync-time">
              共 {friendsData.total} 位好友 · 在线 {friendsData.onlineCount} 人
            </span>
          )}{" "}
        </div>{" "}
        {friendsLoading ? (
          <div className="contacts-empty">加载中...</div>
        ) : !friendsData || friendsData.total === 0 ? (
          <div className="contacts-empty">该用户还没有添加任何好友</div>
        ) : (
          <>
            <div className="contacts-toolbar">
              {" "}
              <input
                className="cs-search"
                type="text"
                placeholder="搜索昵称/用户名/手机号"
                value={friendsSearch}
                onChange={(e) => setFriendsSearch(e.target.value)}
              />{" "}
            </div>
            <div className="contacts-list">
              {" "}
              {friendsData.friends
                .filter((f) => {
                  if (!friendsSearch.trim()) return true;
                  const kw = friendsSearch.trim().toLowerCase();
                  return (
                    f.nickname.toLowerCase().includes(kw) ||
                    f.username.toLowerCase().includes(kw) ||
                    f.phone.includes(kw)
                  );
                })
                .map((f) => (
                  <div
                    className="contact-row friend-row"
                    key={f._id}
                    onClick={() => navigate(`/players/${f._id}`)}
                  >
                    {" "}
                    <div className="cr-avatar">
                      {" "}
                      {f.avatar ? (
                        <img src={f.avatar} alt="" />
                      ) : (
                        <div className="cr-avatar-fallback">
                          {f.nickname.slice(0, 1)}
                        </div>
                      )}{" "}
                    </div>{" "}
                    <div className="cr-info">
                      {" "}
                      <div className="cr-name">{f.nickname}</div>
                      <div className="cr-phone">
                        @{f.username}
                        {f.phone ? ` · ${f.phone}` : ""}
                      </div>{" "}
                    </div>{" "}
                    <div className="friend-meta">
                      {" "}
                      {f.banStatus?.banned ? (
                        <Tag type="banned" />
                      ) : f.status === "online" ? (
                        <Tag type="online" />
                      ) : (
                        <Tag type="offline" />
                      )}{" "}
                      <div className="friend-stats">
                        {f.gamesPlayed} 场 · {f.totalScore} 分
                      </div>{" "}
                    </div>{" "}
                  </div>
                ))}{" "}
              {friendsData.friends.filter((f) => {
                if (!friendsSearch.trim()) return true;
                const kw = friendsSearch.trim().toLowerCase();
                return (
                  f.nickname.toLowerCase().includes(kw) ||
                  f.username.toLowerCase().includes(kw) ||
                  f.phone.includes(kw)
                );
              }).length === 0 && (
                <div className="contacts-empty">没有匹配的好友</div>
              )}{" "}
            </div>
          </>
        )}{" "}
      </div>{" "}
      <Modal
        visible={banModal}
        title="封禁玩家"
        onClose={() => setBanModal(false)}
        footer={
          <>
            {" "}
            <button
              className="btn btn-ghost"
              onClick={() => setBanModal(false)}
            >
              取消
            </button>{" "}
            <button
              className="btn btn-danger"
              disabled={actionLoading || !banReason.trim()}
              onClick={handleBan}
            >
              {" "}
              {actionLoading ? "处理中..." : "确认封禁"}{" "}
            </button>{" "}
          </>
        }
      >
        {" "}
        <div>
          {" "}
          <div className="ban-info-text">
            {" "}
            确定要封禁 <b>{player.nickname}</b> ({player.username})
            吗?封禁后该玩家将无法登录和操作。{" "}
          </div>{" "}
          <div className="form-group">
            {" "}
            <label>封禁原因</label>{" "}
            <textarea
              className="input ban-reason"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="请填写封禁原因"
              rows={3}
            />{" "}
          </div>{" "}
        </div>{" "}
      </Modal>{" "}
      <style>{`        .header-bar { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }        .page-title { font-size: 22px; font-weight: 600; color: #1E1B4B; }        .loading { padding: 60px; text-align: center; color: #9CA3AF; }        .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }        .detail-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 8px rgba(99, 102, 241, 0.06); }        .detail-card.full { grid-column: 1 / -1; }        .card-title { font-size: 15px; font-weight: 600; color: #1E1B4B; margin-bottom: 16px; }        .info-row { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }        .avatar-wrap { flex-shrink: 0; }        .avatar { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; }        .avatar-fallback { background: linear-gradient(135deg, #6366F1, #818CF8); color: white; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 600; }        .main-info { flex: 1; }        .name-line { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }        .nickname { font-size: 18px; font-weight: 600; color: #1E1B4B; }        .meta { font-size: 13px; color: #9CA3AF; margin-top: 4px; }        .mono { font-family: 'SF Mono', Consolas, monospace; font-size: 12px; }        .info-list { border-top: 1px solid #F3F4F6; padding-top: 12px; }        .info-item { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }        .info-item label { color: #9CA3AF; }        .stat-list { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }        .stat-item { background: #F8F7FC; border-radius: 10px; padding: 16px; text-align: center; }        .stat-num { font-size: 24px; font-weight: 700; color: #6366F1; }        .stat-label { font-size: 12px; color: #9CA3AF; margin-top: 4px; }        .ban-info { padding: 12px 0; }        .ban-status { margin-bottom: 12px; }        .ban-row { display: flex; padding: 6px 0; font-size: 13px; gap: 8px; }        .ban-row label { color: #9CA3AF; min-width: 70px; }        .ban-tip { font-size: 13px; color: #9CA3AF; margin-bottom: 16px; }        .ban-info-text { padding: 12px; background: #F8F7FC; border-radius: 8px; margin-bottom: 16px; font-size: 14px; color: #4B5563; }        .ban-reason { resize: vertical; min-height: 80px; font-family: inherit; }        .form-group label { display: block; font-size: 13px; color: #4B5563; margin-bottom: 6px; font-weight: 500; }        .btn-sm { padding: 4px 12px; font-size: 12px; }
        .contacts-card { grid-column: 1 / -1; }
        .contacts-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .contacts-sync-time { font-size: 12px; color: #9CA3AF; }
        .contacts-empty { padding: 40px 20px; text-align: center; color: #9CA3AF; font-size: 13px; }
        .contacts-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
        .cs-item { background: #F8F7FC; border-radius: 10px; padding: 14px; text-align: center; }
        .cs-num { font-size: 22px; font-weight: 700; color: #6366F1; }
        .cs-num-reg { color: #10B981; }
        .cs-num-unreg { color: #9CA3AF; }
        .cs-label { font-size: 12px; color: #9CA3AF; margin-top: 4px; }
        .contacts-toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
        .filter-tabs { display: flex; gap: 6px; background: #F3F4F6; border-radius: 8px; padding: 3px; }
        .ft-btn { padding: 6px 14px; border: none; background: transparent; color: #6B7280; font-size: 12px; border-radius: 6px; cursor: pointer; transition: all 0.2s; font-weight: 500; }
        .ft-btn.active { background: white; color: #6366F1; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
        .cs-search { flex: 1; min-width: 180px; padding: 8px 12px; border: 1px solid #E5E7EB; border-radius: 8px; font-size: 13px; outline: none; transition: border-color 0.2s; }
        .cs-search:focus { border-color: #6366F1; }
        .contacts-list { max-height: 420px; overflow-y: auto; border: 1px solid #F3F4F6; border-radius: 10px; }
        .contact-row { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid #F9FAFB; transition: background 0.15s; }
        .contact-row:last-child { border-bottom: none; }
        .contact-row:hover { background: #F8F7FC; }
        .cr-avatar { flex-shrink: 0; }
        .cr-avatar img { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
        .cr-avatar-fallback { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #D1D5DB, #E5E7EB); color: #6B7280; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 600; }
        .cr-info { flex: 1; min-width: 0; }
        .cr-name { font-size: 14px; font-weight: 500; color: #1E1B4B; }
        .cr-phone { font-size: 12px; color: #9CA3AF; margin-top: 2px; font-family: 'SF Mono', Consolas, monospace; }
        .friends-card { grid-column: 1 / -1; }
        .friend-row { cursor: pointer; }
        .friend-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
        .friend-stats { font-size: 11px; color: #9CA3AF; }      `}</style>{" "}
    </div>
  );
}
