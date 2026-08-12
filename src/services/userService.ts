import { callFunction } from './cloud';
import type { UserProfile } from '@/types/user';

export const userService = {
  async getUserProfile(): Promise<UserProfile> {
    return callFunction<UserProfile>('auth/profile');
  },

  async updateProfile(data: Partial<UserProfile>): Promise<void> {
    await callFunction('auth/profile/update', data);
  },
};
