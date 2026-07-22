import { RunAttempt, RunAttemptRepository, TitingTask, WaitReason } from "@diting/plugin-api";
import { readWaitReason } from "./repositories";

export async function buildTaskLifecycleDiagnostics(
  task: TitingTask,
  runAttempts: RunAttemptRepository
): Promise<{
  currentAttempt: RunAttempt | null;
  waitReason: WaitReason | null;
}> {
  const [currentAttempt, waitReason] = await Promise.all([
    task.status === "active" ? runAttempts.getLatestByTask(task.id) : Promise.resolve(null),
    Promise.resolve(task.status === "waiting" ? readWaitReason(task.metadata) : null)
  ]);
  return { currentAttempt, waitReason };
}
