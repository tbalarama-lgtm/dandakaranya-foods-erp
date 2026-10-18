# Database schema

Migrations are applied in order. `schema_migrations` stores versions. `app_meta.schema_version` is kept in sync.

## v1 — Phase 1 geography and elections

`app_meta`, `boundary_versions`, `assembly_constituencies`, `mandals`, `gram_panchayats`, `villages`, `urban_local_bodies`, `wards`, `village_ward_mappings`, `constituency_coverage`, `elections`, `election_coverage`, `election_wards`, `audit_log`

## v2 — workspace tables (identity originally duplicated on contacts)

`persons`, `ward_contacts` (legacy), `team_assignments`, `issues`, `issue_status_history`, `tasks`

## v3 — reserved (not exposed in Phase 2 UI)

`roll_editions`, `import_batches`, `voter_entries`, `voter_change_history`, `ward_assignment_history`, `duplicate_pairs`

## v4 — person-linked ward contacts

`ward_contact_links` associates one person identity with many wards. Existing `ward_contacts` rows are copied into `persons` + `ward_contact_links` without deleting geography or election data. Private phone/email live only on `persons` and require recorded consent.
