import express from 'express';
import multer from 'multer';
import { isAuth } from '../middlewares/auth.middleware.js';
import * as resumeController from '../controllers/resume.controller.js';
import ApiError from '../utils/ApiError.js';
import { extendTimeout } from '../middlewares/extendTimeout.middleware.js';
import { checkAndReserveCoins } from '../middlewares/coin.middleware.js';

const router = express.Router();

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Invalid file type. Only PDF and DOCX are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

router.post(
  '/analyze',
  isAuth,
  extendTimeout(120000),
  upload.single('resume'),
  checkAndReserveCoins,
  resumeController.analyze
);

// --- ERROR HANDLING MIDDLEWARE ---
// This specifically catches Multer errors like "File too large"
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'The resume file is too large. Please upload a file smaller than 5MB.',
      });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
});

export default router;
