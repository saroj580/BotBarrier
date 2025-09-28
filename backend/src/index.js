import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { apiRouter } from './routes/index.js';
import { ipLimiter, routeLimiter, botDetection } from './middleware/botDetection.js';
import { createIoEmitter } from './services/realtime.js';
import { initConfig } from './config/index.js';
import { errorHandler, notFoundHandler, requestIdMiddleware } from './middleware/errorHandler.js';

dotenv.config();
const config = initConfig();

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));


app.use(requestIdMiddleware);


app.use(cors({
  origin: (origin, callback) => {
    
    if (!origin) return callback(null, true);
    
    if (process.env.NODE_ENV !== 'production') {
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return callback(null, true);
      }
    }
    
    if (config.corsAllowAll && process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    const allowedOrigins = config.corsOrigins || [];
    if (config.corsOrigin) {
      allowedOrigins.push(config.corsOrigin);
    }
    
  
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
 
    console.warn(`CORS blocked request from origin: ${origin}`);
    return callback(new Error('CORS policy violation: Origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'x-js-ok', 
    'x-expected-country',
    'x-requested-with'
  ],
  exposedHeaders: ['x-ratelimit-remaining', 'x-ratelimit-reset'],
  maxAge: 86400 // 24 hours
}));

app.use(express.json());
app.use(cookieParser()); 


app.use(ipLimiter);
app.use(routeLimiter);
app.use(botDetection());


app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api', apiRouter);


app.use(notFoundHandler);
app.use(errorHandler);

const server = http.createServer(app);


const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
    
      if (!origin) return callback(null, true);
      
      if (process.env.NODE_ENV !== 'production') {
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
          return callback(null, true);
        }
      }
      
      if (config.corsAllowAll && process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      
      const allowedOrigins = config.corsOrigins || [];
      if (config.corsOrigin) {
        allowedOrigins.push(config.corsOrigin);
      }
      
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      console.warn(`Socket.io CORS blocked request from origin: ${origin}`);
      return callback(new Error('Socket.io CORS policy violation'));
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Authorization', 'Content-Type', 'x-js-ok'],
    credentials: true
  }
});
createIoEmitter(io);

async function start () {
  try {
    console.log('🔄 Connecting to MongoDB...');
    console.log(`📍 MongoDB URI: ${config.mongoUri}`);
    console.log(`🗄️  Database: ${config.mongoDbName}`);

    mongoose.connection.on('connecting', () => {
      console.log('🔄 MongoDB: Connecting...');
    });
    mongoose.connection.on('connected', () => {
      console.log('✅ MongoDB: Connected successfully');
      console.log(`📍 Connected to: ${mongoose.connection.host}:${mongoose.connection.port}`);
      console.log(`🗄️  Database: ${mongoose.connection.name}`);
    });
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB: Connection error:', err);
    });
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB: Disconnected');
    });
    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB: Reconnected');
    });

    await mongoose.connect(config.mongoUri, { 
      dbName: config.mongoDbName,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    server.listen(config.port, () => {
      console.log('🚀 BotDetector API Server Started');
      console.log(`📍 Server: http://localhost:${config.port}`);
      console.log(`🔗 Health Check: http://localhost:${config.port}/api/health`);
      console.log(`📊 Payment API: http://localhost:${config.port}/api/payment`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${config.port} is already in use`);
        console.error('💡 Fix: Kill the process or use another PORT in .env');
      } else {
        console.error('❌ Server error:', err);
      }
      process.exit(1);
    });

  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();

process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Shutting down...');
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during shutdown:', err);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM. Shutting down...');
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during shutdown:', err);
    process.exit(1);
  }
});
