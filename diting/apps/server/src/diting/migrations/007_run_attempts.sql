create table if not exists run_attempts (
  id text primary key,
  task_id text not null references tasks(id) on delete cascade,
  agent_id text not null default '',
  stage text not null,
  release_reason text,
  metadata_json text not null default '{"schemaVersion":"2026-05-11","data":{}}',
  started_at text not null,
  ended_at text
);

create index if not exists run_attempts_task_started_idx on run_attempts (task_id, started_at desc);
