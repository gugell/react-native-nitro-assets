import { NitroModules } from 'react-native-nitro-modules';
import type { AssetsAdapter } from '../AssetsAdapter.ts';
import { AssetsError } from '../AssetsError.ts';
import type { AssetPacks } from '../specs/AssetPacks.nitro.ts';

/**
 * The platform's asset-pack system through Nitro: Background Assets on iOS 26+, On-Demand
 * Resources below iOS 26, Play Asset Delivery on Android. Which one is used depends on the OS and
 * on what the Expo config plugin enabled; see {@linkcode AssetsAdapter.backend}.
 *
 * Without the native module (Expo Go, app not rebuilt) the adapter is unsupported and every call
 * rejects with `misconfigured`. The hybrid object is created on first use.
 */
export function createNativeAdapter(): AssetsAdapter {
  let root: AssetPacks | null | undefined;
  let loadError: unknown;
  const load = (): AssetPacks | null => {
    if (root !== undefined) return root;
    try {
      root = NitroModules.createHybridObject<AssetPacks>('AssetPacks');
    } catch (error) {
      loadError = error;
      root = null;
    }
    return root;
  };
  const native = (packId: string): AssetPacks => {
    const object = load();
    if (!object)
      throw new AssetsError(
        'misconfigured',
        'The native react-native-nitro-assets module is not linked (rebuild the app; Expo Go cannot load it)',
        { packId, cause: loadError },
      );
    return object;
  };
  return {
    name: 'native',
    get backend() {
      return load()?.backend ?? 'none';
    },
    get isSupported() {
      const backend = load()?.backend;
      return backend !== undefined && backend !== 'none';
    },
    getStatus: async (packId) => native(packId).getStatus(packId),
    ensureAvailable: async (packId, { requireLatestVersion, onProgress }) =>
      native(packId).ensureAvailable(packId, requireLatestVersion, onProgress),
    getFileUrl: async (packId, relativePath) => native(packId).getFileUrl(packId, relativePath),
    remove: async (packId) => native(packId).remove(packId),
  };
}
