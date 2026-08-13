import React, { useState } from 'react';
import { View, Text, Button, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import { useUserStore } from '@/store/userStore';
import ConfirmModal from '@/components/ConfirmModal';
import LoginModal from '@/components/LoginModal';
import styles from './index.module.scss';

const MinePage: React.FC = () => {
  const { profile, updateProfile, logout } = useUserStore();
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const isLoggedIn = !!profile;

  const handleEdit = () => {
    if (!isLoggedIn) return;
    setEditName(profile?.nickname || '');
    setShowEdit(true);
  };

  const handleSave = async () => {
    if (!editName.trim()) {
      Taro.showToast({ title: 'Please enter a nickname', icon: 'none' });
      return;
    }
    await updateProfile({ nickname: editName.trim() });
    Taro.showToast({ title: 'Saved', icon: 'success' });
    setShowEdit(false);
  };

  const handleMenuClick = (key: string) => {
    switch (key) {
      case 'contacts':
        if (!isLoggedIn) { setShowLogin(true); return; }
        Taro.navigateTo({ url: '/pages/contacts/index' });
        break;
      case 'history':
        Taro.showToast({ title: 'Coming soon', icon: 'none' });
        break;
      case 'settings':
        Taro.showToast({ title: 'Coming soon', icon: 'none' });
        break;
      case 'about':
        Taro.showModal({
          title: 'About',
          content: 'Draw Together v1.0.0\nA fun multiplayer drawing and guessing game',
          showCancel: false,
        });
        break;
      default:
        break;
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setShowLogoutConfirm(false);
    setLoggingOut(true);
    try {
      await logout();
      Taro.showToast({ title: 'Logged out', icon: 'success' });
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/index/index' });
      }, 600);
    } catch (err) {
      console.error('[Mine] logout error:', err);
      Taro.showToast({ title: 'Logout failed, please retry', icon: 'none' });
    } finally {
      setLoggingOut(false);
    }
  };

  const handleProfileClick = () => {
    if (!isLoggedIn) {
      setShowLogin(true);
    }
  };

  const menuItems = [
    { key: 'contacts', icon: '📱', title: 'Contact Sync', desc: 'Find registered friends', bg: styles.menuIconBg1 },
    { key: 'history', icon: '📊', title: 'Game History', desc: 'View match history', bg: styles.menuIconBg2 },
    { key: 'settings', icon: '⚙️', title: 'Settings', desc: 'Preferences and notifications', bg: styles.menuIconBg3 },
    { key: 'about', icon: 'ℹ️', title: 'About', desc: 'Version info', bg: styles.menuIconBg4 },
  ];

  return (
    <View className={styles.container}>
      <View className={styles.scrollArea}>
        <View className={styles.profileHeader} onClick={handleProfileClick}>
          <View className={styles.profileContent}>
            <View className={styles.avatarWrap}>
              <View className={styles.avatar}>
                <Text className={styles.avatarLetter}>
                  {(profile?.nickname || 'D').charAt(0)}
                </Text>
              </View>
            </View>
            <View className={styles.profileInfo}>
              <Text className={styles.profileName}>{profile?.nickname || 'Not logged in'}</Text>
              {isLoggedIn ? (
                <Text className={styles.profileId}>ID: {profile?.openid || ''}</Text>
              ) : (
                <Text className={styles.profileLoginHint}>Tap to log in ›</Text>
              )}
              <Text className={styles.profileBio}>
                {isLoggedIn ? (profile?.phone || 'Welcome to Draw Together') : 'Log in for full access'}
              </Text>
            </View>
            {isLoggedIn && (
              <View className={styles.editBtn} onClick={(e) => { e.stopPropagation(); handleEdit(); }}>
                <Text className={styles.editBtnText}>Edit</Text>
              </View>
            )}
          </View>
        </View>

        {isLoggedIn && (
          <View className={styles.statsCard}>
            <View className={styles.statItem}>
              <Text className={styles.statValue}>{profile?.gamesPlayed || 0}</Text>
              <Text className={styles.statLabel}>Games</Text>
            </View>
            <View className={styles.statItem}>
              <Text className={styles.statValue}>{profile?.gamesWon || 0}</Text>
              <Text className={styles.statLabel}>Wins</Text>
            </View>
            <View className={styles.statItem}>
              <Text className={styles.statValue}>{profile?.totalScore || 0}</Text>
              <Text className={styles.statLabel}>Score</Text>
            </View>
          </View>
        )}

        <Text className={styles.sectionTitle}>More</Text>

        <View className={styles.menuList}>
          <View className={styles.menuGroup}>
            {menuItems.map((item) => (
              <View
                key={item.key}
                className={styles.menuItem}
                onClick={() => handleMenuClick(item.key)}
              >
                <View className={classnames(styles.menuIcon, item.bg)}>
                  <Text>{item.icon}</Text>
                </View>
                <View className={styles.menuInfo}>
                  <Text className={styles.menuTitle}>{item.title}</Text>
                  <Text className={styles.menuDesc}>{item.desc}</Text>
                </View>
                <Text className={styles.menuArrow}>›</Text>
              </View>
            ))}
          </View>
        </View>

        {isLoggedIn && (
          <View className={styles.logoutWrapper}>
            <View
              className={styles.logoutBtn}
              onClick={() => { if (!loggingOut) setShowLogoutConfirm(true); }}
            >
              <Text className={styles.logoutBtnText}>
                {loggingOut ? 'Logging out...' : 'Log Out'}
              </Text>
            </View>
          </View>
        )}

        <View className={styles.bottomSpacer} />
      </View>

      {/* 退出登录确认弹窗（紫色渐变主题） */}
      <ConfirmModal
        visible={showLogoutConfirm}
        title="Log Out"
        content="Are you sure you want to log out?"
        confirmText="Log Out"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      {/* 未登录时的登录弹窗 */}
      <LoginModal
        visible={showLogin}
        onClose={() => setShowLogin(false)}
        onSuccess={() => setShowLogin(false)}
      />

      {/* 编辑资料弹窗 */}
      {showEdit && (
        <View className={styles.overlay} onClick={() => setShowEdit(false)}>
          <View className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <Text className={styles.modalTitle}>Edit Profile</Text>
            <View className={styles.inputGroup}>
              <Text className={styles.inputLabel}>Nickname</Text>
              <Input
                className={styles.textInput}
                placeholder="Enter new nickname"
                value={editName}
                maxlength={16}
                onInput={(e) => setEditName(e.detail.value)}
              />
            </View>
            <View className={styles.modalActions}>
              <Button className={styles.cancelBtn} onClick={() => setShowEdit(false)}>
                Cancel
              </Button>
              <Button className={styles.confirmBtn} onClick={handleSave}>
                Save
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default MinePage;