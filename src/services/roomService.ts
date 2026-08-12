import { callFunction } from './cloud';
import type { Room, CreateRoomParams } from '@/types/room';

export const roomService = {
  async getRooms(): Promise<Room[]> {
    return callFunction<Room[]>('getRooms');
  },

  async createRoom(params: CreateRoomParams): Promise<Room> {
    return callFunction<Room>('rooms', params);
  },

  async joinRoom(roomCode: string): Promise<Room> {
    return callFunction<Room>('rooms/join', { roomCode });
  },

  async leaveRoom(roomId: string): Promise<void> {
    await callFunction('rooms/leave', { roomId });
  },

  async getRoomById(roomId: string): Promise<Room> {
    return callFunction<Room>(`rooms/${roomId}`);
  },

  async toggleReady(roomId: string): Promise<Room> {
    return callFunction<Room>('rooms/ready', { roomId });
  },

  async startGame(roomId: string): Promise<Room> {
    return callFunction<Room>('rooms/start', { roomId });
  },

  async kickPlayer(roomId: string, openid: string): Promise<Room> {
    return callFunction<Room>('rooms/kick', { roomId, openid });
  },

  /** 当前画者完成（时间到 / 全员猜对），切换到下一位画者或下一回合 */
  async nextTurn(roomId: string): Promise<Room> {
    return callFunction<Room>('rooms/next-turn', { roomId });
  },

  /** 房主修改房间设置（仅 waiting 状态可改，游戏开始后禁用） */
  async updateSettings(params: {
    roomId: string;
    name?: string;
    maxPlayers?: number;
    totalRounds?: number;
    drawSeconds?: number;
  }): Promise<Room> {
    return callFunction<Room>('rooms/settings', params);
  },
};
