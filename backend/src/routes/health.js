import express from 'express';
import * as healthController from '../controllers/healthController.js';

const router = express.Router();

router.get('/', healthController.healthCheck);

router.get('/detailed', healthController.detailedHealthCheck);

router.get('/ready', healthController.readinessCheck);

router.get('/live', healthController.livenessCheck);

router.get('/metrics', healthController.metrics);

export default router;
