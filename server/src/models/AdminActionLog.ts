import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminActionLog extends Document {
  adminId: string;
  adminName: string;
  action: 'ban' | 'unban' | 'login' | 'logout';
  targetType: 'player' | 'admin';
  targetId: string;
  targetName: string;
  detail: string;
  time: string;
}

const AdminActionLogSchema = new Schema<IAdminActionLog>({
  adminId: { type: String, required: true, index: true },
  adminName: { type: String, required: true },
  action: { type: String, enum: ['ban', 'unban', 'login', 'logout'], required: true },
  targetType: { type: String, enum: ['player', 'admin'], default: 'player' },
  targetId: { type: String, default: '' },
  targetName: { type: String, default: '' },
  detail: { type: String, default: '' },
  time: { type: String, required: true, default: () => new Date().toISOString() },
});

AdminActionLogSchema.index({ time: -1 });

export const AdminActionLog = mongoose.model<IAdminActionLog>('AdminActionLog', AdminActionLogSchema);
