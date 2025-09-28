import express from 'express';
import authRouter from './auth.js';
import adminRouter from './admin.js';
import userRouter from './user.js';
import captchaRouter from './captcha.js';
import paymentRouter from './payment.js';
import healthRouter from './health.js';

export const apiRouter = express.Router();

// Health routes (no rate limiting or authentication)
apiRouter.use('/health', healthRouter);

// Protected routes
apiRouter.use('/auth', authRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/user', userRouter);
apiRouter.use('/captcha', captchaRouter);
apiRouter.use('/payment', paymentRouter);


