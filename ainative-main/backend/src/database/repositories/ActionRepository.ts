/**
 * Action Repository (Backward Compatibility)
 * Schema V2: Redirects to ActionLogRepository
 * @deprecated Use ActionLogRepository instead
 */

export { ActionLogRepository as ActionRepository, ActionLogRepository, DBActionLog as DBAction } from './ActionLogRepository';
export { default } from './ActionLogRepository';
