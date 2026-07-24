import { ITransaction, Transaction } from '../models/Transaction';
import { Ceremony } from '../models/Ceremony';
import { Group } from '../models/Group';
import { User } from '../models/User';
import { consumePromo } from './pricing';

/**
 * Applies whatever a successful payment unlocked. Idempotent: guarded by
 * fulfilledAt so a webhook and a client-side verify racing each other cannot
 * double-apply.
 */
export async function fulfill(tx: ITransaction): Promise<void> {
  const fresh = await Transaction.findOneAndUpdate(
    { _id: tx._id, fulfilledAt: { $exists: false } },
    { $set: { status: 'success', fulfilledAt: new Date() } },
    { new: true }
  );
  if (!fresh) return; // already fulfilled

  switch (fresh.purpose) {
    case 'download_unlock':
      if (fresh.ceremonyId) {
        await Ceremony.updateOne({ _id: fresh.ceremonyId }, { $set: { isPaidTier: true } });
      }
      break;
    case 'group_upgrade':
      if (fresh.groupId) {
        await Group.updateOne({ _id: fresh.groupId }, { $set: { upgraded: true } });
      }
      break;
    case 'ceremony_creation':
      await User.updateOne({ _id: fresh.userId }, { $inc: { ceremonyCredits: 1 } });
      break;
  }
  await consumePromo(fresh.promoCodeUsed);
}
