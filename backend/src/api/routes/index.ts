/**
 * API Routes
 * Central router for all API endpoints
 */

import { Router } from 'express';
import projectRoutes from './projects';
import interactiveRoutes from './interactive';

const router = Router();

// API v1 routes
router.use('/projects', projectRoutes);
router.use('/', interactiveRoutes); // Interactive routes: /api/interactive, /api/interactive-stats

// Health check
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'mind2build-api',
    version: '1.0.0',
  });
});

export default router;

