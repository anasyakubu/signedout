import { Schema, model, Document, Types } from 'mongoose';

export interface ISignature extends Document {
  _id: Types.ObjectId;
  ceremonyId: Types.ObjectId;
  authorUserId?: Types.ObjectId;
  guestName?: string;
  type: 'text' | 'draw' | 'image';
  content: string; // text string, or URL of drawn/uploaded asset
  fontFamily?: string;
  color?: string;
  fontSize?: number; // fraction of panel width (resolution independent)
  side: 'front' | 'back';
  x: number;
  y: number;
  rotation: number;
  scale: number;
  moderationStatus: 'visible' | 'hidden';
  createdAt: Date;
}

const signatureSchema = new Schema<ISignature>(
  {
    ceremonyId: { type: Schema.Types.ObjectId, ref: 'Ceremony', required: true },
    authorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    guestName: { type: String, trim: true, maxlength: 60 },
    type: { type: String, enum: ['text', 'draw', 'image'], required: true },
    content: { type: String, required: true, maxlength: 1000 },
    fontFamily: { type: String, maxlength: 60 },
    color: { type: String, match: /^#[0-9A-Fa-f]{6}$/ },
    fontSize: { type: Number, min: 0.01, max: 0.3 },
    side: { type: String, enum: ['front', 'back'], required: true },
    x: { type: Number, required: true, min: 0, max: 1 },
    y: { type: Number, required: true, min: 0, max: 1 },
    rotation: { type: Number, default: 0, min: -180, max: 180 },
    scale: { type: Number, default: 0.2, min: 0.02, max: 1 },
    moderationStatus: { type: String, enum: ['visible', 'hidden'], default: 'visible' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

signatureSchema.index({ ceremonyId: 1, createdAt: 1 });

export const Signature = model<ISignature>('Signature', signatureSchema);
