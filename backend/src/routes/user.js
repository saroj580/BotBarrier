import express from 'express';
import * as adminController from '../controllers/adminController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);

router.get('/logs', adminController.getUserLogs);

export default router;
