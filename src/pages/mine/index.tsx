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
      Taro.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
    await updateProfile({ nickname: editName.trim() });
    Taro.showToast({ title: '保存成功', icon: 'success' });
    setShowEdit(false);
  };

  const handleMenuClick = (key: string) => {
    switch (key) {
      case 'contacts':
        if (!isLoggedIn) { setShowLogin(true); return; }
        Taro.navigateTo({ url: '/pages/contacts/index' });
        break;
      case 'history':
        Taro.showToast({ title: '功能开发中', icon: 'none' });
        break;
      case 'settings':
        Taro.showToast({ title: '功能开发中', icon: 'none' });
        break;
      case 'about':
        Taro.showModal({
          title: '关于我们',
          content: '你画我猜 v1.0.0\n一款欢乐的多人绘画猜词游戏',
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
      Taro.showToast({ title: '已退出登录', icon: 'success' });
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/index/index' });
      }, 600);
    } catch (err) {
      console.error('[Mine] logout error:', err);
      Taro.showToast({ title: '退出失败，请重试', icon: 'none' });
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
    { key: 'contacts', icon: '📱', title: '通讯录同步', desc: '发现已注册好友', bg: styles.menuIconBg1 },
    { key: 'history', icon: '📊', title: '游戏记录', desc: '查看历史战绩', bg: styles.menuIconBg2 },
    { key: 'settings', icon: '⚙️', title: '设置', desc: '偏好设置与通知', bg: styles.menuIconBg3 },
    { key: 'about', icon: 'ℹ️', title: '关于我们', desc: '版本信息', bg: styles.menuIconBg4 },
  ];

  return (
    <View className={styles.container}>
      <View className={styles.scrollArea}>
        <View className={styles.profileHeader} onClick={handleProfileClick}>
          <View className={styles.profileContent}>
            <View className={styles.avatarWrap}>
              <View className={styles.avatar}>
                <Text className={styles.avatarLetter}>
                  {(profile?.nickname || '游').charAt(0)}
                </Text>
              </View>
            </View>
            <View className={styles.profileInfo}>
              <Text className={styles.profileName}>{profile?.nickname || '未登录'}</Text>
              {isLoggedIn ? (
                <Text className={styles.profileId}>ID: {profile?.openid || ''}</Text>
              ) : (
                <Text className={styles.profileLoginHint}>点击登录账号 ›</Text>
              )}
              <Text className={styles.profileBio}>
                {isLoggedIn ? (profile?.phone || '欢迎来到 Draw Together') : '登录后体验完整功能'}
              </Text>
            </View>
            {isLoggedIn && (
              <View className={styles.editBtn} onClick={(e) => { e.stopPropagation(); handleEdit(); }}>
                <Text className={styles.editBtnText}>编辑</Text>
              </View>
            )}
          </View>
        </View>

        {isLoggedIn && (
          <View className={styles.statsCard}>
            <View className={styles.statItem}>
              <Text className={styles.statValue}>{profile?.gamesPlayed || 0}</Text>
              <Text className={styles.statLabel}>总场次</Text>
            </View>
            <View className={styles.statItem}>
              <Text className={styles.statValue}>{profile?.gamesWon || 0}</Text>
              <Text className={styles.statLabel}>胜场</Text>
            </View>
            <View className={styles.statItem}>
              <Text className={styles.statValue}>{profile?.totalScore || 0}</Text>
              <Text className={styles.statLabel}>总积分</Text>
            </View>
          </View>
        )}

        <Text className={styles.sectionTitle}>更多功能</Text>

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
                {loggingOut ? '退出中...' : '退出登录'}
              </Text>
            </View>
          </View>
        )}

        <View className={styles.bottomSpacer} />
      </View>

      {/* 退出登录确认弹窗（紫色渐变主题） */}
      <ConfirmModal
        visible={showLogoutConfirm}
        title="退出登录"
        content="确定要退出当前账号吗？"
        confirmText="退出登录"
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
            <Text className={styles.modalTitle}>编辑资料</Text>
            <View className={styles.inputGroup}>
              <Text className={styles.inputLabel}>昵称</Text>
              <Input
                className={styles.textInput}
                placeholder="输入新昵称"
                value={editName}
                maxlength={16}
                onInput={(e) => setEditName(e.detail.value)}
              />
            </View>
            <View className={styles.modalActions}>
              <Button className={styles.cancelBtn} onClick={() => setShowEdit(false)}>
                取消
              </Button>
              <Button className={styles.confirmBtn} onClick={handleSave}>
                保存
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default MinePage;