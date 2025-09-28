
import crypto from 'crypto';


function validateRequiredEnv(key, value, defaultValue = null) {
  if (!value && defaultValue === null) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value || defaultValue;
}


function generateSecureSecret() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot generate secrets in production. Please set environment variables.');
  }
  return crypto.randomBytes(64).toString('hex');
}

export function initConfig () {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const cfg = {
    port: Number(process.env.PORT || 5001),
    mongoUri: validateRequiredEnv('MONGO_URI', process.env.MONGO_URI),
    mongoDbName: validateRequiredEnv('MONGO_DB', process.env.MONGO_DB),
    
  
    jwtAccessSecret: validateRequiredEnv(
      'JWT_ACCESS_SECRET', 
      process.env.JWT_ACCESS_SECRET, 
      isProduction ? null : generateSecureSecret()
    ),
    jwtRefreshSecret: validateRequiredEnv(
      'JWT_REFRESH_SECRET', 
      process.env.JWT_REFRESH_SECRET, 
      isProduction ? null : generateSecureSecret()
    ),
    
    accessTokenTtlSec: Number(process.env.ACCESS_TTL_SEC || 900),
    refreshTokenTtlSec: Number(process.env.REFRESH_TTL_SEC || 2592000),
    

    corsOrigin: process.env.CORS_ORIGIN || '',
    corsOrigins: (process.env.CORS_ORIGIN || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
    
    geoApiUrl: process.env.GEO_API_URL || '',
    captcha: {
      recaptchaSecret: process.env.RECAPTCHA_SECRET || '',
      hcaptchaSecret: process.env.HCAPTCHA_SECRET || ''
    },
    adminBootstrapEmail: process.env.ADMIN_EMAIL || '',
    // ML integration + secure rate limiting
    mlServiceBase: process.env.ML_SERVICE_BASE || 'http://localhost:5005',
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // 100 requests per 15 min
    authRateLimitMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5', 10), // 5 auth attempts per 15 min
    paymentRateLimitMax: parseInt(process.env.PAYMENT_RATE_LIMIT_MAX || '10', 10), // 10 payments per 15 min
  };

 
  if ((!cfg.corsOrigin && cfg.corsOrigins.length === 0) && !isProduction) {
    cfg.corsOrigins = ['http://localhost:5173', 'http://localhost:8080', 'http://localhost:8081', 'http://localhost:3000'];
  }


  cfg.corsAllowAll = !isProduction && (
    process.env.CORS_ALLOW_ALL === 'true' ||
    (!cfg.corsOrigin && cfg.corsOrigins.length === 0)
  );


  if (isProduction) {
    if (cfg.corsAllowAll) {
      throw new Error('CORS_ALLOW_ALL cannot be true in production');
    }
    if (!cfg.corsOrigin && cfg.corsOrigins.length === 0) {
      throw new Error('CORS origins must be configured in production');
    }
  }

  return cfg;
}
