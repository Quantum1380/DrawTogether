import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Button, Input, ScrollView } from '@tarojs/components';
import Taro, { usePullDownRefresh } from '@tarojs/taro';
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

  const loadRooms = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const list = await roomService.getRooms();
      setRooms(list);
    } catch (err) {
      console.error('[Home] loadRooms:', err);
    } finally {
      if (!opts?.silent) setLoading(false);
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

  // 下拉刷新：静默拉取最新房间和好友列表
  usePullDownRefresh(() => {
    (async () => {
      try {
        const tasks: Promise<any>[] = [loadRooms({ silent: true })];
        if (authService.isLoggedIn()) {
          tasks.push(loadFriends());
        }
        await Promise.all(tasks);
      } catch (err) {
        console.error('[Home] pullDownRefresh:', err);
      } finally {
        Taro.stopPullDownRefresh();
      }
    })();
  });

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
      Taro.showToast({ title: 'Please enter a room name', icon: 'none' });
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
      Taro.showToast({ title: 'Created successfully', icon: 'success' });
      setShowCreate(false);
      setRoomName('');
      Taro.navigateTo({ url: `/pages/room/index?id=${roomIdStr}&code=${room.roomCode}` });
    } catch (err) {
      console.error('[Home] handleCreateRoom:', err);
      Taro.showToast({
        title: err instanceof Error ? err.message : 'Create failed',
        icon: 'none',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!requireLogin()) return;
    if (!joinCode.trim()) {
      Taro.showToast({ title: 'Please enter room code', icon: 'none' });
      return;
    }
    setJoining(true);
    try {
      const room = await roomService.joinRoom(joinCode.trim().toUpperCase());
      const roomIdStr = String(room._id);
      console.log('[Home] 加入成功 roomId:', roomIdStr, 'roomCode:', room.roomCode, 'type:', typeof room._id);
      Taro.showToast({ title: 'Joined successfully', icon: 'success' });
      setShowJoin(false);
      setJoinCode('');
      Taro.navigateTo({ url: `/pages/room/index?id=${roomIdStr}&code=${room.roomCode}` });
    } catch (err) {
      console.error('[Home] handleJoinRoom:', err);
      Taro.showToast({
        title: err instanceof Error ? err.message : "Room doesn't exist",
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
      Taro.showToast({ title: 'Invite sent', icon: 'success' });
      const roomIdStr = String(result.roomId);
      Taro.redirectTo({
        url: `/pages/room/index?id=${roomIdStr}&code=${result.roomCode}`,
      });
    } catch (err) {
      console.error('[Home] handleInviteFriend:', err);
      Taro.showToast({
        title: err instanceof Error ? err.message : 'Invite failed',
        icon: 'none',
      });
    } finally {
      setInvitingOpenids((prev) => prev.filter((id) => id !== friend.openid));
    }
  };

  const handleRoomClick = (room: Room) => {
    if (room.status === 'playing') {
      Taro.showToast({ title: 'Game has started', icon: 'none' });
      return;
    }
    if (room.players.length >= room.maxPlayers) {
      Taro.showToast({ title: 'Room is full', icon: 'none' });
      return;
    }
    const roomIdStr = String(room._id);
    console.log('[Home] 点击进入房间 roomId:', roomIdStr, 'type:', typeof room._id);
    Taro.navigateTo({ url: `/pages/room/index?id=${roomIdStr}&code=${room.roomCode}` });
  };

  const hour = new Date().getHours();
  const greeting = hour < 6 ? 'Late night' : hour < 12 ? 'Good morning' : hour < 14 ? 'Good afternoon' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <View className={styles.container}>
      <View className={styles.header}>
        <View className={styles.greeting}>
          <Text className={styles.greetingText}>{greeting}</Text>
          <Text className={styles.pageTitle}>Draw Together <Text className={styles.sparkle}>✨</Text></Text>
        </View>
        <View className={styles.avatarBtn} onClick={() => Taro.navigateTo({ url: '/pages/mine/index' })}>
          <Text className={styles.avatarText}>{(profile?.nickname || 'Me').charAt(0)}</Text>
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
              {friends.filter((f) => f.status === 'online').length} friends online
            </Text>
          </View>
          <Text className={styles.heroTitle}>Draw it.</Text>
          <Text className={styles.heroTitle}>Guess it!</Text>
          <Text className={styles.heroDesc}>Invite a friend for a quick, creative game!</Text>
          <View className={styles.heroBtn}>
            <Text className={styles.heroBtnText}>Find Friends</Text>
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
          <Text className={styles.sectionTitle}>Your Friends</Text>
          <Text className={styles.sectionLink} onClick={() => Taro.navigateTo({ url: '/pages/friends/index' })}>View All</Text>
        </View>
        <Text className={styles.sectionDesc}>Ready to play</Text>

        <View className={styles.friendList}>
          {friends.length === 0 ? (
            <View className={styles.emptyFriends}>
              <Text className={styles.emptyText}>No friends yet, go add some</Text>
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
                      {online ? 'Online · Ready to play' : friend.lastSeen || 'Offline'}
                    </Text>
                  </View>
                  {online ? (
                    <View
                      className={classnames(styles.friendAction, styles.actionInvite, inviting && styles.actionDisabled)}
                      onClick={() => { if (!inviting) handleInviteFriend(friend); }}
                    >
                      <Text className={styles.actionText}>
                        {inviting ? 'Inviting...' : 'Invite'}
                      </Text>
                    </View>
                  ) : (
                    <View className={classnames(styles.friendAction, styles.actionOffline)}>
                      <Text className={styles.actionText}>Offline</Text>
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
          <Text className={styles.sectionTitle}>Quick Start</Text>
        </View>
        <View className={styles.quickActions}>
          <View className={styles.quickCard} onClick={() => { if (requireLogin()) setShowCreate(true); }}>
            <View className={classnames(styles.quickIcon, styles.createIcon)}>
              <Text className={styles.quickIconEmoji}>🎨</Text>
            </View>
            <Text className={styles.quickTitle}>Create Room</Text>
            <Text className={styles.quickDesc}>Invite friends to play</Text>
          </View>
          <View className={styles.quickCard} onClick={() => { if (requireLogin()) setShowJoin(true); }}>
            <View className={classnames(styles.quickIcon, styles.joinIcon)}>
              <Text className={styles.quickIconEmoji}>🚪</Text>
            </View>
            <Text className={styles.quickTitle}>Join Room</Text>
            <Text className={styles.quickDesc}>Enter room code</Text>
          </View>
        </View>
      </View>

      {showCreate && (
        <View className={styles.overlay} onClick={() => setShowCreate(false)}>
          <View className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <Text className={styles.modalTitle}>Create Room</Text>
            <View className={styles.inputGroup}>
              <Text className={styles.inputLabel}>Room Name</Text>
              <Input
                className={styles.textInput}
                placeholder="Enter room name"
                value={roomName}
                maxlength={12}
                onInput={(e) => setRoomName(e.detail.value)}
              />
            </View>
            <View className={styles.inputGroup}>
              <Text className={styles.inputLabel}>Rounds</Text>
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
                      {n} Rounds
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            <View className={styles.inputGroup}>
              <Text className={styles.inputLabel}>Seconds per Round</Text>
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
                      {n}s
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            <View className={styles.inputGroup}>
              <Text className={styles.inputLabel}>Max Players</Text>
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
                      {n} players
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            <View className={styles.modalActions}>
              <Button className={styles.cancelBtn} onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                className={classnames(styles.confirmBtn, creating && styles.confirmBtnDisabled)}
                onClick={handleCreateRoom}
                disabled={creating}
              >
                {creating ? 'Creating...' : 'Create Room'}
              </Button>
            </View>
          </View>
        </View>
      )}

      {showJoin && (
        <View className={styles.overlay} onClick={() => setShowJoin(false)}>
          <View className={styles.joinModal} onClick={(e) => e.stopPropagation()}>
            <Text className={styles.modalTitle}>Join Room</Text>
            <Input
              className={styles.codeInput}
              placeholder="A8F3K"
              value={joinCode}
              maxlength={5}
              onInput={(e) => setJoinCode(e.detail.value.toUpperCase())}
            />
            <Text className={styles.hint}>Please enter a 5-digit room code</Text>
            <View className={styles.modalActions}>
              <Button className={styles.cancelBtn} onClick={() => setShowJoin(false)}>
                Cancel
              </Button>
              <Button
                className={classnames(styles.confirmBtn, joining && styles.confirmBtnDisabled)}
                onClick={handleJoinRoom}
                disabled={joining}
              >
                {joining ? 'Joining...' : 'Join Room'}
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
