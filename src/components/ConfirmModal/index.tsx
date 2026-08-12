import React from 'react';
import { View, Text, Button } from '@tarojs/components';
import classnames from 'classnames';
import styles from './index.module.scss';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  content: string;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  title,
  content,
  confirmText = '确定',
  cancelText = '取消',
  showCancel = true,
  onConfirm,
  onCancel,
}) => {
  if (!visible) return null;

  return (
    <View className={styles.overlay} onClick={onCancel}>
      <View className={styles.modal} catchTouchMove>
        <Text className={styles.title}>{title}</Text>
        <Text className={styles.content}>{content}</Text>
        <View className={styles.actions}>
          {showCancel && (
            <View
              className={classnames(styles.btn, styles.btnCancel)}
              onClick={onCancel}
            >
              <Text className={styles.btnCancelText}>{cancelText}</Text>
            </View>
          )}
          <View
            className={classnames(styles.btn, styles.btnConfirm)}
            onClick={onConfirm}
          >
            <Text className={styles.btnConfirmText}>{confirmText}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default ConfirmModal;
