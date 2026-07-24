import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Group, memberRole } from '../models/Group';
import { User, toPublicUser } from '../models/User';
import { Ceremony } from '../models/Ceremony';
import { getSettings } from '../models/SiteSettings';
import { HttpError } from '../middleware/errorHandler';
import { makeJoinCode } from '../utils/slug';

async function capacityCheck(group: { members: unknown[]; upgraded: boolean }) {
  const settings = await getSettings();
  if (!settings.monetizationEnabled || !settings.featureGates.groupMembers.enabled) return null;
  if (group.upgraded) return null;
  if (group.members.length >= settings.featureGates.groupMembers.freeLimit) {
    return {
      error: `This group has reached its free limit of ${settings.featureGates.groupMembers.freeLimit} members.`,
      paymentRequired: { purpose: 'group_upgrade', pricing: settings.pricing.groupUpgrade },
    };
  }
  return null;
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.auth!.sub;
    const group = await Group.create({
      name: req.body.name,
      ownerId: userId,
      members: [{ userId, role: 'owner', joinedAt: new Date() }],
      joinCode: makeJoinCode(),
    });
    res.status(201).json({ group });
  } catch (err) {
    next(err);
  }
}

export async function listMine(req: Request, res: Response, next: NextFunction) {
  try {
    const groups = await Group.find({ 'members.userId': req.auth!.sub }).sort({ createdAt: -1 });
    res.json({ groups });
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const group = await Group.findById(req.params.id).populate(
      'members.userId',
      'name email avatarUrl'
    );
    if (!group) throw new HttpError(404, 'Group not found.');
    const raw = await Group.findById(req.params.id);
    const role = memberRole(raw!, req.auth!.sub);
    if (!role) throw new HttpError(403, 'You are not a member of this group.');
    const ceremonies = await Ceremony.find({ groupId: group._id }).sort({ createdAt: -1 });
    res.json({ group, ceremonies, myRole: role });
  } catch (err) {
    next(err);
  }
}

/**
 * Invite by email: adds an existing SignedOut account directly. If no account
 * exists for that email yet, we tell the inviter to share the join link — an
 * outbound-email invite flow can layer on once an email provider is wired up.
 */
export async function invite(req: Request, res: Response, next: NextFunction) {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) throw new HttpError(404, 'Group not found.');
    const role = memberRole(group, req.auth!.sub);
    if (role !== 'owner' && role !== 'editor') {
      throw new HttpError(403, 'Only group owners and editors can invite members.');
    }
    const email = String(req.body.email ?? '').toLowerCase().trim();
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        error: 'No SignedOut account uses that email yet. Share the join link with them instead.',
        joinCode: group.joinCode,
      });
    }
    if (memberRole(group, user._id.toString())) {
      throw new HttpError(409, 'They are already in this group.');
    }
    const full = await capacityCheck(group);
    if (full) return res.status(402).json(full);
    group.members.push({ userId: user._id, role: 'member', joinedAt: new Date() });
    await group.save();
    res.json({ group, added: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function join(req: Request, res: Response, next: NextFunction) {
  try {
    const group = await Group.findOne({ joinCode: req.params.joinCode.toUpperCase() });
    if (!group) throw new HttpError(404, 'That join code is not valid.');
    const userId = req.auth!.sub;
    if (memberRole(group, userId)) {
      return res.json({ group, alreadyMember: true });
    }
    const full = await capacityCheck(group);
    if (full) return res.status(402).json(full);
    group.members.push({ userId: new Types.ObjectId(userId), role: 'member', joinedAt: new Date() });
    await group.save();
    res.json({ group, alreadyMember: false });
  } catch (err) {
    next(err);
  }
}

export async function changeMemberRole(req: Request, res: Response, next: NextFunction) {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) throw new HttpError(404, 'Group not found.');
    if (memberRole(group, req.auth!.sub) !== 'owner') {
      throw new HttpError(403, 'Only the group owner can change member roles.');
    }
    const targetId = req.params.userId;
    if (targetId === group.ownerId.toString()) {
      throw new HttpError(400, 'The owner role cannot be changed here.');
    }
    const newRole = req.body.role;
    if (!['editor', 'member'].includes(newRole)) {
      throw new HttpError(400, 'Role must be editor or member.');
    }
    const member = group.members.find((m) => m.userId.toString() === targetId);
    if (!member) throw new HttpError(404, 'That person is not in this group.');
    member.role = newRole;
    await group.save();
    res.json({ group });
  } catch (err) {
    next(err);
  }
}
