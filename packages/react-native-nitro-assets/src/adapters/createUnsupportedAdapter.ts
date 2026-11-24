import type { AssetsAdapter } from '../AssetsAdapter.ts';
import { AssetsError } from '../AssetsError.ts';

/** An adapter for where no asset-pack system exists: `isSupported` false, every call rejects. */
export function createUnsupportedAdapter(name: string, platform: string): AssetsAdapter {
  const reject = (packId: string) =>
    Promise.reject(
      new AssetsError('unsupported_platform', `Asset packs are not available on ${platform}`, {
        packId,
      }),
    );
  return {
    name,
    backend: 'none',
    isSupported: false,
    getStatus: reject,
    ensureAvailable: reject,
    getFileUrl: reject,
    remove: reject,
  };
}
