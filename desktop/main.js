import { invoke } from '@tauri-apps/api/core';

import { assembleApprovedSourceFactsProof } from '@ps01/source-authority-adapter.mjs';

const elements = {
  analyzeButton: document.querySelector('#analyze-button'),
  statusMessage: document.querySelector('#status-message'),
  metadata: document.querySelector('#analysis-metadata'),
  resultsRoot: document.querySelector('#results-root'),
};

const probeMode = new URLSearchParams(window.location.search).get('probe') === '1';
let analysisRunning = false;

elements.analyzeButton.addEventListener('click', () => {
  void runAnalysis({ shouldReportProbe: probeMode });
});

renderIdleState();

if (probeMode) {
  queueMicrotask(() => {
    elements.analyzeButton.click();
  });
}

async function runAnalysis({ shouldReportProbe }) {
  if (analysisRunning) {
    return;
  }

  analysisRunning = true;
  elements.analyzeButton.disabled = true;
  elements.statusMessage.textContent = 'Running the local SQLite source authority through assembleApprovedSourceFactsProof…';

  try {
    const sourceAuthority = await invoke('load_source_authority');
    const result = assembleApprovedSourceFactsProof(sourceAuthority);

    renderSuccessState(result);

    if (shouldReportProbe) {
      await reportProbeSummary(result, sourceAuthority);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    renderErrorState(message);

    if (shouldReportProbe) {
      await invoke('report_i07_probe', {
        summary: {
          runtimeError: message,
          requirementRegionAuthority: 'error',
          renderedResultIds: [],
          supportedRequirementLabel: 'Backend Systems',
          supportedStatus: 'error',
          unsupportedRequirementLabel: 'Mentoring',
          unsupportedStatus: 'error',
          unsupportedNoteVisible: false,
          supportingExperienceRecordIds: [],
          supportingEvidenceItemIds: [],
          semanticPositions: [],
          orderedSequence: [],
        },
      });
    }
  } finally {
    analysisRunning = false;
    elements.analyzeButton.disabled = false;
  }
}

function renderIdleState() {
  updateMetadata([
    ['Adapter', 'Waiting for analysis'],
    ['Target region', 'Waiting for analysis'],
    ['Unused source authorities', 'Waiting for analysis'],
  ]);

  elements.resultsRoot.replaceChildren(createEmptyState(
    'No analysis yet',
    'Use the single action above to run the local desktop caller against the SQLite source authority.',
  ));
}

function renderSuccessState(result) {
  const supportedResult = result.proof.results.find(
    (entry) => entry.requirementId === 'req-backend-systems',
  );
  const unsupportedResult = result.proof.results.find(
    (entry) => entry.requirementId === 'req-mentoring',
  );

  updateMetadata([
    ['Adapter', `${result.adapterMetadata.adapterId} · ${result.proof.sliceId}`],
    ['Target region', `${result.adapterMetadata.targetRegionSelection.label} (${result.adapterMetadata.targetRegionSelection.id})`],
    ['Unused source authorities', result.adapterMetadata.unusedSourceAuthorities.join(', ')],
  ]);

  elements.statusMessage.textContent = 'Rendered one supported and one unsupported requirement from the local SQLite source authority.';
  elements.resultsRoot.replaceChildren(
    createResultCard(supportedResult),
    createResultCard(unsupportedResult),
  );
}

function renderErrorState(message) {
  updateMetadata([
    ['Adapter', 'Analysis failed'],
    ['Target region', 'Unavailable'],
    ['Unused source authorities', 'Unavailable'],
  ]);

  elements.statusMessage.textContent = 'The local analysis failed.';
  elements.resultsRoot.replaceChildren(createEmptyState('Analysis failed', message));
}

function updateMetadata(entries) {
  const blocks = entries.map(([label, value]) => {
    const wrapper = document.createElement('div');
    const title = document.createElement('dt');
    const detail = document.createElement('dd');

    title.textContent = label;
    detail.textContent = value;

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

async function reportProbeSummary(result, sourceAuthority) {
  await nextFrame();

  const supportedResult = result.proof.results.find(
    (entry) => entry.requirementId === 'req-backend-systems',
  );
  const unsupportedResult = result.proof.results.find(
    (entry) => entry.requirementId === 'req-mentoring',
  );
  const supportedCard = elements.resultsRoot.querySelector('[data-result-id="req-backend-systems"]');
  const unsupportedCard = elements.resultsRoot.querySelector('[data-result-id="req-mentoring"]');

  const summary = {
    runtimeError: null,
    requirementRegionAuthority: sourceAuthority?.authorityMarkers?.requirementRegionAuthority ?? 'missing',
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
  };

  await invoke('report_i07_probe', { summary });
}

function nextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}