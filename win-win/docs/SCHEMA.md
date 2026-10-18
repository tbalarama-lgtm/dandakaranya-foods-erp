# Database schema

Migrations are applied in order. `schema_migrations` stores versions. `app_meta.schema_version` is kept in sync.

## v1 — Phase 1 geography and elections

`app_meta`, `boundary_versions`, `assembly_constituencies`, `mandals`, `gram_panchayats`, `villages`, `urban_local_bodies`, `wards`, `village_ward_mappings`, `constituency_coverage`, `elections`, `election_coverage`, `election_wards`, `audit_log`

## v2 — reserved (not exposed in Phase 1 UI)

`persons`, `ward_contacts`, `team_assignments`, `issues`, `issue_status_history`, `tasks`

## v3 — reserved (not exposed in Phase 1 UI)

`roll_editions`, `import_batches`, `voter_entries`, `voter_change_history`, `ward_assignment_history`, `duplicate_pairs`

Phase 1 does not show voter, contact or task screens. The extra tables exist so later migrations stay compatible; they start empty.
