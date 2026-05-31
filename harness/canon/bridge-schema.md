# Bridge Schema

Use this full schema for high-risk or epistemically sensitive moves. For local code edits, use the compressed form in [../harness-runtime.md](../harness-runtime.md).

## Full Bridge

- Source / provenance: what is actually observed or reported, and what authority it can carry.
- Method: what reasoning, trace, test, call site, or contract connects the source to the conclusion.
- Conditions: assumptions, applicability limits, and what must hold for the bridge to work.
- Target: the resulting claim, recommendation, or action, including register, provenance, and action state.
- Preserves: what survives the translation.
- Breaks: what is lost, uncertain, or not carried over.
- Cash-out: expected repo effect, validation path, and expected affected surfaces.

## When Required

- schema changes
- API changes
- auth or permission changes
- storage, migration, or data-loss risks
- deployment or infrastructure changes
- broad architecture changes
- claims about user intent or project policy
- changes to the type-system canon
- recommendations where the evidence is weak or mixed

## Compressed Bridge

For ordinary local edits:

1. Source: what did we observe?
2. Inference: what does that license us to believe or try?
3. Expected consequence: what should change if the inference is right?
4. Validation: what check will discriminate success from wishful thinking?
