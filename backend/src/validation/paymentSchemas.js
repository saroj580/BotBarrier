import Joi from 'joi';

const platformSchema = Joi.string()
  .valid('ticketmaster', 'eventbrite', 'stubhub', 'seatgeek', 'vividseats')
  .required()
  .messages({
    'any.only': 'Platform must be one of: ticketmaster, eventbrite, stubhub, seatgeek, vividseats',
    'any.required': 'Platform is required'
  });

const ticketIdSchema = Joi.string()
  .pattern(/^(STD|VIP|PRM)-(TM|EB|SH|SG|VS)-\d{5}$/)
  .required()
  .messages({
    'string.pattern.base': 'Ticket ID must be in format: PREFIX-PLATFORM-NUMBER (e.g., STD-TM-12345)',
    'any.required': 'Ticket ID is required'
  });

const amountSchema = Joi.number()
  .positive()
  .min(1)
  .max(10000)
  .precision(2)
  .required()
  .messages({
    'number.positive': 'Amount must be positive',
    'number.min': 'Amount must be at least $1',
    'number.max': 'Amount cannot exceed $10,000',
    'number.precision': 'Amount can have maximum 2 decimal places',
    'any.required': 'Amount is required'
  });

const currencySchema = Joi.string()
  .valid('INR', 'USD', 'EUR', 'GBP', 'CAD', 'AUD')
  .default('INR')
  .messages({
    'any.only': 'Currency must be one of: INR, USD, EUR, GBP, CAD, AUD'
  });

const paymentMethodSchema = Joi.string()
  .valid('credit_card', 'debit_card', 'paypal', 'apple_pay', 'google_pay', 'bank_transfer')
  .required()
  .messages({
    'any.only': 'Payment method must be one of: credit_card, debit_card, paypal, apple_pay, google_pay, bank_transfer',
    'any.required': 'Payment method is required'
  });

const transactionIdSchema = Joi.string()
  .pattern(/^[a-f\d]{24}$/)
  .required()
  .messages({
    'string.pattern.base': 'Invalid transaction ID format',
    'any.required': 'Transaction ID is required'
  });

const verificationStepSchema = Joi.string()
  .valid('captcha', 'phone_verification', 'email_verification', 'identity_verification', 'payment_verification')
  .required()
  .messages({
    'any.only': 'Invalid verification step',
    'any.required': 'Verification step is required'
  });

export const initiatePaymentSchema = Joi.object({
  platform: platformSchema,
  ticketId: ticketIdSchema,
  amount: amountSchema,
  currency: currencySchema,
  paymentMethod: paymentMethodSchema,
  ticketType: Joi.string().valid('standard', 'vip', 'premium').optional(),
  metadata: Joi.object().optional(),
  deviceFingerprint: Joi.string().max(500).optional(),
  geoData: Joi.object({
    country: Joi.string().length(2).optional(),
    city: Joi.string().max(100).optional(),
    timezone: Joi.string().max(50).optional()
  }).optional()
});

export const processPaymentSchema = Joi.object({
  transactionId: transactionIdSchema,
  verificationData: Joi.object({
    step: verificationStepSchema,
    passed: Joi.boolean().required().messages({
      'any.required': 'Verification result is required'
    }),
    details: Joi.object().optional(),
    token: Joi.string().max(1000).optional(),
    code: Joi.string().max(10).optional()
  }).optional()
});

export const paymentStatusSchema = Joi.object({
  transactionId: transactionIdSchema
});

export const paymentHistorySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  platform: platformSchema.optional(),
  status: Joi.string()
    .valid('pending', 'processing', 'completed', 'failed', 'blocked')
    .optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional()
});

export const adminPaymentSchema = Joi.object({
  transactionId: transactionIdSchema,
  action: Joi.string()
    .valid('approve', 'reject', 'refund', 'block')
    .required(),
  reason: Joi.string().max(500).optional(),
  amount: Joi.number().positive().optional() 
});

export const bulkPaymentSchema = Joi.object({
  transactionIds: Joi.array()
    .items(transactionIdSchema)
    .min(1)
    .max(100)
    .required(),
  action: Joi.string()
    .valid('approve', 'reject', 'refund', 'block')
    .required(),
  reason: Joi.string().max(500).optional()
});
