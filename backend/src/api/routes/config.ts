/**
 * Config API Routes
 */

import { Router } from 'express';
import { LLMConfigController } from '../controllers/LLMConfigController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All routes require authentication (in real app)
// For MVP, auth is optional

// LLM configuration routes
router.get('/llm', LLMConfigController.list);
router.get('/llm/active', LLMConfigController.getActive);
router.get('/llm/:provider', LLMConfigController.getByProvider);
router.post('/llm', LLMConfigController.upsert);
router.post('/llm/:id/activate', LLMConfigController.activate);
router.delete('/llm/:id', LLMConfigController.delete);

export default router;

