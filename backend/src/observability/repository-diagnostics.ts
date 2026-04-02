import { DataSource } from 'typeorm';
import { SlowApiDiagnosticsSession } from './slow-api-diagnostics';

type PoolLike = {
  totalCount?: number;
  idleCount?: number;
  waitingCount?: number;
};

export type RepositoryDiagnosticsOptions = {
  diagnostics?: SlowApiDiagnosticsSession;
  metricPrefix?: string;
};

export function readTypeOrmPoolSnapshot(
  dataSource: DataSource,
): PoolLike | null {
  const driver = dataSource.driver as { master?: PoolLike } | undefined;
  const pool = driver?.master;

  if (!pool) {
    return null;
  }

  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}

export function buildPoolSnapshotDetails(
  metricPrefix: string,
  stage: string,
  snapshot: PoolLike | null,
): Record<string, number> {
  if (!snapshot) {
    return {};
  }

  const suffix = stage ? stage[0]?.toUpperCase() + stage.slice(1) : '';

  const details: Record<string, number> = {};

  if (snapshot.totalCount !== undefined) {
    details[`${metricPrefix}PoolTotal${suffix}`] = snapshot.totalCount;
  }
  if (snapshot.idleCount !== undefined) {
    details[`${metricPrefix}PoolIdle${suffix}`] = snapshot.idleCount;
  }
  if (snapshot.waitingCount !== undefined) {
    details[`${metricPrefix}PoolWaiting${suffix}`] = snapshot.waitingCount;
  }

  return details;
}
