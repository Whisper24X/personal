/**
 * Config API Routes
 */

import { Router } from 'express';
import { LLMConfigController } from '../controllers/LLMConfigController';
import { RoleLLMConfigController } from '../controllers/RoleLLMConfigController';
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

// Role LLM configuration routes
router.get('/role-llm', RoleLLMConfigController.list);
router.get('/role-llm/:profile', RoleLLMConfigController.getByProfile);
router.post('/role-llm/:profile', RoleLLMConfigController.upsert);
router.delete('/role-llm/:profile', RoleLLMConfigController.delete);

export default router;

