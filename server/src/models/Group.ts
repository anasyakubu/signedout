import { Schema, model, Document, Types } from 'mongoose';

export type GroupRole = 'owner' | 'editor' | 'member';

export interface IGroupMember {
  userId: Types.ObjectId;
  role: GroupRole;
  joinedAt: Date;
}

export interface IGroup extends Document {
  _id: Types.ObjectId;
  name: string;
  ownerId: Types.ObjectId;
  members: IGroupMember[];
  joinCode: string;
  upgraded: boolean; // paid member-cap upgrade
  createdAt: Date;
}

const groupSchema = new Schema<IGroup>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    members: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        role: { type: String, enum: ['owner', 'editor', 'member'], required: true },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    joinCode: { type: String, required: true, unique: true, index: true },
    upgraded: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export function memberRole(group: IGroup, userId: string): GroupRole | null {
  const m = group.members.find((x) => x.userId.toString() === userId);
  return m ? m.role : null;
}

export const Group = model<IGroup>('Group', groupSchema);
