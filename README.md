# Career Ledger

A local-first desktop application for managing career evidence, auto-tagging skills via inference markers, and generating targeted resumes. No cloud services, no accounts — all data lives in a local SQLite database on your machine.

<!-- TODO: Add screenshot from demo video -->

## What is Career Ledger?

Career Ledger treats your professional history as structured data. You enter experience records (jobs, projects) and evidence items (specific accomplishments, deliverables, skills demonstrated), and the system automatically infers which canonical tags apply to each piece of evidence based on configurable inference markers. Tags are grouped into delivery toolkit categories that map directly to resume sections.

When you need a resume, point the pipeline at a job posting. It analyzes the posting's requirements, filters your evidence library for relevance, assembles a targeted resume, and renders it to `.docx`. Every generation run is tracked as a manifest with SHA-256 hashes for reproducibility.

The taxonomy — canonical tags, inference markers, and delivery categories — is fully user-controlled. You can start from scratch, import a taxonomy JSON, or generate one with an LLM. See [Taxonomy Quickstart](docs/taxonomy-quickstart.md) for a copy-paste prompt that bootstraps a personalized taxonomy in minutes.

## Key Features

- **Experience Records** — Employment and project records with organization, title, dates, and record-level context tags
- **Evidence Items** — Granular claim text with automatic tag inference, optional manual tags, date ranges, and evidence notes
- **Canonical Tag Taxonomy** — Snake_case tag vocabulary with literal and compound inference markers that auto-detect skills from evidence text
- **Delivery Toolkit Categories** — Group tags into resume-ready sections (e.g. "Systems & Platforms", "Technical Skills", "Implementation & Delivery")
- **Job Posting Analysis** — Paste a job posting to extract requirement clusters, matched keywords, and gap analysis against your library
- **Resume Pipeline** — Export → Analyze → Preflight Filter → Assemble → Render `.docx` — end-to-end from library to formatted document
- **Candidate Profile** — Manage contact info, education, certifications, and summary lines used in resume generation
- **Anomaly Detection** — Surfaces data quality issues (orphaned tags, missing fields, duplicate claims) in an operations dashboard
- **Raw Intake Import** — Batch import experience and evidence from YAML/JSON files with deduplication and skip tracking
- **Generation Manifests** — Every pipeline run is logged with input hashes, selected records, gap reports, and artifact paths

## Architecture

```
┌─────────────────────────────────────────┐
│  Tauri v2 Desktop Shell                 │
│  ┌───────────────┐  ┌────────────────┐  │
│  │ React 19 + TS │  │ Rust Backend   │  │
│  │ Vite, Tailwind│◄►│ rusqlite       │  │
│  │ shadcn/ui     │  │ (bundled SQLite)│  │
│  └───────────────┘  └────────────────┘  │
│         Frontend IPC ◄► Tauri Commands  │
└─────────────────────────────────────────┘
         All data stored locally.
         No network calls. No telemetry.
```

**Frontend**: React 19, TypeScript, Vite 7, Tailwind CSS v4 with oklch color tokens, shadcn/ui (Radix primitives), Lucide icons

**Backend**: Rust with rusqlite (bundled SQLite), serde for serialization, docx-rs for document rendering, SHA-256 content hashing

**Desktop Shell**: Tauri v2 with file dialog plugin, 1280×800 default window

## Getting Started

### Prerequisites

- **Node.js** 20+ and npm
- **Rust** 1.77+ (install via [rustup](https://rustup.rs))
- **Platform build tools** — see [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)
  - Windows: Microsoft C++ Build Tools, WebView2
  - macOS: Xcode Command Line Tools
  - Linux: `build-essential`, `libwebkit2gtk-4.1-dev`, `libssl-dev`, etc.

### Install & Run

```bash
git clone https://github.com/duck-lint/career_ledger.git
cd career_ledger
npm install
```

**Development** (hot-reload frontend + Rust backend):
```bash
npm run tauri:dev
```

**Production build** (native installer):
```bash
npm run tauri:build
```

The installer output lands in `src-tauri/target/release/bundle/`.

## First-Time User Workflow

There are multiple valid paths to a working library. The core loop is: **have some tags + have some evidence → press Re-infer Library Tags → everything calculates.**

### Path A: Start with a taxonomy

1. Generate a taxonomy JSON using an LLM — see [Taxonomy Quickstart](docs/taxonomy-quickstart.md)
2. Open Career Ledger → **Taxonomy** tab → **Import Taxonomy** → select your `.json` file
3. Add experience records and evidence items in the **Library** tab
4. Go back to **Taxonomy** → press **Re-infer Library Tags** — all evidence is tagged automatically

### Path B: Build as you go

1. Start with a blank taxonomy (the default on first launch)
2. Add experience records and evidence in the **Library** tab
3. Create canonical tags and categories directly in the **Taxonomy** tab as you identify skills
4. Press **Re-infer Library Tags** whenever you want tags recalculated

### Path C: Import from raw intake

1. Prepare a YAML or JSON file with intake items (experience + evidence entries)
2. **Settings** tab → **Import Raw Intake** → select the file
3. The import pipeline auto-infers tags and creates records/evidence
4. Review in **Library**, refine taxonomy, Re-infer as needed

Once your library is tagged, go to the **Resume** tab to analyze a job posting and generate a targeted resume.

## Project Structure

```
career_ledger/
├── src/                        # React frontend
│   ├── components/
│   │   ├── dialogs/            # Tag, Evidence, Record creation dialogs
│   │   ├── views/              # Main tab views (Library, Taxonomy, Resume, etc.)
│   │   ├── taxonomy/           # Tag inference marker editor
│   │   └── ui/                 # shadcn/ui primitives
│   ├── hooks/                  # React hooks
│   └── lib/                    # Service layer, types, utilities
├── src-tauri/
│   ├── src/                    # Rust backend
│   │   ├── lib.rs              # Tauri command handlers
│   │   ├── taxonomy.rs         # Taxonomy CRUD, import/export, re-inference
│   │   ├── inference.rs        # Tag inference engine (literal + compound matching)
│   │   ├── resume_pipeline.rs  # End-to-end resume generation pipeline
│   │   ├── docx_renderer.rs    # .docx document rendering
│   │   ├── requirement_analysis.rs  # Job posting analysis
│   │   ├── intake.rs           # Raw YAML/JSON intake import
│   │   └── ...
│   └── defaults/               # Bundled assets
│       ├── career_schema.sql   # SQLite schema
│       ├── tags_taxonomy.json  # Starter taxonomy (243 tags)
│       ├── empty_taxonomy.json # Blank taxonomy
│       └── build_policy.json   # Default resume build policy
├── docs/
│   └── taxonomy-quickstart.md  # LLM prompt for generating a personal taxonomy
├── PRD.md                      # Product requirements document
└── package.json
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start Vite dev server (frontend only) |
| `npm run build` | TypeScript check + Vite production build |
| `npm run lint` | ESLint |
| `npm test` | Run Vitest test suite |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:ui` | Vitest with browser UI |
| `npm run tauri:dev` | Full desktop app with hot reload |
| `npm run tauri:build` | Production build with native installer |
| `cd src-tauri && cargo test --lib` | Rust backend tests |

## Testing

**Frontend** (Vitest + React Testing Library):
```bash
npm test
```

**Backend** (Rust unit tests):
```bash
cd src-tauri
cargo test --lib
```

## License

<!-- TODO: Choose and add license -->
