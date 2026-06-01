export const MEMORY_INGEST_ENQUEUE = Symbol('MEMORY_INGEST_ENQUEUE');

export type MemoryIngestEnqueueInput = {
  projectId: string;
  taskId: string;
  idempotencyKey: string;
};

export interface MemoryIngestEnqueuePort {
  enqueueAfterTaskDone(input: MemoryIngestEnqueueInput): Promise<void>;
}
