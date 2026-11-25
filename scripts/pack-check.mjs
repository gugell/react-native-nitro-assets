import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Packs the library as npm publishes it, installs the tarball into a fresh npm project and proves
 * the result works: files present, nothing private or unresolved in the manifest, the portable
 * entry points import in Node without Nitro, the Expo config plugin loads, and the nitro-assets
 * command runs from the installed package.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = join(root, 'packages/react-native-nitro-assets');
const temporary = mkdtempSync(join(tmpdir(), 'nitro-assets-pack-'));

function run(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed`);
  return result;
}

try {
  const { version } = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
  run('bun', ['run', 'build'], packageRoot);
  run('npm', ['pack', '--pack-destination', temporary], packageRoot);
  const tarball = join(temporary, `react-native-nitro-assets-${version}.tgz`);

  const consumer = join(temporary, 'consumer');
  mkdirSync(consumer);
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({ name: 'packed-consumer', private: true, version: '1.0.0', type: 'module' }),
  );
  // Peers (react-native, nitro, expo) are the app's: not installed here.
  run(
    'npm',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--legacy-peer-deps', tarball],
    consumer,
  );
  const installed = join(consumer, 'node_modules/react-native-nitro-assets');
  const manifest = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'));
  assert.equal(manifest.version, version);
  assert.equal(manifest.private, undefined);
  assert.equal(
    manifest.repository.url,
    'git+https://github.com/gugell/react-native-nitro-assets.git',
  );
  for (const section of ['dependencies', 'peerDependencies', 'devDependencies'])
    for (const spec of Object.values(manifest[section] ?? {}))
      assert.doesNotMatch(spec, /^(catalog|workspace|link|file):/, `Unresolved ${section} spec`);

  const required = [
    'README.md',
    'LICENSE',
    'lib/index.js',
    'lib/index.d.ts',
    'lib/native.js',
    'lib/native.web.js',
    'lib/memory.js',
    'src/index.ts',
    'src/specs/AssetPacks.nitro.ts',
    'NitroAssets.podspec',
    'nitro.json',
    'react-native.config.js',
    'app.plugin.cjs',
    'plugin/withNitroAssets.cjs',
    'plugin/props.d.cts',
    'bin/nitro-assets.mjs',
    'downloader/package.json',
    'downloader/target.config.js',
    'downloader/Info.plist',
    'downloader/DownloaderExtension.swift',
    'ios/HybridAssetPacks.swift',
    'ios/Backends/BackgroundAssetsBackend.swift',
    'ios/Backends/OnDemandResourcesBackend.swift',
    'android/build.gradle',
    'android/src/main/java/com/margelo/nitro/assets/HybridAssetPacks.kt',
    'nitrogen/generated/ios/NitroAssets+autolinking.rb',
    'nitrogen/generated/android/NitroAssets+autolinking.gradle',
  ];
  for (const file of required)
    assert.doesNotThrow(() => readFileSync(join(installed, file)), `Missing ${file}`);
  for (const unwanted of [
    'tests',
    'node_modules',
    'tsconfig.json',
    'vitest.config.ts',
    'package.tgz',
  ])
    assert(!readdirSync(installed).includes(unwanted), `Unexpected published ${unwanted}`);

  const entry = (path) => pathToFileURL(join(installed, path)).href;
  const core = await import(entry('lib/index.js'));
  const memory = await import(entry('lib/memory.js'));
  const web = await import(entry('lib/native.web.js'));
  const assets = core.createAssets({
    adapter: memory.createMemoryAdapter({
      packs: { model: { files: ['model.pte'] } },
      baseUrl: 'file:///packs/',
    }),
  });
  await assets.ensureAvailable('model');
  assert.equal(await assets.getFileUrl('model', 'model.pte'), 'file:///packs/model/model.pte');
  assert.equal(web.createNativeAdapter().isSupported, false);

  // Expo is the app's peer too: link the workspace copy so the config plugin can load.
  symlinkSync(join(root, 'node_modules/expo'), join(consumer, 'node_modules/expo'), 'dir');
  const require = createRequire(join(consumer, 'index.cjs'));
  assert.equal(typeof require('react-native-nitro-assets/app.plugin'), 'function');
  assert.equal(typeof require('react-native-nitro-assets/plugin'), 'function');
  assert.equal(
    require('react-native-nitro-assets/downloader/package.json').name,
    'react-native-nitro-assets-downloader',
  );

  const help = run(join(consumer, 'node_modules/.bin/nitro-assets'), ['--help'], consumer, {
    stdio: 'pipe',
    encoding: 'utf8',
  });
  assert.match(help.stdout, /Usage: nitro-assets package/);

  console.log(`Packed npm consumer verified: react-native-nitro-assets@${version}`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
