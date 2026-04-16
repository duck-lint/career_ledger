# Taxonomy Quickstart — Generate a Personal Taxonomy with an LLM

Career Ledger uses a **taxonomy** to auto-tag your evidence items. A taxonomy defines:

- **Canonical tags** — the skill/competency vocabulary (e.g. `project_management`, `python`, `stakeholder_engagement`)
- **Delivery toolkit categories** — groups that organize tags into resume sections
- **Inference markers** — phrases the engine searches for in your evidence text to detect each tag
- **Display metadata** — human-friendly labels and category assignments for each tag

You can build a taxonomy manually in the app, but it is much faster to generate one tailored to your career using an LLM and then import it.

---

## Step 1: Copy the Prompt Below into an LLM

Replace the two placeholders:

| Placeholder | What to Put |
|---|---|
| `{{JOB_TITLE}}` | Your current or target job title (e.g. "Senior DevOps Engineer", "Product Manager", "Full-Stack Developer") |
| `{{CAREER_SEED}}` | A brief description of your career focus, 2–4 sentences. Mention domains, tools, industries, or specializations that matter to you. |

---

### The Prompt

```text
I need a JSON taxonomy file for a career evidence management tool called Career Ledger.
The taxonomy should be tailored for someone with this profile:

Job Title: {{JOB_TITLE}}

Career Focus:
{{CAREER_SEED}}

Generate a taxonomy JSON that follows this EXACT schema. Do not add extra fields.
Do not wrap the output in markdown code fences. Output only raw JSON.

=== SCHEMA ===

The JSON object must have these five top-level keys:

1. "version" — A string. Use "1.0".

2. "canonical_tags" — An array of strings. Each tag is lower_snake_case
   (letters, digits, underscores only). These are the skill/competency labels.
   Aim for 40–80 tags covering the career profile above.

3. "delivery_toolkit_categories" — An array of objects, each with:
   - "name": string (the category name, e.g. "Technical Skills")
   - "sort_order": integer (unique, starting from 0, determines display order)
   Use 4–8 categories that would make sense as resume section headings.

4. "tag_inference_markers" — An object where each key is a canonical tag
   and each value is an array of markers. Markers are how the engine detects
   the tag in evidence text. There are two marker types:

   a) Literal string — An exact phrase to match (case-insensitive,
      word-boundary-aware). Example: "kubernetes" or "project management"

   b) Compound object — For disambiguation when a literal alone would
      cause false positives. Has two arrays:
      - "all_of": terms that ALL must appear in the text (AND logic)
      - "any_of": terms where AT LEAST ONE must appear (OR logic)
      Example: { "all_of": ["pipeline"], "any_of": ["ci", "cd", "jenkins", "github actions"] }
      This matches text containing "pipeline" AND at least one of the CI/CD tools.

   Rules for markers:
   - Every tag should have at least 3–5 literal markers covering common
     ways people describe that skill (synonyms, abbreviations, tool names)
   - Add compound markers when a term is ambiguous (e.g. "pipeline" alone
     could mean data pipeline or CI/CD pipeline — use compound to disambiguate)
   - Marker text is matched case-insensitively against concatenated evidence
     fields (claim + notes + organization + title + source area)
   - Use lowercase for all marker strings
   - Include common abbreviations and alternate spellings

5. "delivery_toolkit_metadata" — An object where each key is a canonical tag
   and each value is an object with:
   - "category": string (must match a name in delivery_toolkit_categories)
   - "display_label": string (human-readable label, e.g. "Project Management")

   EVERY canonical tag must have an entry here. No exceptions.

=== VALIDATION RULES ===

- Every key in tag_inference_markers must be a tag in canonical_tags
- Every key in delivery_toolkit_metadata must be a tag in canonical_tags
- Every tag in canonical_tags must have a corresponding entry in delivery_toolkit_metadata
- Category names in delivery_toolkit_metadata must reference categories defined in delivery_toolkit_categories
- All sort_order values must be unique non-negative integers
- Category names must be unique
- Tag names must be unique lower_snake_case strings

=== EXAMPLE (3 tags only — yours should have 40–80) ===

{
  "version": "1.0",
  "canonical_tags": [
    "project_management",
    "python",
    "stakeholder_engagement"
  ],
  "delivery_toolkit_categories": [
    { "name": "Leadership & Delivery", "sort_order": 0 },
    { "name": "Technical Skills", "sort_order": 1 },
    { "name": "Communication", "sort_order": 2 }
  ],
  "tag_inference_markers": {
    "project_management": [
      "project management",
      "project-management",
      "managed project",
      "led project",
      "project plan",
      "project lifecycle",
      "pmp",
      "pmi",
      { "all_of": ["managed"], "any_of": ["delivery", "timeline", "milestone", "sprint"] }
    ],
    "python": [
      "python",
      "django",
      "flask",
      "fastapi",
      "pandas",
      "numpy",
      "pytest",
      ".py",
      { "all_of": ["scripting"], "any_of": ["python", "automation"] }
    ],
    "stakeholder_engagement": [
      "stakeholder engagement",
      "stakeholder management",
      "executive briefing",
      "client relationship",
      "cross-functional collaboration",
      { "all_of": ["stakeholder"], "any_of": ["engagement", "alignment", "communication", "buy-in"] }
    ]
  },
  "delivery_toolkit_metadata": {
    "project_management": { "category": "Leadership & Delivery", "display_label": "Project Management" },
    "python": { "category": "Technical Skills", "display_label": "Python" },
    "stakeholder_engagement": { "category": "Communication", "display_label": "Stakeholder Engagement" }
  }
}

Now generate the full taxonomy for the job title and career focus above.
Output ONLY the raw JSON object. No commentary, no markdown fences.
```

---

## Step 2: Import into Career Ledger

1. Copy the LLM's JSON output into a text file and save it as something like `my_taxonomy.json`
2. Open Career Ledger → **Taxonomy** tab
3. Click **Import Taxonomy** → select your `.json` file
4. The import replaces any existing taxonomy (tags, markers, categories, metadata)
5. Review the imported tags and categories in the taxonomy table

> **If the import fails**, check the error message — the most common issues are:
> - A tag in `tag_inference_markers` or `delivery_toolkit_metadata` that isn't listed in `canonical_tags`
> - A `delivery_toolkit_metadata` entry referencing a category name that doesn't exist in `delivery_toolkit_categories`
> - A tag in `canonical_tags` missing from `delivery_toolkit_metadata`
> - Duplicate tag names or duplicate `sort_order` values

## Step 3: Tag Your Evidence

With the taxonomy imported, your evidence items can now be auto-tagged:

1. Go to the **Library** tab and add experience records and evidence items
2. Go to the **Taxonomy** tab → click **Re-infer Library Tags**
3. The inference engine scans every evidence item's text against all markers and assigns matching tags

**How inference works**: For each evidence item, the engine concatenates the claim, evidence note, source area, organization, title, and record type into one searchable block of text (lowercased). It then checks every inference marker:
- **Literal markers**: exact phrase match with word-boundary awareness (so "py" won't match "python")
- **Compound markers**: ALL terms in `all_of` must appear AND at least one term in `any_of` must appear

If any marker for a tag matches, that tag is inferred for the evidence item.

## Tips for Better Taxonomies

- **Be specific with markers.** "managed" is too broad — use compound markers to constrain it: `{ "all_of": ["managed"], "any_of": ["project", "team", "budget"] }`
- **Include tool names and abbreviations.** If you use Terraform, add markers for `terraform`, `tf`, `hcl`, `.tf`
- **Think about how you write your evidence.** The markers need to match the actual phrases you use when describing your work
- **Iterate after first Re-infer.** After importing and running inference, check which tags are over- or under-assigned, then edit markers in the Taxonomy tab to tune accuracy
- **Categories map to resume sections.** Name them the way you'd want section headings on a resume
