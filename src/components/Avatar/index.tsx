import React from 'react';
import { View, Image, Text } from '@tarojs/components';
import classnames from 'classnames';
import type { UserStatus } from '@/types/user';
import styles from './index.module.scss';

interface AvatarProps {
  src?: string;
  nickname?: string;
  size?: number;
  status?: UserStatus;
  onClick?: () => void;
}

const Avatar: React.FC<AvatarProps> = ({ src, nickname, size = 80, status, onClick }) => {
  const sizeStyle = { width: `${size}rpx`, height: `${size}rpx` };

  const getInitial = (name?: string) => {
    if (!name) return '?';
    return name.charAt(0);
  };

  return (
    <View className={styles.avatarWrapper} style={sizeStyle} onClick={onClick}>
      {src ? (
        <Image className={styles.avatar} src={src} style={sizeStyle} mode="aspectFill" />
      ) : (
        <View className={classnames(styles.avatar, styles.placeholder)} style={sizeStyle}>
          <Text style={{ fontSize: `${size * 0.4}rpx`, color: '#fff', fontWeight: 600 }}>
            {getInitial(nickname)}
          </Text>
        </View>
      )}
      {status && (
        <View
          className={classnames(
            styles.statusDot,
            status === 'online' && styles.online,
            status === 'offline' && styles.offline,
            status === 'busy' && styles.busy
          )}
          style={{ width: `${size * 0.28}rpx`, height: `${size * 0.28}rpx` }}
        />
      )}
    </View>
  );
};

export default Avatar;
