import React from 'react';
import { View, Text, Button } from '@tarojs/components';
import classnames from 'classnames';
import type { Friend } from '@/types/user';
import Avatar from '@/components/Avatar';
import styles from './index.module.scss';

interface FriendItemProps {
  friend: Friend;
  onInvite?: (friend: Friend) => void;
  showInvite?: boolean;
}

const statusText: Record<string, string> = {
  online: 'Online',
  offline: 'Offline',
  busy: 'In Game',
};

const FriendItem: React.FC<FriendItemProps> = ({ friend, onInvite, showInvite = true }) => {
  const canInvite = friend.status === 'online' && showInvite;

  return (
    <View className={styles.item}>
      <Avatar src={friend.avatar} nickname={friend.nickname} size={88} status={friend.status} />
      <View className={styles.info}>
        <View className={styles.nameRow}>
          <Text className={styles.name}>{friend.remark || friend.nickname}</Text>
          <Text
            className={classnames(
              styles.statusText,
              friend.status === 'online' && styles.online,
              friend.status === 'offline' && styles.offline,
              friend.status === 'busy' && styles.busy
            )}
          >
            {statusText[friend.status] || 'Offline'}
          </Text>
        </View>
        <Text className={styles.stats}>
          Played {friend.gamesPlayed} games · Won {friend.gamesWon}
        </Text>
      </View>
      {canInvite ? (
        <Button
          className={styles.inviteBtn}
          onClick={() => onInvite?.(friend)}
        >
          Invite
        </Button>
      ) : friend.status === 'busy' ? (
        <View className={styles.busyTag}>
          <Text className={styles.busyText}>Busy</Text>
        </View>
      ) : null}
    </View>
  );
};

export default FriendItem;
