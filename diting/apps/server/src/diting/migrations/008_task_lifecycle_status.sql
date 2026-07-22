-- Backfill RunAttempt rows for in-flight execution statuses before renaming task status.
insert into run_attempts (id, task_id, agent_id, stage, release_reason, metadata_json, started_at, ended_at)
select
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
  id,
  coalesce(json_extract(metadata_json, '$.data.legacyAgentId'), json_extract(metadata_json, '$.legacyAgentId'), ''),
  case status
    when 'evaluating' then 'evaluating'
    when 'repairing' then 'repairing'
    else 'executing'
  end,
  'legacy_status_migration',
  '{"schemaVersion":"2026-05-11","data":{"source":"008_task_lifecycle_status"}}',
  coalesce(started_at, updated_at, created_at),
  null
from tasks
where status in ('running', 'evaluating', 'repairing')
  and not exists (
    select 1 from run_attempts ra where ra.task_id = tasks.id and ra.ended_at is null
  );

-- Stamp WaitReason into metadata for human-intervention statuses.
update tasks
set metadata_json = json_set(
  case
    when json_valid(metadata_json) = 1 and json_extract(metadata_json, '$.schemaVersion') is not null
      then metadata_json
    else json_object('schemaVersion', '2026-05-11', 'data', coalesce(json(metadata_json), json('{}')))
  end,
  '$.data.waitReason',
  json_object(
    'type', case status when 'blocked' then 'policy_blocked' else 'human_input' end,
    'source', 'legacy_status_migration',
    'message', case status when 'blocked' then 'Task was blocked before lifecycle migration' else 'Task required human intervention before lifecycle migration' end,
    'recoverableBy', 'user',
    'createdAt', coalesce(updated_at, created_at)
  )
)
where status in ('needs_human', 'blocked');

-- Map legacy task statuses to the new 7-state lifecycle model.
update tasks
set status = case status
  when 'created' then 'draft'
  when 'validated' then 'draft'
  when 'pending' then 'draft'
  when 'queued' then 'ready'
  when 'running' then 'active'
  when 'evaluating' then 'active'
  when 'repairing' then 'active'
  when 'done' then 'succeeded'
  when 'needs_human' then 'waiting'
  when 'blocked' then 'waiting'
  else status
end
where status in (
  'created', 'validated', 'pending', 'queued', 'running', 'evaluating', 'repairing',
  'done', 'needs_human', 'blocked'
);
