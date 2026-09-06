export interface BaseAsset {
  _id?: string;
  url: string;
  side: 'front' | 'back';
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface CeremonyData {
  _id?: string;
  id?: string;
  title: string;
  description?: string;
  date: string;
  slug: string;
  visibility: 'public' | 'invite' | 'group';
  shirtColor: string;
  garment?: string;
  baseAssets: BaseAsset[];
  isLocked: boolean;
  isPaidTier?: boolean;
  groupId?: string;
  ownerId?: string;
  createdAt?: string;
}

export interface SignatureData {
  _id: string;
  type: 'text' | 'draw' | 'image';
  content: string;
  fontFamily?: string;
  color?: string;
  fontSize?: number;
  side: 'front' | 'back';
  x: number;
  y: number;
  rotation: number;
  scale: number;
  guestName?: string;
  authorUserId?: string;
  createdAt: string;
}

export interface GroupMember {
  userId: { _id: string; name: string; email: string; avatarUrl?: string } | string;
  role: 'owner' | 'editor' | 'member';
  joinedAt: string;
}

export interface GroupData {
  _id: string;
  name: string;
  ownerId: string | { _id: string; name: string; email: string };
  members: GroupMember[];
  joinCode: string;
  upgraded: boolean;
  createdAt: string;
}

export const SIGNATURE_FONTS = [
  'Caveat',
  'Dancing Script',
  'Homemade Apple',
  'Shadows Into Light',
  'Public Sans',
  'Young Serif',
];

export interface PaymentRequiredInfo {
  purpose: 'ceremony_creation' | 'download_unlock' | 'group_upgrade';
  pricing: { NGN: number; USD: number };
}
