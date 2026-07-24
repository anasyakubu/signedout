import { Schema, model, Document, Types } from 'mongoose';

export interface IPromoCode extends Document {
  _id: Types.ObjectId;
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  currency?: 'NGN' | 'USD'; // required when discountType is 'fixed'
  maxUses?: number;
  usedCount: number;
  expiresAt?: Date;
  applicablePurposes: string[];
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

const promoSchema = new Schema<IPromoCode>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    discountType: { type: String, enum: ['percent', 'fixed'], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['NGN', 'USD'] },
    maxUses: { type: Number, min: 1 },
    usedCount: { type: Number, default: 0 },
    expiresAt: { type: Date },
    applicablePurposes: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const PromoCode = model<IPromoCode>('PromoCode', promoSchema);
