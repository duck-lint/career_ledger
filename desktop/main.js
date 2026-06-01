import { invoke } from '@tauri-apps/api/core';

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

const elements = {
  runtimeInputForm: document.querySelector('#runtime-input-form'),
  titleInput: document.querySelector('#job-posting-title-input'),
  textInput: document.querySelector('#job-posting-text-input'),
  analyzeButton: document.querySelector('#analyze-button'),
  statusMessage: document.querySelector('#status-message'),
  metadata: document.querySelector('#analysis-metadata'),
  resultsRoot: document.querySelector('#results-root'),
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
    const sourceAuthority = await invoke('load_source_authority', { jobPostingInput: runtimeInput });
    const result = assembleApprovedSourceFactsProof(sourceAuthority);

    renderSuccessState(result);
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

  await invoke('report_i08_probe', {
    summary: {
      firstRun,
      secondRun,
      differingVisibleAnalysisFields: collectDifferingVisibleAnalysis(firstRun, secondRun),
    },
  });
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
}

function renderSuccessState(result) {
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

  elements.statusMessage.textContent = 'Rendered one supported and one unsupported requirement from the local SQLite source authority for this runtime input.';
  elements.resultsRoot.replaceChildren(
    createResultCard(supportedResult),
    createResultCard(unsupportedResult),
  );
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

  return {
    runtimeError,
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

function nextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}