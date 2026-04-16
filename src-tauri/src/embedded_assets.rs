// Keep compile-time defaults anchored to the crate manifest instead of the repo root.
// That keeps backend-owned assets bundled with the Tauri crate.
pub(crate) const CAREER_SCHEMA_SQL: &str =
    include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/defaults/career_schema.sql"));
pub(crate) const TAGS_TAXONOMY_JSON: &str =
    include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/defaults/tags_taxonomy.json"));
pub(crate) const EMPTY_TAXONOMY_JSON: &str =
    include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/defaults/empty_taxonomy.json"));
pub(crate) const DEFAULT_BUILD_POLICY_JSON: &str =
    include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/defaults/build_policy.json"));
