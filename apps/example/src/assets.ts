import { createAssets, type AssetsClient } from 'react-native-nitro-assets';
import { createMemoryAdapter } from 'react-native-nitro-assets/memory';
import { createNativeAdapter } from 'react-native-nitro-assets/native';

/** The pack this example ships (apps/example/asset-packs/demo-pack). */
export const DEMO_PACK = 'demo-pack';
export const DEMO_FILE = 'models/labels.json';

export type AdapterChoice = 'native' | 'memory';

/** The native backend, or a simulated store that works everywhere (simulator, web, Expo Go). */
export function createClient(choice: AdapterChoice): AssetsClient {
  if (choice === 'memory') {
    return createAssets({
      adapter: createMemoryAdapter({
        packs: {
          [DEMO_PACK]: {
            files: [DEMO_FILE, 'README.txt'],
            downloadSizeBytes: 2_048,
            downloadDurationMs: 2_000,
          },
        },
      }),
    });
  }
  return createAssets({ adapter: createNativeAdapter() });
}
