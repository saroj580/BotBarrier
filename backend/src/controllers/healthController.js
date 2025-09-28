
import mongoose from 'mongoose';
import { initConfig } from '../config/index.js';
import { getMLServiceStatus } from '../services/mlScore.js';
import { getMLQueueStatus } from '../services/queue.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const config = initConfig();


export const healthCheck = asyncHandler(async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  };

  res.status(200).json(health);
});


export const detailedHealthCheck = asyncHandler(async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    mlService: await checkMLService(),
    memory: checkMemory(),
    disk: checkDisk(),
    queue: getMLQueueStatus()
  };

  const allHealthy = Object.values(checks).every(check => 
    check.status === 'healthy' || check.status === 'ok'
  );

  const health = {
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    checks
  };

  res.status(allHealthy ? 200 : 503).json(health);
});


async function checkDatabase() {
  try {
    const state = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    if (state === 1) {
      
      await mongoose.connection.db.admin().ping();
      return {
        status: 'healthy',
        connection: states[state],
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        database: mongoose.connection.name
      };
    } else {
      return {
        status: 'unhealthy',
        connection: states[state],
        error: 'Database not connected'
      };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}


async function checkMLService() {
  try {
    const mlStatus = getMLServiceStatus();
    return {
      status: mlStatus.healthy ? 'healthy' : 'unhealthy',
      baseUrl: mlStatus.baseUrl,
      lastCheck: mlStatus.lastCheck,
      healthy: mlStatus.healthy
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}


function checkMemory() {
  const memUsage = process.memoryUsage();
  const totalMem = memUsage.heapTotal;
  const usedMem = memUsage.heapUsed;
  const usagePercent = (usedMem / totalMem) * 100;

  return {
    status: usagePercent < 90 ? 'healthy' : 'warning',
    heapUsed: Math.round(usedMem / 1024 / 1024), // MB
    heapTotal: Math.round(totalMem / 1024 / 1024), // MB
    usagePercent: Math.round(usagePercent),
    external: Math.round(memUsage.external / 1024 / 1024), // MB
    rss: Math.round(memUsage.rss / 1024 / 1024) // MB
  };
}


function checkDisk() {
  try {
    return {
      status: 'healthy',
      note: 'Disk monitoring not implemented'
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}

export const readinessCheck = asyncHandler(async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    mlService: await checkMLService()
  };

  const isReady = Object.values(checks).every(check => 
    check.status === 'healthy'
  );

  const readiness = {
    ready: isReady,
    timestamp: new Date().toISOString(),
    checks
  };

  res.status(isReady ? 200 : 503).json(readiness);
});

export const livenessCheck = asyncHandler(async (req, res) => {
  const liveness = {
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    pid: process.pid
  };

  res.status(200).json(liveness);
});

export const metrics = asyncHandler(async (req, res) => {
  const memUsage = process.memoryUsage();
  const mlStatus = getMLServiceStatus();
  const queueStatus = getMLQueueStatus();

  const metrics = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024)
    },
    database: {
      connected: mongoose.connection.readyState === 1,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      database: mongoose.connection.name
    },
    mlService: {
      healthy: mlStatus.healthy,
      lastCheck: mlStatus.lastCheck
    },
    queue: queueStatus,
    environment: process.env.NODE_ENV || 'development'
  };

  res.status(200).json(metrics);
});
