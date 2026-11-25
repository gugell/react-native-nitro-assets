import { describe, expect, it } from 'vitest';
import { AssetsError, createAssets, toAssetsError, type AssetsAdapter } from '../src/index.ts';
import { createMemoryAdapter } from '../src/memory.ts';
import { createNativeAdapter as createWebAdapter } from '../src/native.web.ts';

const packs = {
  'intent-model': {
    files: ['minilm_intents_xnnpack_8da4w.pte', 'tokenizer.json', 'nested/dir/file.bin'],
    downloadSizeBytes: 124_000_000,
    downloadDurationMs: 20,
  },
  ready: { files: ['a.txt'], isDownloaded: true },
  broken: { files: ['a.txt'], downloadDurationMs: 10, failDownloadWith: 'network' as const },
};

function client() {
  return createAssets({ adapter: createMemoryAdapter({ packs, baseUrl: 'file:///packs/' }) });
}

describe('createAssets with the memory adapter', () => {
  it('reports status, downloads with monotonic progress, then resolves file URLs', async () => {
    const assets = client();
    expect(assets.backend).toBe('memory');
    expect(assets.isSupported).toBe(true);
    expect(await assets.getStatus('intent-model')).toEqual({
      packId: 'intent-model',
      state: 'not-downloaded',
      isUpdateAvailable: false,
      downloadSizeBytes: 124_000_000,
    });
    await expect(assets.getFileUrl('intent-model', 'tokenizer.json')).rejects.toMatchObject({
      code: 'pack_not_downloaded',
      packId: 'intent-model',
    });

    const progress: number[] = [];
    await assets.ensureAvailable('intent-model', { onProgress: (f) => progress.push(f) });
    expect(progress.length).toBeGreaterThan(0);
    expect(progress.at(-1)).toBe(1);
    expect([...progress].sort((a, b) => a - b)).toEqual(progress);

    expect((await assets.getStatus('intent-model')).state).toBe('available');
    expect(await assets.getFileUrl('intent-model', 'nested/dir/file.bin')).toBe(
      'file:///packs/intent-model/nested/dir/file.bin',
    );
    await expect(assets.getFileUrl('intent-model', 'missing.bin')).rejects.toMatchObject({
      code: 'file_not_found',
    });
  });

  it('resolves at once for a pack that is already on the device, without progress', async () => {
    const progress: number[] = [];
    await client().ensureAvailable('ready', { onProgress: (f) => progress.push(f) });
    expect(progress).toEqual([]);
  });

  it('shares one download between concurrent callers, each with its own progress', async () => {
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
      assets.ensureAvailable('intent-model', { onProgress: (f) => a.push(f) }),
      assets.ensureAvailable('intent-model', { onProgress: (f) => b.push(f) }),
    ]);
    expect(starts).toBe(1);
    expect(a.at(-1)).toBe(1);
    expect(b.at(-1)).toBe(1);
  });

  it('keeps going when a progress callback throws', async () => {
    await expect(
      client().ensureAvailable('intent-model', {
        onProgress: () => {
          throw new Error('boom');
        },
      }),
    ).resolves.toBeUndefined();
  });

  it('maps download failures to coded errors and leaves the pack not downloaded', async () => {
    const assets = client();
    const error = await assets.ensureAvailable('broken').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AssetsError);
    expect(error).toMatchObject({ code: 'network', packId: 'broken', retryable: true });
    expect((await assets.getStatus('broken')).state).toBe('not-downloaded');
  });

  it('rejects unknown packs with pack_not_found', async () => {
    await expect(client().getStatus('nope')).rejects.toMatchObject({ code: 'pack_not_found' });
  });

  it('removes a pack', async () => {
    const assets = client();
    await assets.remove('ready');
    expect((await assets.getStatus('ready')).state).toBe('not-downloaded');
  });

  it('times out ensureAvailable when asked, with a coded error', async () => {
    const adapter = createMemoryAdapter({
      packs: { slow: { files: ['x'], downloadDurationMs: 1000 } },
    });
    await expect(
      createAssets({ adapter }).ensureAvailable('slow', { timeoutMs: 20 }),
    ).rejects.toMatchObject({ code: 'timeout', packId: 'slow' });
  });

  it('bounds quick calls with the default deadline instead of hanging', async () => {
    const never = new Promise<never>(() => {});
    const adapter: AssetsAdapter = {
      ...createMemoryAdapter({ packs }),
      getStatus: () => never,
    };
    await expect(createAssets({ adapter, timeoutMs: 20 }).getStatus('ready')).rejects.toMatchObject(
      {
        code: 'timeout',
      },
    );
  });
});

describe('input checks', () => {
  it.each(['', '1abc', 'a b', 'a/b', 'a.b', 'x'.repeat(65)])('rejects pack id %j', async (id) => {
    await expect(client().getStatus(id)).rejects.toMatchObject({ code: 'invalid_argument' });
  });

  it.each(['', '/abs', '../up', 'a/../b', 'a//b', './a', 'a\\b'])(
    'rejects path %j',
    async (path) => {
      await expect(client().getFileUrl('ready', path)).rejects.toMatchObject({
        code: 'invalid_argument',
      });
    },
  );

  it('rejects bad options at creation', () => {
    expect(() => createAssets({ adapter: createMemoryAdapter({ packs }), timeoutMs: 0 })).toThrow(
      AssetsError,
    );
  });
});

describe('errors', () => {
  it('parses native error prefixes anywhere in the message', () => {
    const error = toAssetsError(
      new Error('Swift error: [nitro-assets:pack_not_found] No pack "x"'),
      'x',
    );
    expect(error).toMatchObject({ code: 'pack_not_found', message: 'No pack "x"', packId: 'x' });
  });

  it('maps unknown codes and plain errors to unknown', () => {
    expect(toAssetsError(new Error('[nitro-assets:weird] hmm')).code).toBe('unknown');
    expect(toAssetsError('plain').code).toBe('unknown');
  });
});

describe('web adapter', () => {
  it('is unsupported and rejects every call with unsupported_platform', async () => {
    const assets = createAssets({ adapter: createWebAdapter() });
    expect(assets.isSupported).toBe(false);
    expect(assets.backend).toBe('none');
    await expect(assets.ensureAvailable('intent-model')).rejects.toMatchObject({
      code: 'unsupported_platform',
    });
  });
});
