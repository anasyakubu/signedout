import { Request, Response, NextFunction } from 'express';
import { User, toPublicUser } from '../models/User';
import { HttpError } from '../middleware/errorHandler';

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await User.findById(req.auth!.sub);
    if (!user) throw new HttpError(404, 'Account not found.');
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req: Request, res: Response, next: NextFunction) {
  try {
    const updates = req.body as Partial<{
      name: string;
      bio: string;
      department: string;
      school: string;
      graduationYear: number;
    }>;
    const user = await User.findByIdAndUpdate(req.auth!.sub, updates, {
      new: true,
      runValidators: true,
    });
    if (!user) throw new HttpError(404, 'Account not found.');
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}
