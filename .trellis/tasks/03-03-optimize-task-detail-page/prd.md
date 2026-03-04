# Optimize Task Detail Page With Vibework Reference

## Goal
Optimize the task detail page in `frontend` to improve information architecture, readability, interaction efficiency, and component organization by referencing the task detail implementation style from `vibework`.

## Requirements
- Analyze the current task detail page implementation and identify UX/component gaps.
- Analyze `vibework` task detail page features/components and extract reusable interaction ideas.
- Refactor the current task detail page with clearer section hierarchy and better interaction flow.
- Keep API contracts and existing business behavior compatible.
- Use Vue 3 Composition API with `<script setup lang="ts">` and follow project frontend standards.

## Acceptance Criteria
- [ ] Task detail page has improved structure and usability compared with current implementation.
- [ ] Key task information, metadata, and action areas are easier to scan and operate.
- [ ] Existing task data loading and update behavior continue to work.
- [ ] Code follows project frontend guidelines and Vue best practices.
- [ ] `pnpm lint` and `pnpm type-check` pass (or issues are explicitly documented if unrelated).

## Technical Notes
- Scope is frontend only.
- Prioritize component reuse and avoid introducing duplicated logic.
- Keep styles consistent with existing design tokens and Tailwind utility patterns.
