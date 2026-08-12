import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Button, Input, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import { useUserStore } from '@/store/userStore';
import { roomService } from '@/services/roomService';
import { friendService } from '@/services/friendService';
import { messageService } from '@/services/messageService';
import { authService } from '@/services/authService';
import { getSocket } from '@/services/socket';
import LoginModal from '@/components/LoginModal';
import type { Room } from '@/types/room';
import type { Friend } from '@/types/user';
import styles from './index.module.scss';

const HomePage: React.FC = () => {
  const { profile } = useUserStore();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [totalRounds, setTotalRounds] = useState(3);
  const [drawSeconds, setDrawSeconds] = useState(60);
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [invitingOpenids, setInvitingOpenids] = useState<string[]>([]);

  /** 检查登录状态，未登录则弹出登录框，返回是否已登录 */
  const requireLogin = useCallback((): boolean => {
    if (authService.isLoggedIn()) return true;
    setShowLogin(true);
    return false;
  }, []);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    try {
      const list = await roomService.getRooms();
      setRooms(list);
    } catch (err) {
      console.error('[Home] loadRooms:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFriends = useCallback(async () => {
    try {
      const list = await friendService.getFriends();
      setFriends(list);
    } catch (err) {
      console.error('[Home] loadFriends:', err);
      setFriends([]);
    }
  }, []);

  useEffect(() => {
    loadRooms();
    if (authService.isLoggedIn()) {
      loadFriends();
    }
  }, [loadRooms, loadFriends]);

  // 监听好友上线/下线事件，实时更新好友列表
  useEffect(() => {
    if (!authService.isLoggedIn()) return;
    const socket = getSocket();
    if (!socket) return;
    const handler = (data: { openid: string; status: string }) => {
      setFriends((prev) =>
        prev.map((f) =>
          f.openid === data.openid ? { ...f, status: data.status as any } : f
        )
      );
    };
    socket.on('user:status-changed', handler);
    return () => {
      socket.off('user:status-changed', handler);
    };
  }, []);

  const handleCreateRoom = async () => {
    if (!requireLogin()) return;
    if (!roomName.trim()) {
      Taro.showToast({ title: '请输入房间名', icon: 'none' });
      return;
    }
    setCreating(true);
    try {
      const room = await roomService.createRoom({
        name: roomName.trim(),
        totalRounds,
        drawSeconds,
        maxPlayers,
      });
      // 调试日志：确保 _id 是字符串，避免拼 URL 时变成 [object Object]
      const roomIdStr = String(room._id);
      console.log('[Home] 创建成功 roomId:', roomIdStr, 'roomCode:', room.roomCode, 'type:', typeof room._id);
      Taro.showToast({ title: '创建成功', icon: 'success' });
      setShowCreate(false);
      setRoomName('');
      Taro.navigateTo({ url: `/pages/room/index?id=${roomIdStr}&code=${room.roomCode}` });
    } catch (err) {
      console.error('[Home] handleCreateRoom:', err);
      Taro.showToast({
        title: err instanceof Error ? err.message : '创建失败',
        icon: 'none',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!requireLogin()) return;
    if (!joinCode.trim()) {
      Taro.showToast({ title: '请输入房间号', icon: 'none' });
      return;
    }
    setJoining(true);
    try {
      const room = await roomService.joinRoom(joinCode.trim().toUpperCase());
      const roomIdStr = String(room._id);
      console.log('[Home] 加入成功 roomId:', roomIdStr, 'roomCode:', room.roomCode, 'type:', typeof room._id);
      Taro.showToast({ title: '加入成功', icon: 'success' });
      setShowJoin(false);
      setJoinCode('');
      Taro.navigateTo({ url: `/pages/room/index?id=${roomIdStr}&code=${room.roomCode}` });
    } catch (err) {
      console.error('[Home] handleJoinRoom:', err);
      Taro.showToast({
        title: err instanceof Error ? err.message : '房间不存在',
        icon: 'none',
      });
    } finally {
      setJoining(false);
    }
  };

  const handleInviteFriend = async (friend: Friend) => {
    if (!requireLogin()) return;
    if (invitingOpenids.includes(friend.openid)) return;
    setInvitingOpenids((prev) => [...prev, friend.openid]);
    try {
      const result = await messageService.inviteAndCreateRoom(friend.openid);
      Taro.showToast({ title: '邀请已发送', icon: 'success' });
      const roomIdStr = String(result.roomId);
      Taro.redirectTo({
        url: `/pages/room/index?id=${roomIdStr}&code=${result.roomCode}`,
      });
    } catch (err) {
      console.error('[Home] handleInviteFriend:', err);
      Taro.showToast({
        title: err instanceof Error ? err.message : '邀请失败',
        icon: 'none',
      });
    } finally {
      setInvitingOpenids((prev) => prev.filter((id) => id !== friend.openid));
    }
  };

  const handleRoomClick = (room: Room) => {
    if (room.status === 'playing') {
      Taro.showToast({ title: '游戏已开始', icon: 'none' });
      return;
    }
    if (room.players.length >= room.maxPlayers) {
      Taro.showToast({ title: '房间已满', icon: 'none' });
      return;
    }
    const roomIdStr = String(room._id);
    console.log('[Home] 点击进入房间 roomId:', roomIdStr, 'type:', typeof room._id);
    Taro.navigateTo({ url: `/pages/room/index?id=${roomIdStr}&code=${room.roomCode}` });
  };

  const hour = new Date().getHours();
  const greeting = hour < 6 ? '凌晨好' : hour < 12 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';

  return (
    <View className={styles.container}>
      <View className={styles.header}>
        <View className={styles.greeting}>
          <Text className={styles.greetingText}>{greeting}</Text>
          <Text className={styles.pageTitle}>一起画画 <Text className={styles.sparkle}>✨</Text></Text>
        </View>
        <View className={styles.avatarBtn} onClick={() => Taro.navigateTo({ url: '/pages/mine/index' })}>
          <Text className={styles.avatarText}>{(profile?.nickname || '我').charAt(0)}</Text>
        </View>
      </View>

      <View className={styles.heroCard} onClick={() => { if (requireLogin()) Taro.navigateTo({ url: '/pages/friends/index' }); }}>
        <View className={styles.heroBg}>
          <View className={styles.heroBlob1} />
          <View className={styles.heroBlob2} />
        </View>
        <View className={styles.heroContent}>
          <View className={styles.onlineBadge}>
            <View className={styles.onlineDot} />
            <Text className={styles.onlineText}>
              {friends.filter((f) => f.status === 'online').length} 位好友在线
            </Text>
          </View>
          <Text className={styles.heroTitle}>画出来。</Text>
          <Text className={styles.heroTitle}>猜猜看！</Text>
          <Text className={styles.heroDesc}>邀请一位朋友，一起来一场快速、充满创意的游戏吧！</Text>
          <View className={styles.heroBtn}>
            <Text className={styles.heroBtnText}>寻找朋友</Text>
            <Text className={styles.heroBtnArrow}>→</Text>
          </View>
        </View>
        <View className={styles.heroDoodles}>
          <View className={styles.doodleStar}>✦</View>
          <View className={styles.doodleCircle} />
          <View className={styles.doodleTriangle} />
        </View>
      </View>

      <View className={styles.section}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>你的朋友</Text>
          <Text className={styles.sectionLink} onClick={() => Taro.navigateTo({ url: '/pages/friends/index' })}>查看全部</Text>
        </View>
        <Text className={styles.sectionDesc}>准备开始游戏</Text>

        <View className={styles.friendList}>
          {friends.length === 0 ? (
            <View className={styles.emptyFriends}>
              <Text className={styles.emptyText}>还没有好友，去添加一些吧</Text>
            </View>
          ) : (
            friends.slice(0, 5).map((friend) => {
              const online = friend.status === 'online';
              const inviting = invitingOpenids.includes(friend.openid);
              return (
                <View key={friend.openid} className={styles.friendItem}>
                  <View className={classnames(styles.friendAvatar, online ? styles.avatarGreen : styles.avatarGray)}>
                    <Text className={styles.friendInitial}>{friend.nickname.charAt(0)}</Text>
                    <View className={classnames(styles.statusDot, online ? styles.statusOnline : styles.statusOffline)} />
                  </View>
                  <View className={styles.friendInfo}>
                    <Text className={styles.friendName}>{friend.nickname}</Text>
                    <Text className={styles.friendStatus}>
                      {online ? '在线 · 准备玩游戏' : friend.lastSeen || '离线'}
                    </Text>
                  </View>
                  {online ? (
                    <View
                      className={classnames(styles.friendAction, styles.actionInvite, inviting && styles.actionDisabled)}
                      onClick={() => { if (!inviting) handleInviteFriend(friend); }}
                    >
                      <Text className={styles.actionText}>
                        {inviting ? '邀请中...' : '邀请'}
                      </Text>
                    </View>
                  ) : (
                    <View className={classnames(styles.friendAction, styles.actionOffline)}>
                      <Text className={styles.actionText}>未上线</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </View>

      <View className={styles.section}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>快速开始</Text>
        </View>
        <View className={styles.quickActions}>
          <View className={styles.quickCard} onClick={() => { if (requireLogin()) setShowCreate(true); }}>
            <View className={classnames(styles.quickIcon, styles.createIcon)}>
              <Text className={styles.quickIconEmoji}>🎨</Text>
            </View>
            <Text className={styles.quickTitle}>创建房间</Text>
            <Text className={styles.quickDesc}>邀请好友来玩</Text>
          </View>
          <View className={styles.quickCard} onClick={() => { if (requireLogin()) setShowJoin(true); }}>
            <View className={classnames(styles.quickIcon, styles.joinIcon)}>
              <Text className={styles.quickIconEmoji}>🚪</Text>
            </View>
            <Text className={styles.quickTitle}>加入房间</Text>
            <Text className={styles.quickDesc}>输入房间号</Text>
          </View>
        </View>
      </View>

      {showCreate && (
        <View className={styles.overlay} onClick={() => setShowCreate(false)}>
          <View className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <Text className={styles.modalTitle}>创建房间</Text>
            <View className={styles.inputGroup}>
              <Text className={styles.inputLabel}>房间名称</Text>
              <Input
                className={styles.textInput}
                placeholder="输入房间名称"
                value={roomName}
                maxlength={12}
                onInput={(e) => setRoomName(e.detail.value)}
              />
            </View>
            <View className={styles.inputGroup}>
              <Text className={styles.inputLabel}>游戏回合数</Text>
              <View className={styles.roundSelector}>
                {[1, 3, 5].map((n) => (
                  <View
                    key={n}
                    className={classnames(
                      styles.roundOption,
                      totalRounds === n && styles.roundOptionActive
                    )}
                    onClick={() => setTotalRounds(n)}
                  >
                    <Text
                      className={classnames(
                        styles.roundText,
                        totalRounds === n && styles.roundTextActive
                      )}
                    >
                      {n}回合
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            <View className={styles.inputGroup}>
              <Text className={styles.inputLabel}>每轮时长（秒）</Text>
              <View className={styles.roundSelector}>
                {[30, 60, 90, 120].map((n) => (
                  <View
                    key={n}
                    className={classnames(
                      styles.roundOption,
                      drawSeconds === n && styles.roundOptionActive
                    )}
                    onClick={() => setDrawSeconds(n)}
                  >
                    <Text
                      className={classnames(
                        styles.roundText,
                        drawSeconds === n && styles.roundTextActive
                      )}
                    >
                      {n}秒
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            <View className={styles.inputGroup}>
              <Text className={styles.inputLabel}>最大玩家数</Text>
              <View className={styles.roundSelector}>
                {[2, 4, 6, 8].map((n) => (
                  <View
                    key={n}
                    className={classnames(
                      styles.roundOption,
                      maxPlayers === n && styles.roundOptionActive
                    )}
                    onClick={() => setMaxPlayers(n)}
                  >
                    <Text
                      className={classnames(
                        styles.roundText,
                        maxPlayers === n && styles.roundTextActive
                      )}
                    >
                      {n}人
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            <View className={styles.modalActions}>
              <Button className={styles.cancelBtn} onClick={() => setShowCreate(false)}>
                取消
              </Button>
              <Button
                className={classnames(styles.confirmBtn, creating && styles.confirmBtnDisabled)}
                onClick={handleCreateRoom}
                disabled={creating}
              >
                {creating ? '创建中...' : '创建房间'}
              </Button>
            </View>
          </View>
        </View>
      )}

      {showJoin && (
        <View className={styles.overlay} onClick={() => setShowJoin(false)}>
          <View className={styles.joinModal} onClick={(e) => e.stopPropagation()}>
            <Text className={styles.modalTitle}>加入房间</Text>
            <Input
              className={styles.codeInput}
              placeholder="A8F3K"
              value={joinCode}
              maxlength={5}
              onInput={(e) => setJoinCode(e.detail.value.toUpperCase())}
            />
            <Text className={styles.hint}>请输入 5 位房间号</Text>
            <View className={styles.modalActions}>
              <Button className={styles.cancelBtn} onClick={() => setShowJoin(false)}>
                取消
              </Button>
              <Button
                className={classnames(styles.confirmBtn, joining && styles.confirmBtnDisabled)}
                onClick={handleJoinRoom}
                disabled={joining}
              >
                {joining ? '加入中...' : '加入房间'}
              </Button>
            </View>
          </View>
        </View>
      )}

      <LoginModal visible={showLogin} onClose={() => setShowLogin(false)} />
    </View>
  );
};

export default HomePage;
