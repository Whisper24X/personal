export enum PlanGranularity {
  /** 功能组数与子任务总数尽量接近，倾向每组约一条子任务 */
  coarse = 'coarse',
  conservative = 'conservative',
  standard = 'standard',
  fine = 'fine',
}
