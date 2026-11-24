import type { AssetsAdapter } from '../AssetsAdapter.ts';
import { createUnsupportedAdapter } from './createUnsupportedAdapter.ts';

/** The web has no asset-pack system: this adapter reports `unsupported_platform`. */
export function createNativeAdapter(): AssetsAdapter {
  return createUnsupportedAdapter('native', 'the web');
}
