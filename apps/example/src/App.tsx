import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { Button, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AssetsError, type AssetPackStatus } from 'react-native-nitro-assets';
import { createClient, DEMO_FILE, DEMO_PACK, type AdapterChoice } from './assets';

function describe(error: unknown): string {
  if (error instanceof AssetsError) return `${error.code}: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}

export function App() {
  const [choice, setChoice] = useState<AdapterChoice>(Platform.OS === 'web' ? 'memory' : 'native');
  const assets = useMemo(() => createClient(choice), [choice]);
  const [status, setStatus] = useState<AssetPackStatus | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const append = useCallback((line: string) => setLog((lines) => [line, ...lines].slice(0, 20)), []);

  const run = useCallback(
    (label: string, body: () => Promise<void>) => async () => {
      try {
        await body();
        append(`✓ ${label}`);
      } catch (error) {
        append(`✗ ${label} — ${describe(error)}`);
      }
    },
    [append],
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>react-native-nitro-assets</Text>
      <Text>
        Adapter: {assets.adapter} · backend: {assets.backend} · supported: {String(assets.isSupported)}
      </Text>
      <View style={styles.row}>
        <Button title="Native" onPress={() => setChoice('native')} disabled={choice === 'native'} />
        <Button title="Memory" onPress={() => setChoice('memory')} disabled={choice === 'memory'} />
      </View>

      <Text style={styles.section}>Pack “{DEMO_PACK}”</Text>
      <Text>State: {status ? `${status.state}${status.isUpdateAvailable ? ' (update available)' : ''}` : '—'}</Text>
      <Text>Size: {status?.downloadSizeBytes !== undefined ? `${status.downloadSizeBytes} bytes` : '—'}</Text>
      <Text>Progress: {progress === null ? '—' : `${Math.round(progress * 100)} %`}</Text>
      <Text selectable>File: {fileUrl ?? '—'}</Text>

      <View style={styles.buttons}>
        <Button
          title="1. Get status"
          onPress={run('getStatus', async () => setStatus(await assets.getStatus(DEMO_PACK)))}
        />
        <Button
          title="2. Ensure available"
          onPress={run('ensureAvailable', async () => {
            setProgress(0);
            await assets.ensureAvailable(DEMO_PACK, { onProgress: setProgress });
            setStatus(await assets.getStatus(DEMO_PACK));
          })}
        />
        <Button
          title="3. Get file URL"
          onPress={run('getFileUrl', async () => setFileUrl(await assets.getFileUrl(DEMO_PACK, DEMO_FILE)))}
        />
        <Button
          title="4. Remove"
          onPress={run('remove', async () => {
            await assets.remove(DEMO_PACK);
            setFileUrl(null);
            setProgress(null);
            setStatus(await assets.getStatus(DEMO_PACK));
          })}
        />
      </View>

      <Text style={styles.section}>Log</Text>
      {log.map((line, index) => (
        <Text key={`${index}-${line}`} style={styles.log}>
          {line}
        </Text>
      ))}
      <StatusBar style="auto" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 64, gap: 8 },
  title: { fontSize: 22, fontWeight: '600' },
  section: { fontSize: 17, fontWeight: '600', marginTop: 16 },
  row: { flexDirection: 'row', gap: 12 },
  buttons: { gap: 4, marginTop: 8 },
  log: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), fontSize: 12 },
});
