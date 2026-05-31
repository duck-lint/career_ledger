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
  ['run', '--manifest-path', 'src-tauri/Cargo.toml', '--', '--i04-probe'],
  600_000,
);

const probeLine = probeResult.output
  .split(/\r?\n/)
  .find((line) => line.startsWith('I04_PROBE:'));

if (!probeLine) {
  console.error(JSON.stringify({
    pass: false,
    reason: 'Missing I04_PROBE line from live desktop run.',
    buildExitCode: buildResult.exitCode,
    probeExitCode: probeResult.exitCode,
  }, null, 2));
  process.exit(1);
}

const summary = JSON.parse(probeLine.slice('I04_PROBE:'.length));
const failureReasons = [];

assertEqual(summary.runtimeError, null, 'runtimeError', failureReasons);
assertEqual(summary.supportedRequirementLabel, 'Backend Systems', 'supportedRequirementLabel', failureReasons);
assertEqual(summary.supportedStatus, 'supported', 'supportedStatus', failureReasons);
assertEqual(summary.unsupportedRequirementLabel, 'Mentoring', 'unsupportedRequirementLabel', failureReasons);
assertEqual(summary.unsupportedStatus, 'unsupported', 'unsupportedStatus', failureReasons);
assertEqual(summary.unsupportedNoteVisible, true, 'unsupportedNoteVisible', failureReasons);
assertArrayEqual(
  summary.renderedResultIds,
  ['req-backend-systems', 'req-mentoring'],
  'renderedResultIds',
  failureReasons,
);
assertArrayEqual(
  summary.supportingExperienceRecordIds,
  ['exp-payments'],
  'supportingExperienceRecordIds',
  failureReasons,
);
assertArrayEqual(
  summary.supportingEvidenceItemIds,
  ['evidence-adr', 'evidence-runbook'],
  'supportingEvidenceItemIds',
  failureReasons,
);
assertArrayEqual(
  summary.semanticPositions,
  ['source-experience', 'source-evidence', 'semantic-tag', 'target-requirement'],
  'semanticPositions',
  failureReasons,
);
assertArrayEqual(
  summary.orderedSequence,
  [
    'Experience: exp-payments',
    'demonstrates: 4',
    'Evidence: evidence-adr',
    'uses: 5',
    'Tag: tag-backend',
    'supports: 6',
    'Requirement: req-backend-systems',
  ],
  'orderedSequence',
  failureReasons,
);

const pass = probeResult.exitCode === 0 && failureReasons.length === 0;

console.log(JSON.stringify({
  pass,
  buildExitCode: buildResult.exitCode,
  probeExitCode: probeResult.exitCode,
  failureReasons,
  summary,
}, null, 2));

if (!pass) {
  process.exit(1);
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