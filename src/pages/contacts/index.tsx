import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Button, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Capacitor } from '@capacitor/core';
import { Contacts } from '@capacitor-community/contacts';
import classnames from 'classnames';
import { friendService } from '@/services/friendService';
import { messageService } from '@/services/messageService';
import type { Contact } from '@/types/user';
import EmptyState from '@/components/EmptyState';
import styles from './index.module.scss';

type FilterType = 'all' | 'registered' | 'unregistered';

/**
 * 通讯录联系人状态 status:
 * - not_registered：未注册
 * - friend：已是好友
 * - requested：已发送好友申请（等待对方同意）
 * - not_friend：已注册但不是好友，也没发过申请
 */
interface EnrichedContact extends Contact {
  openid: string;
  status: string;  // not_registered | friend | requested | not_friend
  isOnline: boolean;  // 是否已在线（需查询），初始化用 false，socket 不可用不影响展示
  registered: boolean;
}

const ContactsPage: React.FC = () => {
  const [contacts, setContacts] = useState<EnrichedContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [synced, setSynced] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');

  // 操作状态：申请中 / 邀请创建房间中
  const [applyingSet, setApplyingSet] = useState<Set<string>>(new Set());
  const [invitingSet, setInvitingSet] = useState<Set<string>>(new Set());

  /**
   * 在安卓 APK（Capacitor 原生）环境下读取通讯录
   * 使用 @capacitor-community/contacts v6 插件
   * v6 API 返回格式: { contacts: 'granted' | 'denied' | 'prompt' }
   * 非原生环境（浏览器开发）抛出友好错误
   */
  const readNativeContacts = async (): Promise<{ name: string; phone: string }[]> => {
    if (!Capacitor.isNativePlatform()) {
      throw new Error('请在手机 App 中使用此功能');
    }

    try {
      // 1. 先检查当前权限
      const currentPerm = await Contacts.checkPermissions();
      const alreadyGranted = currentPerm.contacts === 'granted';

      // 2. 如果还没权限，请求系统弹窗
      if (!alreadyGranted) {
        const permResult = await Contacts.requestPermissions();
        // requestPermissions 返回值在部分机型上不可信，再 check 一次
        const recheck = await Contacts.checkPermissions();
        if (recheck.contacts !== 'granted' && permResult.contacts !== 'granted') {
          throw new Error('通讯录权限未授予，请在系统设置中手动开启');
        }
      }

      // 3. 读取通讯录 —— 必须显式指定 projection，否则 Android 端 GetContactsProjectionInput
      //    会因 call.getObject('projection') 返回 null 而抛 NullPointerException
      const result = await Contacts.getContacts({
        projection: {
          name: true,
          phones: true,
        },
      });
      const list = result?.contacts || [];

      return list
        .map((c: any) => {
          const phone = c.phones?.[0]?.number || '';
          const displayName =
            c.name?.display ||
            (c.name?.given && c.name?.family ? `${c.name.given}${c.name.family}` : '') ||
            '';
          return {
            name: displayName || '(无姓名)',
            phone: String(phone).replace(/\s|-/g, ''),
          };
        })
        .filter((c: any) => c.phone);
    } catch (err: any) {
      console.error('[Contacts] 读取失败:', err);
      // 直接抛出原始错误信息，不再做"权限被拒绝"的误判翻译
      const msg = err?.message || String(err);
      throw new Error(msg);
    }
  };

  const doSyncContacts = useCallback(async () => {
    setLoading(true);
    try {
      const phoneContacts = await readNativeContacts();
      if (phoneContacts.length === 0) {
        Taro.showToast({ title: '没有读取到任何联系人', icon: 'none' });
      }
      // 调用后端匹配已注册 + 好友关系 + 申请状态
      const result: any = await friendService.syncContacts(phoneContacts);
      // 后端已经返回 status: not_registered / friend / requested / not_friend
      const enriched: EnrichedContact[] = result.map((c: any) => ({
        ...c,
        openid: c.openid || '',
        registered: !!c.registered,
        isOnline: !!c.isOnline,
      }));
      setContacts(enriched);
      setSynced(true);
      const found = enriched.filter(c => c.registered).length;
      Taro.showToast({
        title: `同步完成，找到${found}位已注册好友`,
        icon: 'none',
      });
    } catch (err: any) {
      console.error('[Contacts] syncContacts:', err);
      // 直接显示真实错误信息，不再做"权限拒绝"的误判
      const msg = err?.message || '同步失败';
      Taro.showModal({ title: '同步失败', content: msg, showCancel: false });
    } finally {
      setLoading(false);
    }
  }, []);

  /** 通讯录里「已是好友」：点击邀请 → 自动创建房间 + 发邀请消息 → 进入房间 */
  const handleInviteFriend = async (contact: EnrichedContact) => {
    if (invitingSet.has(contact.openid)) return;
    if (contact.status !== 'friend') return;
    setInvitingSet(prev => new Set(prev).add(contact.openid));
    try {
      const result = await messageService.inviteAndCreateRoom(contact.openid);
      Taro.showToast({ title: '邀请已发送', icon: 'success' });
      Taro.redirectTo({
        url: `/pages/room/index?id=${result.roomId}&roomCode=${result.roomCode}`,
      });
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '邀请失败', icon: 'none' });
    } finally {
      setInvitingSet(prev => {
        const next = new Set(prev);
        next.delete(contact.openid);
        return next;
      });
    }
  };

  /** 通讯录里「已注册但不是好友」：点击申请 → 发送好友请求 → 改显示「已申请」 */
  const handleSendFriendRequest = async (contact: EnrichedContact) => {
    if (applyingSet.has(contact.openid)) return;
    if (contact.status === 'friend' || contact.status === 'requested') return;
    setApplyingSet(prev => new Set(prev).add(contact.openid));
    try {
      await friendService.sendFriendRequest(contact.openid, '');
      Taro.showToast({ title: '申请已发送', icon: 'success' });
      // 本地更新状态为 requested
      setContacts(prev => prev.map(c =>
        c.phone === contact.phone && c.name === contact.name
          ? { ...c, status: 'requested' }
          : c
      ));
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '发送失败', icon: 'none' });
    } finally {
      setApplyingSet(prev => {
        const next = new Set(prev);
        next.delete(contact.openid);
        return next;
      });
    }
  };

  const filteredContacts = useMemo(() => contacts.filter((c) => {
    if (filter === 'all') return true;
    if (filter === 'registered') return c.registered;
    return !c.registered;
  }), [contacts, filter]);

  const registeredCount = useMemo(() => contacts.filter(c => c.registered).length, [contacts]);

  const getAvatarColor = (nickname: string) => {
    const colors = [
      ['#86EFAC', '#22C55E'], ['#93C5FD', '#3B82F6'], ['#FCA5A5', '#EF4444'],
      ['#FDE68A', '#F59E0B'], ['#C4B5FD', '#8B5CF6'], ['#F9A8D4', '#EC4899'],
      ['#67E8F9', '#06B6D4'],
    ];
    const idx = (nickname?.charCodeAt(0) || 0) % colors.length;
    return colors[idx];
  };

  /**
   * 判断每个联系人的按钮：
   *  - 未注册（registered=false, status=not_registered）→「未注册」 禁用
   *  - 已注册 + 已是好友（status=friend）：
   *      - 在线 →「邀请」
   *      - 离线 →「未上线」（禁用）→ 不过通讯录页面判断在线状态不准，这里统一显示「邀请」
   *  - 已注册 + 已发送申请（status=requested）→「已申请」禁用
   *  - 已注册 + 未申请（status=not_friend）→「申请」
   */
  const renderButton = (c: EnrichedContact, key: string) => {
    if (!c.registered || c.status === 'not_registered') {
      return (
        <View className={classnames(styles.contactBtn, styles.btnOffline)}>
          <Text className={styles.btnTextDisabled}>未注册</Text>
        </View>
      );
    }
    if (c.status === 'friend') {
      const inv = invitingSet.has(c.openid);
      if (!c.isOnline) {
        // 是好友但未上线 → 显示「未上线」 禁用
        return (
          <View className={classnames(styles.contactBtn, styles.btnOffline)}>
            <Text className={styles.btnTextDisabled}>未上线</Text>
          </View>
        );
      }
      return (
        <View
          className={classnames(styles.contactBtn, styles.btnInvite, inv && styles.btnInviting)}
          onClick={() => handleInviteFriend(c)}
        >
          <Text className={styles.btnTextWhite}>{inv ? '创建中...' : '邀请'}</Text>
        </View>
      );
    }
    if (c.status === 'requested') {
      return (
        <View className={classnames(styles.contactBtn, styles.btnApplied)}>
          <Text className={styles.btnTextApplied}>已申请</Text>
        </View>
      );
    }
    // not_friend → 申请按钮
    const applying = applyingSet.has(c.openid);
    return (
      <View
        className={classnames(styles.contactBtn, styles.btnApply, applying && styles.btnApplying)}
        onClick={() => handleSendFriendRequest(c)}
      >
        <Text className={styles.btnTextWhite}>{applying ? '发送中...' : '申请'}</Text>
      </View>
    );
  };

  return (
    <View className={styles.container}>
      {/* 头部说明 */}
      <View className={styles.header}>
        <Text className={styles.headerTitle}>联系人同步</Text>
        <Text className={styles.headerDesc}>
          同步手机通讯录，自动发现已注册「你画我猜」的好友，添加后即可邀请一起游戏。
        </Text>
        <Button
          className={classnames(styles.syncBtn, loading && styles.syncBtnDisabled)}
          onClick={doSyncContacts}
          disabled={loading}
        >
          {loading ? '同步中...' : synced ? '重新同步' : '📱 同步联系人'}
        </Button>
      </View>

      {synced && (
        <>
          {/* 筛选标签 */}
          <View className={styles.filterTabs}>
            {(['all', 'registered', 'unregistered'] as FilterType[]).map((t) => (
              <View
                key={t}
                className={classnames(styles.filterTab, filter === t && styles.filterTabActive)}
                onClick={() => setFilter(t)}
              >
                <Text
                  className={classnames(
                    styles.filterTabText,
                    filter === t && styles.filterTabTextActive
                  )}
                >
                  {t === 'all'
                    ? `全部(${contacts.length})`
                    : t === 'registered'
                    ? `已注册(${registeredCount})`
                    : `未注册(${contacts.length - registeredCount})`}
                </Text>
              </View>
            ))}
          </View>

          {/* 联系人列表 */}
          <View className={styles.contactList}>
            {loading ? (
              <View className={styles.loadingWrap}>
                <Text className={styles.loadingText}>加载中...</Text>
              </View>
            ) : filteredContacts.length === 0 ? (
              <EmptyState icon="📋" title="暂无联系人" />
            ) : (
              <ScrollView scrollY>
                {filteredContacts.map((contact, idx) => {
                  const key = `${contact.phone}-${idx}`;
                  const [color1, color2] = getAvatarColor(contact.name || contact.openid || '?');
                  return (
                    <View key={key} className={styles.contactItem}>
                      <View
                        className={styles.contactAvatar}
                        style={{ background: `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)` }}
                      >
                        <Text className={styles.contactAvatarText}>
                          {contact.name.charAt(0) || '?'}
                        </Text>
                      </View>
                      <View className={styles.contactInfo}>
                        <View style={{ display: 'flex', alignItems: 'center' }}>
                          <Text className={styles.contactName}>{contact.name || '(无姓名)'}</Text>
                          {contact.registered && (
                            <View className={styles.registeredTag}>
                              <Text className={styles.registeredText}>已注册</Text>
                            </View>
                          )}
                        </View>
                        <Text className={styles.contactPhone}>{contact.phone}</Text>
                      </View>
                      {renderButton(contact, key)}
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </>
      )}

      {!synced && !loading && (
        <EmptyState
          icon="📱"
          title="点击上方按钮同步联系人"
          desc="同步后可发现已注册的好友"
        />
      )}
    </View>
  );
};

export default ContactsPage;
