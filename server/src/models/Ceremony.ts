import { Schema, model, Document, Types } from 'mongoose';

export interface IBaseAsset {
  _id?: Types.ObjectId;
  url: string;
  side: 'front' | 'back';
  x: number; // normalized 0..1, center of asset relative to panel width
  y: number; // normalized 0..1, center relative to panel height
  scale: number; // fraction of panel width the asset occupies
  rotation: number; // degrees
}

export interface ICeremony extends Document {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  date: Date;
  ownerId: Types.ObjectId;
  groupId?: Types.ObjectId;
  slug: string;
  visibility: 'public' | 'invite' | 'group';
  shirtColor: string;
  garment: string;
  baseAssets: IBaseAsset[];
  isLocked: boolean;
  isPaidTier: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const assetSchema = new Schema<IBaseAsset>(
  {
    url: { type: String, required: true },
    side: { type: String, enum: ['front', 'back'], required: true },
    x: { type: Number, required: true, min: 0, max: 1 },
    y: { type: Number, required: true, min: 0, max: 1 },
    scale: { type: Number, required: true, min: 0.02, max: 1 },
    rotation: { type: Number, default: 0, min: -180, max: 180 },
  },
  { _id: true }
);

const ceremonySchema = new Schema<ICeremony>(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000 },
    date: { type: Date, required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', index: true },
    slug: { type: String, required: true, unique: true, index: true },
    visibility: { type: String, enum: ['public', 'invite', 'group'], default: 'public' },
    shirtColor: { type: String, default: '#FFFFFF', match: /^#[0-9A-Fa-f]{6}$/ },
    garment: {
      type: String,
      // Mirrors GARMENTS in client/src/three/garments.ts. Adding a garment
      // there means adding its id here too, or the PATCH is rejected.
      enum: ['classic-tee','oversized-tee','boxy-tee','long-sleeve','crewneck','hoodie','polo'],
      default: 'classic-tee',
    },
    baseAssets: { type: [assetSchema], default: [] },
    isLocked: { type: Boolean, default: false },
    isPaidTier: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Ceremony = model<ICeremony>('Ceremony', ceremonySchema);
