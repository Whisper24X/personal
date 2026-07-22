import { RunAttempt, RunAttemptListQuery, RunAttemptRepository } from "@diting/plugin-api";

export class InMemoryRunAttemptRepository implements RunAttemptRepository {
  private readonly attempts = new Map<string, RunAttempt>();

  async create(attempt: RunAttempt): Promise<void> {
    this.attempts.set(attempt.id, { ...attempt });
  }

  async save(attempt: RunAttempt): Promise<void> {
    this.attempts.set(attempt.id, { ...attempt });
  }

  async getById(id: string): Promise<RunAttempt | null> {
    const attempt = this.attempts.get(id);
    return attempt ? { ...attempt } : null;
  }

  async getLatestByTask(taskId: string): Promise<RunAttempt | null> {
    return [...this.attempts.values()]
      .filter((item) => item.taskId === taskId)
      .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime())[0] ?? null;
  }

  async list(query: RunAttemptListQuery = {}): Promise<RunAttempt[]> {
    return [...this.attempts.values()]
      .filter((item) => (query.taskId ? item.taskId === query.taskId : true))
      .filter((item) => (query.agentId ? item.agentId === query.agentId : true))
      .filter((item) => (query.stage ? item.stage === query.stage : true))
      .slice(0, query.limit ?? 50)
      .map((item) => ({ ...item }));
  }

  async listByTask(taskId: string): Promise<RunAttempt[]> {
    return this.list({ taskId });
  }
}
