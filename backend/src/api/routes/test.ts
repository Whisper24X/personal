/**
 * Test API Routes
 * Routes for testing individual components
 */

import { Router } from 'express';
import {
  testWriteCode,
  testExecuteSubtask,
  testDeploy,
  getEngineerInfo,
  testCustom,
} from '../controllers/EngineerTestController';

const router: Router = Router();

/**
 * Engineer role test routes
 */

// Get Engineer role information
router.get('/engineer/info', getEngineerInfo);

// Test WriteCode action
router.post('/engineer/write-code', testWriteCode);

// Test ExecuteSubtask action
router.post('/engineer/execute-subtask', testExecuteSubtask);

// Test Deploy action
router.post('/engineer/deploy', testDeploy);

// Test custom scenario
router.post('/engineer/custom', testCustom);

export default router;

