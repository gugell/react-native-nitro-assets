#!/usr/bin/env node
// nitro-assets: builds Apple-hosted Background Assets packs (.aar) from an Expo app's config.
//
//   npx nitro-assets package [packId ...] [--project-root <dir>] [--out-dir <dir>]
//
// Each pack's folder (`packs[packId].path` in the config plugin options) is packaged under
// `<packId>/`, so `getFileUrl(packId, 'a/b.bin')` finds `<packId>/a/b.bin` in the shared
// Background Assets namespace. The download policy comes from `ios.backgroundAssets.packs`.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { resolveProps } = require('../plugin/props.cjs');

const PLUGIN = 'react-native-nitro-assets';
const USAGE = `Usage: nitro-assets package [packId ...] [--project-root <dir>] [--out-dir <dir>]

Builds one Apple-hosted asset pack archive (<packId>.aar) per pack listed in the
react-native-nitro-assets config plugin's ios.backgroundAssets.packs, from the folder
in packs[packId].path. Needs macOS with Xcode 26 (xcrun ba-package).

Options:
  --project-root <dir>  The Expo app (default: the current directory)
  --out-dir <dir>       Where to write the archives (default: <project-root>/asset-packs-out)
  -h, --help            Show this help`;

/** Apple's manifest `downloadPolicy` for each config-plugin policy. */
const DOWNLOAD_POLICIES = {
  essential: { essential: { installationEventTypes: ['firstInstallation', 'subsequentUpdate'] } },
  prefetch: { prefetch: { installationEventTypes: ['firstInstallation', 'subsequentUpdate'] } },
  'on-demand': { onDemand: {} },
};

class UsageError extends Error {}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  if (command === undefined || command === '-h' || command === '--help') return { help: true };
  if (command !== 'package') throw new UsageError(`Unknown command "${command}"`);
  const options = { projectRoot: process.cwd(), outDir: undefined, packIds: [] };
  for (let index = 0; index < rest.length; index++) {
    const argument = rest[index];
    const value = () => {
      const next = rest[++index];
      if (next === undefined || next.startsWith('-'))
        throw new UsageError(`${argument} needs a value`);
      return next;
    };
    if (argument === '-h' || argument === '--help') return { help: true };
    else if (argument === '--project-root') options.projectRoot = path.resolve(value());
    else if (argument === '--out-dir') options.outDir = path.resolve(value());
    else if (argument.startsWith('-')) throw new UsageError(`Unknown option "${argument}"`);
    else options.packIds.push(argument);
  }
  if (options.outDir === undefined)
    options.outDir = path.join(options.projectRoot, 'asset-packs-out');
  return options;
}

/** The app's Expo config, read the way `expo prebuild` reads it (app.json, app.config.*). */
function readExpoConfig(projectRoot) {
  let getConfig;
  try {
    ({ getConfig } = createRequire(path.join(projectRoot, 'package.json'))('@expo/config'));
  } catch {
    throw new UsageError(
      `Cannot load @expo/config from ${projectRoot}: is it an Expo app with its dependencies installed?`,
    );
  }
  // Plugins are listed, not run: running them is prebuild's job.
  return getConfig(projectRoot, { skipSDKVersionRequirement: true }).exp;
}

function pluginOptions(exp) {
  for (const entry of exp.plugins ?? []) {
    const [name, props] = Array.isArray(entry) ? entry : [entry, undefined];
    if (name === PLUGIN || name === `${PLUGIN}/app.plugin` || name === `${PLUGIN}/app.plugin.cjs`)
      return props ?? {};
  }
  throw new UsageError(`The app config does not use the ${PLUGIN} config plugin`);
}

/**
 * Copies a folder with every symbolic link replaced by what it points to. ba-package archives
 * links as links, which would ship a pack whose files point at the build machine.
 */
function copyResolvingLinks(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    const source = path.join(from, name);
    const target = path.join(to, name);
    const stats = fs.statSync(source); // follows links; throws on a broken one
    if (stats.isDirectory()) copyResolvingLinks(fs.realpathSync(source), target);
    else if (stats.isFile()) fs.copyFileSync(fs.realpathSync(source), target);
    else throw new UsageError(`${source} is neither a file nor a folder`);
  }
}

function packagePack({ projectRoot, outDir, packId, source, policy }) {
  const sourceDir = path.resolve(projectRoot, source);
  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory())
    throw new UsageError(`packs["${packId}"].path: ${sourceDir} is not a directory`);
  if (fs.readdirSync(sourceDir).length === 0)
    throw new UsageError(`packs["${packId}"].path: ${sourceDir} is empty`);

  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'nitro-assets-'));
  try {
    // The copy puts the files under "<packId>/", the layout the native module reads them from.
    copyResolvingLinks(sourceDir, path.join(stage, packId));
    const manifest = {
      assetPackID: packId,
      downloadPolicy: DOWNLOAD_POLICIES[policy],
      fileSelectors: [{ directory: packId }],
      platforms: ['iOS'],
    };
    fs.writeFileSync(path.join(stage, 'Manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    fs.mkdirSync(outDir, { recursive: true });
    const output = path.join(outDir, `${packId}.aar`);
    fs.rmSync(output, { force: true });
    const result = spawnSync(
      'xcrun',
      ['ba-package', 'package', 'Manifest.json', '--output-path', output, '--quiet'],
      {
        cwd: stage,
        encoding: 'utf8',
      },
    );
    if (result.error)
      throw new UsageError(
        `Cannot run xcrun ba-package (macOS with Xcode 26 is required): ${result.error.message}`,
      );
    if (result.status !== 0)
      throw new Error(
        `xcrun ba-package failed for "${packId}":\n${result.stderr || result.stdout}`,
      );
    return output;
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

function formatSize(bytes) {
  return bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${(bytes / 1e3).toFixed(1)} kB`;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(USAGE);
    return;
  }
  const exp = readExpoConfig(options.projectRoot);
  const props = resolveProps(pluginOptions(exp), exp.ios);
  const backgroundAssets = props.ios.backgroundAssets;
  if (!backgroundAssets)
    throw new UsageError('ios.backgroundAssets is not set in the config plugin options');

  const declared = Object.keys(backgroundAssets.packs);
  const packIds = options.packIds.length > 0 ? options.packIds : declared;
  if (packIds.length === 0)
    throw new UsageError(
      'ios.backgroundAssets.packs is empty: name the packs and their download policies',
    );
  for (const packId of packIds) {
    if (!declared.includes(packId))
      throw new UsageError(`"${packId}" is not in ios.backgroundAssets.packs`);
    if (!props.packs[packId])
      throw new UsageError(`"${packId}" has no folder: set packs["${packId}"].path`);
  }

  for (const packId of packIds) {
    const policy = backgroundAssets.packs[packId];
    const output = packagePack({
      projectRoot: options.projectRoot,
      outDir: options.outDir,
      packId,
      source: props.packs[packId].path,
      policy,
    });
    console.log(
      `${packId} (${policy}): ${path.relative(process.cwd(), output)}, ${formatSize(fs.statSync(output).size)}`,
    );
  }
  console.log(`
Upload to App Store Connect (the app's Apple ID is in App Information):
  xcrun altool --upload-asset-pack <file.aar> --apple-id <app Apple ID> --api-key <key id> --api-issuer <issuer id>
Serve to a development build instead:
  xcrun ba-serve <file.aar> ... --host <this Mac's address>`);
}

try {
  main();
} catch (error) {
  console.error(`nitro-assets: ${error.message}`);
  if (error instanceof UsageError) console.error(`\n${USAGE}`);
  process.exitCode = 1;
}
