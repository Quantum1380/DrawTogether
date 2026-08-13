import React from 'react';
import { View, Text } from '@tarojs/components';
import styles from './index.module.scss';

interface EmptyStateProps {
  icon?: string;
  title?: string;
  desc?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon = '📭',
  title = 'No data',
  desc = '',
}) => {
  return (
    <View className={styles.container}>
      <Text className={styles.icon}>{icon}</Text>
      <Text className={styles.title}>{title}</Text>
      {desc ? <Text className={styles.desc}>{desc}</Text> : null}
    </View>
  );
};

export default EmptyState;
