# Planning Guide

A desktop-oriented CRUD prototype for Career Ledger that manages career experience records, evidence items, normalized taxonomy data, and a bounded Settings-based raw intake importer. The browser build still uses a local fallback store, but the intended runtime is the Tauri desktop shell with SQLite-backed taxonomy and validation.

**Experience Qualities**:
1. **Structured** - Clear information hierarchy with distinct boundaries between records, evidence, and taxonomy management
2. **Precise** - Validation-forward interactions that enforce domain constraints and provide immediate feedback on tag normalization, inference, and claim ceiling structure
3. **Transparent** - Honest presentation of prototype limitations with visible demo-data indicators and explicit confirmation when manual and inferred evidence values diverge

**Complexity Level**: Light Application (multiple features with basic state)
This prototype focuses on CRUD operations across three interconnected entities (records, evidence, taxonomy) with search, filtering, inference preview, validation, and a direct raw-intake import path for Tauri. It intentionally excludes workspace pipeline orchestration, formalized-intake approval boards, and export features planned for the full application.

## Essential Features

**Experience Records Management**
- Functionality: Create, read, update, and delete employment and project records with slug-based identity
- Purpose: Maintain the core career timeline with proper temporal and organizational context
- Trigger: User navigates to Records view or clicks create/edit actions
- Progression: Browse records list → Select record → View evidence → Create/Edit via dialog → Validate → Save → Update list
- Success criteria: Records persist in mock state, slugs remain unique, project records suppress location/employment_type fields, selected record drives evidence view

**Evidence Items Management**
- Functionality: Create, read, update, and delete evidence items belonging to selected parent record with claim text, optional manual tags, optional date range, evidence note, structured claim ceiling, and live inference preview
- Purpose: Capture granular proof points with proper scoping and constraint metadata
- Trigger: User selects parent record and navigates to Evidence view
- Progression: Select parent record → Browse evidence → Search/filter by claim/tags/note → Create/Edit via dialog → Preview inferred tags/claim ceiling → Confirm manual vs inferred values when needed → Save → Update filtered list
- Success criteria: Evidence belongs to exactly one parent, save-time values resolve to canonical tags, claim ceiling preserves structured format, inference differences are explicit, search/filter operates across claim text and tags

**Tag Taxonomy Management**
- Functionality: Browse, create, edit, and delete canonical tags, edit per-tag inference markers, and maintain global claim ceiling rules
- Purpose: Maintain a controlled canonical vocabulary that prevents tag drift
- Trigger: User navigates to Taxonomy view
- Progression: Browse tags → Add/edit canonical tags → Adjust marker sets per tag → Maintain global safe-verb/domain-signal rules → Save → Use updated rules immediately in evidence preview
- Success criteria: Tags stored as lowercase snake_case, every tag retains at least one marker, claim ceiling rules stay structured, taxonomy changes flow directly into evidence inference

**Record Context Tags**
- Functionality: Assign taxonomy-validated tags directly to experience records
- Purpose: Provide high-level thematic categorization distinct from evidence-level tags
- Trigger: User edits record and manages context tags field
- Progression: Edit record → Add context tags → Validate against taxonomy → Save
- Success criteria: Context tags stored separately from evidence tags, same normalization rules apply, displayed distinctly in record view

**Search and Filtering**
- Functionality: Filter evidence by claim text substring, tags, and evidence_note with incremental search
- Purpose: Enable rapid location of specific evidence items within large collections
- Trigger: User types in search field or selects tag filter in Evidence view
- Progression: Type search term → Results filter incrementally → Clear to reset
- Success criteria: Search operates across claim, tags array, and evidence_note fields, filters combine with AND logic, empty results show appropriate message

**Raw Intake Import**
- Functionality: Import raw `intake_items` YAML/JSON from Settings, infer tags in the Rust backend, and write directly to SQLite
- Purpose: Provide a bounded migration/operator path without turning the desktop app into a review-board workflow
- Trigger: User opens Settings, browses to a raw intake file, and starts import
- Progression: Select file → Validate `intake_items` payload → Classify targeted vs grouped items → Infer tags → Insert records/evidence or skip unsafe items → Return counts, duplicates, and skip reasons
- Success criteria: No auto-attach without explicit `target_record_ref`, previously imported intake IDs and in-file repeats are blocked, skipped items remain retryable after the underlying issue is fixed, duplicate claims are skipped and mirrored into anomalies, and same-experience untargeted items merge into one new record within a single import run

## Edge Case Handling

- **Slug collisions**: Reject duplicate slugs during create/edit with inline validation error
- **Orphaned evidence**: Prevent record deletion when evidence items exist; require explicit cascade confirmation
- **Whitespace-only input**: Trim and reject blank required text fields with validation feedback
- **Unknown tags**: Surface unknown manual tags during evidence editing while still allowing inferred-tag fallback when inference resolves a valid canonical set
- **Malformed claim ceiling**: Preserve structured claim ceiling as three list-of-strings fields; reject arbitrary JSON
- **Empty taxonomy**: Seed initial taxonomy; allow deletion but warn when last canonical tag removed
- **Unselected parent record**: Disable evidence creation when no parent record selected; show selection prompt
- **Duplicate raw intake IDs**: Skip reimports by raw intake item id and report them back to the user
- **Ambiguous raw intake items**: Skip vague or underspecified untargeted items instead of inventing record attachment or content

## Design Direction

The design should feel like a professional desktop application for structured data management—think database admin tool or developer IDE, not consumer SaaS. Visual language should emphasize clarity, precision, and information density appropriate for power users managing technical career artifacts. The prototype status must be immediately obvious without being intrusive.

## Color Selection

A technical, document-focused palette with strong contrast and clear semantic color coding.

- **Primary Color**: Deep indigo `oklch(0.35 0.12 265)` communicates structure and precision
- **Secondary Colors**: Neutral grays `oklch(0.65 0.02 265)` for chrome, soft slate `oklch(0.45 0.05 250)` for secondary actions
- **Accent Color**: Bright cyan `oklch(0.70 0.15 195)` for selected states, active records, and interactive highlights
- **Foreground/Background Pairings**:
  - Background (Off-white `oklch(0.98 0.01 265)`): Dark text `oklch(0.20 0.02 265)` - Ratio 13.2:1 ✓
  - Primary (Deep indigo `oklch(0.35 0.12 265)`): White text `oklch(1 0 0)` - Ratio 8.1:1 ✓
  - Accent (Bright cyan `oklch(0.70 0.15 195)`): Dark text `oklch(0.20 0.02 265)` - Ratio 7.3:1 ✓
  - Muted (Light gray `oklch(0.92 0.01 265)`): Muted text `oklch(0.50 0.02 265)` - Ratio 6.8:1 ✓

## Font Selection

Professional typography that emphasizes structure and readability for technical content and data-dense interfaces. Use the currently bundled theme stack instead of promising external font assets the app does not ship.

- **Typographic Hierarchy**:
  - H1 (View Title): Theme heading style / 24px / tight letter spacing
  - H2 (Section Header): Theme heading style / 18px / normal letter spacing
  - H3 (Record Title): Theme emphasis style / 16px / tight letter spacing
  - Body (Form Labels, List Items): Theme sans style / 14px / normal letter spacing
  - Small (Metadata, Dates): Theme sans style / 12px / normal letter spacing
  - Mono (Slugs, Tags, IDs): Theme monospace treatment / 13px / normal letter spacing

## Animations

Animations should reinforce structure and state transitions without adding unnecessary decoration. Use for: dialog open/close with subtle scale and fade, selected record highlight with smooth color transition, tag normalization feedback with brief highlight pulse, validation error shake on input fields. Duration: 150-250ms with ease-out curves. No page transitions or loading spinners—mock backend is instant.

## Component Selection

- **Components**:
  - Dialogs (Create/Edit): Shadcn Dialog for modal record and evidence editing
  - Cards: Shadcn Card for record list items and evidence items
  - Forms: Direct dialog and view state with inline validation instead of a separate form-library layer
  - Tables: Shadcn Table for taxonomy view
  - Inputs: Shadcn Input with inline validation states
  - Badges: Shadcn Badge for tags with monospace text override
  - Buttons: Shadcn Button with variant="default" for primary, variant="outline" for secondary
  - Alerts: Shadcn Alert for prototype status banner
  - Tabs: Shadcn Tabs for main navigation between views
  - Select: Shadcn Select for record_type and employment_type dropdowns
  - Textarea: Shadcn Textarea for multi-line claim and notes

- **Customizations**:
  - Badge component modified with monospace font for tags and slugs
  - Card component with distinct selected state using accent border and background tint
  - Alert component styled as persistent status banner with muted background
  - Form inputs with immediate validation feedback and normalization preview

- **States**:
  - Buttons: Default with shadow, hover with brightness increase, active with scale down, disabled with opacity reduction
  - Inputs: Default with border, focus with accent ring, error with destructive border and shake animation, success with subtle accent tint
  - Cards: Default with subtle border, hover with border color shift, selected with accent border and background highlight
  - Badges: Default with muted background, canonical tags with primary tint

- **Icon Selection**:
  - Briefcase: Employment records
  - FolderOpen: Project records
  - FileText: Evidence items
  - Tag: Taxonomy/tags
  - Plus: Create actions
  - Pencil: Edit actions
  - Trash: Delete actions
  - MagnifyingGlass: Search
  - Funnel: Filter
  - Warning: Validation errors
  - CheckCircle: Validation success
  - Gear: Settings

- **Spacing**:
  - Section gaps: 6 (24px)
  - Card internal padding: 4 (16px)
  - Form field gaps: 4 (16px)
  - List item gaps: 2 (8px)
  - Badge gaps: 1 (4px)
  - Button padding: px-4 py-2

- **Mobile**:
  - Not applicable—this is explicitly desktop-first prototype
  - Minimum supported width: 1280px
  - Show warning message below minimum width
