import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Button, Input, ScrollView, Canvas } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import classnames from 'classnames';
import { useUserStore } from '@/store/userStore';
import { connectSocket, getSocket } from '@/services/socket';
import { roomService } from '@/services/roomService';
import ConfirmModal from '@/components/ConfirmModal';
import { WORD_BANK } from '@/types/game';
import type { ChatMessage } from '@/types/game';
import type { Room } from '@/types/room';
import styles from './index.module.scss';

const COLORS = [
  '#1d2129', '#ff6b35', '#f53f3f', '#ff7d00',
  '#00b42a', '#00cec9', '#165dff', '#6c5ce7',
  '#ff69b4', '#8b4513', '#999999', '#ffffff',
];

const BRUSH_SIZES = [4, 8, 16];

interface PlayerScore {
  openid: string;
  nickname: string;
  score: number;
}

const GamePage: React.FC = () => {
  const router = useRouter();
  const { profile } = useUserStore();
  const roomId = router.params.id || '';

  // 初始化时优先用 URL 参数（跳转到游戏页时后端带过来的），
  // 后续收到 next-turn 时会被服务端最新值覆盖，保证整局一致
  const initWord = decodeURIComponent(router.params.word || '');
  const initDrawer = router.params.drawer || '';
  const [word, setWord] = useState<string>(initWord || WORD_BANK[0]);
  const [currentDrawer, setCurrentDrawer] = useState<string>(initDrawer);
  // 整局是否结束（所有大回合都跑完）
  const [gameEnded, setGameEnded] = useState(false);
  // 当前大回合的画者顺序与当前画者下标，用于判断「是否最后一位画者画完=整局结束」
  const [drawerOrder, setDrawerOrder] = useState<string[]>([]);
  const [drawerIndex, setDrawerIndex] = useState(0);

  const [timeLeft, setTimeLeft] = useState(90);
  const [drawSeconds, setDrawSeconds] = useState<number>(90);
  const [round, setRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(1);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1]);
  const [isEraser, setIsEraser] = useState(false);
  const [guessText, setGuessText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [guessed, setGuessed] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showForceExitModal, setShowForceExitModal] = useState(false);
  const [scores, setScores] = useState<PlayerScore[]>([
    { openid: profile?.openid || 'user_001', nickname: profile?.nickname || '我', score: 0 },
  ]);

  // 只有当 currentDrawer 明确等于当前用户时才是画者；
  // 若 drawer 参数缺失，默认当作猜词者（仍可输入），避免误判成画者导致输入框消失
  const isDrawer = !!currentDrawer && currentDrawer === profile?.openid;
  const isDrawerRef = useRef(isDrawer);
  useEffect(() => { isDrawerRef.current = isDrawer; }, [isDrawer]);

  // 用 ref 保存最新的 round/drawerIndex，用于过滤过期的 socket 事件
  // 场景：玩家 A 的 HTTP next-turn 已更新状态并广播了 game:next-turn，
  // 但玩家 B 的过期事件（HTTP 响应或另一个 socket 事件）晚到，会把状态回滚
  const roundRef = useRef(round);
  useEffect(() => { roundRef.current = round; }, [round]);
  const drawerIndexRef = useRef(drawerIndex);
  useEffect(() => { drawerIndexRef.current = drawerIndex; }, [drawerIndex]);

  /** 把房间数据同步到前端 state（游戏开始 / 下一回合 / 整局结束 通用） */
  const applyRoomState = useCallback((room: Room) => {
    if (!room) return;
    // 同步 players（分数 + 人员）
    if (room.players?.length) {
      setScores((prev) => {
        // 保留前端已经累加过的得分（因为得分更新在各端通过 game:correct 事件独立累加），
        // 缺失的玩家从 room.players 里补回来，score 用 max(已有,后端兜底)=已有 保持
        const openidScore = new Map(prev.map((s) => [s.openid, s.score]));
        return room.players.map((p) => ({
          openid: p.openid,
          nickname: p.nickname,
          score: Math.max(p.score ?? 0, openidScore.get(p.openid) ?? 0),
        }));
      });
    }
    if (room.totalRounds && room.totalRounds > 0) setTotalRounds(room.totalRounds);
    if (room.currentRound && room.currentRound > 0) setRound(room.currentRound);
    if (room.currentDrawer) setCurrentDrawer(room.currentDrawer);
    if (room.currentWord) setWord(room.currentWord);
    if (Array.isArray(room.drawerOrder)) setDrawerOrder(room.drawerOrder);
    if (typeof room.drawerIndex === 'number') setDrawerIndex(room.drawerIndex);
    if (typeof room.drawSeconds === 'number' && room.drawSeconds > 0) {
      setDrawSeconds(room.drawSeconds);
      // 只要后端明确传来 drawSeconds，就重置倒计时（切回合时也要用最新值）
      setTimeLeft(room.drawSeconds);
    }
    if (room.status === 'ended') setGameEnded(true);
  }, []);

  // 进入游戏后从后端拉一次完整状态，确保刷新 / 断网重进后词和画者也是对的
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    roomService.getRoomById(roomId)
      .then((room: Room) => {
        if (cancelled || !room?.players?.length) return;
        applyRoomState(room);
      })
      .catch(() => {
        /* 拉取失败就保持默认（只显示自己）*/
      });
    return () => { cancelled = true; };
  }, [roomId, applyRoomState]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const chatListRef = useRef<any>(null);
  const socketRef = useRef<any>(null);

  // 跨端同步「猜对」所需：scores 最新值、已猜对玩家集合、回合是否已结束
  const scoresRef = useRef<PlayerScore[]>(scores);
  useEffect(() => { scoresRef.current = scores; }, [scores]);
  const guessedSetRef = useRef<Set<string>>(new Set());
  const roundEndedRef = useRef(false);

  const initH5Canvas = useCallback((): boolean => {
    const el = canvasRef.current;
    if (!el) return false;
    const parent = el.parentElement;
    if (!parent) return false;
    const ctx = el.getContext('2d');
    if (!ctx) return false;
    const dpr = window.devicePixelRatio || 1;
    const rect = el.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    // 使用父元素尺寸作为基准，避免 canvas 自身 height:100% 未解析导致返回默认 150px
    const w = parentRect.width || rect.width;
    const h = parentRect.height || rect.height;
    if (w < 10 || h < 10) return false;
    el.width = w * dpr;
    el.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctxRef.current = ctx;
    return true;
  }, []);

  useEffect(() => {
    if (process.env.TARO_ENV === 'weapp') {
      const query = Taro.createSelectorQuery();
      query.select('#drawCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0]) return;
          const canvas = res[0].node;
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          const dpr = Taro.getSystemInfoSync().pixelRatio;
          const w = res[0].width || 300;
          const h = res[0].height || 300;
          canvas.width = w * dpr;
          canvas.height = h * dpr;
          ctx.scale(dpr, dpr);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctxRef.current = ctx;
          canvasRef.current = canvas;
        });
    } else {
      // 多重保障：rAF + setTimeout 确保布局完全稳定
      let done = false;
      let rafId: number;
      let timeoutId: number;

      const tryInit = () => {
        if (done) return;
        if (initH5Canvas()) {
          done = true;
          return;
        }
        rafId = requestAnimationFrame(tryInit);
      };
      rafId = requestAnimationFrame(tryInit);

      // 300ms 后强制初始化一次（兜底）
      timeoutId = window.setTimeout(() => {
        if (!done) {
          done = true;
          initH5Canvas();
        }
      }, 300);

      // 监听父容器尺寸变化，保留已有绘画内容
      const el = canvasRef.current;
      const parent = el?.parentElement;
      if (!el || !parent) return;
      const ro = new ResizeObserver(() => {
        const ctx = ctxRef.current;
        if (!ctx || !el) return;
        const dpr = window.devicePixelRatio || 1;
        const parentRect = parent.getBoundingClientRect();
        const w = parentRect.width;
        const h = parentRect.height;
        if (w < 10 || h < 10) return;
        // 尺寸没变就不重置
        if (Math.abs(el.width - w * dpr) < 2 && Math.abs(el.height - h * dpr) < 2) return;
        // 保存当前绘画
        let saved: string | null = null;
        try { saved = el.toDataURL(); } catch { /* ignore */ }
        el.width = w * dpr;
        el.height = h * dpr;
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // 恢复绘画
        if (saved) {
          const img = new Image();
          img.onload = () => ctx.drawImage(img, 0, 0, w, h);
          img.src = saved;
        }
      });
      ro.observe(parent);

      return () => {
        done = true;
        cancelAnimationFrame(rafId);
        clearTimeout(timeoutId);
        ro.disconnect();
      };
    }
  }, [initH5Canvas]);

  useEffect(() => {
    // showResult 显示中 / timeLeft 已为 0 都不启动倒计时
    // 防止「setShowResult(false) 触发 effect 重启时 timeLeft 还没来得及重置」导致立刻触发回合结束
    if (showResult || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleRoundEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [showResult, timeLeft]);

  const addSystemMessage = useCallback((content: string) => {
    const msg: ChatMessage = {
      _id: `msg_${Date.now()}`,
      roomId: '',
      openid: 'system',
      nickname: '系统',
      avatar: '',
      content,
      type: 'system',
      createTime: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, msg]);
  }, []);

  // 判断是否所有非画者都猜对了，是则提前结束本回合
  // 用 ref 读取最新 scores，避免在 socket 监听器里闭包到旧值
  const checkRoundEnd = useCallback(() => {
    if (roundEndedRef.current) return;
    const allPlayers = scoresRef.current;
    const guessers = allPlayers.filter((s) => s.openid !== currentDrawer);
    // 没有非画者或人数为 0 时不触发
    if (guessers.length === 0) return;
    const allGuessed = guessers.every((s) => guessedSetRef.current.has(s.openid));
    if (allGuessed) {
      roundEndedRef.current = true;
      addSystemMessage(`全员猜对！正确答案是「${word}」`);
      setTimeLeft(0);
      setTimeout(() => setShowResult(true), 1500);
    }
  }, [currentDrawer, word, addSystemMessage]);

  // 进入游戏页后加入 socket 房间，监听画板同步与聊天消息
  // 画者：本地绘制并广播；猜词者：只接收并回显画者的笔迹
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;

    const onDrawStart = (data: any) => {
      // 画者不回显自己的笔（服务端用 socket.to 也不会回传给发送方，这里再加一层保险）
      if (isDrawerRef.current) return;
      const ctx = ctxRef.current;
      const size = getCanvasSize();
      if (!ctx || !data) return;
      const x = (data.nx ?? 0) * size.width;
      const y = (data.ny ?? 0) * size.height;
      const width = data.width || 8;
      ctx.beginPath();
      ctx.arc(x, y, width / 2, 0, Math.PI * 2);
      ctx.fillStyle = data.color || '#1d2129';
      ctx.fill();
      lastPointRef.current = { x, y, width: size.width, height: size.height };
    };

    const onDrawMove = (data: any) => {
      if (isDrawerRef.current) return;
      const ctx = ctxRef.current;
      const size = getCanvasSize();
      if (!ctx || !data || !data.from || !data.to) return;
      ctx.beginPath();
      ctx.moveTo(data.from.nx * size.width, data.from.ny * size.height);
      ctx.lineTo(data.to.nx * size.width, data.to.ny * size.height);
      ctx.strokeStyle = data.color || '#1d2129';
      ctx.lineWidth = data.width || 8;
      ctx.stroke();
      lastPointRef.current = {
        x: data.to.nx * size.width,
        y: data.to.ny * size.height,
        width: size.width,
        height: size.height,
      };
    };

    const onDrawClear = () => {
      // 画者不处理；猜词者直接清空本地画板（不再 emit，避免回声循环）
      if (isDrawerRef.current) return;
      const ctx = ctxRef.current;
      const canvas = canvasRef.current as any;
      if (!ctx || !canvas) return;
      const parent = canvas.parentElement;
      const parentRect = parent?.getBoundingClientRect?.();
      const dpr = window.devicePixelRatio || 1;
      const w = (parentRect?.width || canvas.width / dpr);
      const h = (parentRect?.height || canvas.height / dpr);
      ctx.clearRect(0, 0, w, h);
    };

    const onChatMessage = (data: ChatMessage) => {
      if (!data) return;
      setMessages((prev) => {
        // 去重：避免同一消息被加入两次（发送方本地已加，不会收到回声）
        if (prev.some((m) => m._id === data._id)) return prev;
        return [...prev, data];
      });
    };

    // 其他玩家猜对：给该玩家加分、加系统提示与 correct 消息，并判断是否全员猜对
    const onGameCorrect = (data: { openid: string; nickname: string; bonus: number }) => {
      if (!data) return;
      guessedSetRef.current.add(data.openid);
      setScores((prev) =>
        prev.map((s) =>
          s.openid === data.openid ? { ...s, score: s.score + data.bonus } : s
        )
      );
      addSystemMessage(`${data.nickname} 猜对了！+${data.bonus}分`);
      const correctMsg: ChatMessage = {
        _id: `msg_${Date.now()}_correct_${data.openid}`,
        roomId,
        openid: data.openid,
        nickname: data.nickname,
        avatar: '',
        content: '猜对了！',
        type: 'correct',
        createTime: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, correctMsg]);
      checkRoundEnd();
    };

    // 服务端通知：进入下一位画者（或新的大回合）
    const onNextTurn = (room: Room) => {
      if (!room) return;
      // 过期事件过滤：如果 incoming 的回合/画者下标小于本地当前值，说明是晚到的旧事件
      const incomingRound = room.currentRound || 0;
      const incomingDrawerIdx = typeof room.drawerIndex === 'number' ? room.drawerIndex : -1;
      if (incomingRound < roundRef.current) return;
      if (incomingRound === roundRef.current && incomingDrawerIdx < drawerIndexRef.current) return;
      applyRoomState(room);
      // 重置画板 + 状态，开始新一轮
      handleClearCanvas();
      setGuessed(false);
      // 关键：先重置 timeLeft 和 ref，再 setShowResult(false)，
      // 避免 effect 重启时 timeLeft 还是 0 立刻触发回合结束
      // 注：applyRoomState 内已经根据 room.drawSeconds 设置了 timeLeft/drawSeconds，这里兜底
      if (typeof room.drawSeconds === 'number' && room.drawSeconds > 0) {
        setTimeLeft(room.drawSeconds);
      } else {
        setTimeLeft(drawSeconds);
      }
      guessedSetRef.current = new Set();
      roundEndedRef.current = false;
      setMessages([]);
      setShowResult(false);
      addSystemMessage(`第 ${room.currentRound} 轮 · 轮到 ${room.players.find(p => p.openid === room.currentDrawer)?.nickname || '下一位玩家'} 作画！`);
    };

    // 整局游戏结束（所有大回合跑完）
    const onGameEnded = (room: Room) => {
      if (!room) return;
      // 过期事件过滤
      if ((room.currentRound || 0) < roundRef.current) return;
      applyRoomState(room);
      roundEndedRef.current = true;
      guessedSetRef.current = new Set();
    };

    // 房间状态变化（有人加入/离开/准备等）
    // 关键：当玩家数量 <= 1 时，强制剩下的玩家退出游戏
    const onRoomUpdated = (room: Room) => {
      if (!room || !Array.isArray(room.players)) return;
      // 同步玩家列表（用于分数栏显示）
      applyRoomState(room);
      // 只剩 0 或 1 人，且自己还在游戏里 → 强制退出
      const myOpenid = profile?.openid;
      if (room.players.length <= 1 && myOpenid && room.players.some(p => p.openid === myOpenid)) {
        setShowForceExitModal(true);
      }
    };

    (async () => {
      const s = await connectSocket();
      if (cancelled || !s) return;
      socketRef.current = s;
      s.emit('room:join', roomId);
      s.on('draw:start', onDrawStart);
      s.on('draw:move', onDrawMove);
      s.on('draw:clear', onDrawClear);
      s.on('chat:message', onChatMessage);
      s.on('game:correct', onGameCorrect);
      s.on('game:next-turn', onNextTurn);
      s.on('game:ended', onGameEnded);
      s.on('room:updated', onRoomUpdated);
    })();

    return () => {
      cancelled = true;
      const s = getSocket() || socketRef.current;
      if (s) {
        s.off('draw:start', onDrawStart);
        s.off('draw:move', onDrawMove);
        s.off('draw:clear', onDrawClear);
        s.off('chat:message', onChatMessage);
        s.off('game:correct', onGameCorrect);
        s.off('game:next-turn', onNextTurn);
        s.off('game:ended', onGameEnded);
        s.off('room:updated', onRoomUpdated);
      }
    };
  }, [roomId, getCanvasSize, checkRoundEnd, applyRoomState]);

  const handleExit = () => {
    setShowExitModal(true);
  };

  const handleExitConfirm = async () => {
    setShowExitModal(false);
    const s = socketRef.current;
    if (s) s.emit('room:leave', roomId);
    try { await roomService.leaveRoom(roomId); } catch { /* 忽略 */ }
    Taro.switchTab({ url: '/pages/index/index' });
  };

  const handleForceExit = () => {
    setShowForceExitModal(false);
    const s = socketRef.current;
    if (s) s.emit('room:leave', roomId);
    try { roomService.leaveRoom(roomId); } catch { /* 忽略 */ }
    Taro.switchTab({ url: '/pages/index/index' });
  };

  const handleRoundEnd = () => {
    // 如果已被 checkRoundEnd（全员猜对）提前结束过，直接显示结算，不再重复加「时间到」消息
    if (roundEndedRef.current) {
      setShowResult(true);
      return;
    }
    roundEndedRef.current = true;
    addSystemMessage(`时间到！正确答案是「${word}」`);
    setTimeout(() => setShowResult(true), 2000);
  };

  const getCanvasPoint = (e: any) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect?.();
    let clientX: number, clientY: number;

    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX ?? e.touches[0].x ?? 0;
      clientY = e.touches[0].clientY ?? e.touches[0].y ?? 0;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX ?? e.changedTouches[0].x ?? 0;
      clientY = e.changedTouches[0].clientY ?? e.changedTouches[0].y ?? 0;
    } else {
      clientX = e.clientX ?? e.x ?? 0;
      clientY = e.clientY ?? e.y ?? 0;
    }

    const width = rect?.width || 1;
    const height = rect?.height || 1;
    if (rect) {
      return { x: clientX - rect.left, y: clientY - rect.top, width, height };
    }
    return { x: clientX, y: clientY, width, height };
  };

  /** 读取画板 CSS 尺寸，用于把归一化坐标还原成本地坐标 */
  const getCanvasSize = useCallback((): { width: number; height: number } => {
    const rect = (canvasRef.current as any)?.getBoundingClientRect?.();
    if (!rect || rect.width < 1 || rect.height < 1) return { width: 1, height: 1 };
    return { width: rect.width, height: rect.height };
  }, []);

  const startDrawing = (e: any) => {
    if (!isDrawer || !ctxRef.current) return;
    e.preventDefault?.();
    isDrawingRef.current = true;
    const point = getCanvasPoint(e);
    lastPointRef.current = point;
    const color = isEraser ? '#ffffff' : selectedColor;
    const width = isEraser ? brushSize * 3 : brushSize;
    ctxRef.current.beginPath();
    ctxRef.current.arc(point.x, point.y, brushSize / 2, 0, Math.PI * 2);
    ctxRef.current.fillStyle = color;
    ctxRef.current.fill();
    // 广播给房间内其他玩家（归一化坐标，适配不同屏幕尺寸）
    socketRef.current?.emit('draw:start', {
      roomId,
      nx: point.x / point.width,
      ny: point.y / point.height,
      color,
      width,
    });
  };

  const moveDrawing = (e: any) => {
    if (!isDrawer || !isDrawingRef.current || !ctxRef.current) return;
    e.preventDefault?.();
    const point = getCanvasPoint(e);
    const last = lastPointRef.current;
    const color = isEraser ? '#ffffff' : selectedColor;
    const width = isEraser ? brushSize * 3 : brushSize;
    if (last) {
      ctxRef.current.beginPath();
      ctxRef.current.moveTo(last.x, last.y);
      ctxRef.current.lineTo(point.x, point.y);
      ctxRef.current.strokeStyle = color;
      ctxRef.current.lineWidth = width;
      ctxRef.current.stroke();
      // 广播连线：from 为上一个点，to 为当前点（均归一化）
      socketRef.current?.emit('draw:move', {
        roomId,
        from: { nx: last.x / last.width, ny: last.y / last.height },
        to: { nx: point.x / point.width, ny: point.y / point.height },
        color,
        width,
      });
    }
    lastPointRef.current = point;
  };

  const endDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPointRef.current = null;
    socketRef.current?.emit('draw:end', { roomId });
  };

  const handleClearCanvas = () => {
    if (!ctxRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const parent = canvas.parentElement;
    const parentRect = parent?.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = (parentRect?.width || canvas.width / dpr);
    const h = (parentRect?.height || canvas.height / dpr);
    ctxRef.current.clearRect(0, 0, w, h);
    socketRef.current?.emit('draw:clear', { roomId });
  };

  const handleSendGuess = () => {
    if (!guessText.trim() || guessed) return;
    const text = guessText.trim();

    if (text === word) {
      // 答对：公屏不显示原答案，只显示「猜对了」标记 + 系统得分提示，
      // 也不把答案内容广播给其他玩家（防止泄漏给还没猜出的人）
      const myOpenid = profile?.openid || 'user_001';
      setGuessed(true);
      guessedSetRef.current.add(myOpenid);
      const bonus = Math.floor(timeLeft * 5 + 50);
      setScores((prev) =>
        prev.map((s) =>
          s.openid === myOpenid ? { ...s, score: s.score + bonus } : s
        )
      );
      addSystemMessage(`${profile?.nickname} 猜对了！+${bonus}分`);
      const correctMsg: ChatMessage = {
        _id: `msg_${Date.now()}_correct_${myOpenid}`,
        roomId,
        openid: myOpenid,
        nickname: profile?.nickname || '我',
        avatar: '',
        content: '猜对了！',
        type: 'correct',
        createTime: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, correctMsg]);
      // 通知房间内其他玩家：我猜对了，让他们同步我的分数并判断是否全员猜对
      socketRef.current?.emit('game:correct', {
        roomId,
        openid: myOpenid,
        nickname: profile?.nickname || '我',
        bonus,
      });
      // 本机也参与判断全员是否都猜对
      checkRoundEnd();
    } else {
      // 答错：公屏显示猜测内容 + 广播给其他人；接近的话追加「很接近了」提示
      const msg: ChatMessage = {
        _id: `msg_${Date.now()}`,
        roomId,
        openid: profile?.openid || 'user_001',
        nickname: profile?.nickname || '我',
        avatar: '',
        content: text,
        type: 'chat',
        createTime: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, msg]);
      socketRef.current?.emit('chat:message', msg);

      if (word.includes(text) && text.length >= 2) {
        const closeMsg: ChatMessage = {
          ...msg,
          _id: `msg_${Date.now()}_close`,
          content: `${text}...很接近了！`,
          type: 'close',
        };
        setMessages((prev) => [...prev, closeMsg]);
        socketRef.current?.emit('chat:message', closeMsg);
      }
    }

    setGuessText('');
  };

  // 防止 handleNextRound 重复调用导致 double navigateBack
  // 场景：手动点击 + 3.5s 自动轮换 timer 在 await nextTurn 期间同时触发
  // → 两次 navigateBack → 游戏页出栈后房间页也出栈 → 返回到首页（"桌面"）
  const nextRoundInProgressRef = useRef(false);

  // 请求服务端进入下一位画者（或下一回合 / 整局结束）
  // 同步 word、drawer、round 等状态走 socket game:next-turn，
  // 避免本地自增后与其他玩家不一致
  const handleNextRound = async () => {
    // 防止重复调用：手动点击 + 自动 timer 可能同时触发
    if (nextRoundInProgressRef.current) return;
    nextRoundInProgressRef.current = true;

    try {
      // 整局已结束（已收到 game:ended 或上一次 next-turn 已让后端 ended）：直接返回房间
      if (gameEnded) {
        Taro.navigateBack();
        return;
      }
      // 判断是否最后一回合最后一位画者画完 → 整局结束
      // 是的话直接调 nextTurn 让后端把 status 改为 ended，然后返回房间，
      // 不再走「下一位画者 → 返回房间」的两步流程
      const isLastTurn =
        round === totalRounds &&
        drawerOrder.length > 0 &&
        drawerIndex === drawerOrder.length - 1;

      if (isLastTurn) {
        try {
          const nextRoom = await roomService.nextTurn(roomId);
          if (nextRoom) applyRoomState(nextRoom);
        } catch (err) {
          // 忽略错误（可能其他玩家已经触发过后端 ended），仍然返回房间
        }
        setGameEnded(true);
        Taro.navigateBack();
        return;
      }

      // 非最后一位：正常切换下一位画者
      // 关键：先重置 timeLeft 和 ref 状态，再 setShowResult(false)。
      // 否则 setShowResult(false) 会立刻触发倒计时 effect 重启，
      // 但此时 timeLeft 还是 0，定时器下一秒就会判定为「时间到」→ 立刻 handleRoundEnd → 死循环
      // 注：后面 next-turn 返回的 room 会通过 applyRoomState 进一步把 timeLeft 改成 room.drawSeconds
      setTimeLeft(drawSeconds);
      guessedSetRef.current = new Set();
      roundEndedRef.current = false;
      setShowResult(false);

      try {
        const nextRoom = await roomService.nextTurn(roomId);
        if (nextRoom) {
          applyRoomState(nextRoom);
          if (nextRoom.status === 'ended') {
            // 后端判定整局结束（理论上前面 isLastTurn 已拦截，这里是兜底）
            setGameEnded(true);
            setShowResult(true);
            return;
          }
          // 新 sub-turn 本地清画板 + 清状态
          handleClearCanvas();
          setGuessed(false);
          setMessages([]);
          addSystemMessage(`第 ${nextRoom.currentRound} 轮 · 轮到 ${nextRoom.players.find(p => p.openid === nextRoom.currentDrawer)?.nickname || '下一位玩家'} 作画！`);
        }
      } catch (err) {
        // 失败就兜底：回到结算状态并提示
        const msg = err instanceof Error ? err.message : '切换回合失败';
        addSystemMessage(msg);
        setShowResult(true);
      }
    } finally {
      // 解锁，允许下次调用（中间回合切换画者后需要重新可用）
      // 注意：navigateBack 路径走完 finally 后组件已卸载，ref 值已无影响
      nextRoundInProgressRef.current = false;
    }
  };

  // 用 ref 保存最新的 handleNextRound，避免自动轮换 effect 频繁重建
  const handleNextRoundRef = useRef(handleNextRound);
  useEffect(() => { handleNextRoundRef.current = handleNextRound; });

  // 是否最后一回合最后一位画者画完（= 整局结束）
  // 用于在弹窗第一次显示时就直接展示「游戏结束 / 返回房间」按钮，
  // 而不是先显示「下一位画者」再切换
  const isFinalTurnOrEnded =
    gameEnded ||
    (round === totalRounds &&
      drawerOrder.length > 0 &&
      drawerIndex === drawerOrder.length - 1);

  // 结算弹窗显示 3.5 秒后自动进入下一轮（仅非整局结束时）；
  // 整局结束时改为等待用户手动点击「返回房间」按钮，不自动退出
  useEffect(() => {
    if (!showResult) return;
    if (isFinalTurnOrEnded) return;
    const t = setTimeout(() => {
      handleNextRoundRef.current();
    }, 3500);
    return () => clearTimeout(t);
  }, [showResult, isFinalTurnOrEnded]);

  // 新消息来了，把消息浮层自动滚到底部（直播消息框体验）
  useEffect(() => {
    const el = chatListRef.current as any;
    if (!el) return;
    // H5 下 ref 直接是 DOM 节点；小程序下可能是组件实例
    if (typeof el.scrollTop !== 'undefined' && typeof el.scrollHeight !== 'undefined') {
      el.scrollTop = el.scrollHeight;
    } else if (typeof el.scrollTo === 'function') {
      el.scrollTo(0, 99999);
    }
  }, [messages]);

  const renderWord = () => {
    if (isDrawer) {
      return (
        <View className={styles.wordDisplay}>
          <Text className={styles.wordHintLabel}>画:</Text>
          {word.split('').map((char, idx) => (
            <View key={idx} className={styles.wordChar}>
              <Text>{char}</Text>
            </View>
          ))}
        </View>
      );
    }
    return (
      <View className={styles.wordDisplay}>
        <Text className={styles.wordHintLabel}>猜:</Text>
        {word.split('').map((_, idx) => (
          <View key={idx} className={styles.wordPlaceholder} />
        ))}
      </View>
    );
  };

  const sortedScores = [...scores].sort((a, b) => b.score - a.score);

  const isWeapp = process.env.TARO_ENV === 'weapp';

  return (
    <View className={styles.container}>
      <View className={styles.topBar}>
        <View className={styles.topRow}>
          <View className={styles.roundInfo}>
            <Text className={styles.roundText}>第{round}/{totalRounds}轮</Text>
          </View>
          <View className={styles.timerCenter}>
            <Text className={styles.timerBig}>{timeLeft}s</Text>
          </View>
          <View className={styles.exitBtn} onClick={handleExit}>
            <Text className={styles.exitBtnText}>退出</Text>
          </View>
        </View>
        {renderWord()}
      </View>

      <View className={styles.scoreBar}>
        {scores.map((s) => (
          <View
            key={s.openid}
            className={classnames(
              styles.scoreItem,
              s.openid === currentDrawer && styles.scoreItemDrawing
            )}
          >
            <Text className={styles.scoreName}>{s.nickname}</Text>
          </View>
        ))}
      </View>

      <View className={styles.canvasArea}>
        {isWeapp ? (
          <Canvas
            canvasId="drawCanvas"
            id="drawCanvas"
            className={styles.canvas}
            onTouchStart={startDrawing}
            onTouchMove={moveDrawing}
            onTouchEnd={endDrawing}
          />
        ) : (
          <canvas
            ref={canvasRef}
            id="drawCanvas"
            className={styles.canvas}
            onTouchStart={startDrawing}
            onTouchMove={moveDrawing}
            onTouchEnd={endDrawing}
            onMouseDown={startDrawing}
            onMouseMove={moveDrawing}
            onMouseUp={endDrawing}
            onMouseLeave={endDrawing}
          />
        )}

        {/* 直播样式消息浮层：黑底半透明，浮在画板左侧，不顶画板 */}
        <ScrollView scrollY className={styles.chatOverlay} ref={chatListRef}>
          {messages.length === 0 ? (
            <Text className={styles.overlayEmpty}>快开始猜词吧！</Text>
          ) : (
            messages.map((msg) => (
              <View key={msg._id} className={styles.overlayItem}>
                {msg.type === 'system' ? (
                  <Text className={styles.overlaySystem}>{msg.content}</Text>
                ) : (
                  <Text className={styles.overlayText}>
                    <Text className={styles.overlayName}>{msg.nickname}: </Text>
                    <Text
                      className={classnames(
                        msg.type === 'correct' && styles.chatCorrect,
                        msg.type === 'close' && styles.chatClose
                      )}
                    >
                      {msg.content}
                    </Text>
                  </Text>
                )}
              </View>
            ))
          )}
        </ScrollView>
      </View>

      {isDrawer && (
        <View className={styles.toolbar}>
          <View className={styles.colorPicker}>
            {COLORS.map((color) => (
              <View
                key={color}
                className={classnames(
                  styles.colorDot,
                  selectedColor === color && !isEraser && styles.colorActive
                )}
                style={{ background: color }}
                onClick={() => {
                  setSelectedColor(color);
                  setIsEraser(false);
                }}
              />
            ))}
          </View>
          <View className={styles.brushSizes}>
            {BRUSH_SIZES.map((size) => (
              <View
                key={size}
                className={classnames(
                  styles.brushSize,
                  brushSize === size && styles.brushSizeActive
                )}
                onClick={() => setBrushSize(size)}
              >
                <View
                  className={styles.brushDot}
                  style={{ width: `${size * 1.5}rpx`, height: `${size * 1.5}rpx` }}
                />
              </View>
            ))}
          </View>
          <View
            className={classnames(styles.toolBtn, isEraser && styles.toolActive)}
            onClick={() => setIsEraser(!isEraser)}
          >
            <Text>🧹</Text>
          </View>
          <View className={styles.toolBtn} onClick={handleClearCanvas}>
            <Text>🗑</Text>
          </View>
        </View>
      )}

      <View className={styles.inputArea}>
        {isDrawer ? (
          <Text className={styles.viewerHint}>你正在绘画，其他玩家在猜词...</Text>
        ) : guessed ? (
          <Text className={styles.viewerHint}>已猜对！等待回合结束...</Text>
        ) : (
          isWeapp ? (
            <>
              <Input
                className={styles.guessInput}
                placeholder="输入你的猜测..."
                value={guessText}
                onInput={(e) => setGuessText(e.detail.value)}
                onConfirm={handleSendGuess}
                confirmType="send"
              />
              <Button
                className={classnames(styles.sendBtn, !guessText.trim() && styles.sendBtnDisabled)}
                onClick={handleSendGuess}
                disabled={!guessText.trim()}
              >
                <Text className={styles.sendBtnText}>发送</Text>
              </Button>
            </>
          ) : (
            <>
              <input
                className={styles.guessInput}
                placeholder="输入你的猜测..."
                value={guessText}
                onChange={(e) => setGuessText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendGuess();
                }}
              />
              <button
                className={classnames(styles.sendBtn, !guessText.trim() && styles.sendBtnDisabled)}
                onClick={handleSendGuess}
                disabled={!guessText.trim()}
                >
                  发送
                </button>
              </>
            )
          )}
        </View>

      {showResult && (
        <View className={styles.overlay}>
          <View className={styles.resultModal}>
            <Text className={styles.resultTitle}>
              {isFinalTurnOrEnded ? '游戏结束' : '本回合结束'}
            </Text>
            <Text className={styles.resultWord}>
              正确答案: <Text className={styles.resultWordText}>{word}</Text>
            </Text>
            <View className={styles.resultList}>
              {sortedScores.map((s, idx) => (
                <View key={s.openid} className={styles.resultItem}>
                  <Text className={styles.resultRank}>{idx + 1}</Text>
                  <Text className={styles.resultName}>{s.nickname}</Text>
                  <Text className={styles.resultScore}>{s.score}分</Text>
                </View>
              ))}
            </View>
            <Button className={styles.resultBtn} onClick={handleNextRound}>
              {isFinalTurnOrEnded ? '返回房间' : '下一位画者'}
            </Button>
          </View>
        </View>
      )}

      <ConfirmModal
        visible={showExitModal}
        title="退出游戏"
        content="确定要退出本局游戏吗？"
        onConfirm={handleExitConfirm}
        onCancel={() => setShowExitModal(false)}
      />

      <ConfirmModal
        visible={showForceExitModal}
        title="游戏结束"
        content="其他玩家已离开，本局游戏被迫结束"
        confirmText="返回首页"
        showCancel={false}
        onConfirm={handleForceExit}
      />
    </View>
  );
};

export default GamePage;
