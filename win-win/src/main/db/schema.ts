import type Database from "better-sqlite3";
import { APP_ID, APP_VERSION, SCHEMA_VERSION } from "@shared/constants";
import { newId, nowIso } from "./ids";

export const MIGRATIONS: Array<{ version: number; sql: string }> = [
  {
    version: 1,
    sql: `
CREATE TABLE app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE boundary_versions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft','active','archived')),
  created_at TEXT NOT NULL
);

CREATE TABLE assembly_constituencies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_te TEXT NOT NULL DEFAULT '',
  official_code TEXT,
  notes TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE mandals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_te TEXT NOT NULL DEFAULT '',
  official_code TEXT,
  notes TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE gram_panchayats (
  id TEXT PRIMARY KEY,
  mandal_id TEXT NOT NULL REFERENCES mandals(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  name TEXT NOT NULL,
  name_te TEXT NOT NULL DEFAULT '',
  official_code TEXT,
  notes TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE villages (
  id TEXT PRIMARY KEY,
  gram_panchayat_id TEXT NOT NULL REFERENCES gram_panchayats(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  name TEXT NOT NULL,
  name_te TEXT NOT NULL DEFAULT '',
  official_code TEXT,
  notes TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE urban_local_bodies (
  id TEXT PRIMARY KEY,
  body_type TEXT NOT NULL CHECK (body_type IN ('municipality','municipal_corporation','nagar_panchayat')),
  name TEXT NOT NULL,
  name_te TEXT NOT NULL DEFAULT '',
  official_code TEXT,
  administrative_mandal_id TEXT REFERENCES mandals(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  notes TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE wards (
  id TEXT PRIMARY KEY,
  classification TEXT NOT NULL CHECK (classification IN ('rural','urban')),
  gram_panchayat_id TEXT REFERENCES gram_panchayats(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  urban_local_body_id TEXT REFERENCES urban_local_bodies(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  boundary_version_id TEXT NOT NULL REFERENCES boundary_versions(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ward_number TEXT NOT NULL,
  name TEXT NOT NULL,
  name_te TEXT NOT NULL DEFAULT '',
  official_code TEXT,
  record_source TEXT NOT NULL DEFAULT '',
  last_verified_at TEXT,
  notes TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (classification = 'rural' AND gram_panchayat_id IS NOT NULL AND urban_local_body_id IS NULL)
    OR
    (classification = 'urban' AND urban_local_body_id IS NOT NULL AND gram_panchayat_id IS NULL)
  )
);

CREATE UNIQUE INDEX ux_rural_ward_number
  ON wards(gram_panchayat_id, boundary_version_id, ward_number)
  WHERE classification = 'rural' AND gram_panchayat_id IS NOT NULL;

CREATE UNIQUE INDEX ux_urban_ward_number
  ON wards(urban_local_body_id, boundary_version_id, ward_number)
  WHERE classification = 'urban' AND urban_local_body_id IS NOT NULL;

CREATE INDEX ix_wards_boundary ON wards(boundary_version_id, classification);
CREATE INDEX ix_wards_search ON wards(ward_number, name);

CREATE TABLE village_ward_mappings (
  id TEXT PRIMARY KEY,
  village_id TEXT NOT NULL REFERENCES villages(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ward_id TEXT NOT NULL REFERENCES wards(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  coverage_kind TEXT NOT NULL CHECK (coverage_kind IN ('complete','partial')),
  notes TEXT NOT NULL DEFAULT '',
  UNIQUE (village_id, ward_id)
);

CREATE TRIGGER trg_village_ward_rural_insert
BEFORE INSERT ON village_ward_mappings
BEGIN
  SELECT RAISE(ABORT, 'Village-to-ward mappings require a rural ward in the same Gram Panchayat')
  WHERE NOT EXISTS (
    SELECT 1 FROM wards w
    JOIN villages v ON v.id = NEW.village_id
    WHERE w.id = NEW.ward_id
      AND w.classification = 'rural'
      AND w.gram_panchayat_id = v.gram_panchayat_id
  );
END;

CREATE TRIGGER trg_village_ward_rural_update
BEFORE UPDATE ON village_ward_mappings
BEGIN
  SELECT RAISE(ABORT, 'Village-to-ward mappings require a rural ward in the same Gram Panchayat')
  WHERE NOT EXISTS (
    SELECT 1 FROM wards w
    JOIN villages v ON v.id = NEW.village_id
    WHERE w.id = NEW.ward_id
      AND w.classification = 'rural'
      AND w.gram_panchayat_id = v.gram_panchayat_id
  );
END;

CREATE TABLE constituency_coverage (
  id TEXT PRIMARY KEY,
  constituency_id TEXT NOT NULL REFERENCES assembly_constituencies(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  boundary_version_id TEXT NOT NULL REFERENCES boundary_versions(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  unit_type TEXT NOT NULL CHECK (unit_type IN (
    'mandal','gram_panchayat','village','urban_local_body','rural_ward','urban_ward'
  )),
  unit_id TEXT NOT NULL,
  coverage_kind TEXT NOT NULL CHECK (coverage_kind IN ('complete','partial')),
  notes TEXT NOT NULL DEFAULT '',
  UNIQUE (constituency_id, boundary_version_id, unit_type, unit_id)
);

CREATE INDEX ix_coverage_lookup
  ON constituency_coverage(constituency_id, boundary_version_id, unit_type);

CREATE TABLE elections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  election_type TEXT NOT NULL CHECK (election_type IN (
    'assembly','gram_panchayat','municipality','municipal_corporation','nagar_panchayat'
  )),
  year INTEGER NOT NULL,
  constituency_id TEXT NOT NULL REFERENCES assembly_constituencies(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  boundary_version_id TEXT NOT NULL REFERENCES boundary_versions(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('draft','active','archived')),
  notes TEXT NOT NULL DEFAULT '',
  snapshot_json TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE election_coverage (
  id TEXT PRIMARY KEY,
  election_id TEXT NOT NULL REFERENCES elections(id) ON DELETE CASCADE ON UPDATE CASCADE,
  unit_type TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  coverage_kind TEXT NOT NULL CHECK (coverage_kind IN ('complete','partial')),
  unit_name_snapshot TEXT NOT NULL,
  UNIQUE (election_id, unit_type, unit_id)
);

CREATE TABLE election_wards (
  election_id TEXT NOT NULL REFERENCES elections(id) ON DELETE CASCADE ON UPDATE CASCADE,
  ward_id TEXT NOT NULL REFERENCES wards(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ward_number_snapshot TEXT NOT NULL,
  ward_name_snapshot TEXT NOT NULL,
  classification_snapshot TEXT NOT NULL,
  PRIMARY KEY (election_id, ward_id)
);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  changed_fields TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX ix_audit_created ON audit_log(created_at DESC);
CREATE INDEX ix_gp_mandal ON gram_panchayats(mandal_id);
CREATE INDEX ix_villages_gp ON villages(gram_panchayat_id);
CREATE INDEX ix_ulb_mandal ON urban_local_bodies(administrative_mandal_id);
CREATE INDEX ix_elections_const ON elections(constituency_id, status);
`
  },
  {
    version: 2,
    sql: `
CREATE TABLE persons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_te TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  consent_status TEXT NOT NULL CHECK (consent_status IN ('given','not_given','unknown','withdrawn')),
  consent_date TEXT,
  consent_source TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX ix_persons_name ON persons(name);

CREATE TABLE ward_contacts (
  id TEXT PRIMARY KEY,
  ward_id TEXT NOT NULL REFERENCES wards(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  constituency_id TEXT NOT NULL REFERENCES assembly_constituencies(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  name TEXT NOT NULL,
  name_te TEXT NOT NULL DEFAULT '',
  organization TEXT NOT NULL DEFAULT '',
  public_role TEXT NOT NULL DEFAULT '',
  area_served TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  consent_status TEXT NOT NULL CHECK (consent_status IN ('given','not_given','unknown','withdrawn')),
  consent_date TEXT,
  consent_source TEXT NOT NULL DEFAULT '',
  record_source TEXT NOT NULL DEFAULT '',
  last_verified_at TEXT,
  coordination_notes TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX ix_contacts_ward ON ward_contacts(ward_id, archived, name);
CREATE INDEX ix_contacts_search ON ward_contacts(name, organization, public_role);

CREATE TABLE team_assignments (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ward_id TEXT NOT NULL REFERENCES wards(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  constituency_id TEXT NOT NULL REFERENCES assembly_constituencies(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  operational_role TEXT NOT NULL,
  responsibilities TEXT NOT NULL DEFAULT '',
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL CHECK (status IN ('active','inactive')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX ix_assign_ward ON team_assignments(ward_id, status);
CREATE INDEX ix_assign_person ON team_assignments(person_id, ward_id);

CREATE TABLE issues (
  id TEXT PRIMARY KEY,
  ward_id TEXT NOT NULL REFERENCES wards(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  constituency_id TEXT NOT NULL REFERENCES assembly_constituencies(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  reference_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  reported_at TEXT NOT NULL,
  responsible_person_id TEXT REFERENCES persons(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  priority TEXT NOT NULL CHECK (priority IN ('low','medium','high','urgent')),
  due_date TEXT,
  status TEXT NOT NULL CHECK (status IN ('open','in_progress','resolved','closed')),
  resolution_notes TEXT NOT NULL DEFAULT '',
  complainant_name TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX ix_issues_ward ON issues(ward_id, status, priority);
CREATE INDEX ix_issues_ref ON issues(reference_number);

CREATE TABLE issue_status_history (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE ON UPDATE CASCADE,
  status TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  changed_at TEXT NOT NULL
);

CREATE INDEX ix_issue_hist ON issue_status_history(issue_id, changed_at);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  ward_id TEXT NOT NULL REFERENCES wards(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  constituency_id TEXT NOT NULL REFERENCES assembly_constituencies(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  title TEXT NOT NULL,
  assigned_person_id TEXT REFERENCES persons(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  related_issue_id TEXT REFERENCES issues(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  due_date TEXT,
  status TEXT NOT NULL CHECK (status IN ('open','in_progress','done','cancelled')),
  description TEXT NOT NULL DEFAULT '',
  completed_at TEXT,
  completion_notes TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX ix_tasks_ward ON tasks(ward_id, status, due_date);
CREATE INDEX ix_tasks_assignee ON tasks(assigned_person_id, status);
`
  },
  {
    version: 3,
    sql: `
CREATE TABLE roll_editions (
  id TEXT PRIMARY KEY,
  constituency_id TEXT NOT NULL REFERENCES assembly_constituencies(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  boundary_version_id TEXT NOT NULL REFERENCES boundary_versions(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  name TEXT NOT NULL,
  revision_code TEXT NOT NULL DEFAULT '',
  published_on TEXT,
  notes TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX ix_roll_const ON roll_editions(constituency_id, archived);

CREATE TABLE import_batches (
  id TEXT PRIMARY KEY,
  constituency_id TEXT NOT NULL REFERENCES assembly_constituencies(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  roll_edition_id TEXT NOT NULL REFERENCES roll_editions(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  file_name TEXT NOT NULL,
  file_sha256 TEXT NOT NULL,
  row_count INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('committed','cancelled','failed')),
  mapping_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  committed_at TEXT
);

CREATE INDEX ix_import_hash ON import_batches(file_sha256, roll_edition_id, status);

CREATE TABLE voter_entries (
  id TEXT PRIMARY KEY,
  roll_edition_id TEXT NOT NULL REFERENCES roll_editions(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  constituency_id TEXT NOT NULL REFERENCES assembly_constituencies(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  import_batch_id TEXT REFERENCES import_batches(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  source_row_number INTEGER,
  source_name TEXT NOT NULL DEFAULT '',
  source_name_en TEXT NOT NULL DEFAULT '',
  source_electoral_id TEXT NOT NULL DEFAULT '',
  source_roll_serial TEXT NOT NULL DEFAULT '',
  source_age TEXT NOT NULL DEFAULT '',
  source_age_reference_date TEXT NOT NULL DEFAULT '',
  source_address TEXT NOT NULL DEFAULT '',
  source_section TEXT NOT NULL DEFAULT '',
  source_page TEXT NOT NULL DEFAULT '',
  source_ward_label TEXT NOT NULL DEFAULT '',
  local_name TEXT,
  local_name_en TEXT,
  local_electoral_id TEXT,
  local_roll_serial TEXT,
  local_age TEXT,
  local_age_reference_date TEXT,
  local_address TEXT,
  assigned_ward_id TEXT REFERENCES wards(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  verification_status TEXT NOT NULL CHECK (verification_status IN ('unverified','verified','needs_review')),
  verified_at TEXT,
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  archive_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX ix_voter_scope ON voter_entries(constituency_id, roll_edition_id, assigned_ward_id, archived);
CREATE INDEX ix_voter_idtext ON voter_entries(source_electoral_id, local_electoral_id);
CREATE INDEX ix_voter_serial ON voter_entries(source_roll_serial, local_roll_serial);
CREATE INDEX ix_voter_verify ON voter_entries(verification_status, constituency_id);

CREATE TABLE voter_change_history (
  id TEXT PRIMARY KEY,
  voter_id TEXT NOT NULL REFERENCES voter_entries(id) ON DELETE CASCADE ON UPDATE CASCADE,
  changed_at TEXT NOT NULL,
  action TEXT NOT NULL,
  field_names TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX ix_voter_hist ON voter_change_history(voter_id, changed_at);

CREATE TABLE ward_assignment_history (
  id TEXT PRIMARY KEY,
  voter_id TEXT NOT NULL REFERENCES voter_entries(id) ON DELETE CASCADE ON UPDATE CASCADE,
  from_ward_id TEXT,
  to_ward_id TEXT,
  reason TEXT NOT NULL DEFAULT '',
  changed_at TEXT NOT NULL
);

CREATE INDEX ix_assign_hist ON ward_assignment_history(voter_id, changed_at);

CREATE TABLE duplicate_pairs (
  id TEXT PRIMARY KEY,
  roll_edition_id TEXT NOT NULL REFERENCES roll_editions(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  voter_a_id TEXT NOT NULL REFERENCES voter_entries(id) ON DELETE CASCADE ON UPDATE CASCADE,
  voter_b_id TEXT NOT NULL REFERENCES voter_entries(id) ON DELETE CASCADE ON UPDATE CASCADE,
  reasons_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('flagged','distinct','confirmed_duplicate_import')),
  reviewed_at TEXT,
  UNIQUE(roll_edition_id, voter_a_id, voter_b_id)
);
`
  },
  {
    version: 4,
    sql: `
CREATE TABLE ward_contact_links (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ward_id TEXT NOT NULL REFERENCES wards(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  constituency_id TEXT NOT NULL REFERENCES assembly_constituencies(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  organization TEXT NOT NULL DEFAULT '',
  public_role TEXT NOT NULL DEFAULT '',
  area_served TEXT NOT NULL DEFAULT '',
  record_source TEXT NOT NULL DEFAULT '',
  last_verified_at TEXT,
  coordination_notes TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (person_id, ward_id)
);

CREATE INDEX ix_contact_links_ward ON ward_contact_links(ward_id, constituency_id, archived);
CREATE INDEX ix_contact_links_person ON ward_contact_links(person_id);
CREATE INDEX ix_contact_links_org ON ward_contact_links(organization, public_role);
CREATE INDEX ix_issues_responsible ON issues(responsible_person_id, status);
CREATE INDEX ix_tasks_issue ON tasks(related_issue_id);
CREATE INDEX ix_persons_consent ON persons(consent_status, archived);
`
  },
  {
    version: 5,
    sql: `
ALTER TABLE ward_assignment_history ADD COLUMN verification_source TEXT NOT NULL DEFAULT '';
CREATE INDEX ix_voter_edition_active ON voter_entries(roll_edition_id, archived, assigned_ward_id);
CREATE INDEX ix_import_edition_hash ON import_batches(constituency_id, roll_edition_id, file_sha256, status);
`
  },
  {
    version: 6,
    sql: `
CREATE TABLE reservation_notifications (
  id TEXT PRIMARY KEY,
  constituency_id TEXT NOT NULL REFERENCES assembly_constituencies(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  election_id TEXT NOT NULL REFERENCES elections(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  boundary_version_id TEXT NOT NULL REFERENCES boundary_versions(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  year INTEGER NOT NULL,
  name TEXT NOT NULL,
  notification_reference TEXT NOT NULL DEFAULT '',
  notification_date TEXT,
  district_source TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft','verified','superseded')),
  notes TEXT NOT NULL DEFAULT '',
  verified_at TEXT,
  verified_notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX ix_res_note_election ON reservation_notifications(election_id, year, status);

CREATE TABLE reservation_import_batches (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL REFERENCES reservation_notifications(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  constituency_id TEXT NOT NULL REFERENCES assembly_constituencies(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  file_name TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  worksheet_name TEXT NOT NULL,
  source_year INTEGER,
  row_count INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('committed','cancelled','failed')),
  district_source TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  committed_at TEXT
);

CREATE UNIQUE INDEX ux_res_import_fingerprint
  ON reservation_import_batches(notification_id, fingerprint)
  WHERE status = 'committed';

CREATE TABLE seat_reservations (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL REFERENCES reservation_notifications(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  import_batch_id TEXT REFERENCES reservation_import_batches(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  election_id TEXT NOT NULL REFERENCES elections(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  year INTEGER NOT NULL,
  seat_type TEXT NOT NULL CHECK (seat_type IN ('sarpanch','ward_member')),
  gram_panchayat_id TEXT REFERENCES gram_panchayats(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ward_id TEXT REFERENCES wards(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  source_mandal_label TEXT NOT NULL,
  source_gp_label TEXT NOT NULL,
  source_ward_number TEXT NOT NULL DEFAULT '',
  declared_ward_count INTEGER,
  original_code TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('UR','BC','SC','ST','unknown','not_recorded')),
  women_reserved INTEGER NOT NULL CHECK (women_reserved IN (0,1)),
  review_status TEXT NOT NULL,
  source_filename TEXT NOT NULL DEFAULT '',
  source_worksheet TEXT NOT NULL DEFAULT '',
  source_row INTEGER,
  source_cell TEXT NOT NULL DEFAULT '',
  verification_notes TEXT NOT NULL DEFAULT '',
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (seat_type = 'sarpanch' AND ward_id IS NULL)
    OR seat_type = 'ward_member'
  )
);

CREATE UNIQUE INDEX ux_res_sarpanch_gp
  ON seat_reservations(notification_id, gram_panchayat_id)
  WHERE seat_type = 'sarpanch' AND gram_panchayat_id IS NOT NULL;

CREATE UNIQUE INDEX ux_res_ward_member
  ON seat_reservations(notification_id, ward_id)
  WHERE seat_type = 'ward_member' AND ward_id IS NOT NULL;

CREATE UNIQUE INDEX ux_res_source_seat
  ON seat_reservations(notification_id, seat_type, source_mandal_label, source_gp_label, source_ward_number);

CREATE INDEX ix_res_lookup ON seat_reservations(notification_id, seat_type, review_status, category);
CREATE INDEX ix_res_gp ON seat_reservations(gram_panchayat_id, seat_type);
CREATE INDEX ix_res_ward ON seat_reservations(ward_id);

CREATE TABLE reservation_review_history (
  id TEXT PRIMARY KEY,
  seat_id TEXT NOT NULL REFERENCES seat_reservations(id) ON DELETE CASCADE ON UPDATE CASCADE,
  notification_id TEXT NOT NULL REFERENCES reservation_notifications(id) ON DELETE CASCADE ON UPDATE CASCADE,
  changed_at TEXT NOT NULL,
  action TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  field_names TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX ix_res_hist ON reservation_review_history(seat_id, changed_at);
`
  }
];

export function applyMigrations(db: Database.Database): void {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
  const current = db.prepare("SELECT MAX(version) AS v FROM schema_migrations").get() as { v: number | null };
  const from = current.v ?? 0;
  for (const migration of MIGRATIONS) {
    if (migration.version <= from) continue;
    const tx = db.transaction(() => {
      db.exec(migration.sql);
      db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(
        migration.version,
        nowIso()
      );
    });
    tx();
  }
  backfillContactLinks(db);
  seedMeta(db);
  db.prepare("UPDATE app_meta SET value = ? WHERE key = 'schema_version'").run(String(SCHEMA_VERSION));
  db.prepare("UPDATE app_meta SET value = ? WHERE key = 'app_version'").run(APP_VERSION);
}

function backfillContactLinks(db: Database.Database): void {
  const legacy = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ward_contacts'")
    .get() as { name: string } | undefined;
  const links = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ward_contact_links'")
    .get() as { name: string } | undefined;
  if (!legacy || !links) return;
  const rows = db.prepare("SELECT * FROM ward_contacts").all() as Array<Record<string, unknown>>;
  const insertPerson = db.prepare(
    `INSERT INTO persons (id, name, name_te, phone, email, consent_status, consent_date, consent_source, archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertLink = db.prepare(
    `INSERT INTO ward_contact_links (
      id, person_id, ward_id, constituency_id, organization, public_role, area_served,
      record_source, last_verified_at, coordination_notes, archived, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const existing = db.prepare("SELECT id FROM ward_contact_links WHERE id = ?");
  for (const row of rows) {
    if (existing.get(String(row.id))) continue;
    const personId = newId();
    insertPerson.run(
      personId,
      String(row.name),
      String(row.name_te ?? ""),
      String(row.phone ?? ""),
      String(row.email ?? ""),
      String(row.consent_status ?? "unknown"),
      row.consent_date ?? null,
      String(row.consent_source ?? ""),
      Number(row.archived ?? 0),
      String(row.created_at),
      String(row.updated_at)
    );
    insertLink.run(
      String(row.id),
      personId,
      String(row.ward_id),
      String(row.constituency_id),
      String(row.organization ?? ""),
      String(row.public_role ?? ""),
      String(row.area_served ?? ""),
      String(row.record_source ?? ""),
      row.last_verified_at ?? null,
      String(row.coordination_notes ?? ""),
      Number(row.archived ?? 0),
      String(row.created_at),
      String(row.updated_at)
    );
  }
}

export function seedMeta(db: Database.Database): void {
  const insert = db.prepare(
    "INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING"
  );
  insert.run("app_id", APP_ID);
  insert.run("schema_version", String(SCHEMA_VERSION));
  insert.run("app_version", APP_VERSION);
  insert.run("organization_name", "");
  insert.run("default_constituency_id", "");
  insert.run("locale", "en");
  insert.run("data_kind", "empty");
}
