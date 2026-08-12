import React from 'react';
import { View, Text, Image } from '@tarojs/components';
import classnames from 'classnames';
import type { Player } from '@/types/room';
import styles from './index.module.scss';

interface PlayerSlotProps {
  player?: Player;
  isOwner?: boolean;
  currentDrawer?: string;
}

const PlayerSlot: React.FC<PlayerSlotProps> = ({ player, isOwner, currentDrawer }) => {
  const isWeapp = process.env.TARO_ENV === 'weapp';

  if (!player) {
    return (
      <View className={classnames(styles.slot, styles.slotEmpty)}>
        <View className={styles.emptyAvatar}>
          <Text className={styles.plus}>+</Text>
        </View>
        <Text className={styles.emptyText}>空位</Text>
      </View>
    );
  }

  const isDrawing = currentDrawer === player.openid;

  return (
    <View className={classnames(styles.slot, styles.slotFilled, isDrawing && styles.drawing)}>
      {player.isOwner && (
        <View className={styles.ownerTag}><Text className={styles.ownerText}>房主</Text></View>
      )}
      <Text className={styles.name}>{player.nickname}</Text>
      <View className={styles.avatarContainer}>
        {/* 直接用图片填满圆形容器并裁切，不嵌套 Avatar 组件。
            Taro <Image> 在 H5 下会被包装成自定义元素导致尺寸样式失效，
            所以 H5 用原生 <img>，小程序用 Taro <Image>。 */}
        {player.avatar ? (
          isWeapp ? (
            <Image
              className={styles.avatarImg}
              src={player.avatar}
              mode="aspectFill"
            />
          ) : (
            <img
              className={styles.avatarImg}
              src={player.avatar}
              alt={player.nickname}
            />
          )
        ) : (
          <View className={styles.avatarPlaceholder}>
            <Text className={styles.avatarInitial}>
              {player.nickname?.charAt(0) || '?'}
            </Text>
          </View>
        )}
        {isDrawing && <View className={styles.drawerTag}><Text className={styles.drawerText}>画中</Text></View>}
      </View>
      <Text className={classnames(styles.statusText, player.isReady ? styles.readyText : styles.unreadyText)}>
        {player.isReady ? '已准备' : '未准备'}
      </Text>
    </View>
  );
};

export default PlayerSlot;
