import mongoose from 'mongoose';
import { PaymentTransaction } from '../models/PaymentTransaction.js';
import { SuspiciousLog } from '../models/SuspiciousLog.js';
import { emitSuspicious, recordSuspicious } from '../services/realtime.js';
import { initConfig } from '../config/index.js';
import { getMLBotScore, getMLServiceStatus } from '../services/mlScore.js';
import { addMLProcessingJob } from '../services/queue.js';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/errorHandler.js';

const config = initConfig();

function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function simulatePaymentProcessing(paymentData) {
  const { amount, currency, paymentMethod, userId } = paymentData;

  await new Promise(resolve => setTimeout(resolve, 1000));

  const success = amount < 10000; // Reject payments over $10,000

  return {
    success,
    transactionId: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    amount,
    currency,
    status: success ? 'completed' : 'failed',
    message: success ? 'Payment processed successfully' : 'Payment amount too high'
  };
}

export const initiatePayment = asyncHandler(async (req, res) => {
  const { platform, ticketId, amount: rawAmount, currency = 'INR', paymentMethod, ticketType, metadata, deviceFingerprint, geoData } = req.body;
  const amount = parseFloat(rawAmount) || 0; 
  const userId = req.user?.id;
  const ip = req.ip;
  const userAgent = req.get('user-agent') || '';

  if (!userId) {
    throw new ValidationError('User authentication required');
  }
  if (amount <= 0) { 
    throw new ValidationError('Invalid amount');
  }
  if (!['INR', 'USD', 'EUR', 'GBP'].includes(currency)) { 
    throw new ValidationError('Unsupported currency');
  }

  const sessionId = generateSessionId();

  const botFeatures = {
    ip: ip || '',
    userAgent: userAgent,
    platform: platform,
    amount: amount, 
    currency: currency,
    ticketId: ticketId,
    userId: userId.toString(), 
    geoData: geoData || {},
    deviceFingerprint: deviceFingerprint || '',
    riskFactors: req.botDetection?.riskFactors || {},
    heuristics: req.botDetection?.heuristics || {},
    headlessBrowser: req.botDetection?.riskFactors?.headlessBrowser || false,
    missingJsChallenge: req.botDetection?.riskFactors?.missingJsChallenge || false,
    geoMismatch: req.botDetection?.riskFactors?.geoMismatch || false,
    rapidPurchase: req.botDetection?.riskFactors?.rapidPurchase || false,
    multipleDevices: req.botDetection?.riskFactors?.multipleDevices || false,
    unusualTiming: req.botDetection?.riskFactors?.unusualTiming || false
  };

  const initialBotScore = req.botDetection?.score || 0;
  const detectionReasons = req.botDetection?.detectionReasons || [];

  const transaction = await PaymentTransaction.create({
    userId,
    sessionId,
    ticketId,
    platform,
    amount, 
    currency,
    status: 'pending',
    botScore: initialBotScore,
    botDetectionReasons: detectionReasons,
    paymentMethod,
    ip,
    userAgent,
    geoData: req.botDetection?.geoData || {},
    deviceFingerprint: req.botDetection?.deviceFingerprint || '',
    riskFactors: req.botDetection?.riskFactors || {},
    metadata: { ...(metadata || {}), ticketType },
    verificationSteps: [{
      step: 'bot_detection',
      passed: initialBotScore < 0.6,
      timestamp: new Date(),
      details: {
        score: initialBotScore,
        reasons: detectionReasons,
        method: 'heuristic'
      }
    }]
  });

  try {
    await addMLProcessingJob(transaction._id, botFeatures);
    console.log(`Queued ML processing for transaction ${transaction._id}`);
  } catch (error) {
    console.warn(`Failed to queue ML processing: ${error.message}`);
  }

  const { emitPaymentEvent } = await import('../services/realtime.js');

  if (initialBotScore >= 0.6) {
    emitPaymentEvent({
      transactionId: transaction._id,
      status: 'blocked',
      botScore: initialBotScore,
      amount: amount,
      platform: platform,
      ip: ip,
      userId: userId
    });

    return res.status(400).json({
      message: 'Payment blocked due to bot detection',
      reason: 'bot_detected',
      botScore: initialBotScore,
      detectionReasons: detectionReasons,
      transactionId: transaction._id,
      requiresVerification: true,
      verificationSteps: [
        'captcha',
        'phone_verification',
        'email_verification'
      ]
    });
  }

  if (initialBotScore >= 0.3) {
    emitPaymentEvent({
      transactionId: transaction._id,
      status: 'verification_required',
      botScore: initialBotScore,
      amount: amount,
      platform: platform,
      ip: ip,
      userId: userId
    });

    return res.status(200).json({
      message: 'Payment requires additional verification',
      reason: 'medium_risk',
      botScore: initialBotScore,
      detectionReasons: detectionReasons,
      transactionId: transaction._id,
      requiresVerification: true,
      verificationSteps: ['captcha']
    });
  }

  setTimeout(async () => {
    try {
      const updatedTransaction = await PaymentTransaction.findById(transaction._id);
      if (updatedTransaction && updatedTransaction.status === 'pending') {
        updatedTransaction.status = 'completed';
        updatedTransaction.metadata = {
          ...(updatedTransaction.metadata || {}),
          autoCompleted: true,
          completedAt: new Date(),
          reason: 'timeout_auto_completion'
        };
        await updatedTransaction.save();
        console.log(`Auto-completed payment ${transaction._id} due to timeout`);
      }
    } catch (error) {
      console.error(`Failed to auto-complete payment ${transaction._id}:`, error.message);
    }
  }, 30000); 

  res.status(200).json({
    message: 'Payment initiated successfully',
    transactionId: transaction._id,
    sessionId,
    botScore: initialBotScore,
    status: 'processing',
    mlProcessing: 'queued' 
  });
});

export async function processPayment(req, res) {
  try {
    const { transactionId, verificationData } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: missing user' });
    }

    const transaction = await PaymentTransaction.findOne({
      _id: transactionId,
      userId,
      status: { $in: ['pending', 'processing'] }
    });

    if (!transaction) {
      return res.status(404).json({
        message: 'Transaction not found or already processed'
      });
    }

    if (verificationData) {
      transaction.verificationSteps.push({
        step: verificationData.step,
        passed: verificationData.passed,
        timestamp: new Date(),
        details: verificationData.details || {}
      });
    }

    const requiredSteps = transaction.botScore >= 0.6 ?
      ['bot_detection', 'captcha', 'phone_verification'] :
      ['bot_detection', 'captcha'];

    const completedSteps = transaction.verificationSteps
      .filter(step => step.passed)
      .map(step => step.step);

    const allStepsCompleted = requiredSteps.every(step => completedSteps.includes(step));

    if (!allStepsCompleted) {
      await transaction.save();
      return res.status(200).json({
        message: 'Additional verification required',
        completedSteps,
        requiredSteps,
        transactionId: transaction._id
      });
    }

    const paymentResult = await simulatePaymentProcessing({
      amount: transaction.amount,
      currency: transaction.currency,
      paymentMethod: transaction.paymentMethod,
      userId: transaction.userId
    });

    transaction.status = paymentResult.success ? 'completed' : 'failed';
    transaction.metadata = {
      ...(transaction.metadata || {}),
      paymentResult,
      processedAt: new Date()
    };

    await transaction.save();

    await SuspiciousLog.create({
      ip: transaction.ip,
      userId: transaction.userId,
      userAgent: transaction.userAgent,
      path: req.path,
      method: req.method,
      reason: paymentResult.success ? 'payment_completed' : 'payment_failed',
      score: transaction.botScore,
      meta: {
        platform: transaction.platform,
        ticketId: transaction.ticketId,
        amount: transaction.amount,
        currency: transaction.currency,
        transactionId: transaction._id,
        riskFactors: transaction.riskFactors
      }
    });

    emitSuspicious({
      ip: transaction.ip,
      userId: transaction.userId,
      userAgent: transaction.userAgent,
      path: req.path,
      method: req.method,
      reason: paymentResult.success ? 'payment_completed' : 'payment_failed',
      score: transaction.botScore,
      platform: transaction.platform,
      ticketId: transaction.ticketId,
      amount: transaction.amount,
      currency: transaction.currency
    });

    const { emitPaymentEvent } = await import('../services/realtime.js');
    emitPaymentEvent({
      transactionId: transaction._id,
      status: paymentResult.success ? 'completed' : 'failed',
      botScore: transaction.botScore,
      amount: transaction.amount,
      currency: transaction.currency,
      platform: transaction.platform,
      ip: transaction.ip,
      userId: transaction.userId
    });

    return res.status(200).json({
      message: paymentResult.success ? 'Payment completed successfully' : 'Payment failed',
      success: paymentResult.success,
      transactionId: transaction._id,
      botScore: transaction.botScore,
      detectionReasons: transaction.botDetectionReasons,
      paymentResult
    });

  } catch (error) {
    console.error('❌ Payment processing error:', error);
    return res.status(500).json({
      message: 'Payment processing failed',
      error: error.message
    });
  }
}

export async function getPaymentStatus(req, res) {
  try {
    const { transactionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: missing user' });
    }

    const transaction = await PaymentTransaction.findOne({
      _id: transactionId,
      userId
    });

    if (!transaction) {
      return res.status(404).json({
        message: 'Transaction not found'
      });
    }

    return res.status(200).json({
      transactionId: transaction._id,
      status: transaction.status,
      botScore: transaction.botScore,
      detectionReasons: transaction.botDetectionReasons,
      riskFactors: transaction.riskFactors,
      verificationSteps: transaction.verificationSteps,
      platform: transaction.platform,
      ticketId: transaction.ticketId,
      amount: transaction.amount,
      currency: transaction.currency,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt
    });

  } catch (error) {
    console.error('❌ Get payment status error:', error);
    return res.status(500).json({
      message: 'Failed to get payment status',
      error: error.message
    });
  }
}

export async function updatePendingPayments(req, res) {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: missing user' });
    }

    const oneMinuteAgo = new Date(Date.now() - 60000);
    const pendingPayments = await PaymentTransaction.find({
      userId,
      status: 'pending',
      createdAt: { $lt: oneMinuteAgo }
    });

    let updatedCount = 0;
    
    for (const payment of pendingPayments) {
      payment.status = 'completed';
      payment.metadata = {
        ...(payment.metadata || {}),
        autoCompleted: true,
        completedAt: new Date(),
        reason: 'manual_cleanup'
      };
      await payment.save();
      updatedCount++;
    }

    return res.status(200).json({
      message: `Updated ${updatedCount} pending payments`,
      updatedCount,
      totalPending: pendingPayments.length
    });

  } catch (error) {
    console.error('❌ Update pending payments error:', error);
    return res.status(500).json({
      message: 'Failed to update pending payments',
      error: error.message
    });
  }
}

export async function getPaymentHistory(req, res) {
  try {
    const userId = req.user?.id;
    const { page = 1, limit = 10, platform, status } = req.query;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: missing user' });
    }

    const filter = { userId };
    if (platform) filter.platform = platform;
    if (status) filter.status = status;

    const transactions = await PaymentTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await PaymentTransaction.countDocuments(filter);
    
    let totalAmount = 0;
    try {
      const totalAmountResult = await PaymentTransaction.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'completed' } },
        { $group: { _id: null, totalAmount: { $sum: '$amount' } } }
      ]);
      totalAmount = totalAmountResult.length > 0 ? totalAmountResult[0].totalAmount : 0;
    } catch (error) {
      console.error('Error calculating total amount:', error);
      const completedPayments = await PaymentTransaction.find({ userId, status: 'completed' });
      totalAmount = completedPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    }
    

    return res.status(200).json({
      payments: transactions.map(t => ({
        _id: t._id,
        ticketId: t.ticketId,
        platform: t.platform,
        amount: t.amount,
        currency: t.currency,
        status: t.status,
        botScore: t.botScore,
        botDetectionReasons: t.botDetectionReasons,
        paymentMethod: t.paymentMethod,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        verificationSteps: t.verificationSteps
      })),
      total,
      totalPages: Math.ceil(total / limit),
      totalAmount,
      currentPage: parseInt(page)
    });

  } catch (error) {
    console.error('❌ Get payment history error:', error);
    return res.status(500).json({
      message: 'Failed to get payment history',
      error: error.message
    });
  }
}
