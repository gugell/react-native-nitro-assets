import { spawnSync } from 'node:child_process';

/**
 * Nitrogen output is committed. Regenerate it and fail when anything changed: a spec edited
 * without `bun run specs` ships bindings that do not match the TypeScript API.
 */
const generated = 'packages/react-native-nitro-assets/nitrogen';

const specs = spawnSync('bun', ['run', 'specs'], { stdio: 'inherit' });
if (specs.status !== 0) process.exit(specs.status ?? 1);
const status = spawnSync('git', ['status', '--porcelain', '--', generated], { encoding: 'utf8' });
if (status.status !== 0) process.exit(1);
if (status.stdout.trim()) {
  console.error('Nitrogen output is stale. Run `bun run specs` and commit nitrogen/generated:');
  console.error(status.stdout);
  process.exit(1);
}
console.log('Nitrogen output is reproducible.');
