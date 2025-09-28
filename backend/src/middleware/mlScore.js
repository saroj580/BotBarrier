import fetch from 'node-fetch';
import { initConfig } from '../config/index.js';

const config = initConfig();

/*
 * @param {Object} features 
 * @returns {Number} score between 0.0 and 1.0
 */
export async function getMLBotScore(features) {
  try {
    const response = await fetch(`${config.mlServiceBase}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(features)
    });

    if (!response.ok) {
      console.error('ML service error:', response.status, await response.text());
      return 0.0; 
    }

    const data = await response.json();

    let score = 0.0;
    if (typeof data.score === 'number') {
      score = data.score;
    } else if (typeof data.probability === 'number') {
      score = data.probability;
    } else if (Array.isArray(data) && typeof data[0] === 'number') {
      score = data[0];
    }

    return Math.max(0.0, Math.min(1.0, score));
  } catch (err) {
    console.error('Error calling ML service:', err.message);
    return 0.0; 
  }
}
