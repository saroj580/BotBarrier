import express from 'express';
import * as authController from '../controllers/authController.js';
import { validate } from '../middleware/validate.js';
import { signupSchema, loginSchema } from '../validation/authSchemas.js';
import { authLimiter } from '../middleware/botDetection.js';

const router = express.Router();

router.use(authLimiter);

router.post('/signup', validate(signupSchema), authController.signup);
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authController.logout);

export default router;


