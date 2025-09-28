import rateLimit from 'express-rate-limit';
import useragent from 'useragent';
import fetch from 'node-fetch';
import { SuspiciousLog } from '../models/SuspiciousLog.js';
import { BlockList } from '../models/BlockList.js';
import { initConfig } from '../config/index.js';
import { emitSuspicious } from '../services/realtime.js';

const config = initConfig();

export const ipLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs, // 15 minutes
  max: config.rateLimitMax, // 100 requests per 15 minutes
  keyGenerator: (req) => req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP',
    retryAfter: Math.ceil(config.rateLimitWindowMs / 1000)
  },
  skip: (req) => {
    return req.path.startsWith('/api/health') || 
           req.path === '/api/health' ||
           req.path === '/health';
  }
});

export const routeLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: Math.floor(config.rateLimitMax / 2), // 50 requests per 15 minutes per route
  keyGenerator: (req) => `${req.ip}:${req.path}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests to this endpoint',
    retryAfter: Math.ceil(config.rateLimitWindowMs / 1000)
  },
  skip: (req) => {
    return req.path.startsWith('/api/health') || 
           req.path === '/api/health' ||
           req.path === '/health';
  }
});

export const authLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.authRateLimitMax, // 5 auth attempts per 15 minutes
  keyGenerator: (req) => `${req.ip}:auth`,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts',
    retryAfter: Math.ceil(config.rateLimitWindowMs / 1000)
  },
  skipSuccessfulRequests: true 
});

export const paymentLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.paymentRateLimitMax, // 10 payment attempts per 15 minutes
  keyGenerator: (req) => `${req.ip}:payment`,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many payment attempts',
    retryAfter: Math.ceil(config.rateLimitWindowMs / 1000)
  }
});

function scoreRequest ({ headless, missingJs, geoMismatch, suspiciousUa, tooManyRequests, failedLogins }) {
  let score = 0;
  if (headless) score += 0.3;
  if (missingJs) score += 0.2;
  if (geoMismatch) score += 0.2;
  if (suspiciousUa) score += 0.2;
  if (tooManyRequests) score += 0.2;
  if (failedLogins) score += 0.2;
  return Math.min(1.0, score);
}

function looksHeadless (uaString) {
  const s = uaString.toLowerCase();
  return s.includes('headless') || s.includes('phantom') || s.includes('puppeteer') || s.includes('spider');
}

function fingerprintFromHeaders (req) {
  const accept = req.get('accept') || '';
  const lang = req.get('accept-language') || '';
  const enc = req.get('accept-encoding') || '';
  const dnt = req.get('dnt') || '';
  return `${accept}|${lang}|${enc}|${dnt}`;
}

async function geoLookup (ip) {
  try {
    const url = `${config.geoApiUrl}${ip}`;
    const r = await fetch(url);
    const data = await r.json();
    return { country: data.countryCode || data.country || null, city: data.city || null };
  } catch (_) {
    return { country: null, city: null };
  }
}

export function botDetection () {
  return async (req, res, next) => {
    const ip = req.ip;
    const uaString = req.get('user-agent') || '';
    const agent = useragent.parse(uaString);
    const suspiciousUa = !agent || agent.family === 'Other';
    const headless = looksHeadless(uaString);

    const missingJs = req.get('x-js-ok') !== '1';

    const fp = fingerprintFromHeaders(req);
    const { country } = await geoLookup(req.ip);

    const expectedCountry = req.get('x-expected-country') || null;
    const geoMismatch = expectedCountry && country && expectedCountry !== country;

    const failedLogins = req.path.includes('/auth/login') && req.method === 'POST';
    
    const tooManyRequests = false; 

    const score = scoreRequest({ headless, missingJs, geoMismatch, suspiciousUa, tooManyRequests, failedLogins });

    const blocked = await BlockList.findOne({ $or: [{ ip }, { userId: req.user?.id || null }] });
    if (blocked) {
      await SuspiciousLog.create({ ip, userId: req.user?.id || null, userAgent: uaString, path: req.path, method: req.method, reason: 'blocklist', score, meta: { fp, country, expectedCountry } });
      emitSuspicious({ ip, userId: req.user?.id || null, userAgent: uaString, path: req.path, method: req.method, reason: 'blocklist', score });
      return res.status(403).json({ message: 'Blocked' });
    }

    if (score >= 0.3) { 
      const reason = failedLogins ? 'login_failed' : 'suspected_bot';
      const log = await SuspiciousLog.create({ 
        ip, 
        userId: req.user?.id || null, 
        userAgent: uaString, 
        path: req.path, 
        method: req.method, 
        reason, 
        score, 
        meta: { fp, country, expectedCountry, headless, missingJs, suspiciousUa, failedLogins } 
      });
      emitSuspicious({ id: log._id, ip, path: req.path, score, reason, userAgent: uaString });
    }

    next();
  };
}


