/**
 * HTML原型生成路由
 */

import { Router } from 'express';
import {
  generateHtmlPrototype,
  getGenerationStatus,
  getGenerationConversation,
  sendFollowup,
  stopGeneration,
  deleteGeneration,
  listGenerations,
  generateFromPrd,
} from '../controllers/htmlPrototypeController.js';

const router = Router();

// HTML原型生成相关路由
router.post('/api/v1/html-prototype/generate', generateHtmlPrototype);
router.get('/api/v1/html-prototype/generate', listGenerations);
router.get('/api/v1/html-prototype/generate/:taskId/status', getGenerationStatus);
router.get('/api/v1/html-prototype/generate/:taskId/conversation', getGenerationConversation);
router.post('/api/v1/html-prototype/generate/:taskId/followup', sendFollowup);
router.post('/api/v1/html-prototype/generate/:taskId/stop', stopGeneration);
router.delete('/api/v1/html-prototype/generate/:taskId', deleteGeneration);
router.post('/api/v1/html-prototype/generate-from-prd/:prdId', generateFromPrd);

export default router;

