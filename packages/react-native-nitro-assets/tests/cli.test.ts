/// <reference types="node" />
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(packageRoot, 'bin/nitro-assets.mjs');
const workspaceModules = path.resolve(packageRoot, '../../node_modules');

const canPackage =
  process.platform === 'darwin' && spawnSync('xcrun', ['--find', 'ba-package']).status === 0;

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

/** A minimal Expo app using the config plugin, with `@expo/config` resolvable from its root. */
function app(pluginOptions: unknown) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nitro-assets-cli-'));
  roots.push(root);
  fs.symlinkSync(workspaceModules, path.join(root, 'node_modules'));
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"fixture","version":"1.0.0"}');
  fs.writeFileSync(
    path.join(root, 'app.json'),
    JSON.stringify({
      expo: {
        name: 'Fixture',
        slug: 'fixture',
        ios: { bundleIdentifier: 'com.example.fixture' },
        plugins: [['react-native-nitro-assets', pluginOptions]],
      },
    }),
  );
  return root;
}

function run(root: string, ...args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
}

function list(archive: string) {
  const result = spawnSync('aa', ['list', '-i', archive, '-v'], { encoding: 'utf8' });
  return result.stdout
    .split('\n')
    .filter((line) => /^[FL] /.test(line))
    .map((line) => line.split(' ').slice(0, 2).join(' '));
}

describe('nitro-assets package', () => {
  it('prints usage for --help', () => {
    const result = run(os.tmpdir(), '--help');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage: nitro-assets package');
  });

  it('fails with usage on an unknown command', () => {
    const result = run(os.tmpdir(), 'publish');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Unknown command "publish"');
  });

  it('requires ios.backgroundAssets', () => {
    const root = app({ packs: { model: './packs/model' } });
    const result = run(root, 'package');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('ios.backgroundAssets is not set');
  });

  it('rejects a pack that has no folder', () => {
    const root = app({ ios: { backgroundAssets: { packs: { model: 'essential' } } } });
    const result = run(root, 'package');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('"model" has no folder');
  });

  it.runIf(canPackage)(
    'packages each pack under <packId>/ with its policy, resolving symbolic links',
    () => {
      const root = app({
        packs: { model: './packs/model' },
        ios: { backgroundAssets: { packs: { model: 'essential' } } },
      });
      const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'nitro-assets-outside-'));
      roots.push(outside);
      fs.writeFileSync(path.join(outside, 'weights.bin'), 'weights');
      fs.mkdirSync(path.join(root, 'packs/model/nested'), { recursive: true });
      fs.writeFileSync(path.join(root, 'packs/model/nested/tokenizer.json'), '{}');
      fs.symlinkSync(path.join(outside, 'weights.bin'), path.join(root, 'packs/model/model.bin'));

      const result = run(root, 'package');
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
      const archive = path.join(root, 'asset-packs-out/model.aar');
      expect(list(archive).sort()).toEqual([
        'F PAT=Contents/model/model.bin',
        'F PAT=Contents/model/nested/tokenizer.json',
        'F PAT=Manifest.json',
      ]);

      const extracted = path.join(root, 'extracted');
      fs.mkdirSync(extracted);
      spawnSync('aa', ['extract', '-i', archive, '-d', extracted]);
      expect(fs.readFileSync(path.join(extracted, 'Contents/model/model.bin'), 'utf8')).toBe(
        'weights',
      );
      expect(JSON.parse(fs.readFileSync(path.join(extracted, 'Manifest.json'), 'utf8'))).toEqual({
        assetPackID: 'model',
        downloadPolicy: {
          essential: { installationEventTypes: ['firstInstallation', 'subsequentUpdate'] },
        },
        fileSelectors: [{ directory: 'model' }],
        platforms: ['iOS'],
      });
    },
  );
});
