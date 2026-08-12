import { WORD_BANK } from '@/types/game';

export default async function (data?: Record<string, any>) {
  const roomId = data?.roomId;
  const word = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
  return {
    _id: roomId || 'room_001',
    roomCode: 'A8F3K',
    name: '欢乐绘画房',
    owner: 'user_001',
    ownerNickname: '快乐小画家',
    players: [
      { openid: 'user_001', nickname: '快乐小画家', avatar: '', score: 0, isReady: true, isOwner: true, status: 'online' },
      { openid: 'user_002', nickname: '画画小天才', avatar: '', score: 0, isReady: true, isOwner: false, status: 'online' },
    ],
    maxPlayers: 6,
    status: 'playing',
    currentRound: 1,
    totalRounds: 3,
    currentDrawer: 'user_001',
    currentWord: word,
    createTime: new Date().toISOString(),
  };
}
