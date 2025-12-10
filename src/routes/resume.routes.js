import express from 'express';
import multer from 'multer';
import { isAuth } from '../middlewares/auth.middleware.js'; // Your existing auth middleware
import * as resumeController from '../controllers/resume.controller.js';
import ApiError from '../utils/ApiError.js';
import { extendTimeout } from '../middlewares/extendTimeout.middleware.js';
import { checkAndReserveCoins } from '../middlewares/coin.middleware.js';

const router = express.Router();

// --- MULTER CONFIG (In-Memory Storage) ---
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB Limit
});

router.post(
  '/analyze',
  isAuth,
  extendTimeout(200000), // ✅ Add 3-minute timeout for this route
  upload.single('resume'),
  checkAndReserveCoins,
  resumeController.analyze
);

export default router;
