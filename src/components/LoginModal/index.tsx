import React, { useState, useEffect } from 'react';
import { View, Text, Button, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import { useUserStore } from '@/store/userStore';
import styles from './index.module.scss';

interface LoginModalProps {
  visible: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
}

type Mode = 'login' | 'register';

const LoginModal: React.FC<LoginModalProps> = ({ visible, onClose, onSuccess }) => {
  const { login, register } = useUserStore();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (visible) {
      setMode('login');
      setUsername('');
      setPassword('');
      setNickname('');
      setErrorMsg('');
      setLoading(false);
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!username.trim()) {
      setErrorMsg('请输入用户名');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg('密码至少 6 位');
      return;
    }
    if (mode === 'register' && !nickname.trim()) {
      setErrorMsg('请输入昵称');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      if (mode === 'login') {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password, nickname.trim());
      }
      Taro.showToast({
        title: mode === 'login' ? '登录成功' : '注册成功',
        icon: 'success',
      });
      onSuccess?.();
      onClose?.();
    } catch (err: any) {
      setErrorMsg(err?.message || '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <View className={styles.overlay} onClick={onClose}>
      <View className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <View className={styles.header}>
          <View className={styles.logo}>
            <Text className={styles.logoIcon}>🎨</Text>
          </View>
          <Text className={styles.title}>
            {mode === 'login' ? '欢迎回来' : '加入我们'}
          </Text>
          <Text className={styles.subtitle}>
            {mode === 'login' ? '登录账号继续创作' : '创建账号，开始绘画之旅'}
          </Text>
          <View className={styles.closeBtn} onClick={onClose}>
            <Text className={styles.closeIcon}>✕</Text>
          </View>
        </View>

        <View className={styles.tabs}>
          <View
            className={classnames(styles.tab, mode === 'login' && styles.tabActive)}
            onClick={() => { setMode('login'); setErrorMsg(''); }}
          >
            <Text className={styles.tabText}>登录</Text>
          </View>
          <View
            className={classnames(styles.tab, mode === 'register' && styles.tabActive)}
            onClick={() => { setMode('register'); setErrorMsg(''); }}
          >
            <Text className={styles.tabText}>注册</Text>
          </View>
        </View>

        <View className={styles.form}>
          <View className={styles.inputGroup}>
            <Text className={styles.label}>用户名</Text>
            <Input
              className={styles.input}
              placeholder="输入用户名"
              value={username}
              maxlength={20}
              onInput={(e) => setUsername(e.detail.value)}
            />
          </View>

          {mode === 'register' && (
            <View className={styles.inputGroup}>
              <Text className={styles.label}>昵称</Text>
              <Input
                className={styles.input}
                placeholder="给自己起个昵称"
                value={nickname}
                maxlength={20}
                onInput={(e) => setNickname(e.detail.value)}
              />
            </View>
          )}

          <View className={styles.inputGroup}>
            <Text className={styles.label}>密码</Text>
            <Input
              className={styles.input}
              placeholder="至少 6 位"
              password
              value={password}
              maxlength={32}
              onInput={(e) => setPassword(e.detail.value)}
            />
          </View>

          {errorMsg && (
            <View className={styles.errorWrap}>
              <Text className={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          <Button
            className={classnames(styles.submitBtn, loading && styles.submitBtnDisabled)}
            disabled={loading}
            onClick={handleSubmit}
          >
            <Text className={styles.submitBtnText}>
              {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
            </Text>
          </Button>

          <View className={styles.hintWrap}>
            <Text className={styles.hintText}>
              {mode === 'login' ? '还没有账号？' : '已有账号？'}
            </Text>
            <Text
              className={styles.switchBtn}
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setErrorMsg('');
              }}
            >
              {mode === 'login' ? '去注册' : '去登录'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default LoginModal;
