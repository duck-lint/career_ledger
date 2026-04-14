PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS experience_records (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE,
  record_type TEXT NOT NULL CHECK (record_type IN ('employment', 'project')),
  organization TEXT NOT NULL,
  title TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  location TEXT,
  employment_type TEXT,
  context_tags_json TEXT,
  canonical_scope_summary TEXT,
  common_context_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS evidence_items (
  id TEXT PRIMARY KEY,
  experience_record_id TEXT NOT NULL,
  claim TEXT NOT NULL,
  date_range TEXT,
  tags_json TEXT NOT NULL,
  scope_context_json TEXT,
  evidence_note TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (experience_record_id) REFERENCES experience_records(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS raw_intake_import_runs (
  id TEXT PRIMARY KEY,
  source_path TEXT NOT NULL,
  total_item_count INTEGER NOT NULL CHECK (total_item_count >= 0),
  imported_record_count INTEGER NOT NULL CHECK (imported_record_count >= 0),
  imported_evidence_count INTEGER NOT NULL CHECK (imported_evidence_count >= 0),
  skipped_count INTEGER NOT NULL CHECK (skipped_count >= 0),
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS raw_intake_import_items (
  intake_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  source_area TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('imported', 'skipped')),
  skip_reason TEXT,
  experience_record_id TEXT,
  created_evidence_ids_json TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  FOREIGN KEY (run_id) REFERENCES raw_intake_import_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (experience_record_id) REFERENCES experience_records(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS generation_manifests (
  id TEXT PRIMARY KEY,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  artifact_kind TEXT NOT NULL,
  target_role_family TEXT,
  job_posting_path TEXT,
  job_posting_sha256 TEXT,
  build_policy_path TEXT,
  build_policy_sha256 TEXT,
  candidate_profile_path TEXT,
  candidate_profile_sha256 TEXT,
  library_export_path TEXT,
  library_export_sha256 TEXT,
  selected_record_ids_json TEXT,
  selected_evidence_ids_json TEXT,
  gap_report_json TEXT,
  artifact_paths_json TEXT,
  artifact_hashes_json TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS anomalies (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  anomaly_code TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  detected_at TEXT DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS candidate_profiles (
  id TEXT PRIMARY KEY CHECK (id = 'active'),
  version TEXT NOT NULL,
  config_type TEXT NOT NULL CHECK (config_type = 'candidate_profile'),
  display_name TEXT NOT NULL,
  location TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  linkedin TEXT,
  github TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS candidate_profile_education (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL DEFAULT 'active',
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  institution TEXT NOT NULL,
  credential TEXT NOT NULL,
  signal_tags_json TEXT NOT NULL,
  major TEXT,
  minor TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  UNIQUE (profile_id, sort_order)
);

CREATE TABLE IF NOT EXISTS candidate_profile_certifications (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL DEFAULT 'active',
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  name TEXT NOT NULL,
  issuer TEXT NOT NULL,
  credential_detail TEXT NOT NULL,
  signal_tags_json TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  UNIQUE (profile_id, sort_order)
);

CREATE TABLE IF NOT EXISTS candidate_profile_summary_lines (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL DEFAULT 'active',
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  line_text TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  UNIQUE (profile_id, sort_order)
);

CREATE TABLE IF NOT EXISTS resume_build_policy_settings (
  id TEXT PRIMARY KEY CHECK (id = 'active'),
  policy_json TEXT NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_experience_records_slug
  ON experience_records(slug);

CREATE INDEX IF NOT EXISTS idx_evidence_items_experience_record_id
  ON evidence_items(experience_record_id);

CREATE INDEX IF NOT EXISTS idx_raw_intake_import_items_run_id
  ON raw_intake_import_items(run_id);

CREATE INDEX IF NOT EXISTS idx_raw_intake_import_items_outcome
  ON raw_intake_import_items(outcome);

CREATE INDEX IF NOT EXISTS idx_generation_manifests_target_role_family
  ON generation_manifests(target_role_family);

CREATE INDEX IF NOT EXISTS idx_anomalies_entity
  ON anomalies(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_anomalies_code
  ON anomalies(anomaly_code);

CREATE INDEX IF NOT EXISTS idx_anomalies_open
  ON anomalies(resolved_at);

CREATE INDEX IF NOT EXISTS idx_candidate_profile_education_profile_id
  ON candidate_profile_education(profile_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_candidate_profile_certifications_profile_id
  ON candidate_profile_certifications(profile_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_candidate_profile_summary_lines_profile_id
  ON candidate_profile_summary_lines(profile_id, sort_order);

-- Canonical tag taxonomy (managed by GUI; read-only for pipeline tools)
CREATE TABLE IF NOT EXISTS canonical_tags (
  id TEXT PRIMARY KEY,
  tag TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS taxonomy_metadata (
  metadata_key TEXT PRIMARY KEY,
  metadata_value TEXT NOT NULL,
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS delivery_toolkit_categories (
  name TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL UNIQUE CHECK (sort_order >= 0)
);

CREATE TABLE IF NOT EXISTS delivery_toolkit_metadata (
  canonical_tag TEXT PRIMARY KEY,
  category_name TEXT NOT NULL,
  display_label TEXT NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  FOREIGN KEY (canonical_tag) REFERENCES canonical_tags(tag)
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (category_name) REFERENCES delivery_toolkit_categories(name)
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_delivery_toolkit_metadata_category_name
  ON delivery_toolkit_metadata(category_name);

CREATE TABLE IF NOT EXISTS tag_inference_markers (
  id TEXT PRIMARY KEY,
  canonical_tag TEXT NOT NULL,
  marker_kind TEXT NOT NULL CHECK (marker_kind IN ('literal', 'compound')),
  literal_value TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  FOREIGN KEY (canonical_tag) REFERENCES canonical_tags(tag)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CHECK (
    (marker_kind = 'literal' AND literal_value IS NOT NULL)
    OR (marker_kind = 'compound' AND literal_value IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_tag_inference_markers_canonical_tag
  ON tag_inference_markers(canonical_tag);

CREATE TABLE IF NOT EXISTS tag_inference_marker_terms (
  id TEXT PRIMARY KEY,
  marker_id TEXT NOT NULL,
  term_group TEXT NOT NULL CHECK (term_group IN ('all_of', 'any_of')),
  term_value TEXT NOT NULL,
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  FOREIGN KEY (marker_id) REFERENCES tag_inference_markers(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE (marker_id, term_group, sort_order),
  UNIQUE (marker_id, term_group, term_value)
);

CREATE INDEX IF NOT EXISTS idx_tag_inference_marker_terms_marker_id
  ON tag_inference_marker_terms(marker_id);
