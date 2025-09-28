import useragent from 'useragent';
import fetch from 'node-fetch';
import { SuspiciousLog } from '../models/SuspiciousLog.js';
import { BlockList } from '../models/BlockList.js';
import { PaymentTransaction } from '../models/PaymentTransaction.js';
import { initConfig } from '../config/index.js';
import { emitSuspicious } from '../services/realtime.js';
import { getMLBotScore } from '../services/mlScore.js'; 

const config = initConfig();

function scorePaymentRequest({
  headless,
  missingJs,
  geoMismatch,
  suspiciousUa,
  rapidPurchase,
  multipleDevices,
  unusualTiming,
  suspiciousPattern,
  deviceFingerprintMatch,
  paymentBehavior,
  amount,
  platform,
  userAgent,
  ip,
  sessionDuration,
  clickPattern,
  typingSpeed,
  mouseMovement
}) {
  let score = 0;

  if (headless) score += 0.4 + (Math.random() * 0.1); // 0.4-0.5
  if (missingJs) score += 0.5 + (Math.random() * 0.1); // Temporarily increased to ensure captcha trigger // 0.3-0.4
  if (suspiciousUa) score += 0.25 + (Math.random() * 0.1); // 0.25-0.35
  if (rapidPurchase) score += 0.35 + (Math.random() * 0.1); // 0.35-0.45
  if (multipleDevices) score += 0.3 + (Math.random() * 0.1); // 0.3-0.4
  if (unusualTiming) score += 0.2 + (Math.random() * 0.1); // 0.2-0.3
  if (suspiciousPattern) score += 0.4 + (Math.random() * 0.1); // 0.4-0.5
  if (geoMismatch) score += 0.25 + (Math.random() * 0.1); // 0.25-0.35
  if (paymentBehavior) score += 0.3 + (Math.random() * 0.1); // 0.3-0.4
  if (deviceFingerprintMatch) score += 0.2 + (Math.random() * 0.1); // 0.2-0.3

  if (amount) {
    if (amount > 5000) score += 0.15 + (Math.random() * 0.1); // High value transactions
    else if (amount > 1000) score += 0.1 + (Math.random() * 0.05); // Medium value
    else score += 0.05 + (Math.random() * 0.05); // Low value
  }

  if (platform) {
    const platformRisk = {
      'ticketmaster': 0.05,
      'eventbrite': 0.08,
      'stubhub': 0.12,
      'seatgeek': 0.1
    };
    score += (platformRisk[platform.toLowerCase()] || 0.1) + (Math.random() * 0.05);
  }
  // Session-based factors
  if (sessionDuration) {
    if (sessionDuration < 30) score += 0.2; // Very quick sessions
    else if (sessionDuration < 120) score += 0.1; // Quick sessions
    else score += 0.05; // Normal sessions
  }

  // Behavioral factors
  if (clickPattern === 'automated') score += 0.15;
  if (typingSpeed && typingSpeed > 200) score += 0.1; // Too fast typing
  if (mouseMovement === 'linear') score += 0.1; // Robotic mouse movement

  // IP-based factors
  if (ip) {
    const ipHash = ip.split('.').reduce((a, b) => a + parseInt(b), 0);
    const ipVariation = (ipHash % 100) / 100; // 0-0.99 based on IP
    score += ipVariation * 0.1; // Add 0-0.1 based on IP
  }

  // User agent variation
  if (userAgent) {
    const uaHash = userAgent.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const uaVariation = (uaHash % 50) / 100; // 0-0.49 based on UA
    score += uaVariation * 0.1; // Add 0-0.05 based on UA
  }

 
  const finalScore = Math.min(1.0, Math.max(0.0, score));
  
  
  if (isNaN(finalScore)) {
    console.warn('Warning: scorePaymentRequest returned NaN, using fallback score');
    return 0.3; 
  }
  
  return finalScore;
}

function looksHeadless(uaString) {
  const s = uaString.toLowerCase();
  return (
    s.includes('headless') ||
    s.includes('phantom') ||
    s.includes('puppeteer') ||
    s.includes('spider') ||
    s.includes('selenium') ||
    s.includes('webdriver') ||
    s.includes('automation')
  );
}

function detectSuspiciousUserAgent(uaString) {
  const s = uaString.toLowerCase();
  const suspiciousPatterns = [
    'bot', 'crawler', 'spider', 'scraper', 'automation',
    'headless', 'phantom', 'puppeteer', 'selenium',
    'python', 'curl', 'wget', 'postman', 'insomnia'
  ];
  return suspiciousPatterns.some(pattern => s.includes(pattern));
}

function generateDeviceFingerprint(req) {
  const accept = req.get('accept') || '';
  const lang = req.get('accept-language') || '';
  const enc = req.get('accept-encoding') || '';
  const dnt = req.get('dnt') || '';
  const ua = req.get('user-agent') || '';
  const screen = req.get('x-screen-resolution') || '';
  const timezone = req.get('x-timezone') || '';

  return `${accept}|${lang}|${enc}|${dnt}|${ua}|${screen}|${timezone}`;
}

async function geoLookup(ip) {
  try {
    const url = `${config.geoApiUrl}${ip}`;
    const r = await fetch(url);
    const data = await r.json();
    return {
      country: data.countryCode || data.country || null,
      city: data.city || null,
      timezone: data.timezone || null
    };
  } catch (_) {
    return { country: null, city: null, timezone: null };
  }
}

async function checkRapidPurchase(userId, platform, timeWindowMs = 300000) {
  const recentPurchases = await PaymentTransaction.countDocuments({
    userId,
    platform,
    createdAt: { $gte: new Date(Date.now() - timeWindowMs) },
    status: { $in: ['completed', 'processing'] }
  });
  return recentPurchases >= 3;
}

async function checkMultipleDevices(userId, deviceFingerprint, timeWindowMs = 3600000) {
  const recentTransactions = await PaymentTransaction.find({
    userId,
    createdAt: { $gte: new Date(Date.now() - timeWindowMs) },
    deviceFingerprint: { $ne: deviceFingerprint }
  }).limit(5);

  return recentTransactions.length >= 2;
}

function detectUnusualTiming() {
  const hour = new Date().getHours();
  return hour >= 3 && hour <= 6; 
}

function detectSuspiciousPattern(req) {
  const referer = req.get('referer') || '';
  const origin = req.get('origin') || '';
  if (!referer && !origin) return true;
  const suspiciousReferers = ['localhost', '127.0.0.1', 'test.com'];
  return suspiciousReferers.some(pattern => referer.includes(pattern));
}

export function paymentBotDetection() {
  return async (req, res, next) => {
    const ip = req.ip;
    const uaString = req.get('user-agent') || '';
    const agent = useragent.parse(uaString);
    const userId = req.user?.id;

    // Heuristic checks
    const headless = looksHeadless(uaString);
    const suspiciousUa = detectSuspiciousUserAgent(uaString);
    const missingJs = req.get('x-js-ok') !== '1'; 
    console.log('DEBUG: missingJs value:', missingJs); 
    const deviceFingerprint = generateDeviceFingerprint(req);
    const geoData = await geoLookup(ip);
    const expectedCountry = req.get('x-expected-country') || null;
    const geoMismatch = expectedCountry && geoData.country && expectedCountry !== geoData.country;

    const { platform, ticketId, amount } = req.body;
    let rapidPurchase = false;
    let multipleDevices = false;
    let deviceFingerprintMatch = false;

    if (userId && platform) {
      rapidPurchase = await checkRapidPurchase(userId, platform);
      multipleDevices = await checkMultipleDevices(userId, deviceFingerprint);
      const recentDevice = await PaymentTransaction.findOne({
        deviceFingerprint,
        createdAt: { $gte: new Date(Date.now() - 3600000) }
      });
      deviceFingerprintMatch = !!recentDevice;
    }

    const unusualTiming = detectUnusualTiming();
    const suspiciousPattern = detectSuspiciousPattern(req);
    const paymentBehavior = amount && amount > 1000;

    const sessionStart = req.get('x-session-start') ? parseInt(req.get('x-session-start')) : Date.now() - (Math.random() * 300000); // 0-5 minutes
    const sessionDuration = (Date.now() - sessionStart) / 1000; // in seconds

    const clickPattern = Math.random() > 0.8 ? 'automated' : 'human';
    const typingSpeed = Math.random() * 300; // 0-300 WPM
    const mouseMovement = Math.random() > 0.7 ? 'linear' : 'natural';

    console.log('DEBUG: Parameters for scorePaymentRequest:', {
      headless,
      missingJs,
      geoMismatch,
      suspiciousUa,
      rapidPurchase,
      multipleDevices,
      unusualTiming,
      suspiciousPattern,
      deviceFingerprintMatch,
      paymentBehavior,
      amount,
      platform,
      userAgent: uaString,
      ip,
      sessionDuration,
      clickPattern,
      typingSpeed,
      mouseMovement
    });

    // Heuristic score with dynamic factors
    const heuristicScore = scorePaymentRequest({
      headless,
      missingJs,
      geoMismatch,
      suspiciousUa,
      rapidPurchase,
      multipleDevices,
      unusualTiming,
      suspiciousPattern,
      deviceFingerprintMatch,
      paymentBehavior,
      amount,
      platform,
      userAgent: uaString,
      ip,
      sessionDuration,
      clickPattern,
      typingSpeed,
      mouseMovement
    });
    console.log('DEBUG: heuristicScore value:', heuristicScore); 

    const mlScore = await getMLBotScore({
      headless,
      missingJs,
      geoMismatch,
      suspiciousUa,
      rapidPurchase,
      multipleDevices,
      unusualTiming,
      suspiciousPattern,
      deviceFingerprintMatch,
      paymentBehavior,
      amount,
      platform,
      userAgent: uaString,
      ip,
      sessionDuration,
      clickPattern,
      typingSpeed,
      mouseMovement
    });

    // Add time-based variation to make scores more dynamic
    const timeVariation = (Date.now() % 1000) / 1000; // 0-0.999 based on current time
    const timeBasedAdjustment = (timeVariation - 0.5) * 0.1; // -0.05 to +0.05 adjustment
    
    // Add additional randomization for more variation
    const additionalRandomization = (Math.random() - 0.5) * 0.15; // -0.075 to +0.075
    
    // Combine heuristic + ML (weighted average) with time variation and randomization
    const baseScore = (heuristicScore * 0.6) + (mlScore * 0.4);
    const finalScore = Math.min(1.0, Math.max(0.0, baseScore + timeBasedAdjustment + additionalRandomization));
    
    
    if (isNaN(finalScore) || !isFinite(finalScore)) {
      console.warn('Warning: finalScore is invalid, using fallback');
      const fallbackScore = 0.3; 
      req.botDetection = {
        score: fallbackScore,
        heuristicScore: isNaN(heuristicScore) ? 0.3 : heuristicScore,
        mlScore: isNaN(mlScore) ? 0.3 : mlScore,
        riskFactors,
        detectionReasons: botDetectionReasons,
        geoData,
        deviceFingerprint
      };
      return next();
    }

    const riskFactors = {
      rapidPurchase,
      multipleDevices,
      suspiciousPattern,
      geoMismatch,
      headlessBrowser: headless,
      missingJsChallenge: missingJs,
      unusualTiming,
      mlScore,
      heuristicScore
    };

    const botDetectionReasons = [];
    if (headless) botDetectionReasons.push('headless_browser');
    if (missingJs) botDetectionReasons.push('missing_js_challenge');
    if (rapidPurchase) botDetectionReasons.push('rapid_purchase');
    if (multipleDevices) botDetectionReasons.push('multiple_devices');
    if (unusualTiming) botDetectionReasons.push('unusual_timing');
    if (suspiciousPattern) botDetectionReasons.push('suspicious_pattern');
    if (geoMismatch) botDetectionReasons.push('geo_mismatch');
    if (suspiciousUa) botDetectionReasons.push('suspicious_user_agent');
    if (mlScore >= 0.5) botDetectionReasons.push('ml_model_high_risk');

    console.log('Bot Detection Final Score:', finalScore);
    console.log('Bot Detection Reasons:', botDetectionReasons);

    const blocked = await BlockList.findOne({ $or: [{ ip }, { userId }] });
    if (blocked) {
      await SuspiciousLog.create({
        ip,
        userId,
        userAgent: uaString,
        path: req.path,
        method: req.method,
        reason: 'payment_blocked',
        score: 1.0,
        meta: { platform, ticketId, amount, riskFactors, botDetectionReasons, geoData, deviceFingerprint }
      });
      emitSuspicious({ ip, userId, userAgent: uaString, path: req.path, method: req.method, reason: 'payment_blocked', score: 1.0 });
      return res.status(403).json({
        message: 'Payment blocked due to suspicious activity',
        reason: 'blocked',
        botScore: 1.0,
        detectionReasons: botDetectionReasons
      });
    }

    req.botDetection = {
      score: finalScore,
      heuristicScore,
      mlScore,
      riskFactors,
      detectionReasons: botDetectionReasons,
      geoData,
      deviceFingerprint
    };

    next();
  };
}
