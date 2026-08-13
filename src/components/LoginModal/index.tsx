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
type RegisterMethod = 'username' | 'phone';

const LoginModal: React.FC<LoginModalProps> = ({ visible, onClose, onSuccess }) => {
  const { login, register, registerByPhone } = useUserStore();
  const [mode, setMode] = useState<Mode>('login');
  const [registerMethod, setRegisterMethod] = useState<RegisterMethod>('username');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (visible) {
      setMode('login');
      setRegisterMethod('username');
      setUsername('');
      setPhone('');
      setPassword('');
      setNickname('');
      setErrorMsg('');
      setLoading(false);
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (mode === 'login') {
      if (!username.trim()) {
        setErrorMsg('Please enter username or phone number');
        return;
      }
      if (!password || password.length < 6) {
        setErrorMsg('Password must be at least 6 characters');
        return;
      }
    } else {
      // Register mode
      if (registerMethod === 'username') {
        if (!username.trim()) {
          setErrorMsg('Please enter a username');
          return;
        }
      } else {
        // phone registration
        const cleanPhone = phone.trim().replace(/[\s-]/g, '');
        if (!cleanPhone) {
          setErrorMsg('Please enter a phone number');
          return;
        }
        if (!/^\d{7,15}$/.test(cleanPhone)) {
          setErrorMsg('Invalid phone number format');
          return;
        }
      }
      if (!password || password.length < 6) {
        setErrorMsg('Password must be at least 6 characters');
        return;
      }
      if (!nickname.trim()) {
        setErrorMsg('Please enter a nickname');
        return;
      }
    }

    setLoading(true);
    setErrorMsg('');
    try {
      if (mode === 'login') {
        await login(username.trim(), password);
      } else if (registerMethod === 'username') {
        await register(username.trim(), password, nickname.trim());
      } else {
        await registerByPhone(phone.trim(), password, nickname.trim());
      }
      Taro.showToast({
        title: mode === 'login' ? 'Login successful' : 'Registration successful',
        icon: 'success',
      });
      onSuccess?.();
      onClose?.();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Operation failed, please try again');
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
            {mode === 'login' ? 'Welcome Back' : 'Join Us'}
          </Text>
          <Text className={styles.subtitle}>
            {mode === 'login'
              ? 'Log in to continue creating'
              : 'Create an account and start drawing'}
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
            <Text className={styles.tabText}>Log In</Text>
          </View>
          <View
            className={classnames(styles.tab, mode === 'register' && styles.tabActive)}
            onClick={() => { setMode('register'); setErrorMsg(''); }}
          >
            <Text className={styles.tabText}>Sign Up</Text>
          </View>
        </View>

        {mode === 'register' && (
          <View className={styles.subTabs}>
            <View
              className={classnames(styles.subTab, registerMethod === 'username' && styles.subTabActive)}
              onClick={() => { setRegisterMethod('username'); setErrorMsg(''); }}
            >
              <Text className={styles.subTabText}>Username</Text>
            </View>
            <View
              className={classnames(styles.subTab, registerMethod === 'phone' && styles.subTabActive)}
              onClick={() => { setRegisterMethod('phone'); setErrorMsg(''); }}
            >
              <Text className={styles.subTabText}>Phone</Text>
            </View>
          </View>
        )}

        <View className={styles.form}>
          {mode === 'login' || registerMethod === 'username' ? (
            <View className={styles.inputGroup}>
              <Text className={styles.label}>
                {mode === 'login' ? 'Username or Phone' : 'Username'}
              </Text>
              <Input
                className={styles.input}
                placeholder={mode === 'login' ? 'Enter username or phone' : 'Enter a username'}
                value={username}
                maxlength={20}
                onInput={(e) => setUsername(e.detail.value)}
              />
            </View>
          ) : (
            <View className={styles.inputGroup}>
              <Text className={styles.label}>Phone Number</Text>
              <Input
                className={styles.input}
                placeholder="Enter your phone number"
                value={phone}
                type="number"
                maxlength={15}
                onInput={(e) => setPhone(e.detail.value)}
              />
            </View>
          )}

          {mode === 'register' && (
            <View className={styles.inputGroup}>
              <Text className={styles.label}>Nickname</Text>
              <Input
                className={styles.input}
                placeholder="Pick a nickname"
                value={nickname}
                maxlength={20}
                onInput={(e) => setNickname(e.detail.value)}
              />
            </View>
          )}

          <View className={styles.inputGroup}>
            <Text className={styles.label}>Password</Text>
            <Input
              className={styles.input}
              placeholder="At least 6 characters"
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
              {loading ? 'Processing...' : mode === 'login' ? 'Log In' : 'Sign Up'}
            </Text>
          </Button>

          <View className={styles.hintWrap}>
            <Text className={styles.hintText}>
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
            </Text>
            <Text
              className={styles.switchBtn}
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setErrorMsg('');
              }}
            >
              {mode === 'login' ? 'Sign Up' : 'Log In'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default LoginModal;
