import express from 'express';

import { myProfile, adminController } from '../controllers/user.controller.js';

import { isAuth, isAdmin } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/me', isAuth, myProfile);

router.get('/admin', isAuth, isAdmin, adminController);

export default router;
