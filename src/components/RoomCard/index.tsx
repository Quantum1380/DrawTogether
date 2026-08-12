import React from 'react';
import { View, Text } from '@tarojs/components';
import classnames from 'classnames';
import type { Room } from '@/types/room';
import Avatar from '@/components/Avatar';
import styles from './index.module.scss';

interface RoomCardProps {
  room: Room;
  onClick?: (room: Room) => void;
}

const RoomCard: React.FC<RoomCardProps> = ({ room, onClick }) => {
  const playerCount = room.players.length;
  const isFull = playerCount >= room.maxPlayers;
  const isPlaying = room.status === 'playing';

  return (
    <View
      className={classnames(styles.card, isPlaying && styles.playing)}
      onClick={() => onClick?.(room)}
    >
      <View className={styles.header}>
        <View className={styles.titleRow}>
          <Text className={styles.title}>{room.name}</Text>
          {isPlaying ? (
            <View className={classnames(styles.badge, styles.badgePlaying)}>
              <Text className={styles.badgeText}>游戏中</Text>
            </View>
          ) : (
            <View className={classnames(styles.badge, styles.badgeWaiting)}>
              <Text className={styles.badgeText}>等待中</Text>
            </View>
          )}
        </View>
        <Text className={styles.roomCode}>房间号 {room.roomCode}</Text>
      </View>

      <View className={styles.players}>
        <View className={styles.avatarList}>
          {room.players.slice(0, 4).map((p) => (
            <View key={p.openid} className={styles.avatarItem}>
              <Avatar src={p.avatar} nickname={p.nickname} size={64} />
            </View>
          ))}
          {playerCount < room.maxPlayers && (
            <View className={styles.emptySlot}>
              <Text className={styles.plus}>+</Text>
            </View>
          )}
        </View>
        <Text className={styles.playerCount}>
          {playerCount}/{room.maxPlayers}人
        </Text>
      </View>

      <View className={styles.footer}>
        <Text className={styles.owner}>房主: {room.ownerNickname}</Text>
        <Text className={styles.rounds}>{room.totalRounds}回合</Text>
      </View>

      {isFull && <View className={styles.fullMask}><Text className={styles.fullText}>已满员</Text></View>}
    </View>
  );
};

export default RoomCard;
