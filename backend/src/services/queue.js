import { initConfig } from '../config/index.js';
import { getMLBotScore } from './mlScore.js';
import { PaymentTransaction } from '../models/PaymentTransaction.js';
import { SuspiciousLog } from '../models/SuspiciousLog.js';
import { emitSuspicious } from './realtime.js';

const config = initConfig();

class MLProcessingQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.maxConcurrency = 3;
    this.activeJobs = 0;
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
  }

  async addJob(jobData) {
    const job = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      data: jobData,
      attempts: 0,
      createdAt: new Date(),
      status: 'pending'
    };
    
    this.queue.push(job);
    console.log(`Added ML processing job ${job.id} to queue`);
    
    if (!this.processing) {
      this.processQueue();
    }
    
    return job.id;
  }

  async processQueue() {
    if (this.processing || this.activeJobs >= this.maxConcurrency) {
      return;
    }
    
    this.processing = true;
    
    while (this.queue.length > 0 && this.activeJobs < this.maxConcurrency) {
      const job = this.queue.shift();
      if (job) {
        this.activeJobs++;
        this.processJob(job).finally(() => {
          this.activeJobs--;
        });
      }
    }
    
    this.processing = false;
    
    if (this.queue.length > 0) {
      setTimeout(() => this.processQueue(), 100);
    }
  }

  async processJob(job) {
    try {
      job.status = 'processing';
      job.attempts++;
      
      console.log(`Processing ML job ${job.id} (attempt ${job.attempts})`);
      
      const result = await this.executeMLAnalysis(job.data);
      
      await this.updateTransactionWithMLResults(job.data.transactionId, result);
      
      job.status = 'completed';
      console.log(`ML job ${job.id} completed successfully`);
      
    } catch (error) {
      console.error(`ML job ${job.id} failed:`, error.message);
      
      if (job.attempts < this.retryAttempts) {
        job.status = 'retrying';
        setTimeout(() => {
          this.queue.unshift(job); 
          this.processQueue();
        }, this.retryDelay * job.attempts);
      } else {
        job.status = 'failed';
        job.error = error.message;
        await this.handleJobFailure(job);
      }
    }
  }

  async executeMLAnalysis(jobData) {
    const { transactionId, features } = jobData;
    
    // Get ML bot score
    const mlScore = await getMLBotScore(features);
    
    // Calculate final risk score
    const finalScore = Math.min(1.0, mlScore);
    
    return {
      mlScore,
      finalScore,
      processedAt: new Date(),
      features: features
    };
  }

  async updateTransactionWithMLResults(transactionId, mlResults) {
    try {
      const transaction = await PaymentTransaction.findById(transactionId);
      if (!transaction) {
        throw new Error(`Transaction ${transactionId} not found`);
      }
      
      transaction.botScore = mlResults.finalScore;
      transaction.mlProcessed = true;
      transaction.mlResults = {
        mlScore: mlResults.mlScore,
        processedAt: mlResults.processedAt
      };
      
      if (mlResults.finalScore < 0.3 && transaction.status === 'pending') {
        transaction.status = 'completed';
        transaction.metadata = {
          ...(transaction.metadata || {}),
          autoCompleted: true,
          completedAt: new Date(),
          reason: 'low_risk_auto_completion'
        };
        console.log(`Auto-completed low-risk payment ${transactionId} with score ${mlResults.finalScore}`);
      }
      
      await transaction.save();
      
      if (mlResults.finalScore >= 0.6) {
        await SuspiciousLog.create({
          ip: transaction.ip,
          userId: transaction.userId,
          userAgent: transaction.userAgent,
          path: '/api/payment/initiate',
          method: 'POST',
          reason: 'ml_high_risk',
          score: mlResults.finalScore,
          meta: {
            transactionId: transaction._id,
            platform: transaction.platform,
            amount: transaction.amount,
            currency: transaction.currency,
            mlScore: mlResults.mlScore
          }
        });
        
        emitSuspicious({
          ip: transaction.ip,
          userId: transaction.userId,
          userAgent: transaction.userAgent,
          path: '/api/payment/initiate',
          method: 'POST',
          reason: 'ml_high_risk',
          score: mlResults.finalScore,
          transactionId: transaction._id
        });
      }
      
      console.log(`Updated transaction ${transactionId} with ML results`);
      
    } catch (error) {
      console.error(`Failed to update transaction ${transactionId}:`, error.message);
      throw error;
    }
  }

  async handleJobFailure(job) {
    console.error(`Job ${job.id} failed permanently after ${job.attempts} attempts:`, job.error);
    
    try {
      const transaction = await PaymentTransaction.findById(job.data.transactionId);
      if (transaction) {
        transaction.mlProcessed = false;
        transaction.mlError = job.error;
        await transaction.save();
      }
    } catch (error) {
      console.error(`Failed to update transaction after job failure:`, error.message);
    }
  }

  getStatus() {
    return {
      queueLength: this.queue.length,
      activeJobs: this.activeJobs,
      processing: this.processing,
      maxConcurrency: this.maxConcurrency
    };
  }

  clearQueue() {
    this.queue = [];
    this.processing = false;
    this.activeJobs = 0;
  }
}

const mlQueue = new MLProcessingQueue();

export async function addMLProcessingJob(transactionId, features) {
  return await mlQueue.addJob({
    transactionId,
    features,
    timestamp: new Date()
  });
}

export function getMLQueueStatus() {
  return mlQueue.getStatus();
}

export function clearMLQueue() {
  mlQueue.clearQueue();
}

export default mlQueue;
