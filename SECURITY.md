# Security Policy

## Scope

Career Ledger is a local-first desktop application. It makes **no network connections** — all data is stored in a local SQLite database and all processing happens on your machine. There is no server, no telemetry, no cloud sync.

That said, the application does parse user-supplied files (taxonomy JSON, intake YAML/JSON, job posting text) and renders data to `.docx` documents, so local attack surface exists.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Reporting a Vulnerability

If you find a security issue — even in a local-only context — please report it responsibly:

1. **Do not open a public issue.** Security bugs should not be disclosed publicly until a fix is available.
2. **Email**: Send a description to the repository owner via the contact information on their GitHub profile.
3. **Include**: Steps to reproduce, affected version, and potential impact.

You should expect an initial response within 7 days. If the issue is confirmed, a fix will be prioritized and released as a patch version.

## Threat Model

Because Career Ledger is offline-only, the primary risks are:

- **Malicious file import** — Crafted taxonomy JSON, intake YAML, or job posting text that exploits parsing logic
- **Path traversal** — File save/export operations writing outside expected directories
- **SQL injection** — User-supplied text reaching SQLite queries without parameterization (all queries currently use parameterized statements via rusqlite)
- **Denial of service** — Extremely large input files causing memory exhaustion

Out of scope:
- Network-based attacks (there are no network calls)
- Authentication/authorization bypasses (there is no auth — it's a single-user desktop app)
- Browser-based XSS (the app runs in a Tauri webview, not a browser)
