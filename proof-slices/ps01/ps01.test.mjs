import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SOURCE_AUTHORITY_ADAPTER_ID,
  assembleApprovedSourceFactsProof,
} from './source-authority-adapter.mjs';
import {
  SUPPORTED_EDGE_KINDS,
  SUPPORTED_NODE_KINDS,
  assembleRequirementRegionProof,
  buildSemanticGraph,
  enumerateRequirementPaths,
  enumerateValidRequirementPaths,
  normalizeSourceSlice,
} from './ps01.mjs';

function createProbeFixture() {
  return {
    sourceSlice: {
      experienceRecords: [
        {
          kind: 'Experience',
          id: 'exp-payments',
          label: 'Payments Platform Rewrite',
          tagLinks: [
            { kind: 'uses', tagId: 'tag-backend', weight: 2 },
          ],
        },
        {
          kind: 'Experience',
          id: 'exp-ops',
          label: 'Ops Collaboration',
          tagLinks: [
            { kind: 'uses', tagId: 'tag-mentoring', weight: 1 },
          ],
        },
      ],
      evidenceItems: [
        {
          kind: 'Evidence',
          id: 'evidence-adr',
          label: 'Architecture decision record',
          experienceRecordId: 'exp-payments',
          experienceLink: {
            kind: 'demonstrates',
            experienceRecordId: 'exp-payments',
            weight: 4,
          },
          tagLinks: [
            { kind: 'uses', tagId: 'tag-backend', weight: 5 },
          ],
        },
        {
          kind: 'Evidence',
          id: 'evidence-runbook',
          label: 'Runbook excerpt',
          experienceRecordId: 'exp-payments',
          experienceLink: {
            kind: 'demonstrates',
            experienceRecordId: 'exp-payments',
            weight: 3,
          },
          tagLinks: [
            { kind: 'uses', tagId: 'tag-backend', weight: 4 },
          ],
        },
        {
          kind: 'Evidence',
          id: 'evidence-oncall',
          label: 'On-call notes',
          experienceRecordId: 'exp-ops',
          experienceLink: {
            kind: 'demonstrates',
            experienceRecordId: 'exp-ops',
            weight: 2,
          },
          tagLinks: [
            { kind: 'uses', tagId: 'tag-operations', weight: 1 },
          ],
        },
      ],
      taxonomy: {
        tags: [
          { kind: 'Tag', id: 'tag-backend', label: 'Backend Systems' },
          { kind: 'Tag', id: 'tag-operations', label: 'Operations' },
          { kind: 'Tag', id: 'tag-mentoring', label: 'Mentoring' },
        ],
        tagRequirementLinks: [
          {
            kind: 'supports',
            tagId: 'tag-backend',
            requirementId: 'req-backend-systems',
            weight: 6,
          },
          {
            kind: 'supports',
            tagId: 'tag-operations',
            requirementId: 'req-backend-systems',
            weight: 1,
          },
          {
            kind: 'supports',
            tagId: 'tag-mentoring',
            requirementId: 'req-mentoring',
            weight: 5,
          },
        ],
      },
    },
    targetRegion: {
      id: 'region-platform',
      label: 'Platform Engineering',
      requirements: [
        {
          kind: 'Requirement',
          id: 'req-backend-systems',
          label: 'Backend Systems',
          weight: 10,
        },
        {
          kind: 'Requirement',
          id: 'req-mentoring',
          label: 'Mentoring',
          weight: 4,
        },
      ],
    },
  };
}

function createApprovedSourceAuthorityFixture() {
  return {
    experience_records: [
      {
        id: 'exp-payments',
        label: 'Payments Platform Rewrite',
        tag_links: [
          { tag_id: 'tag-backend', weight: 2 },
        ],
      },
      {
        id: 'exp-ops',
        label: 'Ops Collaboration',
        tag_links: [
          { tag_id: 'tag-mentoring', weight: 1 },
        ],
      },
    ],
    evidence_items: [
      {
        id: 'evidence-adr',
        label: 'Architecture decision record',
        experience_record_id: 'exp-payments',
        experience_link: {
          weight: 4,
        },
        tag_links: [
          { tag_id: 'tag-backend', weight: 5 },
        ],
      },
      {
        id: 'evidence-runbook',
        label: 'Runbook excerpt',
        experience_record_id: 'exp-payments',
        experience_link: {
          weight: 3,
        },
        tag_links: [
          { tag_id: 'tag-backend', weight: 4 },
        ],
      },
      {
        id: 'evidence-oncall',
        label: 'On-call notes',
        experience_record_id: 'exp-ops',
        experience_link: {
          weight: 2,
        },
        tag_links: [
          { tag_id: 'tag-operations', weight: 1 },
        ],
      },
    ],
    taxonomy: {
      tags: [
        { id: 'tag-backend', label: 'Backend Systems' },
        { id: 'tag-operations', label: 'Operations' },
        { id: 'tag-mentoring', label: 'Mentoring' },
      ],
      tag_requirement_links: [
        {
          tag_id: 'tag-backend',
          requirement_id: 'req-backend-systems',
          weight: 6,
        },
        {
          tag_id: 'tag-operations',
          requirement_id: 'req-incident-response',
          weight: 6,
        },
        {
          tag_id: 'tag-mentoring',
          requirement_id: 'req-mentoring',
          weight: 5,
        },
      ],
      requirements: [
        {
          id: 'req-backend-systems',
          label: 'Backend Systems',
          default_weight: 10,
          cue_terms: ['backend systems', 'api design', 'distributed systems'],
        },
        {
          id: 'req-incident-response',
          label: 'Incident Response',
          default_weight: 7,
          cue_terms: ['incident response', 'on-call'],
        },
        {
          id: 'req-mentoring',
          label: 'Mentoring',
          default_weight: 4,
          cue_terms: ['mentoring', 'mentor'],
        },
      ],
      target_regions: [
        {
          id: 'region-operations',
          label: 'Operations Engineering',
          requirement_ids: ['req-incident-response'],
        },
        {
          id: 'region-platform',
          label: 'Platform Engineering',
          requirement_ids: ['req-backend-systems', 'req-mentoring'],
        },
      ],
    },
    profiles: {
      certifications: [],
    },
    settings: {
      locale: 'en-US',
    },
    jobPostingInput: {
      title: 'Staff Platform Engineer',
      text: 'This role emphasizes backend systems ownership, API design, and distributed systems scaling.',
    },
  };
}

function createNonAsciiTieFixture() {
  return {
    sourceSlice: {
      experienceRecords: [
        {
          kind: 'Experience',
          id: 'exp-ä',
          label: 'Ä Platform Work',
          tagLinks: [
            { kind: 'uses', tagId: 'tag-shared', weight: 2 },
          ],
        },
        {
          kind: 'Experience',
          id: 'exp-z',
          label: 'Z Platform Work',
          tagLinks: [
            { kind: 'uses', tagId: 'tag-shared', weight: 2 },
          ],
        },
      ],
      evidenceItems: [
        {
          kind: 'Evidence',
          id: 'evidence-ä',
          label: 'Ä Evidence',
          experienceRecordId: 'exp-ä',
          experienceLink: {
            kind: 'demonstrates',
            experienceRecordId: 'exp-ä',
            weight: 4,
          },
          tagLinks: [
            { kind: 'uses', tagId: 'tag-shared', weight: 5 },
          ],
        },
        {
          kind: 'Evidence',
          id: 'evidence-z',
          label: 'Z Evidence',
          experienceRecordId: 'exp-z',
          experienceLink: {
            kind: 'demonstrates',
            experienceRecordId: 'exp-z',
            weight: 4,
          },
          tagLinks: [
            { kind: 'uses', tagId: 'tag-shared', weight: 5 },
          ],
        },
      ],
      taxonomy: {
        tags: [
          { kind: 'Tag', id: 'tag-shared', label: 'Shared Capability' },
        ],
        tagRequirementLinks: [
          {
            kind: 'supports',
            tagId: 'tag-shared',
            requirementId: 'req-shared',
            weight: 6,
          },
        ],
      },
    },
    targetRegion: {
      id: 'region-shared',
      label: 'Shared Region',
      requirements: [
        {
          kind: 'Requirement',
          id: 'req-shared',
          label: 'Shared Requirement',
          weight: 8,
        },
      ],
    },
  };
}

function createNonAsciiEvidenceOrderFixture() {
  return {
    sourceSlice: {
      experienceRecords: [
        {
          kind: 'Experience',
          id: 'exp-proof',
          label: 'Proof Experience',
          tagLinks: [
            { kind: 'uses', tagId: 'tag-proof', weight: 2 },
          ],
        },
      ],
      evidenceItems: [
        {
          kind: 'Evidence',
          id: 'evidence-ä',
          label: 'Ä Evidence',
          experienceRecordId: 'exp-proof',
          experienceLink: {
            kind: 'demonstrates',
            experienceRecordId: 'exp-proof',
            weight: 3,
          },
          tagLinks: [
            { kind: 'uses', tagId: 'tag-proof', weight: 4 },
          ],
        },
        {
          kind: 'Evidence',
          id: 'evidence-z',
          label: 'Z Evidence',
          experienceRecordId: 'exp-proof',
          experienceLink: {
            kind: 'demonstrates',
            experienceRecordId: 'exp-proof',
            weight: 4,
          },
          tagLinks: [
            { kind: 'uses', tagId: 'tag-proof', weight: 5 },
          ],
        },
      ],
      taxonomy: {
        tags: [
          { kind: 'Tag', id: 'tag-proof', label: 'Proof Capability' },
        ],
        tagRequirementLinks: [
          {
            kind: 'supports',
            tagId: 'tag-proof',
            requirementId: 'req-proof',
            weight: 6,
          },
        ],
      },
    },
    targetRegion: {
      id: 'region-proof',
      label: 'Proof Region',
      requirements: [
        {
          kind: 'Requirement',
          id: 'req-proof',
          label: 'Proof Requirement',
          weight: 5,
        },
      ],
    },
  };
}

test('slice contracts allow only the PS-01 node and edge kinds', () => {
  assert.deepEqual(SUPPORTED_NODE_KINDS, ['Experience', 'Evidence', 'Tag', 'Requirement']);
  assert.deepEqual(SUPPORTED_EDGE_KINDS, ['demonstrates', 'uses', 'supports']);

  const fixture = createProbeFixture();
  fixture.sourceSlice.experienceRecords[0].kind = 'Project';

  assert.throws(
    () => buildSemanticGraph(fixture),
    /must be one of Experience, Evidence, Tag, Requirement/,
  );
});

test('path ranking is deterministic across repeat runs', () => {
  const fixture = createProbeFixture();

  const first = assembleRequirementRegionProof(fixture);
  const second = assembleRequirementRegionProof(fixture);

  assert.deepEqual(first, second);

  const backendResult = first.results.find(
    (result) => result.requirementId === 'req-backend-systems',
  );
  assert.equal(backendResult.status, 'supported');
  assert.equal(backendResult.selectedPath.score.evidenceSupportCount, 2);
  assert.equal(backendResult.selectedPath.score.explicitRelationWeightSum, 15);
});

test('paths lacking evidence support are rejected', () => {
  const fixture = createProbeFixture();

  const graph = buildSemanticGraph(fixture);
  const candidatePaths = enumerateRequirementPaths(graph, 'req-mentoring');
  const validPaths = enumerateValidRequirementPaths(graph, 'req-mentoring');

  assert.equal(candidatePaths.length, 1);
  assert.equal(validPaths.length, 0);
});

test('non-ASCII identifiers still use code-unit stable ordering', () => {
  const tieFixture = createNonAsciiTieFixture();
  const normalized = normalizeSourceSlice(tieFixture.sourceSlice);
  const graph = buildSemanticGraph(tieFixture);
  const rankedPaths = enumerateValidRequirementPaths(graph, 'req-shared');
  const evidenceOrderProof = assembleRequirementRegionProof(createNonAsciiEvidenceOrderFixture());

  assert.deepEqual(
    normalized.experienceRecords.map((record) => record.id),
    ['exp-z', 'exp-ä'],
  );
  assert.equal(rankedPaths[0].supportingExperienceRecordIds[0], 'exp-z');
  assert.deepEqual(
    evidenceOrderProof.results[0].supportingEvidenceItemIds,
    ['evidence-z', 'evidence-ä'],
  );
});

test('PS-01 Probe: Backend Systems Path Reconstruction', () => {
  const fixture = createProbeFixture();
  const proof = assembleRequirementRegionProof(fixture);

  const backendResult = proof.results.find(
    (result) => result.requirementId === 'req-backend-systems',
  );
  const mentoringResult = proof.results.find(
    (result) => result.requirementId === 'req-mentoring',
  );

  assert.equal(proof.sliceId, 'PS-01');
  assert.equal(backendResult.status, 'supported');
  assert.deepEqual(backendResult.supportingExperienceRecordIds, ['exp-payments']);
  assert.deepEqual(backendResult.supportingEvidenceItemIds, ['evidence-adr', 'evidence-runbook']);
  assert.deepEqual(
    backendResult.selectedPath.orderedSequence.map((entry) => entry.type === 'node'
      ? `${entry.nodeKind}:${entry.sourceId}`
      : `${entry.edgeKind}:${entry.weight}`),
    [
      'Experience:exp-payments',
      'demonstrates:4',
      'Evidence:evidence-adr',
      'uses:5',
      'Tag:tag-backend',
      'supports:6',
      'Requirement:req-backend-systems',
    ],
  );
  assert.deepEqual(
    backendResult.selectedPath.semanticPositions.map((position) => position.semanticPosition),
    ['source-experience', 'source-evidence', 'semantic-tag', 'target-requirement'],
  );

  assert.equal(mentoringResult.status, 'unsupported');
  assert.equal(mentoringResult.selectedPath, null);
});

test('I03 Probe: Approved Source Facts To Ranked Requirement Output', () => {
  const fixture = createApprovedSourceAuthorityFixture();
  const result = assembleApprovedSourceFactsProof(fixture);

  const backendResult = result.proof.results.find(
    (entry) => entry.requirementId === 'req-backend-systems',
  );
  const mentoringResult = result.proof.results.find(
    (entry) => entry.requirementId === 'req-mentoring',
  );

  assert.equal(result.adapterMetadata.adapterId, SOURCE_AUTHORITY_ADAPTER_ID);
  assert.deepEqual(result.adapterMetadata.unusedSourceAuthorities, ['profiles', 'settings']);
  assert.equal(result.adapterMetadata.targetRegionSelection.id, 'region-platform');
  assert.deepEqual(result.adapterMetadata.targetRegionSelection.rankedRegionIds, ['region-platform', 'region-operations']);
  assert.equal(result.adapterMetadata.targetRegionSelection.selectionScore.totalCueMatchCount, 3);
  assert.deepEqual(
    result.proof.targetRegion.requirements,
    [
      { id: 'req-backend-systems', label: 'Backend Systems', weight: 13 },
      { id: 'req-mentoring', label: 'Mentoring', weight: 4 },
    ],
  );

  assert.equal(result.proof.sliceId, 'PS-01');
  assert.equal(backendResult.status, 'supported');
  assert.deepEqual(backendResult.supportingExperienceRecordIds, ['exp-payments']);
  assert.deepEqual(backendResult.supportingEvidenceItemIds, ['evidence-adr', 'evidence-runbook']);
  assert.deepEqual(
    backendResult.selectedPath.orderedSequence.map((entry) => entry.type === 'node'
      ? `${entry.nodeKind}:${entry.sourceId}`
      : `${entry.edgeKind}:${entry.weight}`),
    [
      'Experience:exp-payments',
      'demonstrates:4',
      'Evidence:evidence-adr',
      'uses:5',
      'Tag:tag-backend',
      'supports:6',
      'Requirement:req-backend-systems',
    ],
  );
  assert.deepEqual(
    backendResult.selectedPath.semanticPositions.map((position) => position.semanticPosition),
    ['source-experience', 'source-evidence', 'semantic-tag', 'target-requirement'],
  );

  assert.equal(mentoringResult.status, 'unsupported');
  assert.equal(mentoringResult.selectedPath, null);
});

test('adapter seam is deterministic across repeat runs', () => {
  const fixture = createApprovedSourceAuthorityFixture();

  const first = assembleApprovedSourceFactsProof(fixture);
  const second = assembleApprovedSourceFactsProof(fixture);

  assert.deepEqual(first, second);
});