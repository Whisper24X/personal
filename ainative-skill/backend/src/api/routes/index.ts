/**
 * API Routes
 * Central router for all API endpoints
 */

import { Router } from 'express';
import projectRoutes from './projects';
import applicationRoutes from './applications';
import configRoutes from './config';
import testRoutes from './test';
import workflowRoutes from './workflow';

const router: Router = Router();

// API v1 routes
router.use('/applications', applicationRoutes);
router.use('/projects', projectRoutes);
router.use('/config', configRoutes);
router.use('/test', testRoutes); // Test routes: /api/test/engineer/*
router.use('/workflow', workflowRoutes); // Workflow routes: /api/workflow/:projectId/*

// Health check
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'mind2build-api',
    version: '1.0.0',
  });
});

export default router;

