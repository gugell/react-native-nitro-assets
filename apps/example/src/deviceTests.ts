import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import {
  AssetsError,
  createAssets,
  type AssetsAdapter,
  type AssetsClient,
} from 'react-native-nitro-assets';
import { createMemoryAdapter } from 'react-native-nitro-assets/memory';
import { createNativeAdapter } from 'react-native-nitro-assets/native';
import { DEMO_FILE, DEMO_PACK } from './assets';

/**
 * Tests that run inside the app, on a real device: the TypeScript core on Hermes (memory adapter)
 * and the native module against the backend the OS actually picks. Results go to the screen, to
 * the console (one `NITRO_TEST` line each) and to Documents/nitro-assets-tests.json.
 */

export interface TestResult {
  name: string;
  passed: boolean;
  /** What happened: the failure, or the outcome the native backend reported. */
  detail: string;
  durationMs: number;
}

export interface TestReport {
  platform: string;
  osVersion: string;
  backend: string;
  /** False while running, and in a file left behind by a crash. */
  complete: boolean;
  passed: number;
  failed: number;
  results: TestResult[];
}

/** Codes a sideloaded build may legitimately get from a store-backed backend. */
const STORE_CODES = [
  'pack_not_found',
  'store_unavailable',
  'misconfigured',
  'not_allowed',
  'network',
];

class AssertionError extends Error {}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new AssertionError(message);
}

function equal<T>(actual: T, expected: T, what: string) {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

async function rejection(promise: Promise<unknown>): Promise<AssetsError> {
  try {
    const value = await promise;
    throw new AssertionError(`expected a rejection, resolved with ${JSON.stringify(value)}`);
  } catch (error) {
    if (error instanceof AssertionError) throw error;
    assert(error instanceof AssetsError, `expected an AssetsError, got ${String(error)}`);
    return error;
  }
}

async function rejectsWith(promise: Promise<unknown>, code: string): Promise<AssetsError> {
  const error = await rejection(promise);
  equal(error.code, code, 'error code');
  return error;
}

function describeError(error: AssetsError) {
  return `${error.code}${error.retryable ? ' (retryable)' : ''}: ${error.message}`;
}

/** A native call must settle with a result or a coded error, never `unknown`, never hang. */
async function settles<T>(promise: Promise<T>): Promise<{ value?: T; error?: AssetsError }> {
  try {
    return { value: await promise };
  } catch (error) {
    assert(error instanceof AssetsError, `expected an AssetsError, got ${String(error)}`);
    assert(error.code !== 'unknown', `uncoded native error: ${error.message}`);
    return { error };
  }
}

type Test = { name: string; run: () => Promise<string | void> };

function memoryTests(): Test[] {
  const packs = {
    model: {
      files: ['weights.bin', 'nested/dir/file.bin'],
      downloadSizeBytes: 1_000,
      downloadDurationMs: 50,
    },
    ready: { files: ['a.txt'], isDownloaded: true },
    broken: { files: ['a.txt'], downloadDurationMs: 10, failDownloadWith: 'network' as const },
  };
  const client = () =>
    createAssets({ adapter: createMemoryAdapter({ packs, baseUrl: 'file:///packs/' }) });

  return [
    {
      name: 'memory: status, monotonic progress, then file URLs',
      run: async () => {
        const assets = client();
        equal((await assets.getStatus('model')).state, 'not-downloaded', 'state before');
        await rejectsWith(assets.getFileUrl('model', 'weights.bin'), 'pack_not_downloaded');
        const progress: number[] = [];
        await assets.ensureAvailable('model', { onProgress: (f) => progress.push(f) });
        assert(progress.length > 0, 'no progress reported');
        equal(progress.at(-1), 1, 'last progress');
        equal(
          [...progress].sort((a, b) => a - b),
          progress,
          'progress order',
        );
        equal((await assets.getStatus('model')).state, 'available', 'state after');
        equal(
          await assets.getFileUrl('model', 'nested/dir/file.bin'),
          'file:///packs/model/nested/dir/file.bin',
          'file URL',
        );
        await rejectsWith(assets.getFileUrl('model', 'missing.bin'), 'file_not_found');
      },
    },
    {
      name: 'memory: concurrent callers share one download',
      run: async () => {
        let starts = 0;
        const memory = createMemoryAdapter({ packs });
        const adapter: AssetsAdapter = {
          ...memory,
          name: memory.name,
          backend: memory.backend,
          isSupported: true,
          ensureAvailable: (packId, options) => {
            starts++;
            return memory.ensureAvailable(packId, options);
          },
        };
        const assets = createAssets({ adapter });
        const a: number[] = [];
        const b: number[] = [];
        await Promise.all([
          assets.ensureAvailable('model', { onProgress: (f) => a.push(f) }),
          assets.ensureAvailable('model', { onProgress: (f) => b.push(f) }),
        ]);
        equal(starts, 1, 'downloads started');
        equal([a.at(-1), b.at(-1)], [1, 1], 'last progress of each caller');
      },
    },
    {
      name: 'memory: a throwing progress callback does not fail the download',
      run: async () => {
        await client().ensureAvailable('model', {
          onProgress: () => {
            throw new Error('boom');
          },
        });
      },
    },
    {
      name: 'memory: download failure maps to a coded, retryable error',
      run: async () => {
        const assets = client();
        const error = await rejectsWith(assets.ensureAvailable('broken'), 'network');
        equal(error.retryable, true, 'retryable');
        equal((await assets.getStatus('broken')).state, 'not-downloaded', 'state after failure');
      },
    },
    {
      name: 'memory: timeouts reject with timeout',
      run: async () => {
        const adapter = createMemoryAdapter({
          packs: { slow: { files: ['x'], downloadDurationMs: 1_000 } },
        });
        await rejectsWith(
          createAssets({ adapter }).ensureAvailable('slow', { timeoutMs: 20 }),
          'timeout',
        );
      },
    },
  ];
}

function nativeTests(assets: AssetsClient): Test[] {
  const iosMajor = Platform.OS === 'ios' ? parseInt(String(Platform.Version), 10) : 0;
  // On iOS 26 the module uses Background Assets when the app ships the downloader extension and
  // the app group, and falls back to On-Demand Resources when it does not.
  const allowedBackends =
    Platform.OS === 'android'
      ? ['play-asset-delivery']
      : iosMajor >= 26
        ? ['background-assets', 'on-demand-resources']
        : ['on-demand-resources'];
  const odr = assets.backend === 'on-demand-resources';

  return [
    {
      name: `native: backend is one of ${allowedBackends.join(', ')}`,
      run: async () => {
        equal(assets.adapter, 'native', 'adapter');
        assert(allowedBackends.includes(assets.backend), `backend ${assets.backend}`);
        equal(assets.isSupported, true, 'isSupported');
        return assets.backend;
      },
    },
    {
      name: 'native: invalid pack ids and paths are rejected before reaching native',
      run: async () => {
        for (const id of ['', '1abc', 'a/b', 'a.b']) {
          await rejectsWith(assets.getStatus(id), 'invalid_argument');
        }
        for (const path of ['/abs', '../up', 'a//b']) {
          await rejectsWith(assets.getFileUrl(DEMO_PACK, path), 'invalid_argument');
        }
      },
    },
    {
      name: `native: getStatus("${DEMO_PACK}") settles with a status or a coded error`,
      run: async () => {
        const { value, error } = await settles(assets.getStatus(DEMO_PACK));
        if (error) {
          assert(
            STORE_CODES.includes(error.code),
            `unexpected code ${error.code}: ${error.message}`,
          );
          return `rejected ${describeError(error)}`;
        }
        equal(value!.packId, DEMO_PACK, 'packId');
        return `state=${value!.state} size=${value!.downloadSizeBytes ?? '—'} update=${value!.isUpdateAvailable}`;
      },
    },
    {
      name: 'native: an unknown pack is reported as such',
      run: async () => {
        const { value, error } = await settles(assets.getStatus('no-such-pack'));
        assert(error, `resolved for an unknown pack: ${JSON.stringify(value)}`);
        if (odr) equal(error.code, 'pack_not_found', 'error code');
        assert(STORE_CODES.includes(error.code), `unexpected code ${error.code}: ${error.message}`);
        return `rejected ${describeError(error)}`;
      },
    },
    {
      name: `native: ensureAvailable("${DEMO_PACK}") settles, with progress ending at 1 on success`,
      run: async () => {
        const progress: number[] = [];
        const { error } = await settles(
          assets.ensureAvailable(DEMO_PACK, {
            timeoutMs: 60_000,
            onProgress: (f) => progress.push(f),
          }),
        );
        // The test build embeds its On-Demand Resources packs, so that path must succeed.
        assert(
          !(odr && error),
          `On-Demand Resources download failed: ${error && describeError(error)}`,
        );
        if (error) {
          assert(
            STORE_CODES.includes(error.code) || error.code === 'timeout',
            `unexpected code ${error.code}`,
          );
          return `rejected ${describeError(error)} after ${progress.length} progress events`;
        }
        if (progress.length > 0) equal(progress.at(-1), 1, 'last progress');
        return `available (${progress.length} progress events)`;
      },
    },
    {
      name: `native: getFileUrl("${DEMO_PACK}", "${DEMO_FILE}") matches the pack's state`,
      run: async () => {
        const status = await settles(assets.getStatus(DEMO_PACK));
        const { value, error } = await settles(assets.getFileUrl(DEMO_PACK, DEMO_FILE));
        if (status.value?.state === 'available') {
          assert(
            value?.startsWith('file://') && value !== undefined,
            `expected a file URL, got ${value ?? error?.code}`,
          );
          const text = new File(value).textSync();
          const labels: unknown = JSON.parse(text);
          assert(labels && typeof labels === 'object', 'file is not a JSON object');
          return `${value} (${text.length} bytes of JSON)`;
        }
        assert(!odr, `On-Demand Resources pack not available after ensureAvailable`);
        assert(error, `got a URL for a pack that is not available: ${value}`);
        assert(
          ['pack_not_downloaded', ...STORE_CODES].includes(error.code),
          `unexpected code ${error.code}: ${error.message}`,
        );
        return `rejected ${describeError(error)}`;
      },
    },
    {
      name: 'native: missing files inside an available pack are file_not_found',
      run: async () => {
        const status = await settles(assets.getStatus(DEMO_PACK));
        if (status.value?.state !== 'available') return 'skipped: pack not on the device';
        await rejectsWith(assets.getFileUrl(DEMO_PACK, 'does/not/exist.bin'), 'file_not_found');
      },
    },
    {
      name: 'native: concurrent calls all settle',
      run: async () => {
        const outcomes = await Promise.all(
          Array.from({ length: 5 }, () => settles(assets.getStatus(DEMO_PACK))),
        );
        const codes = outcomes.map((o) => o.error?.code ?? o.value?.state);
        assert(new Set(codes).size === 1, `inconsistent outcomes: ${codes.join(', ')}`);
        return codes[0];
      },
    },
    {
      name: `native: remove("${DEMO_PACK}") settles`,
      run: async () => {
        const { error } = await settles(assets.remove(DEMO_PACK));
        return error ? `rejected ${describeError(error)}` : 'resolved';
      },
    },
  ];
}

const RESULTS_FILE = 'nitro-assets-tests.json';

function emit(line: string) {
  // Release builds forward console output to the unified log (subsystem com.facebook.react.log).
  console.log(`NITRO_TEST ${line}`);
}

function save(report: TestReport) {
  try {
    const file = new File(Paths.document, RESULTS_FILE);
    file.create({ overwrite: true });
    file.writeSync(JSON.stringify(report, null, 2));
  } catch (error) {
    emit(`could not write ${RESULTS_FILE}: ${String(error)}`);
  }
}

function reportOf(backend: string, results: TestResult[], complete: boolean): TestReport {
  const passed = results.filter((r) => r.passed).length;
  return {
    platform: Platform.OS,
    osVersion: String(Platform.Version),
    backend,
    complete,
    passed,
    failed: results.length - passed,
    results,
  };
}

export async function runDeviceTests(onResult?: (result: TestResult) => void): Promise<TestReport> {
  const native = createAssets({ adapter: createNativeAdapter(), timeoutMs: 20_000 });
  const tests = [...memoryTests(), ...nativeTests(native)];
  const results: TestResult[] = [];
  emit(
    `START ${tests.length} tests on ${Platform.OS} ${Platform.Version}, backend ${native.backend}`,
  );

  // Saved before and after every test, so a crash leaves the results so far (complete: false).
  save(reportOf(native.backend, results, false));
  for (const test of tests) {
    // Logged before running, so a native crash still points at the test that caused it.
    emit(`RUN ${test.name}`);
    const started = Date.now();
    let result: TestResult;
    try {
      const outcome = await test.run();
      result = {
        name: test.name,
        passed: true,
        detail: outcome ?? '',
        durationMs: Date.now() - started,
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      result = { name: test.name, passed: false, detail, durationMs: Date.now() - started };
    }
    results.push(result);
    emit(
      `${result.passed ? 'PASS' : 'FAIL'} ${test.name}${result.detail ? ` — ${result.detail}` : ''}`,
    );
    onResult?.(result);
    save(reportOf(native.backend, results, false));
  }

  const report = reportOf(native.backend, results, true);
  save(report);
  emit(`DONE passed=${report.passed} failed=${report.failed}`);
  return report;
}
