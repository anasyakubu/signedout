import { Schema, model, Document, Types } from 'mongoose';

export type TxPurpose = 'ceremony_creation' | 'download_unlock' | 'group_upgrade';

export interface ITransaction extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  ceremonyId?: Types.ObjectId;
  groupId?: Types.ObjectId;
  purpose: TxPurpose;
  amount: number; // major units of currency, after promo
  currency: 'NGN' | 'USD';
  gateway: string; // 'paystack' | 'flutterwave' | 'promo' (100%-off codes)
  gatewayReference: string;
  status: 'pending' | 'success' | 'failed';
  promoCodeUsed?: string;
  fulfilledAt?: Date;
  createdAt: Date;
}

const txSchema = new Schema<ITransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ceremonyId: { type: Schema.Types.ObjectId, ref: 'Ceremony' },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group' },
    purpose: {
      type: String,
      enum: ['ceremony_creation', 'download_unlock', 'group_upgrade'],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['NGN', 'USD'], required: true },
    gateway: { type: String, required: true },
    gatewayReference: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
    promoCodeUsed: { type: String },
    fulfilledAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Transaction = model<ITransaction>('Transaction', txSchema);
