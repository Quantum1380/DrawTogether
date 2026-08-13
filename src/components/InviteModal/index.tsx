import React, { useState, useEffect } from 'react';
import { View, Text, Button, ScrollView, Input } from '@tarojs/components';
import classnames from 'classnames';
import type { Friend } from '@/types/user';
import { friendService } from '@/services/friendService';
import Avatar from '@/components/Avatar';
import EmptyState from '@/components/EmptyState';
import styles from './index.module.scss';

interface InviteModalProps {
  visible: boolean;
  roomCode?: string;
  roomId?: string;
  onClose?: () => void;
  onInvite?: (friend: Friend) => void;
}

const InviteModal: React.FC<InviteModalProps> = ({ visible, roomCode, roomId, onClose, onInvite }) => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchKey, setSearchKey] = useState('');
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) {
      loadFriends();
      setInvitedIds(new Set());
      setSearchKey('');
    }
  }, [visible]);

  const loadFriends = async () => {
    setLoading(true);
    try {
      const list = await friendService.getFriends();
      setFriends(list);
    } catch (err) {
      console.error('[InviteModal] loadFriends:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = (friend: Friend) => {
    if (invitedIds.has(friend.openid)) return;
    setInvitedIds((prev) => new Set(prev).add(friend.openid));
    onInvite?.(friend);
  };

  const filteredFriends = friends.filter(
    (f) => f.nickname.includes(searchKey) || (f.remark || '').includes(searchKey)
  );

  if (!visible) return null;

  return (
    <View className={styles.overlay} onClick={onClose}>
      <View className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <View className={styles.header}>
          <Text className={styles.title}>Invite Friends</Text>
          {roomCode && <Text className={styles.roomCode}>Room Code: {roomCode}</Text>}
          <View className={styles.closeBtn} onClick={onClose}>
            <Text className={styles.closeIcon}>✕</Text>
          </View>
        </View>

        <View className={styles.searchBar}>
          <Input
            className={styles.searchInput}
            placeholder="Search friends by nickname"
            value={searchKey}
            onInput={(e) => setSearchKey(e.detail.value)}
          />
        </View>

        <ScrollView scrollY className={styles.friendList}>
          {loading ? (
            <View className={styles.loadingWrap}>
              <Text className={styles.loadingText}>Loading...</Text>
            </View>
          ) : filteredFriends.length === 0 ? (
            <EmptyState icon="🔍" title="No friends found" desc="Add more friends in your contacts" />
          ) : (
            filteredFriends.map((friend) => (
              <View key={friend.openid} className={styles.friendRow}>
                <Avatar src={friend.avatar} nickname={friend.nickname} size={72} status={friend.status} />
                <View className={styles.friendInfo}>
                  <Text className={styles.friendName}>{friend.remark || friend.nickname}</Text>
                  <Text
                    className={classnames(
                      styles.friendStatus,
                      friend.status === 'online' && styles.online,
                      friend.status === 'offline' && styles.offline,
                      friend.status === 'busy' && styles.busyStatus
                    )}
                  >
                    {friend.status === 'online' ? 'Online' : friend.status === 'busy' ? 'In Game' : 'Offline'}
                  </Text>
                </View>
                <Button
                  className={classnames(
                    styles.inviteBtn,
                    (friend.status !== 'online' || invitedIds.has(friend.openid)) && styles.disabled
                  )}
                  disabled={friend.status !== 'online' || invitedIds.has(friend.openid)}
                  onClick={() => handleInvite(friend)}
                >
                  <Text className={styles.inviteBtnText}>
                    {invitedIds.has(friend.openid) ? 'Invited' : 'Invite'}
                  </Text>
                </Button>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
};

export default InviteModal;
