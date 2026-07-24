import { Schema, model, Document } from 'mongoose';

export interface ISiteSettings extends Document {
  monetizationEnabled: boolean;
  featureGates: {
    ceremonyCreation: { enabled: boolean; freeLimit: number };
    designDownload: { enabled: boolean };
    groupMembers: { enabled: boolean; freeLimit: number };
  };
  pricing: {
    ceremonyCreation: { NGN: number; USD: number };
    designDownload: { NGN: number; USD: number };
    groupUpgrade: { NGN: number; USD: number };
  };
  gateways: {
    paystack: { enabled: boolean };
    flutterwave: { enabled: boolean };
  };
  currencyRouting: { NGN: 'paystack' | 'flutterwave'; USD: 'paystack' | 'flutterwave' };
}

const price = { NGN: { type: Number, min: 0 }, USD: { type: Number, min: 0 } };

const settingsSchema = new Schema<ISiteSettings>({
  monetizationEnabled: { type: Boolean, default: false },
  featureGates: {
    ceremonyCreation: {
      enabled: { type: Boolean, default: false },
      freeLimit: { type: Number, default: 2, min: 0 },
    },
    designDownload: { enabled: { type: Boolean, default: false } },
    groupMembers: {
      enabled: { type: Boolean, default: false },
      freeLimit: { type: Number, default: 15, min: 1 },
    },
  },
  pricing: {
    ceremonyCreation: price,
    designDownload: price,
    groupUpgrade: price,
  },
  gateways: {
    paystack: { enabled: { type: Boolean, default: true } },
    flutterwave: { enabled: { type: Boolean, default: true } },
  },
  currencyRouting: {
    NGN: { type: String, enum: ['paystack', 'flutterwave'], default: 'paystack' },
    USD: { type: String, enum: ['paystack', 'flutterwave'], default: 'flutterwave' },
  },
});

export const SiteSettings = model<ISiteSettings>('SiteSettings', settingsSchema);

export async function getSettings(): Promise<ISiteSettings> {
  let doc = await SiteSettings.findOne();
  if (!doc) {
    doc = await SiteSettings.create({
      pricing: {
        ceremonyCreation: { NGN: 1000, USD: 2 },
        designDownload: { NGN: 2500, USD: 5 },
        groupUpgrade: { NGN: 5000, USD: 8 },
      },
    });
  }
  return doc;
}
