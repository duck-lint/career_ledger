# Career Ledger — diagrams

**Status:** The SQL schema exists and storage CLI exist on `revamp`; model inference, selection validation, and resume assembly are **proposed**, not implemented.

## 1. System architecture

```mermaid
architecture-beta
    group app(server)[Career Ledger app]
    service author(server)[User career content]
    service posting(disk)[Job posting]
    service entry(server)[Entry and read] in app
    service db(database)[SQLite library] in app
    service model(cloud)[LLM inference]
    service gate(server)[Selection validator] in app
    service assembly(server)[Resume assembly] in app
    service artifact(disk)[Resume and source map]

    author:R --> L:entry
    entry:R --> L:db
    posting:R --> L:model
    db:B --> T:model
    model:R --> L:gate
    db:R --> L:gate
    gate:B --> T:assembly
    db:B --> T:assembly
    assembly:R --> L:artifact
```

## 2. Resume build — handoffs

```mermaid
swimlane-beta LR
    subgraph user [User]
        job[Supply job posting]
        review[Review resume]
    end
    subgraph app [Application]
        options[Request offered evidence]
        prompt[Compose posting, options and versioned instructions]
        valid{Proposal valid?}
        failure[Return violations]
        fetch[Request selected source content]
        assembly[Assemble approved sections]
    end
    subgraph database [SQLite]
        available[Read evidence IDs, text and parent context]
        chosen[Read selected evidence, parents and approved content]
    end
    subgraph llm [LLM]
        relate[Interpret relational problem space]
        propose[Return evidence IDs and stated relationships]
    end
    subgraph document [Output]
        resume[Resume and source-ID map]
    end

    job --> options --> available --> prompt --> relate --> propose --> valid
    valid -->|Invalid JSON or IDs| failure
    valid -->|Valid| fetch --> chosen --> assembly --> resume --> review
```

**What crosses the model boundary:** `job_description` and `options` (IDs, text, parent context) go in; `matches` (requirement, evidence ID, relationship) and `unmatched_requirements` come out. The problem space is evaluated by the model, **not** serialized or stored as an authoritative object.

## 3. Current SQLite schema

```mermaid
erDiagram
    experience_records ||--o{ evidence_items : owns
    experience_records {
        TEXT id PK
        TEXT kind
        TEXT title
        TEXT organization
        TEXT start_date
        TEXT end_date
    }
    evidence_items {
        TEXT id PK
        TEXT experience_id FK
        TEXT description
    }
    approved_content {
        TEXT id PK
        TEXT section
        TEXT content
    }
```

`approved_content` is independent of experience/evidence. `evidence_items.experience_id` is a foreign key; moving an item changes its parent reference, not its ID or text.
