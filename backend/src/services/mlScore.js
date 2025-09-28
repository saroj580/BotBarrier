import fetch from 'node-fetch';
import { initConfig } from '../config/index.js';

const config = initConfig();

let mlServiceHealthy = true;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds


async function checkMLServiceHealth() {
  const now = Date.now();
  if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return mlServiceHealthy;
  }
  
  lastHealthCheck = now;
  
  try {
    const baseUrl = config.mlServiceBase.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      timeout: 3000
    });
    
    mlServiceHealthy = response.ok;
    return mlServiceHealthy;
  } catch (error) {
    mlServiceHealthy = false;
    console.warn('ML service health check failed:', error.message);
    return false;
  }
}

/**

 * @param {Object} features - extracted features
 * @returns {Number} score between 0.0 and 1.0
 */
function heuristicBotDetection(features) {
  let score = 0;
  
  if (features.userAgent) {
    const ua = features.userAgent.toLowerCase();
    if (ua.includes('headless') || ua.includes('phantom') || ua.includes('puppeteer')) {
      score += 0.4 + (Math.random() * 0.1);
    }
    if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider')) {
      score += 0.3 + (Math.random() * 0.1);
    }
  }
  
  if (features.missingJsChallenge) {
    score += 0.3 + (Math.random() * 0.1);
  }
  
  if (features.geoMismatch) {
    score += 0.2 + (Math.random() * 0.1);
  }
  
  if (features.rapidPurchase) {
    score += 0.3 + (Math.random() * 0.1);
  }
  
  if (features.multipleDevices) {
    score += 0.2 + (Math.random() * 0.1);
  }
  
  if (features.unusualTiming) {
    score += 0.1 + (Math.random() * 0.05);
  }
  
  if (features.amount) {
    if (features.amount > 5000) {
      score += 0.15 + (Math.random() * 0.1);
    } else if (features.amount > 1000) {
      score += 0.1 + (Math.random() * 0.05);
    } else {
      score += 0.05 + (Math.random() * 0.05);
    }
  }
  
  if (features.platform) {
    const platformRisk = {
      'ticketmaster': 0.05,
      'eventbrite': 0.08,
      'stubhub': 0.12,
      'seatgeek': 0.1
    };
    score += (platformRisk[features.platform.toLowerCase()] || 0.1) + (Math.random() * 0.05);
  }
  
  // Session duration factors
  if (features.sessionDuration) {
    if (features.sessionDuration < 30) {
      score += 0.2;
    } else if (features.sessionDuration < 120) {
      score += 0.1;
    } else {
      score += 0.05;
    }
  }
  
  // Behavioral factors
  if (features.clickPattern === 'automated') {
    score += 0.15;
  }
  if (features.typingSpeed && features.typingSpeed > 200) {
    score += 0.1;
  }
  if (features.mouseMovement === 'linear') {
    score += 0.1;
  }
  
  // IP-based variation
  if (features.ip) {
    const ipHash = features.ip.split('.').reduce((a, b) => a + parseInt(b), 0);
    const ipVariation = (ipHash % 100) / 100;
    score += ipVariation * 0.1;
  }
  
  const randomFactor = (Math.random() - 0.5) * 0.2; // -0.1 to +0.1
  score += randomFactor;
  
  return Math.min(1.0, Math.max(0.0, score));
}

/**
 
 * @param {Object} features - extracted payment/bot features
 * @returns {Number} score between 0.0 and 1.0
 */
export async function getMLBotScore(features) {
  const isHealthy = await checkMLServiceHealth();
  
  if (!isHealthy || !config.mlServiceBase) {
    console.warn('ML service unavailable, using heuristic fallback');
    return heuristicBotDetection(features);
  }
  
  try {
    const baseUrl = config.mlServiceBase.replace(/\/$/, '');
    const url = `${baseUrl}/predict`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    console.log('Sending features to ML service:', JSON.stringify(features, null, 2));
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'BotDetector-Backend/1.0'
      },
      body: JSON.stringify(features),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`ML service responded with status ${response.status}`);
    }
    
    const data = await response.json();
    
    let score = 0;
    if (typeof data.score === 'number') {
      score = data.score;
    } else if (typeof data.probability === 'number') {
      score = data.probability;
    } else if (Array.isArray(data) && typeof data[0] === 'number') {
      score = data[0];
    } else {
      throw new Error('Invalid ML service response format');
    }
    
    score = Math.max(0, Math.min(1, score));
    
    mlServiceHealthy = true;
    
    return score;
    
  } catch (error) {
    console.warn('ML service error:', error.message);
    mlServiceHealthy = false;
    
    return heuristicBotDetection(features);
  }
}


export function getMLServiceStatus() {
  return {
    healthy: mlServiceHealthy,
    lastCheck: new Date(lastHealthCheck),
    baseUrl: config.mlServiceBase
  };
}
