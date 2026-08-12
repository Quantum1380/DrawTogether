export default async function (data?: Record<string, any>) {
  return {
    _id: data?.roomId || 'room_001',
    roomCode: 'A8F3K',
    name: '欢乐绘画房',
    owner: 'user_001',
    ownerNickname: '快乐小画家',
    players: [
      { openid: 'user_001', nickname: '快乐小画家', avatar: '', score: 0, isReady: true, isOwner: true, status: 'online' },
      { openid: 'user_002', nickname: '画画小天才', avatar: '', score: 0, isReady: true, isOwner: false, status: 'online' },
    ],
    maxPlayers: 6,
    status: 'waiting',
    currentRound: 0,
    totalRounds: 3,
    createTime: new Date().toISOString(),
  };
}
