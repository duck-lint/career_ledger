import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const probeDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(probeDir, '..', '..');
const npmCommand = 'npm';
const cargoCommand = 'cargo';

const I09_PROBE_RUN = {
  title: 'Principal Platform Engineer',
  text: 'This role emphasizes backend systems ownership, API design, distributed systems scaling, mentoring, and mentor programs for senior engineers.',
};

const buildResult = await runStep(
  'build:web',
  npmCommand,
  ['run', 'build:web'],
  180_000,
);

if (buildResult.exitCode !== 0) {
  throw new Error(`build:web failed with exit code ${buildResult.exitCode}.`);
}

const probeResult = await runStep(
  'cargo-run-probe',
  cargoCommand,
  ['run', '--manifest-path', 'src-tauri/Cargo.toml', '--', '--i09-probe'],
  600_000,
);

const probeLine = probeResult.output
  .split(/\r?\n/)
  .find((line) => line.startsWith('I09_PROBE:'));

if (!probeLine) {
  console.error(JSON.stringify({
    pass: false,
    reason: 'Missing I09_PROBE line from live desktop run.',
    buildExitCode: buildResult.exitCode,
    probeExitCode: probeResult.exitCode,
  }, null, 2));
  process.exit(1);
}

const summary = JSON.parse(probeLine.slice('I09_PROBE:'.length));
const failureReasons = [];

assertResultContract(summary, failureReasons);
assertExplorerContract(summary, failureReasons);

const pass = probeResult.exitCode === 0 && failureReasons.length === 0;

console.log(JSON.stringify({
  probeName: 'I09 Desktop Probe: Read-Only Source-Authority Explorer Reflects Live Payload',
  pass,
  buildExitCode: buildResult.exitCode,
  probeExitCode: probeResult.exitCode,
  failureReasons,
  summary,
}, null, 2));

if (!pass) {
  process.exit(1);
}

function assertResultContract(summary, failureReasons) {
  assertEqual(summary.runtimeError, null, 'summary.runtimeError', failureReasons);
  assertEqual(summary.requirementRegionAuthority, 'sqlite', 'summary.requirementRegionAuthority', failureReasons);
  assertEqual(summary.supportedRequirementLabel, 'Backend Systems', 'summary.supportedRequirementLabel', failureReasons);
  assertEqual(summary.supportedStatus, 'supported', 'summary.supportedStatus', failureReasons);
  assertEqual(summary.unsupportedRequirementLabel, 'Mentoring', 'summary.unsupportedRequirementLabel', failureReasons);
  assertEqual(summary.unsupportedStatus, 'unsupported', 'summary.unsupportedStatus', failureReasons);
  assertEqual(summary.unsupportedNoteVisible, true, 'summary.unsupportedNoteVisible', failureReasons);
  assertArrayEqual(
    summary.renderedResultIds,
    ['req-backend-systems', 'req-mentoring'],
    'summary.renderedResultIds',
    failureReasons,
  );
  assertNonEmptyArray(summary.supportingExperienceRecordIds, 'summary.supportingExperienceRecordIds', failureReasons);
  assertNonEmptyArray(summary.supportingEvidenceItemIds, 'summary.supportingEvidenceItemIds', failureReasons);
  assertArrayEqual(
    summary.semanticPositions,
    ['source-experience', 'source-evidence', 'semantic-tag', 'target-requirement'],
    'summary.semanticPositions',
    failureReasons,
  );
  assertPathShape(summary.orderedSequence, 'summary.orderedSequence', failureReasons);
}

function assertExplorerContract(summary, failureReasons) {
  assertEqual(summary.loadSourceAuthorityCallCount, 1, 'summary.loadSourceAuthorityCallCount', failureReasons);
  assertEqual(summary.hasWritableExplorerControls, false, 'summary.hasWritableExplorerControls', failureReasons);
  assertEqual(summary.displayedRequirementRegionAuthority, 'sqlite', 'summary.displayedRequirementRegionAuthority', failureReasons);
  assertEqual(summary.displayedJobPostingTitle, I09_PROBE_RUN.title, 'summary.displayedJobPostingTitle', failureReasons);
  assertEqual(summary.displayedJobPostingText, I09_PROBE_RUN.text, 'summary.displayedJobPostingText', failureReasons);

  assertExplorerSection(
    summary.experienceRecordsSummary,
    summary.experienceRecordItems,
    'summary.experienceRecords',
    failureReasons,
  );
  assertExplorerSection(
    summary.evidenceItemsSummary,
    summary.evidenceItemItems,
    'summary.evidenceItems',
    failureReasons,
  );
  assertExplorerSection(summary.taxonomySummary, summary.taxonomyItems, 'summary.taxonomy', failureReasons);
  assertExplorerSection(
    summary.jobPostingInputSummary,
    summary.jobPostingInputItems,
    'summary.jobPostingInput',
    failureReasons,
  );
  assertExplorerSection(
    summary.authorityMarkersSummary,
    summary.authorityMarkerItems,
    'summary.authorityMarkers',
    failureReasons,
  );
}

function assertExplorerSection(summaryText, items, label, failureReasons) {
  assertNonEmptyString(summaryText, `${label}Summary`, failureReasons);
  assertNonEmptyArray(items, `${label}Items`, failureReasons);
}

function assertEqual(actual, expected, label, failureReasons) {
  if (actual !== expected) {
    failureReasons.push(`${label} expected ${JSON.stringify(expected)} but received ${JSON.stringify(actual)}.`);
  }
}

function assertArrayEqual(actual, expected, label, failureReasons) {
  const actualArray = Array.isArray(actual) ? actual : [];
  if (JSON.stringify(actualArray) !== JSON.stringify(expected)) {
    failureReasons.push(`${label} expected ${JSON.stringify(expected)} but received ${JSON.stringify(actualArray)}.`);
  }
}

function assertNonEmptyString(actual, label, failureReasons) {
  if (typeof actual !== 'string' || actual.trim() === '') {
    failureReasons.push(`${label} must be a non-empty string.`);
  }
}

function assertNonEmptyArray(actual, label, failureReasons) {
  const actualArray = Array.isArray(actual) ? actual : [];
  if (actualArray.length === 0 || actualArray.some((entry) => typeof entry !== 'string' || entry.trim() === '')) {
    failureReasons.push(`${label} must contain at least one non-empty string.`);
  }
}

function assertPathShape(actual, label, failureReasons) {
  const actualArray = Array.isArray(actual) ? actual : [];

  if (actualArray.length !== 7) {
    failureReasons.push(`${label} expected 7 entries but received ${actualArray.length}.`);
    return;
  }

  const patterns = [
    /^Experience: .+/,
    /^demonstrates: \d+$/,
    /^Evidence: .+/,
    /^uses: \d+$/,
    /^Tag: .+/,
    /^supports: \d+$/,
    /^Requirement: req-backend-systems$/,
  ];

  patterns.forEach((pattern, index) => {
    if (!pattern.test(actualArray[index] ?? '')) {
      failureReasons.push(`${label}[${index}] expected to match ${pattern} but received ${JSON.stringify(actualArray[index] ?? '')}.`);
    }
  });
}

async function runStep(label, command, args, timeoutMs) {
  const child = process.platform === 'win32'
    ? spawn(
      process.env.ComSpec ?? 'cmd.exe',
      ['/d', '/s', '/c', [command, ...args].join(' ')],
      {
        cwd: repoRoot,
        env: process.env,
        shell: false,
        windowsHide: false,
      },
    )
    : spawn(command, args, {
      cwd: repoRoot,
      env: process.env,
      shell: false,
      windowsHide: false,
    });

  let output = '';

  const append = (chunk) => {
    const text = chunk.toString();
    output += text;
    process.stdout.write(text);
  };

  child.stdout.on('data', append);
  child.stderr.on('data', append);

  const exitCode = await new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      child.kill();
      reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    child.once('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });

    child.once('close', (code) => {
      clearTimeout(timeoutId);
      resolve(code ?? 1);
    });
  });

  return { exitCode, output };
}