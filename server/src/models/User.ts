import { Schema, model, Document, Types } from 'mongoose';

export type AuthProvider = 'local' | 'google' | 'both';
export type PlatformRole = 'user' | 'admin';

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash?: string;
  googleId?: string;
  authProvider: AuthProvider;
  avatarUrl?: string;
  role: PlatformRole;
  bio?: string;
  department?: string;
  school?: string;
  graduationYear?: number;
  refreshTokenHash?: string;
  ceremonyCredits: number;
  isSuspended: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String },
    googleId: { type: String, index: true, sparse: true },
    authProvider: { type: String, enum: ['local', 'google', 'both'], required: true },
    avatarUrl: { type: String },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    bio: { type: String, maxlength: 500 },
    department: { type: String, maxlength: 120 },
    school: { type: String, maxlength: 160 },
    graduationYear: { type: Number, min: 1950, max: 2100 },
    refreshTokenHash: { type: String, select: false },
    ceremonyCredits: { type: Number, default: 0, min: 0 },
    isSuspended: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export function toPublicUser(user: IUser) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    authProvider: user.authProvider,
    avatarUrl: user.avatarUrl ?? null,
    role: user.role,
    bio: user.bio ?? null,
    department: user.department ?? null,
    school: user.school ?? null,
    graduationYear: user.graduationYear ?? null,
    createdAt: user.createdAt,
  };
}

export const User = model<IUser>('User', userSchema);
