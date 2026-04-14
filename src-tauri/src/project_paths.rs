use std::path::PathBuf;

// Resolve runtime paths from the Tauri crate root so copied projects keep pointing at their own
// assets, database, and output directories instead of some ancestor folder.
pub(crate) fn runtime_repo_root() -> Result<PathBuf, String> {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .canonicalize()
        .map_err(|error| format!("Failed to resolve project root: {error}"))
}
