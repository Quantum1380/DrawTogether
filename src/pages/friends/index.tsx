import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useRouter, usePullDownRefresh } from '@tarojs/taro';
import classnames from 'classnames';
import { friendService, SearchUser } from '@/services/friendService';
import { messageService } from '@/services/messageService';
import { getSocket } from '@/services/socket';
import type { Friend } from '@/types/user';
import styles from './index.module.scss';

type FilterType = 'all' | 'online' | 'offline';

const FriendsPage: React.FC = () => {
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKey, setSearchKey] = useState('');
  const [searching, setSearching] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const searchTimerRef = useRef<any>(null);
  const [invitingSet, setInvitingSet] = useState<Set<string>>(new Set());
  const [applyingSet, setApplyingSet] = useState<Set<string>>(new Set());

  const isFromRoom = router.params.fromRoom === '1';
  const roomId = router.params.roomId;
  const roomCode = router.params.roomCode;

  /**
   * 加载好友列表
   * @param opts.silent 静默模式：下拉刷新时不切换 loading 状态，避免列表闪一下「加载中...」
   */
  const loadFriends = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const list = await friendService.getFriends();
      setFriends(list);
    } catch (err) {
      console.error('[Friends] loadFriends:', err);
      if (!opts?.silent) setFriends([]);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  // 下拉刷新：静默拉取最新好友列表，完成后停止下拉动画
  usePullDownRefresh(() => {
    (async () => {
      try {
        await loadFriends({ silent: true });
      } catch (err) {
        console.error('[Friends] pullDownRefresh:', err);
      } finally {
        Taro.stopPullDownRefresh();
      }
    })();
  });

  // 监听好友上线/下线事件，实时更新好友列表和搜索结果
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (data: { openid: string; status: string }) => {
      setFriends((prev) =>
        prev.map((f) =>
          f.openid === data.openid ? { ...f, status: data.status as any } : f
        )
      );
      setSearchResults((prev) =>
        prev.map((u) =>
          u.openid === data.openid ? { ...u, status: data.status } : u
        )
      );
    };
    socket.on('user:status-changed', handler);
    return () => {
      socket.off('user:status-changed', handler);
    };
  }, []);

  const handleSearch = useCallback(async (keyword: string) => {
    if (!keyword || keyword.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await friendService.searchUsers(keyword.trim());
      setSearchResults(results);
    } catch (err) {
      console.error('[Friends] searchUsers:', err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearchInput = useCallback((val: string) => {
    setSearchKey(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      handleSearch(val);
    }, 300);
  }, [handleSearch]);

  const handleSyncContacts = () => {
    Taro.navigateTo({ url: '/pages/contacts/index' });
  };

  // 点击「邀请」：自动创建房间 → 发邀请消息 → 跳转到房间页
  const handleInviteFriend = async (friend: Friend | SearchUser, type: 'friend' | 'search') => {
    if (invitingSet.has(friend.openid)) return;
    setInvitingSet(prev => new Set(prev).add(friend.openid));

    try {
      // 统一调用一键邀请接口：自动创建房间 + 发送邀请消息
      const result = await messageService.inviteAndCreateRoom(friend.openid);
      Taro.showToast({ title: 'Invite sent', icon: 'success' });

      // 立即把房主自己带入房间页
      Taro.redirectTo({
        url: `/pages/room/index?id=${result.roomId}&roomCode=${result.roomCode}`,
      });
    } catch (err: any) {
      Taro.showToast({ title: err?.message || 'Invite failed', icon: 'none' });
    } finally {
      setInvitingSet(prev => {
        const next = new Set(prev);
        next.delete(friend.openid);
        return next;
      });
    }
  };

  // 点击「申请」发送好友请求
  const handleSendFriendRequest = async (user: SearchUser) => {
    if (applyingSet.has(user.openid)) return;
    if (user.hasRequested || user.isFriend) return;

    setApplyingSet(prev => new Set(prev).add(user.openid));
    try {
      await friendService.sendFriendRequest(user.openid, '');
      Taro.showToast({ title: 'Request sent', icon: 'success' });
      // 刷新搜索结果状态（或直接本地更新）
      setSearchResults(prev => prev.map(u =>
        u.openid === user.openid ? { ...u, hasRequested: true } : u
      ));
    } catch (err: any) {
      Taro.showToast({ title: err?.message || 'Send failed', icon: 'none' });
    } finally {
      setApplyingSet(prev => {
        const next = new Set(prev);
        next.delete(user.openid);
        return next;
      });
    }
  };

  const onlineCount = friends.filter((f) => f.status === 'online').length;
  const offlineCount = friends.filter((f) => f.status !== 'online').length;
  const isSearching = searchKey.trim().length > 0;

  const filteredFriends = friends.filter((f) => {
    const matchSearch =
      f.nickname.includes(searchKey) || (f.remark || '').includes(searchKey);
    const matchFilter =
      filter === 'all' ||
      (filter === 'online' && f.status === 'online') ||
      (filter === 'offline' && f.status !== 'online');
    return matchSearch && matchFilter;
  });

  const getAvatarColor = (nickname: string) => {
    const colors = [
      ['#86EFAC', '#22C55E'],
      ['#93C5FD', '#3B82F6'],
      ['#FCA5A5', '#EF4444'],
      ['#FDE68A', '#F59E0B'],
      ['#C4B5FD', '#8B5CF6'],
      ['#F9A8D4', '#EC4899'],
      ['#67E8F9', '#06B6D4'],
    ];
    const index = nickname.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <View className={styles.container}>
      <View className={styles.header}>
        <View className={styles.headerTop}>
          <Text className={styles.pageTitle}>Find Friends</Text>
          <View className={styles.settingsBtn} onClick={handleSyncContacts}>
            <Text className={styles.settingsIcon}>⚙️</Text>
          </View>
        </View>

        <View className={styles.searchBar}>
          <Text className={styles.searchIcon}>🔍</Text>
          <input
            className={styles.searchInput}
            placeholder="Search by nickname, phone, or UID"
            value={searchKey}
            onInput={(e) => handleSearchInput((e.target as HTMLInputElement).value)}
          />
          {searchKey.length > 0 && (
            <View
              className={styles.searchClear}
              onClick={() => { setSearchKey(''); setSearchResults([]); }}
            >
              <Text className={styles.searchClearIcon}>✕</Text>
            </View>
          )}
        </View>
      </View>

      {!isSearching && (
        <View className={styles.permissionCard}>
          <View className={styles.permissionIcon}>📖</View>
          <View className={styles.permissionContent}>
            <Text className={styles.permissionTitle}>Play with people you know</Text>
            <Text className={styles.permissionDesc}>
              Allow contacts permission and we'll find friends already on Draw Together.
            </Text>
          </View>
          <View className={styles.permissionBtn} onClick={handleSyncContacts}>
            <Text className={styles.permissionBtnText}>Sync</Text>
          </View>
        </View>
      )}

      {isSearching ? (
        // ====== 搜索结果视图 ======
        <View className={styles.friendList}>
          {searching ? (
            <View className={styles.loadingWrap}>
              <Text className={styles.loadingText}>Searching...</Text>
            </View>
          ) : searchResults.length === 0 ? (
            <View className={styles.emptyState}>
              <Text className={styles.emptyIcon}>🔍</Text>
              <Text className={styles.emptyTitle}>No users found</Text>
              <Text className={styles.emptyDesc}>Try different keywords</Text>
            </View>
          ) : (
            searchResults.map((user) => {
              const [color1, color2] = getAvatarColor(user.nickname || user.openid);

              // 好友 + 在线 → 「邀请」（点击自动创建房间发送邀请）
              // 好友 + 离线 → 「未上线」（不可点击）
              // 非好友 + 已发送申请 → 「已申请」（不可点击）
              // 非好友 + 未申请 → 「申请」（点击发送请求）
              let btnClass = '';
              let btnText = '';
              let disabled = false;
              let handler: () => void = () => {};

              if (user.isFriend) {
                if (user.status === 'online') {
                  btnClass = styles.actionInvite;
                  btnText = invitingSet.has(user.openid) ? 'Creating...' : 'Invite';
                  disabled = invitingSet.has(user.openid);
                  handler = () => handleInviteFriend(user, 'search');
                } else {
                  btnClass = styles.actionOffline;
                  btnText = 'Offline';
                  disabled = true;
                }
              } else {
                if (user.hasRequested) {
                  btnClass = styles.actionApplied;
                  btnText = 'Requested';
                  disabled = true;
                } else {
                  btnClass = styles.actionApply;
                  btnText = applyingSet.has(user.openid) ? 'Sending...' : 'Add';
                  disabled = applyingSet.has(user.openid);
                  handler = () => handleSendFriendRequest(user);
                }
              }

              return (
                <View key={user.openid} className={styles.friendItem}>
                  <View className={styles.friendAvatarWrap}>
                    <View
                      className={styles.friendAvatar}
                      style={{ background: `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)` }}
                    >
                      <Text className={styles.friendInitial}>
                        {(user.nickname || user.openid).charAt(0)}
                      </Text>
                    </View>
                    <View
                      className={classnames(
                        styles.statusDot,
                        user.status === 'online' ? styles.statusOnline : styles.statusOffline
                      )}
                    />
                  </View>
                  <View className={styles.friendInfo}>
                    <Text className={styles.friendName}>{user.nickname || user.openid}</Text>
                    <Text className={styles.friendSource}>
                      @{user.openid}
                      {user.phone ? ` · ${user.phone}` : ''}
                    </Text>
                  </View>
                  <View
                    className={classnames(
                      styles.friendAction,
                      btnClass,
                      disabled && styles.actionDisabled
                    )}
                    onClick={() => { if (!disabled) handler(); }}
                  >
                    <Text className={styles.actionText}>{btnText}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      ) : (
        // ====== 好友列表视图 ======
        <>
          <View className={styles.filterTabs}>
            {([
              { key: 'all', label: 'All', count: friends.length },
              { key: 'online', label: 'Online', count: onlineCount },
              { key: 'offline', label: 'Offline', count: offlineCount },
            ] as { key: FilterType; label: string; count: number }[]).map((t) => (
              <View
                key={t.key}
                className={classnames(styles.filterTab, filter === t.key && styles.filterTabActive)}
                onClick={() => setFilter(t.key)}
              >
                <Text className={classnames(styles.filterTabText, filter === t.key && styles.filterTabTextActive)}>
                  {t.label}
                </Text>
                <Text className={classnames(styles.filterCount, filter === t.key && styles.filterCountActive)}>
                  {t.count}
                </Text>
              </View>
            ))}
          </View>

          {isFromRoom && (
            <View className={styles.inviteBanner}>
              <Text className={styles.inviteBannerText}>
                Tap the button on the right of a friend to invite them to room {roomCode}
              </Text>
            </View>
          )}

          <View className={styles.friendList}>
            {loading ? (
              <View className={styles.loadingWrap}>
                <Text className={styles.loadingText}>Loading...</Text>
              </View>
            ) : filteredFriends.length === 0 ? (
              <View className={styles.emptyState}>
                <Text className={styles.emptyIcon}>👥</Text>
                <Text className={styles.emptyTitle}>No friends yet</Text>
                <Text className={styles.emptyDesc}>Sync friends from contacts</Text>
              </View>
            ) : (
              filteredFriends.map((friend) => {
                const [color1, color2] = getAvatarColor(friend.nickname);

                // 好友列表按钮：
                // - 在线：「邀请」(一键创建房间 + 发邀请消息 → 直接跳转到房间)
                // - 离线：「未上线」(不可点击)
                const online = friend.status === 'online';
                const inv = invitingSet.has(friend.openid);
                return (
                  <View key={friend.openid} className={styles.friendItem}>
                    <View className={styles.friendAvatarWrap}>
                      <View
                        className={styles.friendAvatar}
                        style={{ background: `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)` }}
                      >
                        <Text className={styles.friendInitial}>{friend.nickname.charAt(0)}</Text>
                      </View>
                      <View
                        className={classnames(
                          styles.statusDot,
                          online ? styles.statusOnline : styles.statusOffline
                        )}
                      />
                    </View>
                    <View className={styles.friendInfo}>
                      <Text className={styles.friendName}>{friend.nickname}</Text>
                      <Text className={styles.friendSource}>
                        {friend.source === 'contacts' ? 'From your contacts' : 'Added via search'}
                        {friend.lastSeen ? ` · ${friend.lastSeen}` : ''}
                      </Text>
                    </View>
                    <View
                      className={classnames(
                        styles.friendAction,
                        online
                          ? (inv ? styles.actionCreating : styles.actionInvite)
                          : styles.actionOffline,
                        (!online || inv) && styles.actionDisabled
                      )}
                      onClick={() => { if (online && !inv) handleInviteFriend(friend, 'friend'); }}
                    >
                      <Text
                        className={classnames(
                          styles.actionText,
                          !online && styles.actionTextDisabled
                        )}
                      >
                        {online ? (inv ? 'Creating...' : 'Invite') : 'Offline'}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          <View className={styles.addFriendBtn} onClick={handleSyncContacts}>
            <Text className={styles.addFriendText}>+ Add Friend</Text>
          </View>
        </>
      )}
    </View>
  );
};

export default FriendsPage;
