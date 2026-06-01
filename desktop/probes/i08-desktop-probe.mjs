import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const probeDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(probeDir, '..', '..');
const npmCommand = 'npm';
const cargoCommand = 'cargo';

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
  ['run', '--manifest-path', 'src-tauri/Cargo.toml', '--', '--i08-probe'],
  600_000,
);

const probeLine = probeResult.output
  .split(/\r?\n/)
  .find((line) => line.startsWith('I08_PROBE:'));

if (!probeLine) {
  console.error(JSON.stringify({
    pass: false,
    reason: 'Missing I08_PROBE line from live desktop run.',
    buildExitCode: buildResult.exitCode,
    probeExitCode: probeResult.exitCode,
  }, null, 2));
  process.exit(1);
}

const summary = JSON.parse(probeLine.slice('I08_PROBE:'.length));
const failureReasons = [];

assertRun(summary.firstRun, 'firstRun', failureReasons);
assertRun(summary.secondRun, 'secondRun', failureReasons);
assertVisibleAnalysisChanged(summary, failureReasons);

const pass = probeResult.exitCode === 0 && failureReasons.length === 0;

console.log(JSON.stringify({
  probeName: 'I08 Desktop Probe: Operator Runtime Input Drives Analysis',
  pass,
  buildExitCode: buildResult.exitCode,
  probeExitCode: probeResult.exitCode,
  failureReasons,
  summary,
}, null, 2));

if (!pass) {
  process.exit(1);
}

function assertRun(runSummary, label, failureReasons) {
  assertEqual(runSummary.runtimeError, null, `${label}.runtimeError`, failureReasons);
  assertEqual(runSummary.requirementRegionAuthority, 'sqlite', `${label}.requirementRegionAuthority`, failureReasons);
  assertEqual(runSummary.supportedRequirementLabel, 'Backend Systems', `${label}.supportedRequirementLabel`, failureReasons);
  assertEqual(runSummary.supportedStatus, 'supported', `${label}.supportedStatus`, failureReasons);
  assertEqual(runSummary.unsupportedRequirementLabel, 'Mentoring', `${label}.unsupportedRequirementLabel`, failureReasons);
  assertEqual(runSummary.unsupportedStatus, 'unsupported', `${label}.unsupportedStatus`, failureReasons);
  assertEqual(runSummary.unsupportedNoteVisible, true, `${label}.unsupportedNoteVisible`, failureReasons);
  assertArrayEqual(
    runSummary.renderedResultIds,
    ['req-backend-systems', 'req-mentoring'],
    `${label}.renderedResultIds`,
    failureReasons,
  );
  assertNonEmptyArray(runSummary.supportingExperienceRecordIds, `${label}.supportingExperienceRecordIds`, failureReasons);
  assertNonEmptyArray(runSummary.supportingEvidenceItemIds, `${label}.supportingEvidenceItemIds`, failureReasons);
  assertArrayEqual(
    runSummary.semanticPositions,
    ['source-experience', 'source-evidence', 'semantic-tag', 'target-requirement'],
    `${label}.semanticPositions`,
    failureReasons,
  );
  assertPathShape(runSummary.orderedSequence, `${label}.orderedSequence`, failureReasons);
}

function assertVisibleAnalysisChanged(summary, failureReasons) {
  const changedFields = Array.isArray(summary.differingVisibleAnalysisFields)
    ? summary.differingVisibleAnalysisFields
    : [];

  if (changedFields.length === 0) {
    failureReasons.push('Expected at least one user-visible analysis metadata field to differ between probe runs.');
    return;
  }

  const allowedFields = new Set(['selectedRegionScore', 'requirementWeights', 'matchedCueTerms']);
  const validChangedFields = changedFields.filter((entry) => allowedFields.has(entry.field));

  if (validChangedFields.length === 0) {
    failureReasons.push('Visible analysis difference must come from selectedRegionScore, requirementWeights, or matchedCueTerms.');
  }
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