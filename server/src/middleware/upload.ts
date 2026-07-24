import multer from 'multer';

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PNG, JPEG, or WebP images are allowed.'));
  },
});
