import * as React from 'react';
import { AppState, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '@/components/KeyboardDismissBar';
import { Btn } from '@/components/Btn';
import { Txt } from '@/components/Txt';
import { color as C } from '@/lib/theme';
import { state, runner, prepare, loadLocal, identify, begin, stop, exportCapture, currentDevice, importFiles } from './native';
import type { Sample } from './protocol';

export default function CollectorScreen() {
  const { t } = useTranslation();
  const [host, setHost] = React.useState('127.0.0.1');
  const [model, setModel] = React.useState('');
  const [kind, setKind] = React.useState<'physical' | 'simulator'>('physical');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState(0);
  const [rows, setRows] = React.useState(() => [...runner.rows.values()]);
  const [ready, setReady] = React.useState(false);
  const guard = React.useRef(false);
  const mounted = React.useRef(true);
  const refresh = React.useCallback(() => {
    if (!mounted.current) return;
    setRows([...runner.rows.values()]);
    setBusy(runner.busy || state.downloading);
  }, []);
  React.useEffect(() => {
    mounted.current = true;
    void loadLocal().then(() => {
      if (!mounted.current) return;
      setReady(!!state.manifest);
      setProgress(state.manifest?.samples.length ?? 0);
      const device = currentDevice();
      if (device) { setModel(device.model); setKind(device.kind); }
      refresh();
    })
      .catch(() => { if (mounted.current) setMessage('ocrCollector.error'); });
    const sub = AppState.addEventListener('change', status => {
      if (status !== 'active') stop('BACKGROUND');
      else refresh();
    });
    return () => { mounted.current = false; sub.remove(); stop(); };
  }, [refresh]);
  const action = async (work: () => Promise<void>, success = 'ocrCollector.saved') => {
    if (guard.current || runner.busy || state.downloading) return;
    guard.current = true; setBusy(true);
    try { await work(); if (mounted.current) setMessage(success); }
    catch { if (mounted.current) setMessage('ocrCollector.error'); }
    finally { guard.current = false; refresh(); }
  };
  const run = (samples: Sample[]) => action(async () => {
    begin(await identify(model, kind));
    await runner.run(samples, refresh);
  });
  return <SafeAreaView style={styles.root}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Txt style={styles.title}>{t('ocrCollector.title')}</Txt>
      <Txt>{t('ocrCollector.intro')}</Txt>
      {message && <Txt accessibilityLiveRegion="polite">{t(message)}</Txt>}
      <Input testID="ocr-collector-host" style={styles.input} value={host} onChangeText={setHost} editable={!busy}
        autoCapitalize="none" autoCorrect={false} accessibilityLabel={t('ocrCollector.host')} placeholder={t('ocrCollector.host')} />
      <Btn testID="ocr-collector-prepare" disabled={busy} onPress={() => { void action(async () => {
        await prepare(host, n => { if (mounted.current) setProgress(n); }); setReady(true);
      }, 'ocrCollector.prepared'); }}>{t('ocrCollector.download')}</Btn>
      <Btn testID="ocr-collector-import" disabled={busy} variant="ghost" onPress={() => { void action(async () => {
        await importFiles(n => { if (mounted.current) setProgress(n); }); setReady(true);
      }, 'ocrCollector.prepared'); }}>{t('ocrCollector.import')}</Btn>
      <Txt>{t('ocrCollector.progress', { done: progress, total: 32 })}</Txt>
      <Input testID="ocr-collector-model" style={styles.input} value={model} onChangeText={setModel} editable={!busy && rows.length === 0}
        accessibilityLabel={t('ocrCollector.model')} placeholder={t('ocrCollector.model')} />
      <Btn testID="ocr-collector-kind" disabled={busy || rows.length > 0} variant="ghost"
        onPress={() => setKind(kind === 'physical' ? 'simulator' : 'physical')}>{t(`ocrCollector.${kind}`)}</Btn>
      <Btn testID="ocr-collector-run" disabled={busy || !ready || !model.trim() || rows.length === 32} onPress={() => {
        void run((state.manifest?.samples ?? []).filter(s => !runner.rows.has(s.sample_id)));
      }}>{t('ocrCollector.run')}</Btn>
      <Btn testID="ocr-collector-cancel" disabled={!busy} variant="ghost" onPress={() => {
        stop(); setMessage('ocrCollector.stopping');
      }}>{t('ocrCollector.cancel')}</Btn>
      <Txt>{t('ocrCollector.progress', { done: rows.length, total: 32 })}</Txt>
      <Btn testID="ocr-collector-export" disabled={busy || rows.length !== 32}
        onPress={() => { void action(exportCapture); }}>{t('ocrCollector.export')}</Btn>
      {rows.map(row => <View key={row.sample_id} style={styles.row}>
        <Txt>{t(row.status === 'ok' ? 'ocrCollector.ok' : 'ocrCollector.failed', {
          id: row.sample_id, count: row.lines.length, ms: Math.round(row.elapsed_ms), code: row.error_code ?? '',
        })}</Txt>
        {row.status === 'error' && <Btn testID="ocr-collector-retry" variant="ghost" disabled={busy || !ready}
          onPress={() => { const s = state.manifest?.samples.find(x => x.sample_id === row.sample_id); if (s) void run([s]); }}>
          {t('ocrCollector.retry')}
        </Btn>}
      </View>)}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.card },
  content: { padding: 20, gap: 16 },
  title: { fontSize: 22 },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 12, color: C.ink },
  row: { gap: 8 },
});
