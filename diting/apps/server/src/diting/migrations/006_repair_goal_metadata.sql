alter table repair_goals
  add column metadata_json text not null default '{"schemaVersion":"2026-05-11","data":{}}';
