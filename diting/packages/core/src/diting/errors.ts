/** Core 内通用错误基类。 */
export class TitingError extends Error {}

/** 资源不存在（任务、Agent、trace 等）；HTTP 层常映射为 404。 */
export class NotFoundError extends TitingError {}

/** 任务状态机非法迁移；HTTP 层可映射为 400。 */
export class InvalidTransitionError extends TitingError {}

/** Preflight 失败且任务已迁移到 blocked；执行管线应直接结束，不得再记 unknown failure。 */
export class PreflightBlockedError extends TitingError {}
