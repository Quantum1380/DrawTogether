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
              <Text className={styles.badgeText}>In Game</Text>
            </View>
          ) : (
            <View className={classnames(styles.badge, styles.badgeWaiting)}>
              <Text className={styles.badgeText}>Waiting</Text>
            </View>
          )}
        </View>
        <Text className={styles.roomCode}>Room Code: {room.roomCode}</Text>
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
          {playerCount}/{room.maxPlayers} players
        </Text>
      </View>

      <View className={styles.footer}>
        <Text className={styles.owner}>Host: {room.ownerNickname}</Text>
        <Text className={styles.rounds}>{room.totalRounds} rounds</Text>
      </View>

      {isFull && <View className={styles.fullMask}><Text className={styles.fullText}>Full</Text></View>}
    </View>
  );
};

export default RoomCard;
