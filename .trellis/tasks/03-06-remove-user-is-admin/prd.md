# Remove users.isAdmin

## Goal
Remove the `isAdmin` field from the `users` table and stop using it as a platform-level permission source so business-line capabilities are governed by explicit membership roles instead.

## Requirements
- Remove `isAdmin` from the backend user domain model, relational entity, mapper, seed data, and DB schema.
- Replace business-line creation and related permission checks with role-based logic that does not rely on `users.isAdmin`.
- Remove frontend profile typing and UI permission derivation that depend on `isAdmin`.
- Keep existing non-user-based admin checks that rely on JWT roles unchanged unless they depend on the removed DB field.

## Acceptance Criteria
- [ ] New and existing code paths no longer read or write `users.isAdmin`.
- [ ] A database migration drops the `users.isAdmin` column and supports rollback.
- [ ] Business-line and related access control still work using explicit roles after the field removal.
- [ ] Frontend user profile types and derived permissions no longer depend on `isAdmin`.
- [ ] Targeted lint/test validation passes, or any unrelated failures are documented.

## Technical Notes
- This is a cross-layer change covering database schema, NestJS services, and Vue/TypeScript client state.
- Prefer minimal surface changes and preserve existing JWT `roles` behavior where it is already the authorization source.
- Be careful not to overwrite the user's existing unstaged whitespace change in `backend/src/database/migrations/1772722882499-InitAinativeSchema.ts`.
