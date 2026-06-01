import { invoke as tauriInvoke } from '@tauri-apps/api/core';

import { assembleApprovedSourceFactsProof } from '@ps01/source-authority-adapter.mjs';

const probeMode = new URLSearchParams(window.location.search).get('probe');

const I08_PROBE_RUNS = [
  {
    title: 'Staff Platform Engineer',
    text: 'This role emphasizes backend systems ownership, API design, and distributed systems scaling.',
  },
  {
    title: 'Principal Platform Engineer',
    text: 'This role emphasizes backend systems ownership, API design, distributed systems scaling, mentoring, and mentor programs for senior engineers.',
  },
];

const I09_PROBE_RUN = {
  title: 'Principal Platform Engineer',
  text: 'This role emphasizes backend systems ownership, API design, distributed systems scaling, mentoring, and mentor programs for senior engineers.',
};

const commandMetrics = {
  loadSourceAuthorityCalls: 0,
};

const elements = {
  runtimeInputForm: document.querySelector('#runtime-input-form'),
  titleInput: document.querySelector('#job-posting-title-input'),
  textInput: document.querySelector('#job-posting-text-input'),
  analyzeButton: document.querySelector('#analyze-button'),
  statusMessage: document.querySelector('#status-message'),
  metadata: document.querySelector('#analysis-metadata'),
  resultsRoot: document.querySelector('#results-root'),
  explorerRoot: document.querySelector('#source-authority-explorer-root'),
};

let analysisRunning = false;

elements.runtimeInputForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void runAnalysisForCurrentInput();
});

renderIdleState();

if (probeMode === 'i08') {
  queueMicrotask(() => {
    void runI08ProbeSession();
  });
}

if (probeMode === 'i09') {
  queueMicrotask(() => {
    void runI09ProbeSession();
  });
}

async function invokeDesktopCommand(command, payload) {
  if (command === 'load_source_authority') {
    commandMetrics.loadSourceAuthorityCalls += 1;
  }

  return tauriInvoke(command, payload);
}

async function runAnalysisForCurrentInput() {
  await runAnalysis(collectRuntimeInput());
}

async function runAnalysis(runtimeInput) {
  if (analysisRunning) {
    return null;
  }

  analysisRunning = true;
  elements.analyzeButton.disabled = true;
  elements.statusMessage.textContent = 'Running the local SQLite source authority through assembleApprovedSourceFactsProof for this runtime input…';

  try {
    const sourceAuthority = await invokeDesktopCommand('load_source_authority', { jobPostingInput: runtimeInput });
    const result = assembleApprovedSourceFactsProof(sourceAuthority);

    renderSuccessState(result, sourceAuthority);
    return {
      runtimeError: null,
      result,
      sourceAuthority,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    renderErrorState(message);
    return {
      runtimeError: message,
      result: null,
      sourceAuthority: null,
    };
  } finally {
    analysisRunning = false;
    elements.analyzeButton.disabled = false;
  }
}

async function runI08ProbeSession() {
  const firstRun = await runProbePass(I08_PROBE_RUNS[0]);
  const secondRun = await runProbePass(I08_PROBE_RUNS[1]);

  await invokeDesktopCommand('report_i08_probe', {
    summary: {
      firstRun,
      secondRun,
      differingVisibleAnalysisFields: collectDifferingVisibleAnalysis(firstRun, secondRun),
    },
  });
}

async function runI09ProbeSession() {
  applyRuntimeInput(I09_PROBE_RUN);
  const outcome = await runAnalysis(collectRuntimeInput());
  const summary = await captureProbeRunSummary(outcome);

  await invokeDesktopCommand('report_i09_probe', { summary });
}

async function runProbePass(runtimeInput) {
  applyRuntimeInput(runtimeInput);
  const outcome = await runAnalysis(collectRuntimeInput());
  return captureProbeRunSummary(outcome);
}

function renderIdleState() {
  updateMetadata([
    { key: 'adapter', label: 'Adapter', value: 'Waiting for analysis' },
    { key: 'target-region', label: 'Target region', value: 'Waiting for analysis' },
    { key: 'selected-region-score', label: 'Selected region score', value: 'Waiting for analysis' },
    { key: 'requirement-weights', label: 'Requirement weights', value: 'Waiting for analysis' },
    { key: 'matched-cue-terms', label: 'Matched cue terms', value: 'Waiting for analysis' },
    { key: 'unused-source-authorities', label: 'Unused source authorities', value: 'Waiting for analysis' },
  ]);

  elements.resultsRoot.replaceChildren(createEmptyState(
    'No analysis yet',
    'Enter runtime job-posting input above to run the local desktop caller against the SQLite source authority.',
  ));
  renderExplorerEmptyState(
    'No source-authority payload yet',
    'Run an analysis to inspect the live source-authority slices that fed that result.',
  );
}

function renderSuccessState(result, sourceAuthority) {
  const supportedResult = result.proof.results.find(
    (entry) => entry.requirementId === 'req-backend-systems',
  );
  const unsupportedResult = result.proof.results.find(
    (entry) => entry.requirementId === 'req-mentoring',
  );
  const targetRegionSelection = result.adapterMetadata.targetRegionSelection;

  updateMetadata([
    {
      key: 'adapter',
      label: 'Adapter',
      value: `${result.adapterMetadata.adapterId} · ${result.proof.sliceId}`,
    },
    {
      key: 'target-region',
      label: 'Target region',
      value: `${targetRegionSelection.label} (${targetRegionSelection.id})`,
    },
    {
      key: 'selected-region-score',
      label: 'Selected region score',
      value: formatSelectionScore(targetRegionSelection.selectionScore),
    },
    {
      key: 'requirement-weights',
      label: 'Requirement weights',
      value: formatRequirementWeights(targetRegionSelection.requirementWeights),
    },
    {
      key: 'matched-cue-terms',
      label: 'Matched cue terms',
      value: formatCueMatches(result.adapterMetadata.jobPostingAnalysis.requirementCueScores),
    },
    {
      key: 'unused-source-authorities',
      label: 'Unused source authorities',
      value: result.adapterMetadata.unusedSourceAuthorities.join(', '),
    },
  ]);

  elements.statusMessage.textContent = 'Rendered one supported and one unsupported requirement plus a read-only explorer for the current SQLite-backed source authority.';
  elements.resultsRoot.replaceChildren(
    createResultCard(supportedResult),
    createResultCard(unsupportedResult),
  );
  renderExplorerState(sourceAuthority);
}

function renderErrorState(message) {
  updateMetadata([
    { key: 'adapter', label: 'Adapter', value: 'Analysis failed' },
    { key: 'target-region', label: 'Target region', value: 'Unavailable' },
    { key: 'selected-region-score', label: 'Selected region score', value: 'Unavailable' },
    { key: 'requirement-weights', label: 'Requirement weights', value: 'Unavailable' },
    { key: 'matched-cue-terms', label: 'Matched cue terms', value: 'Unavailable' },
    { key: 'unused-source-authorities', label: 'Unused source authorities', value: 'Unavailable' },
  ]);

  elements.statusMessage.textContent = 'The local analysis failed.';
  elements.resultsRoot.replaceChildren(createEmptyState('Analysis failed', message));
  renderExplorerEmptyState(
    'Source-authority explorer unavailable',
    'The explorer only renders after a successful analysis run.',
  );
}

function updateMetadata(entries) {
  const blocks = entries.map(({ key, label, value }) => {
    const wrapper = document.createElement('div');
    const title = document.createElement('dt');
    const detail = document.createElement('dd');

    wrapper.dataset.metadataKey = key;
    title.textContent = label;
    detail.textContent = value;
    detail.dataset.metadataValue = key;

    wrapper.append(title, detail);
    return wrapper;
  });

  elements.metadata.replaceChildren(...blocks);
}

function createEmptyState(title, description) {
  const card = document.createElement('article');
  const heading = document.createElement('h3');
  const body = document.createElement('p');

  card.className = 'empty-state';
  heading.textContent = title;
  body.textContent = description;

  card.append(heading, body);
  return card;
}

function createResultCard(result) {
  const card = document.createElement('article');
  card.className = 'result-card';
  card.dataset.resultId = result.requirementId;

  const header = document.createElement('div');
  header.className = 'result-card__header';

  const title = document.createElement('h3');
  title.textContent = result.requirementLabel;

  const statusPill = document.createElement('span');
  statusPill.className = `status-pill status-pill--${result.status}`;
  statusPill.dataset.statusValue = result.status;
  statusPill.textContent = result.status;

  header.append(title, statusPill);
  card.append(header);

  const layout = document.createElement('div');
  layout.className = 'result-layout';

  layout.append(
    createListSection(
      'Supporting experience',
      result.supportingExperienceRecordIds,
      'No supporting experience ids.',
      'data-supporting-experience-id',
    ),
    createListSection(
      'Supporting evidence',
      result.supportingEvidenceItemIds,
      'No supporting evidence ids.',
      'data-supporting-evidence-id',
    ),
  );

  if (result.selectedPath) {
    layout.append(
      createListSection(
        'Path sequence',
        result.selectedPath.orderedSequence.map(formatSequenceEntry),
        'No ordered sequence available.',
        'data-path-item',
      ),
      createListSection(
        'Semantic positions',
        result.selectedPath.semanticPositions.map((entry) => entry.semanticPosition),
        'No semantic positions available.',
        'data-semantic-position',
      ),
    );
  } else {
    layout.append(createUnsupportedSection());
  }

  card.append(layout);
  return card;
}

function renderExplorerState(sourceAuthority) {
  const experienceRecords = sourceAuthority?.experience_records ?? sourceAuthority?.experienceRecords ?? [];
  const evidenceItems = sourceAuthority?.evidence_items ?? sourceAuthority?.evidenceItems ?? [];
  const taxonomy = sourceAuthority?.taxonomy ?? {};
  const jobPostingInput = sourceAuthority?.jobPostingInput ?? {};
  const authorityMarkers = sourceAuthority?.authorityMarkers ?? {};

  elements.explorerRoot.replaceChildren(
    createExplorerListCard(
      'experience-records',
      'Experience records',
      `${experienceRecords.length} record${pluralize(experienceRecords.length)} from SQLite source authority`,
      buildExplorerPreview(
        experienceRecords.map(formatExperienceRecordItem),
        6,
        'experience records',
      ),
    ),
    createExplorerListCard(
      'evidence-items',
      'Evidence items',
      `${evidenceItems.length} item${pluralize(evidenceItems.length)} linked to experience records`,
      buildExplorerPreview(
        evidenceItems.map(formatEvidenceItem),
        8,
        'evidence items',
      ),
    ),
    createExplorerListCard(
      'taxonomy',
      'Taxonomy',
      formatTaxonomySummary(taxonomy),
      buildTaxonomyItems(taxonomy),
    ),
    createExplorerKeyValueCard(
      'job-posting-input',
      'Runtime job-posting input',
      formatJobPostingInputSummary(jobPostingInput),
      buildJobPostingInputEntries(jobPostingInput),
    ),
    createExplorerKeyValueCard(
      'authority-markers',
      'Authority markers',
      formatAuthorityMarkersSummary(authorityMarkers),
      buildAuthorityMarkerEntries(authorityMarkers),
    ),
  );
}

function renderExplorerEmptyState(title, description) {
  elements.explorerRoot.replaceChildren(createEmptyState(title, description));
}

function createExplorerListCard(key, title, summary, items) {
  const card = createExplorerCard(key, title, summary);
  const list = document.createElement('ul');

  list.className = 'explorer-list';

  for (const item of items) {
    const listItem = document.createElement('li');
    listItem.textContent = item;
    listItem.setAttribute('data-explorer-item', 'visible');
    list.append(listItem);
  }

  card.append(list);
  return card;
}

function createExplorerKeyValueCard(key, title, summary, entries) {
  const card = createExplorerCard(key, title, summary);
  const list = document.createElement('dl');

  list.className = 'explorer-definition-list';

  for (const entry of entries) {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    const detail = document.createElement('dd');

    term.textContent = entry.label;
    detail.textContent = entry.value;
    detail.setAttribute('data-explorer-item', 'visible');

    if (entry.dataAttributeName && entry.dataAttributeValue) {
      detail.setAttribute(entry.dataAttributeName, entry.dataAttributeValue);
    }

    row.append(term, detail);
    list.append(row);
  }

  card.append(list);
  return card;
}

function createExplorerCard(key, title, summary) {
  const card = document.createElement('article');
  const header = document.createElement('div');
  const heading = document.createElement('h3');
  const summaryText = document.createElement('p');

  card.className = 'explorer-card';
  card.setAttribute('data-explorer-section', key);

  header.className = 'explorer-card__header';
  heading.textContent = title;
  summaryText.className = 'explorer-card__summary';
  summaryText.setAttribute('data-explorer-summary', key);
  summaryText.textContent = summary;

  header.append(heading, summaryText);
  card.append(header);

  return card;
}

function createListSection(title, items, emptyLabel, dataAttribute) {
  const section = document.createElement('section');
  const heading = document.createElement('h4');
  const list = document.createElement('ul');

  section.className = 'result-section';
  heading.textContent = title;

  const hasItems = items.length > 0;
  const values = hasItems ? items : [emptyLabel];

  for (const item of values) {
    const listItem = document.createElement('li');
    listItem.textContent = item;
    if (dataAttribute && hasItems) {
      listItem.setAttribute(dataAttribute, item);
    }
    list.append(listItem);
  }

  section.append(heading, list);
  return section;
}

function createUnsupportedSection() {
  const section = document.createElement('section');
  const heading = document.createElement('h4');
  const note = document.createElement('p');

  section.className = 'result-section';
  heading.textContent = 'Evidence-bounded outcome';
  note.className = 'unsupported-note';
  note.dataset.unsupportedNote = 'visible';
  note.textContent = 'No qualifying evidence-bounded path was found for this requirement.';

  section.append(heading, note);
  return section;
}

function formatExperienceRecordItem(record) {
  return `${record.id} · ${record.label} · tags ${formatTagLinks(record.tag_links ?? record.tagLinks ?? [])}`;
}

function formatEvidenceItem(item) {
  const experienceLink = item.experience_link ?? item.experienceLink ?? {};

  return `${item.id} · ${item.label} · experience ${item.experience_record_id ?? item.experienceRecordId} x${experienceLink.weight ?? 'missing'} · tags ${formatTagLinks(item.tag_links ?? item.tagLinks ?? [])}`;
}

function formatTagLinks(tagLinks) {
  return tagLinks.map((entry) => `${entry.tag_id ?? entry.tagId} x${entry.weight}`).join(', ');
}

function formatTaxonomySummary(taxonomy) {
  const tags = taxonomy.tags ?? [];
  const requirements = taxonomy.requirements ?? [];
  const targetRegions = taxonomy.target_regions ?? taxonomy.targetRegions ?? [];
  const tagRequirementLinks = taxonomy.tag_requirement_links ?? taxonomy.tagRequirementLinks ?? [];

  return `${tags.length} tag${pluralize(tags.length)} · ${requirements.length} requirement${pluralize(requirements.length)} · ${targetRegions.length} target region${pluralize(targetRegions.length)} · ${tagRequirementLinks.length} tag link${pluralize(tagRequirementLinks.length)}`;
}

function buildTaxonomyItems(taxonomy) {
  const tags = taxonomy.tags ?? [];
  const requirements = taxonomy.requirements ?? [];
  const targetRegions = taxonomy.target_regions ?? taxonomy.targetRegions ?? [];
  const tagRequirementLinks = taxonomy.tag_requirement_links ?? taxonomy.tagRequirementLinks ?? [];
  const items = [];

  if (tags.length > 0) {
    items.push(`Tags: ${formatPreviewValues(tags.map((entry) => entry.label), 10)}`);
  }

  if (requirements.length > 0) {
    items.push(`Requirements: ${requirements.map(formatRequirementItem).join(' | ')}`);
  }

  if (targetRegions.length > 0) {
    items.push(`Target regions: ${targetRegions.map(formatTargetRegionItem).join(' | ')}`);
  }

  if (tagRequirementLinks.length > 0) {
    items.push(`Tag links: ${tagRequirementLinks.map(formatTagRequirementLink).join(' | ')}`);
  }

  return items;
}

function buildExplorerPreview(items, maxVisible, label) {
  if (items.length <= maxVisible) {
    return items;
  }

  return [
    ...items.slice(0, maxVisible),
    `${items.length - maxVisible} more ${label} remain in the current read-only payload preview.`,
  ];
}

function formatRequirementItem(requirement) {
  const cueTerms = requirement.cue_terms ?? requirement.cueTerms ?? [];
  const defaultWeight = requirement.default_weight ?? requirement.defaultWeight;

  return `${requirement.label} (${requirement.id}) default ${defaultWeight} cues ${cueTerms.join(', ')}`;
}

function formatTargetRegionItem(targetRegion) {
  const requirementIds = targetRegion.requirement_ids ?? targetRegion.requirementIds ?? [];

  return `${targetRegion.label} (${targetRegion.id}) -> ${requirementIds.join(', ')}`;
}

function formatTagRequirementLink(link) {
  return `${link.tag_id ?? link.tagId} -> ${link.requirement_id ?? link.requirementId} x${link.weight}`;
}

function formatJobPostingInputSummary(jobPostingInput) {
  const populatedFieldCount = countPopulatedJobPostingFields(jobPostingInput);

  return `${populatedFieldCount} populated field${pluralize(populatedFieldCount)} in the runtime payload`;
}

function buildJobPostingInputEntries(jobPostingInput) {
  return [
    {
      label: 'Title',
      value: formatOptionalText(jobPostingInput.title),
      dataAttributeName: 'data-explorer-runtime-field',
      dataAttributeValue: 'title',
    },
    {
      label: 'Text',
      value: formatOptionalText(jobPostingInput.text),
      dataAttributeName: 'data-explorer-runtime-field',
      dataAttributeValue: 'text',
    },
    {
      label: 'Summary',
      value: formatOptionalText(jobPostingInput.summary),
      dataAttributeName: 'data-explorer-runtime-field',
      dataAttributeValue: 'summary',
    },
    {
      label: 'Description',
      value: formatOptionalText(jobPostingInput.description),
      dataAttributeName: 'data-explorer-runtime-field',
      dataAttributeValue: 'description',
    },
  ];
}

function countPopulatedJobPostingFields(jobPostingInput) {
  return ['title', 'text', 'summary', 'description']
    .map((field) => jobPostingInput[field])
    .filter((value) => typeof value === 'string' && value.trim() !== '')
    .length;
}

function formatAuthorityMarkersSummary(authorityMarkers) {
  const markerCount = Object.values(authorityMarkers).filter((value) => String(value ?? '').trim() !== '').length;

  return `${markerCount} authority marker${pluralize(markerCount)} from the current run payload`;
}

function buildAuthorityMarkerEntries(authorityMarkers) {
  return [
    {
      label: 'Requirement region authority',
      value: formatOptionalText(authorityMarkers.requirementRegionAuthority),
      dataAttributeName: 'data-explorer-marker',
      dataAttributeValue: 'requirement-region-authority',
    },
  ];
}

function formatOptionalText(value) {
  return typeof value === 'string' && value.trim() !== ''
    ? value
    : 'Not provided';
}

function pluralize(count) {
  return count === 1 ? '' : 's';
}

function formatSequenceEntry(entry) {
  if (entry.type === 'node') {
    return `${entry.nodeKind}: ${entry.sourceId}`;
  }

  return `${entry.edgeKind}: ${entry.weight}`;
}

function formatSelectionScore(selectionScore) {
  return [
    `${selectionScore.matchedRequirementCount} matched requirements`,
    `${selectionScore.totalCueMatchCount} cue hits`,
    `weighted sum ${selectionScore.weightedRequirementSum}`,
  ].join(' · ');
}

function formatRequirementWeights(requirementWeights) {
  return requirementWeights
    .map((requirement) => `${requirement.label}: ${requirement.derivedWeight ?? requirement.weight}`)
    .join(' | ');
}

function formatCueMatches(requirementCueScores) {
  const matchedRequirements = requirementCueScores
    .filter((requirement) => requirement.cueMatches.length > 0)
    .map((requirement) => `${requirement.label}: ${requirement.cueMatches.map((match) => `${match.cueTerm} x${match.matchCount}`).join(', ')}`);

  return matchedRequirements.length > 0
    ? matchedRequirements.join(' | ')
    : 'No cue-term matches found.';
}

function collectRuntimeInput() {
  return {
    title: elements.titleInput.value,
    text: elements.textInput.value,
  };
}

function applyRuntimeInput(runtimeInput) {
  elements.titleInput.value = runtimeInput.title ?? '';
  elements.textInput.value = runtimeInput.text ?? '';
}

async function captureProbeRunSummary(outcome) {
  await nextFrame();

  const supportedCard = elements.resultsRoot.querySelector('[data-result-id="req-backend-systems"]');
  const unsupportedCard = elements.resultsRoot.querySelector('[data-result-id="req-mentoring"]');
  const runtimeError = outcome ? outcome.runtimeError : 'missing';
  const experienceSection = readExplorerSection('experience-records');
  const evidenceSection = readExplorerSection('evidence-items');
  const taxonomySection = readExplorerSection('taxonomy');
  const jobPostingSection = readExplorerSection('job-posting-input');
  const authoritySection = readExplorerSection('authority-markers');

  return {
    runtimeError,
    loadSourceAuthorityCallCount: commandMetrics.loadSourceAuthorityCalls,
    requirementRegionAuthority: outcome?.sourceAuthority?.authorityMarkers?.requirementRegionAuthority ?? 'missing',
    renderedResultIds: Array.from(elements.resultsRoot.querySelectorAll('[data-result-id]')).map(
      (entry) => entry.getAttribute('data-result-id') ?? '',
    ),
    supportedRequirementLabel: supportedCard?.querySelector('h3')?.textContent ?? 'missing',
    supportedStatus: supportedCard?.querySelector('[data-status-value]')?.textContent ?? 'missing',
    unsupportedRequirementLabel: unsupportedCard?.querySelector('h3')?.textContent ?? 'missing',
    unsupportedStatus: unsupportedCard?.querySelector('[data-status-value]')?.textContent ?? 'missing',
    unsupportedNoteVisible: Boolean(unsupportedCard?.querySelector('[data-unsupported-note="visible"]')),
    supportingExperienceRecordIds: Array.from(
      supportedCard?.querySelectorAll('[data-supporting-experience-id]') ?? [],
    ).map((entry) => entry.textContent ?? ''),
    supportingEvidenceItemIds: Array.from(
      supportedCard?.querySelectorAll('[data-supporting-evidence-id]') ?? [],
    ).map((entry) => entry.textContent ?? ''),
    semanticPositions: Array.from(supportedCard?.querySelectorAll('[data-semantic-position]') ?? []).map(
      (entry) => entry.textContent ?? '',
    ),
    orderedSequence: Array.from(supportedCard?.querySelectorAll('[data-path-item]') ?? []).map(
      (entry) => entry.textContent ?? '',
    ),
    targetRegionLabel: readMetadataValue('target-region'),
    selectedRegionScore: readMetadataValue('selected-region-score'),
    requirementWeights: readMetadataValue('requirement-weights'),
    matchedCueTerms: readMetadataValue('matched-cue-terms'),
    experienceRecordsSummary: experienceSection.summary,
    experienceRecordItems: experienceSection.items,
    evidenceItemsSummary: evidenceSection.summary,
    evidenceItemItems: evidenceSection.items,
    taxonomySummary: taxonomySection.summary,
    taxonomyItems: taxonomySection.items,
    jobPostingInputSummary: jobPostingSection.summary,
    jobPostingInputItems: jobPostingSection.items,
    displayedJobPostingTitle: readExplorerField('[data-explorer-runtime-field="title"]'),
    displayedJobPostingText: readExplorerField('[data-explorer-runtime-field="text"]'),
    authorityMarkersSummary: authoritySection.summary,
    authorityMarkerItems: authoritySection.items,
    displayedRequirementRegionAuthority: readExplorerField('[data-explorer-marker="requirement-region-authority"]'),
    hasWritableExplorerControls: Boolean(elements.explorerRoot.querySelector('input, textarea, select, button, [contenteditable="true"]')),
  };
}

function collectDifferingVisibleAnalysis(firstRun, secondRun) {
  return [
    {
      field: 'selectedRegionScore',
      firstValue: firstRun.selectedRegionScore,
      secondValue: secondRun.selectedRegionScore,
    },
    {
      field: 'requirementWeights',
      firstValue: firstRun.requirementWeights,
      secondValue: secondRun.requirementWeights,
    },
    {
      field: 'matchedCueTerms',
      firstValue: firstRun.matchedCueTerms,
      secondValue: secondRun.matchedCueTerms,
    },
  ].filter((entry) => entry.firstValue !== entry.secondValue);
}

function readMetadataValue(key) {
  return elements.metadata.querySelector(`[data-metadata-value="${key}"]`)?.textContent ?? 'missing';
}

function readExplorerSection(key) {
  const section = elements.explorerRoot.querySelector(`[data-explorer-section="${key}"]`);

  return {
    summary: section?.querySelector(`[data-explorer-summary="${key}"]`)?.textContent ?? 'missing',
    items: Array.from(section?.querySelectorAll('[data-explorer-item]') ?? []).map(
      (entry) => entry.textContent ?? '',
    ),
  };
}

function readExplorerField(selector) {
  return elements.explorerRoot.querySelector(selector)?.textContent ?? 'missing';
}

function nextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function formatPreviewValues(values, maxVisible) {
  if (values.length <= maxVisible) {
    return values.join(', ');
  }

  return `${values.slice(0, maxVisible).join(', ')} + ${values.length - maxVisible} more`;
}