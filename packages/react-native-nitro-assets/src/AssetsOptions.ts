import type { AssetsAdapter } from './AssetsAdapter.ts';

/**
 * Options for {@linkcode createAssets}.
 */
export interface AssetsOptions {
  /**
   * The backend: `createNativeAdapter()` from `react-native-nitro-assets/native`,
   * `createMemoryAdapter()` from `react-native-nitro-assets/memory`, or your own
   * {@linkcode AssetsAdapter}.
   */
  adapter: AssetsAdapter;
  /**
   * Deadline in milliseconds for the quick calls (`getStatus`, `getFileUrl`, `remove`). A call
   * that takes longer rejects with `timeout`. `ensureAvailable` has its own `timeoutMs`.
   * @default 30000
   */
  timeoutMs?: number;
}
