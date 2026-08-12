import mongoose, { Schema, Document } from 'mongoose';

export interface IAdmin extends Document {
  username: string;
  password: string;
  nickname: string;
  role: 'super' | 'admin';
  lastLoginAt: string;
  createTime: string;
}

const AdminSchema = new Schema<IAdmin>({
  username: { type: String, required: true, unique: true, trim: true, minlength: 2, maxlength: 20 },
  password: { type: String, required: true },
  nickname: { type: String, required: true, trim: true, maxlength: 20 },
  role: { type: String, enum: ['super', 'admin'], default: 'admin' },
  lastLoginAt: { type: String, default: '' },
  createTime: { type: String, default: () => new Date().toISOString() },
});

// 返回时自动删除 password 与 __v
AdminSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  obj._id = obj._id.toString();
  return obj;
};

export const Admin = mongoose.model<IAdmin>('Admin', AdminSchema);
