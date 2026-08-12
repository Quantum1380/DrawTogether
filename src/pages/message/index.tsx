import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import classnames from 'classnames';
import { messageService, MessageItem } from '@/services/messageService';
import { roomService } from '@/services/roomService';
import {
  friendService,
  FriendRequestItem,
} from '@/services/friendService';
import EmptyState from '@/components/EmptyState';
import styles from './index.module.scss';

type FilterType = 'all' | 'invite' | 'friend_request' | 'system';

const messageIcons: Record<string, string> = {
  invite: '🎮',
  system: '📢',
  friend_request: '👋',
  chat: '💬',
};

const filterLabel: Record<FilterType, string> = {
  all: '全部',
  invite: '邀请',
  friend_request: '申请',
  system: '系统',
};

const MessagesPage: React.FC = () => {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  const [loadingRequests, setLoadingRequests] = useState(false);
  const [handlingRequestIds, setHandlingRequestIds] = useState<Set<string>>(new Set());

  const [acceptedInviteIds, setAcceptedInviteIds] = useState<Set<string>>(new Set());
  const [checkingInviteIds, setCheckingInviteIds] = useState<Set<string>>(new Set());

  const loadMessages = useCallback(async () => {
    try {
      const list = await messageService.getMessages();
      list.sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime());
      setMessages(list);
    } catch (err) {
      console.error('[Message] loadMessages:', err);
    }
  }, []);

  const loadFriendRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const list = await friendService.getIncomingFriendRequests();
      setFriendRequests(list);
    } catch (err) {
      console.error('[Message] loadFriendRequests:', err);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadMessages(), loadFriendRequests()]);
    } finally {
      setLoading(false);
    }
  }, [loadMessages, loadFriendRequests]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useDidShow(() => {
    loadAll();
  });

  const formatTime = (time: string) => {
    const date = new Date(time);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const parseMsgData = (m: MessageItem) => {
    if (!m.data) return null;
    try { return JSON.parse(m.data); } catch { return null; }
  };

  // 点击邀请消息的「加入房间」：先校验房间，再进入
  const handleAcceptInvite = async (msg: MessageItem) => {
    if (checkingInviteIds.has(msg._id)) return;
    const data = parseMsgData(msg) as { roomId?: string; roomCode?: string } | null;
    const roomId = data?.roomId;
    const roomCode = data?.roomCode;
    if (!roomId || !roomCode) {
      Taro.showToast({ title: '邀请信息无效', icon: 'none' });
      return;
    }

    setCheckingInviteIds(prev => new Set(prev).add(msg._id));
    Taro.showLoading({ title: '加入房间...', mask: true });
    try {
      const result = await messageService.checkInviteRoom(roomId);
      if (!result.exists) {
        // 房间不存在
        Taro.showModal({
          title: '提示',
          content: '房主已退出房间',
          showCancel: false,
          confirmText: '知道了',
          confirmColor: '#6366F1',
        });
        return;
      }
      // 真正加入房间（后端幂等：已加入会直接返回当前房间）
      try {
        await roomService.joinRoom(roomCode);
      } catch (e: any) {
        // 房间已开始/已满等错误直接提示
        Taro.showToast({ title: e?.message || '加入失败', icon: 'none' });
        return;
      }
      // 加入房间
      setAcceptedInviteIds(prev => new Set(prev).add(msg._id));
      // 先标记已读
      try { await messageService.markRead([msg._id]); } catch {}
      Taro.redirectTo({
        url: `/pages/room/index?id=${roomId}&roomCode=${roomCode}`,
      });
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '加入失败', icon: 'none' });
    } finally {
      Taro.hideLoading();
      setCheckingInviteIds(prev => {
        const next = new Set(prev);
        next.delete(msg._id);
        return next;
      });
    }
  };

  const handleRejectInvite = async (msg: MessageItem) => {
    try {
      await messageService.markRead([msg._id]);
      setMessages(prev => prev.filter(m => m._id !== msg._id));
      Taro.showToast({ title: '已拒绝', icon: 'none' });
    } catch (err) {
      console.error('[Message] rejectInvite:', err);
    }
  };

  // 好友申请：同意
  const handleAcceptFriendRequest = async (req: FriendRequestItem) => {
    if (handlingRequestIds.has(req.requestId)) return;
    setHandlingRequestIds(prev => new Set(prev).add(req.requestId));
    try {
      await friendService.acceptFriendRequest(req.requestId);
      Taro.showToast({ title: '已添加好友', icon: 'success' });
      // 从列表移除
      setFriendRequests(prev => prev.filter(r => r.requestId !== req.requestId));
      // 刷新好友列表数据（也重新加载消息）
      loadMessages();
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '操作失败', icon: 'none' });
    } finally {
      setHandlingRequestIds(prev => {
        const next = new Set(prev);
        next.delete(req.requestId);
        return next;
      });
    }
  };

  // 好友申请：拒绝
  const handleRejectFriendRequest = async (req: FriendRequestItem) => {
    if (handlingRequestIds.has(req.requestId)) return;
    setHandlingRequestIds(prev => new Set(prev).add(req.requestId));
    try {
      await friendService.rejectFriendRequest(req.requestId);
      Taro.showToast({ title: '已拒绝', icon: 'none' });
      setFriendRequests(prev => prev.filter(r => r.requestId !== req.requestId));
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '操作失败', icon: 'none' });
    } finally {
      setHandlingRequestIds(prev => {
        const next = new Set(prev);
        next.delete(req.requestId);
        return next;
      });
    }
  };

  // 按类型筛选消息（在 'all' 模式下，邀请和系统消息来自 messages，好友申请来自独立接口 friendRequests）
  const filteredMessages = messages.filter(m => {
    if (filter === 'all') return m.type === 'invite' || m.type === 'system' || m.type === 'chat';
    if (filter === 'friend_request') return false; // 好友申请用 friendRequests 列表
    return m.type === filter;
  });

  const unreadCount = messages.filter(m => !m.isRead).length;
  const pendingRequestCount = friendRequests.length;

  const getAvatarColor = (nickname: string) => {
    const colors = [
      ['#86EFAC', '#22C55E'], ['#93C5FD', '#3B82F6'], ['#FCA5A5', '#EF4444'],
      ['#FDE68A', '#F59E0B'], ['#C4B5FD', '#8B5CF6'], ['#F9A8D4', '#EC4899'],
      ['#67E8F9', '#06B6D4'],
    ];
    const idx = (nickname?.charCodeAt(0) || 0) % colors.length;
    return colors[idx];
  };

  // 渲染邀请消息卡片（显示「加入房间」「拒绝」）
  const renderInviteMessage = (msg: MessageItem) => {
    const data = parseMsgData(msg);
    const roomCode = data?.roomCode || '';
    const fromNickname = data?.fromNickname || msg.fromOpenid;
    const accepted = acceptedInviteIds.has(msg._id);
    const checking = checkingInviteIds.has(msg._id);
    return (
      <>
        <Text className={styles.messageText}>
          {`${fromNickname} 邀请你加入房间 ${roomCode}，一起来玩你画我猜！`}
        </Text>
        {accepted ? (
          <View className={styles.acceptedTag}>
            <Text className={styles.acceptedText}>已接受邀请</Text>
          </View>
        ) : (
          <View className={styles.messageActions}>
            <View
              className={styles.rejectBtn}
              onClick={(e) => { e.stopPropagation(); handleRejectInvite(msg); }}
            >
              <Text>拒绝</Text>
            </View>
            <View
              className={styles.acceptBtn}
              onClick={(e) => { e.stopPropagation(); handleAcceptInvite(msg); }}
            >
              <Text>{checking ? '检查中...' : '加入房间'}</Text>
            </View>
          </View>
        )}
      </>
    );
  };

  return (
    <View className={styles.container}>
      {/* 筛选标签 */}
      <View className={styles.filterTabs}>
        {(['all', 'invite', 'friend_request', 'system'] as FilterType[]).map((t) => {
          const countBadge =
            t === 'all' ? (unreadCount + pendingRequestCount) :
            t === 'friend_request' ? pendingRequestCount :
            t === 'invite' ? messages.filter(m => m.type === 'invite' && !m.isRead).length :
            t === 'system' ? messages.filter(m => m.type === 'system' && !m.isRead).length :
            0;
          return (
            <View
              key={t}
              className={classnames(styles.filterTab, filter === t && styles.filterTabActive)}
              onClick={() => setFilter(t)}
            >
              <Text className={classnames(
                styles.filterTabText,
                filter === t && styles.filterTabTextActive
              )}>
                {filterLabel[t]}
                {countBadge > 0 && (
                  <Text className={classnames(
                    styles.filterBadge,
                    filter === t && styles.filterBadgeActive
                  )}>
                    {countBadge > 99 ? '99+' : countBadge}
                  </Text>
                )}
              </Text>
            </View>
          );
        })}
      </View>

      {/* 消息列表 */}
      <View className={styles.messageList}>
        {loading ? (
          <View className={styles.loadingWrap}>
            <Text className={styles.loadingText}>加载中...</Text>
          </View>
        ) : (
          <ScrollView scrollY className={styles.scrollView}>
            {/* Tab: friend_request 显示来自独立接口的待处理好友申请 */}
            {(filter === 'all' || filter === 'friend_request') && friendRequests.map(req => {
              const [color1, color2] = getAvatarColor(req.fromNickname || req.fromUsername);
              const handling = handlingRequestIds.has(req.requestId);
              return (
                <View
                  key={`req-${req.requestId}`}
                  className={classnames(styles.messageItem, styles.unread)}
                >
                  <View className={styles.unreadDot} />
                  <View className={styles.messageAvatar}>
                    <View
                      className={styles.realAvatar}
                      style={{ background: `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)` }}
                    >
                      <Text className={styles.avatarText}>
                        {(req.fromNickname || req.fromUsername || '?').charAt(0)}
                      </Text>
                    </View>
                  </View>
                  <View className={styles.messageContent}>
                    <View className={styles.messageHeader}>
                      <Text className={styles.messageFrom}>{req.fromNickname || req.fromUsername}</Text>
                      <Text className={styles.messageTime}>{formatTime(req.createTime)}</Text>
                    </View>
                    <Text className={styles.messageText}>
                      {req.message
                        ? `请求添加你为好友：${req.message}`
                        : '请求添加你为好友'}
                    </Text>
                    <View className={styles.messageActions}>
                      <View
                        className={styles.rejectBtn}
                        onClick={(e) => { e.stopPropagation(); handleRejectFriendRequest(req); }}
                      >
                        <Text>{handling ? '处理中...' : '拒绝'}</Text>
                      </View>
                      <View
                        className={styles.acceptBtn}
                        onClick={(e) => { e.stopPropagation(); handleAcceptFriendRequest(req); }}
                      >
                        <Text>{handling ? '处理中...' : '同意'}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}

            {/* 邀请 / 系统 / chat 消息 */}
            {filteredMessages.map(msg => {
              const [color1, color2] = getAvatarColor(msg.fromOpenid);
              return (
                <View
                  key={msg._id}
                  className={classnames(styles.messageItem, !msg.isRead && styles.unread)}
                >
                  {!msg.isRead && <View className={styles.unreadDot} />}
                  <View className={styles.messageAvatar}>
                    <View
                      className={styles.realAvatar}
                      style={{ background: `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)` }}
                    >
                      <Text className={styles.avatarText}>
                        {messageIcons[msg.type] || '📨'}
                      </Text>
                    </View>
                  </View>
                  <View className={styles.messageContent}>
                    <View className={styles.messageHeader}>
                      <Text className={styles.messageFrom}>
                        {msg.type === 'invite' ? '游戏邀请' :
                         msg.type === 'friend_request' ? '好友申请' :
                         msg.type === 'system' ? '系统通知' : '消息'}
                      </Text>
                      <Text className={styles.messageTime}>{formatTime(msg.createTime)}</Text>
                    </View>
                    {msg.type === 'invite'
                      ? renderInviteMessage(msg)
                      : (
                        <Text className={styles.messageText}>{msg.content}</Text>
                      )
                    }
                  </View>
                </View>
              );
            })}

            {/* 空状态（在两种列表都空时才显示） */}
            {(() => {
              const showEmpty =
                (filter === 'all' && friendRequests.length === 0 && filteredMessages.length === 0) ||
                (filter === 'friend_request' && friendRequests.length === 0) ||
                ((filter === 'invite' || filter === 'system') && filteredMessages.length === 0);
              if (!showEmpty) return null;
              const tips = filter === 'friend_request'
                ? { icon: '👋', title: '暂无好友申请', desc: '等好友发来申请吧' }
                : filter === 'invite'
                  ? { icon: '🎮', title: '暂无游戏邀请', desc: '让好友邀请你玩' }
                  : filter === 'system'
                    ? { icon: '📢', title: '暂无系统通知', desc: '会在这里发布' }
                    : { icon: '📬', title: '暂无消息', desc: '邀请好友一起玩游戏吧' };
              return (
                <View style={{ paddingTop: 40 }}>
                  <EmptyState icon={tips.icon} title={tips.title} desc={tips.desc} />
                </View>
              );
            })()}
          </ScrollView>
        )}
      </View>
    </View>
  );
};

export default MessagesPage;
