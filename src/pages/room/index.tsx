import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import classnames from 'classnames';
import { roomService } from '@/services/roomService';
import { connectSocket, getSocket } from '@/services/socket';
import { useUserStore } from '@/store/userStore';
import type { Room } from '@/types/room';
import PlayerSlot from '@/components/PlayerSlot';
import InviteModal from '@/components/InviteModal';
import styles from './index.module.scss';

const ROUND_OPTIONS = [1, 3, 5, 8, 10, 15, 20];
const SECOND_OPTIONS = [30, 45, 60, 90, 120, 180];
const MAXPLAYER_OPTIONS = [2, 3, 4, 5, 6, 8, 10];

const RoomPage: React.FC = () => {
  const router = useRouter();
  const params = router.params;
  const roomId = (params?.id as string) || (params?.roomId as string) || '';
  const roomCode = (params?.code as string) || (params?.roomCode as string) || '';
  const { profile } = useUserStore();

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [starting, setStarting] = useState(false);

  // 房间设置弹窗
  const [showSettings, setShowSettings] = useState(false);
  const [settName, setSettName] = useState('');
  const [settRounds, setSettRounds] = useState<number>(3);
  const [settSeconds, setSettSeconds] = useState<number>(60);
  const [settMax, setSettMax] = useState<number>(6);
  const [savingSettings, setSavingSettings] = useState(false);

  // 离开房间确认弹窗
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // 防止房主在 HTTP 成功跳转后，又收到 game:started socket 回声导致重复跳转
  const navigatedRef = useRef(false);

  // 页面每次显示时重置跳转守卫。
  // 关键场景：游戏结束 navigateBack 回房间页后，navigatedRef.current 还是 true，
  // 会导致第二次开始游戏时 onGameStarted -> navigateToGame 直接 return 不跳转。
  // useDidShow 在 navigateBack 回到页面时也会触发，确保 ref 被重置。
  useDidShow(() => {
    navigatedRef.current = false;
  });

  // 跳转到游戏页：房主与猜词玩家复用同一逻辑
  const navigateToGame = useCallback((room: Room) => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    Taro.navigateTo({
      url: `/pages/game/index?id=${room._id}&word=${encodeURIComponent(room.currentWord || '')}&drawer=${room.currentDrawer || ''}`,
    });
  }, []);

  const loadRoom = useCallback(async () => {
    if (!roomId) {
      setErrorMsg('Missing room parameter');
      setLoading(false);
      return;
    }
    try {
      console.log('[Room] 加载房间 roomId:', roomId, '请求路径:', `rooms/${roomId}`);
      let data = await roomService.getRoomById(roomId);
      console.log('[Room] 加载成功:', data);

      // 兜底：如果当前用户不在玩家列表里（例如从邀请链接直接进入），
      // 自动调用 joinRoom 把自己加入房间。后端幂等，已加入会直接返回。
      const meInRoom = data.players.some((p: any) => p.openid === profile?.openid);
      if (!meInRoom && data.status === 'waiting' && roomCode && profile?.openid) {
        try {
          data = await roomService.joinRoom(roomCode);
        } catch (e) {
          // joinRoom 失败（房间已开始/已满）不阻断渲染，直接展示当前房间数据
          console.warn('[Room] auto joinRoom failed:', e);
        }
      }

      setRoom(data);
      setErrorMsg('');
      // 轮询兜底：房间已进入 playing 但本地尚未跳转（例如 socket 未连上/未加入房间）
      if (data.status === 'playing' && !navigatedRef.current) {
        navigateToGame(data);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Load failed';
      console.error('[Room] loadRoom 失败:', msg, err);
      // 接口返回了非 0 码（如"房间不存在"），这里直接显示后端的错误
      setErrorMsg(msg);
      setRoom(null);
    } finally {
      setLoading(false);
    }
  }, [roomId, roomCode, profile?.openid, navigateToGame]);

  // 进入房间页后加入 socket 房间，监听房间状态变化与游戏开始事件
  // 同时启用轮询兜底：APK + cpolar 环境下 WebSocket 可能不稳定，
  // socket 失败时其他玩家也能通过轮询发现游戏开始并跳转
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;

    const onGameStarted = (data: Room) => {
      if (cancelled) return;
      console.log('[Room] 收到 game:started', data);
      navigateToGame(data);
    };
    const onRoomUpdated = (data: Room) => {
      if (cancelled) return;
      // 房间状态实时刷新（有人加入/离开/准备等）
      setRoom(data);
      if (data.status === 'playing' && !navigatedRef.current) {
        navigateToGame(data);
      }
    };

    (async () => {
      const s = await connectSocket();
      if (cancelled || !s) return;
      s.emit('room:join', roomId);
      s.on('game:started', onGameStarted);
      s.on('room:updated', onRoomUpdated);
    })();

    // 轮询兜底：每 3 秒拉一次房间状态。
    // socket 正常时 navigatedRef 会快速置 true，轮询的跳转会被守卫挡住，不会重复跳；
    // socket 异常时这是其他玩家进入游戏的唯一通路。
    const pollTimer = setInterval(async () => {
      if (cancelled || navigatedRef.current) return;
      try {
        const data = await roomService.getRoomById(roomId);
        if (cancelled) return;
        setRoom(data);
        if (data.status === 'playing' && !navigatedRef.current) {
          console.log('[Room] 轮询发现游戏已开始，兜底跳转');
          navigateToGame(data);
        }
      } catch (e) {
        // 轮询失败不中断，下个 tick 继续
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(pollTimer);
      const s = getSocket();
      if (s) {
        s.off('game:started', onGameStarted);
        s.off('room:updated', onRoomUpdated);
        s.emit('room:leave', roomId);
      }
    };
  }, [roomId, navigateToGame]);

  // 首次加载房间数据，后续更新全部依赖 Socket.io room:updated 实时同步
  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  const handleCopyCode = () => {
    Taro.setClipboardData({ data: roomCode });
  };

  const handleInvite = () => {
    setShowInviteModal(true);
  };

  const handleOpenSettings = () => {
    if (!room) return;
    setSettName(room.name);
    setSettRounds(room.totalRounds);
    setSettSeconds(typeof room.drawSeconds === 'number' ? room.drawSeconds : 60);
    setSettMax(room.maxPlayers);
    setShowSettings(true);
  };

  const handleSaveSettings = async () => {
    if (!room) return;
    setSavingSettings(true);
    try {
      const updated = await roomService.updateSettings({
        roomId: room._id,
        name: settName,
        maxPlayers: settMax,
        totalRounds: settRounds,
        drawSeconds: settSeconds,
      });
      setRoom(updated);
      setShowSettings(false);
      Taro.showToast({ title: 'Saved', icon: 'success' });
    } catch (err: any) {
      Taro.showToast({ title: err?.message || 'Save failed', icon: 'none' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggleReady = async () => {
    if (!room) return;
    try {
      const updated = await roomService.toggleReady(room._id);
      setRoom(updated);
    } catch (err) {
      Taro.showToast({ title: 'Operation failed', icon: 'none' });
    }
  };

  const handleStartGame = async () => {
    if (!room) return;
    const allReady = room.players.every((p) => p.isReady || p.isOwner);
    if (!allReady) {
      Taro.showToast({ title: 'Some players are not ready', icon: 'none' });
      return;
    }
    if (room.players.length < 2) {
      Taro.showToast({ title: 'At least 2 players required', icon: 'none' });
      return;
    }
    // 关键：重置跳转守卫，否则上一局游戏结束后 navigateBack 回到房间页，
    // navigatedRef.current 还是 true，第二次开始游戏时 navigateToGame 会直接 return 不跳转
    navigatedRef.current = false;
    setStarting(true);
    try {
      const updated = await roomService.startGame(room._id);
      // 房主直接跳转；复用 navigateToGame 的 ref 守卫，
      // 避免与服务端广播的 game:started 回声造成重复跳转
      navigateToGame(updated);
    } catch (err) {
      Taro.showToast({ title: 'Start failed', icon: 'none' });
    } finally {
      setStarting(false);
    }
  };

  const handleLeaveRoom = () => {
    setShowLeaveModal(true);
  };

  const confirmLeaveRoom = async () => {
    if (!room || leaving) return;
    setLeaving(true);
    try {
      await roomService.leaveRoom(room._id);
    } catch (err) {
      console.warn('[Room] leaveRoom error:', err);
      // 即使后端报错也继续跳转，反正房间数据会在 socket disconnect 时被清理
    } finally {
      setLeaving(false);
      setShowLeaveModal(false);
      // 关键：从消息页/通讯录/好友页通过 redirectTo 进入时，navigateBack 没有上一页会失败，
      // 此时回退到首页 tab，确保一定能离开房间页
      const pages = Taro.getCurrentPages();
      if (pages.length > 1) {
        Taro.navigateBack();
      } else {
        Taro.switchTab({ url: '/pages/index/index' });
      }
    }
  };

  if (loading) {
    return (
      <View className={styles.loadingWrap}>
        <Text className={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!room) {
    return (
      <View className={styles.loadingWrap}>
        <Text className={styles.loadingText}>
          {errorMsg || "Room doesn't exist"}
        </Text>
        {errorMsg && (
          <View style={{ marginTop: 24 }}>
            <Button
              className={styles.startBtn}
              onClick={() => Taro.navigateBack()}
            >
              Back
            </Button>
          </View>
        )}
      </View>
    );
  }

  const isOwner = room.owner === profile?.openid;
  const currentPlayer = room.players.find((p) => p.openid === profile?.openid);
  const allReady = room.players.every((p) => p.isReady || p.isOwner);
  const canStart = isOwner && allReady && room.players.length >= 2;

  // 补齐空位
  const slots = [...room.players];
  for (let i = slots.length; i < room.maxPlayers; i++) {
    slots.push(undefined);
  }

  return (
    <View className={styles.container}>
      {/* 房间头部 */}
      <View className={styles.roomHeader}>
        <View className={styles.roomNameRow}>
          <Text className={styles.roomName}>{room.name}</Text>
          <View className={styles.roomNameRight}>
            <View className={styles.roomStatus}>
              <Text className={styles.roomStatusText}>
                {room.status === 'waiting' ? 'Waiting' : room.status === 'playing' ? 'In Game' : 'Ended'}
              </Text>
            </View>
            {isOwner && room.status === 'waiting' && (
              <View className={styles.settingsGear} onClick={handleOpenSettings}>
                <Text className={styles.settingsGearText}>⚙️</Text>
              </View>
            )}
          </View>
        </View>
        <View className={styles.roomCodeCard}>
          <View>
            <Text className={styles.roomCodeLabel}>Room Code</Text>
            <Text className={styles.roomCodeValue}>{room.roomCode}</Text>
          </View>
          <Button className={styles.copyBtn} onClick={handleCopyCode}>
            <Text className={styles.copyBtnText}>Copy</Text>
          </Button>
        </View>
      </View>

      {/* 玩家列表 */}
      <Text className={styles.sectionTitle}>
        Players ({room.players.length}/{room.maxPlayers})
      </Text>
      <View className={styles.playerGrid}>
        {slots.map((player, idx) => (
          <View key={player?.openid || `empty-${idx}`} className={styles.playerSlot}>
            <PlayerSlot
              player={player}
              isOwner={player?.isOwner}
              currentDrawer={room.currentDrawer}
            />
          </View>
        ))}
      </View>

      {/* 游戏信息 */}
      <View className={styles.gameInfo}>
        <View className={styles.infoRow}>
          <Text className={styles.infoLabel}>Rounds</Text>
          <Text className={styles.infoValue}>{room.totalRounds} Rounds</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.infoLabel}>Time per Round</Text>
          <Text className={styles.infoValue}>{typeof room.drawSeconds === 'number' ? room.drawSeconds : 60} sec</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.infoLabel}>Host</Text>
          <Text className={styles.infoValue}>{room.ownerNickname}</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.infoLabel}>Status</Text>
          <Text className={styles.infoValue}>
            {allReady ? 'All ready' : 'Waiting for players to get ready'}
          </Text>
        </View>
      </View>

      {/* 玩法说明 */}
      <View className={styles.wordHint}>
        <Text className={styles.wordHintText}>
          🎨 How to play: After the host starts the game, one player draws each round while the others guess in the chat. The faster you guess, the more points you get!
        </Text>
      </View>

      {/* 底部操作栏 */}
      <View className={styles.bottomBar}>
        <Button className={styles.leaveBtn} onClick={handleLeaveRoom}>
          <Text className={styles.leaveBtnText}>Leave</Text>
        </Button>
        <Button className={styles.inviteBtn} onClick={handleInvite}>
          <Text className={styles.inviteBtnText}>👥 Invite</Text>
        </Button>
        {isOwner ? (
          <Button
            className={classnames(styles.startBtn, !canStart && styles.startBtnDisabled)}
            onClick={handleStartGame}
            disabled={!canStart || starting}
          >
            {starting ? 'Starting...' : 'Start Game'}
          </Button>
        ) : (
          <Button
            className={classnames(
              styles.readyBtn,
              currentPlayer?.isReady && styles.startBtnDisabled
            )}
            onClick={handleToggleReady}
          >
            {currentPlayer?.isReady ? 'Ready' : 'Ready'}
          </Button>
        )}
      </View>

      {/* 邀请好友弹窗 */}
      <InviteModal
        visible={showInviteModal}
        roomId={room._id}
        roomCode={room.roomCode}
        onClose={() => setShowInviteModal(false)}
      />

      {/* 房间设置弹窗（仅房主 waiting 状态下可调出） */}
      {showSettings && (
        <View className={styles.modalMask} onClick={() => setShowSettings(false)}>
          <View className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <Text className={styles.modalTitle}>Room Settings</Text>

            {/* 房间名 */}
            <View className={styles.modalField}>
              <Text className={styles.modalFieldLabel}>Room Name</Text>
              <input
                className={styles.modalInput}
                value={settName}
                placeholder="Enter room name"
                maxLength={24}
                onInput={(e) => setSettName((e.target as HTMLInputElement).value)}
              />
            </View>

            {/* 回合数 */}
            <View className={styles.modalField}>
              <Text className={styles.modalFieldLabel}>Rounds</Text>
              <View className={styles.optionRow}>
                {ROUND_OPTIONS.map((n) => (
                  <View
                    key={n}
                    className={classnames(
                      styles.optionChip,
                      settRounds === n && styles.optionChipActive
                    )}
                    onClick={() => setSettRounds(n)}
                  >
                    <Text className={settRounds === n ? styles.optionChipTextActive : styles.optionChipText}>
                      {n}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 每轮时长 */}
            <View className={styles.modalField}>
              <Text className={styles.modalFieldLabel}>Time per Round (sec)</Text>
              <View className={styles.optionRow}>
                {SECOND_OPTIONS.map((n) => (
                  <View
                    key={n}
                    className={classnames(
                      styles.optionChip,
                      settSeconds === n && styles.optionChipActive
                    )}
                    onClick={() => setSettSeconds(n)}
                  >
                    <Text className={settSeconds === n ? styles.optionChipTextActive : styles.optionChipText}>
                      {n}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 最大玩家数 */}
            <View className={styles.modalField}>
              <Text className={styles.modalFieldLabel}>Max Players</Text>
              <View className={styles.optionRow}>
                {MAXPLAYER_OPTIONS.map((n) => {
                  const disabled = n < (room?.players.length || 1);
                  return (
                    <View
                      key={n}
                      className={classnames(
                        styles.optionChip,
                        settMax === n && styles.optionChipActive,
                        disabled && styles.optionChipDisabled
                      )}
                      onClick={() => { if (!disabled) setSettMax(n); }}
                    >
                      <Text
                        className={classnames(
                          settMax === n ? styles.optionChipTextActive : styles.optionChipText,
                          disabled && styles.optionChipTextDisabled
                        )}
                      >
                        {n}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <Text className={styles.modalHint}>Options less than current player count ({room?.players.length || 0}) are unavailable</Text>
            </View>

            {/* 操作按钮 */}
            <View className={styles.modalActions}>
              <View
                className={classnames(styles.modalBtn, styles.modalBtnCancel)}
                onClick={() => setShowSettings(false)}
              >
                <Text className={styles.modalBtnCancelText}>Cancel</Text>
              </View>
              <View
                className={classnames(
                  styles.modalBtn,
                  styles.modalBtnConfirm,
                  savingSettings && styles.modalBtnDisabled
                )}
                onClick={() => { if (!savingSettings) handleSaveSettings(); }}
              >
                <Text className={styles.modalBtnConfirmText}>
                  {savingSettings ? 'Saving...' : 'Save'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 离开房间确认弹窗 */}
      {showLeaveModal && (
        <View className={styles.modalMask} onClick={() => { if (!leaving) setShowLeaveModal(false); }}>
          <View className={classnames(styles.modalCard, styles.leaveModalCard)} onClick={(e) => e.stopPropagation()}>
            <Text className={styles.modalTitle}>Leave Room</Text>
            <Text className={styles.modalText}>
              {room?.owner === profile?.openid
                ? 'If you leave, host will transfer to a remaining player. Are you sure you want to leave?'
                : 'Are you sure you want to leave the room?'}
            </Text>
            <View className={styles.modalActions}>
              <View
                className={classnames(styles.modalBtn, styles.modalBtnCancel, leaving && styles.modalBtnDisabled)}
                onClick={() => { if (!leaving) setShowLeaveModal(false); }}
              >
                <Text className={styles.modalBtnCancelText}>Cancel</Text>
              </View>
              <View
                className={classnames(
                  styles.modalBtn,
                  styles.modalBtnDanger,
                  leaving && styles.modalBtnDisabled
                )}
                onClick={() => { if (!leaving) confirmLeaveRoom(); }}
              >
                <Text className={styles.modalBtnConfirmText}>
                  {leaving ? 'Leaving...' : 'Leave'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default RoomPage;
