import { AssetsError } from '../AssetsError.ts';

/**
 * Pack identifiers: a letter, then letters, digits, `-` or `_`, at most 64 characters. Play Asset
 * Delivery allows only letters, digits and `_`, so on Android `-` becomes `_`
 * (`intent-model` → `intent_model`).
 */
export const PACK_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

export function checkPackId(packId: unknown): asserts packId is string {
  if (typeof packId !== 'string' || !PACK_ID_PATTERN.test(packId)) {
    throw new AssetsError(
      'invalid_argument',
      `Invalid pack id ${JSON.stringify(packId)}: use a letter, then letters, digits, "-" or "_" (at most 64)`,
    );
  }
}

export function checkRelativePath(
  relativePath: unknown,
  packId: string,
): asserts relativePath is string {
  const fail = (why: string) =>
    new AssetsError('invalid_argument', `Invalid path ${JSON.stringify(relativePath)}: ${why}`, {
      packId,
    });
  if (typeof relativePath !== 'string' || relativePath.length === 0)
    throw fail('expected a non-empty string');
  if (relativePath.startsWith('/')) throw fail('must be relative to the pack root');
  if (relativePath.includes('\\')) throw fail('use "/" as the separator');
  if (relativePath.includes('\0')) throw fail('contains a NUL character');
  const segments = relativePath.split('/');
  if (segments.some((segment) => segment === '..' || segment === '.' || segment === ''))
    throw fail('must not contain empty, "." or ".." segments');
}

export function checkTimeout(name: string, value: number | undefined): void {
  if (value === undefined) return;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
    throw new AssetsError('invalid_argument', `${name} must be a positive number of milliseconds`);
}
