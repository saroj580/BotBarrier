import express from 'express';
import * as paymentController from '../controllers/paymentController.js';
import { paymentBotDetection } from '../middleware/paymentBotDetection.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { paymentLimiter } from '../middleware/botDetection.js';
import { 
  initiatePaymentSchema, 
  processPaymentSchema, 
  paymentStatusSchema,
  paymentHistorySchema 
} from '../validation/paymentSchemas.js';

const router = express.Router();

router.use(requireAuth);
router.use(paymentLimiter);

router.post(
  '/initiate',
  paymentBotDetection(),
  validate(initiatePaymentSchema),
  paymentController.initiatePayment
);

router.post(
  '/process',
  validate(processPaymentSchema),
  paymentController.processPayment
);

router.get('/status/:transactionId', validate(paymentStatusSchema, 'params'), paymentController.getPaymentStatus);

router.get('/history', validate(paymentHistorySchema, 'query'), paymentController.getPaymentHistory);

router.post('/update-pending', paymentController.updatePendingPayments);

export default router;
