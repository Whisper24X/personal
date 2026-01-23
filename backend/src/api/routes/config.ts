/**
 * Config API Routes
 */

import { Router } from 'express';
import { LLMConfigController } from '../controllers/LLMConfigController';
import { RoleLLMConfigController } from '../controllers/RoleLLMConfigController';
import { PromptConfigController } from '../controllers/PromptConfigController';
import { RoleActionController } from '../controllers/RoleActionController';
// import { authMiddleware } from '../middleware/auth'; // Unused

const router: Router = Router();

// All routes require authentication (in real app)
// For MVP, auth is optional

// LLM configuration routes
router.get('/llm', LLMConfigController.list);
router.get('/llm/active', LLMConfigController.getActive);
// Provider configuration routes (API keys and base URLs) - must be before /llm/:provider
router.get('/llm/providers', LLMConfigController.listProviders);
router.get('/llm/providers/:provider', LLMConfigController.getProvider);
router.post('/llm/providers', LLMConfigController.upsertProvider);
// Model registry routes - must be before /llm/:provider
router.get('/llm/models', LLMConfigController.listModels);
router.post('/llm/models', LLMConfigController.createModel);
router.put('/llm/models/sort', LLMConfigController.updateModelSortOrder);
router.get('/llm/models/:provider', LLMConfigController.listModelsByProvider);
router.put('/llm/models/:id', LLMConfigController.updateModel);
router.delete('/llm/models/:id', LLMConfigController.deleteModel);
// Parameter routes must be after specific routes
router.get('/llm/:provider', LLMConfigController.getByProvider);
router.post('/llm', LLMConfigController.upsert);
router.post('/llm/:id/activate', LLMConfigController.activate);
router.delete('/llm/:id', LLMConfigController.delete);

// Role LLM configuration routes
router.get('/role-llm', RoleLLMConfigController.list);
router.get('/role-llm/:profile', RoleLLMConfigController.getByProfile);
router.post('/role-llm/:profile', RoleLLMConfigController.upsert);
router.delete('/role-llm/:profile', RoleLLMConfigController.delete);

// Prompt configuration routes
router.get('/prompts', PromptConfigController.list);
router.get('/prompts/grouped', PromptConfigController.listGrouped);
router.get('/prompts/:type', PromptConfigController.getByType);
router.get('/prompts/:type/:key', PromptConfigController.get);
router.post('/prompts', PromptConfigController.upsert);
router.delete('/prompts/:type/:key', PromptConfigController.delete);

// Role and Action metadata routes
router.get('/roles', RoleActionController.getRoles);
router.post('/roles', RoleActionController.createRole);
router.get('/actions', RoleActionController.getActions);
router.post('/actions', RoleActionController.createAction);
router.get('/roles-actions', RoleActionController.getRolesAndActions);

export default router;

