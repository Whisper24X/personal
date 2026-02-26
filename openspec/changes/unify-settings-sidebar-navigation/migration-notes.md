## Rollout Notes

1. Deploy frontend with the new Settings modal and compatibility redirects enabled.
2. Validate deep-link behavior:
   - `/settings` -> `/dashboard?settings=profile`
   - `/about` -> `/dashboard?settings=about`
   - `/business-lines` -> `/dashboard?settings=business-lines`
   - `/projects` -> `/dashboard?settings=projects`
   - `/users` -> `/dashboard?settings=users` (non-admin falls back to `profile`)
3. Confirm sidebar second column no longer contains `home/about/business-lines/projects/users`.
4. Verify admin and non-admin behavior in Settings sections:
   - Admin sees Users section
   - Non-admin does not see Users section and gets a safe fallback
5. Run frontend checks:
   - `pnpm -C frontend type-check`
   - `pnpm -C frontend test:unit --run`
   - `pnpm -C frontend lint` (currently blocked by pre-existing repo lint baseline issues unrelated to this change)

## Rollback Notes

1. Revert this change set to restore legacy standalone routes and sidebar structure.
2. Restore route components for `/settings`, `/about`, `/business-lines`, `/projects`, `/users`, and `/home`.
3. Remove `settings` query synchronization in layout hook to disable modal deep-link behavior.
4. Remove Settings modal mount from `Layout.vue` and revert sidebar settings button back to route navigation.
5. Re-run frontend checks to confirm rollback integrity.
