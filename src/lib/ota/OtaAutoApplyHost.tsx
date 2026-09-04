/**
 * OtaAutoApplyHost (KB-420/P-204) — 루트 레이아웃에 1회 마운트되는 OTA 자동
 * 적용 배선 + prod 배너.
 *
 * - 트리거: 마운트 + AppState active 복귀(스로틀은 otaCheck 코어).
 * - __DEV__ 또는 Updates.isEnabled=false(Metro) = 전 구간 no-op.
 * - 적용 판정은 otaPolicy 한 곳 — 비-prod 즉시 reload / prod는 안전 순간에만,
 *   아니면 상단 비차단 배너(탭 = 수동 적용). 라우트·뮤테이션 변화 시 재평가.
 * - expo-updates는 지연 require(정적 import 금지 관례 — pushAdapter와 동일 계열).
 */
import * as React from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { useIsMutating } from '@tanstack/react-query';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Txt as Text } from '@/components/Txt';
import { color as C, font, radius, shadow } from '@/lib/theme';
import { isProdChannel } from '@/lib/flags';
import { checkAndFetchOta, type OtaUpdatesModule } from './otaCheck';
import { isBlockedRoute, otaApplyDecision } from './otaPolicy';

function updatesModule(): OtaUpdatesModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-updates') as OtaUpdatesModule;
  } catch {
    return null; // 웹/모듈 부재 — no-op
  }
}

function applyNow(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Updates = require('expo-updates') as { reloadAsync(): Promise<void> };
    void Updates.reloadAsync().catch((e: Error) => console.log('[ota] reload failed:', e?.message));
  } catch {
    /* 모듈 부재 — 무시 */
  }
}

export function OtaAutoApplyHost() {
  const pathname = usePathname();
  const mutating = useIsMutating();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [ready, setReady] = React.useState(false);
  const stateRef = React.useRef({ lastCheckAt: 0 });

  React.useEffect(() => {
    const check = () => {
      if (__DEV__) return; // Metro 개발 중 = no-op(코어의 isEnabled 게이트와 이중)
      const u = updatesModule();
      if (!u) return;
      void checkAndFetchOta(u, stateRef.current, Date.now()).then((r) => {
        if (r === 'ready') setReady(true);
      });
    };
    check(); // 콜드 스타트 1회
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') check(); // 포그라운드 복귀 — 스로틀은 코어가 판정
    });
    return () => sub.remove();
  }, []);

  // 적용 재평가 — fetch 완료·라우트 변경·뮤테이션 종료마다
  const prod = isProdChannel();
  React.useEffect(() => {
    if (!ready) return;
    if (otaApplyDecision({ prod, pathname, mutating }) === 'reload') applyNow();
  }, [ready, prod, pathname, mutating]);

  // 배너 = prod 대기 상태에서만 · 제외 화면(스캔 등)엔 미노출(비차단이어도 오버레이 금지)
  if (!ready || !prod || isBlockedRoute(pathname)) return null;
  return (
    <View style={[styles.wrap, { top: insets.top + 6 }]} pointerEvents="box-none" testID="ota-banner">
      <Pressable style={styles.pill} onPress={applyNow} testID="ota-apply" hitSlop={8}>
        <Text style={styles.text} numberOfLines={2}>
          {t('ota.ready')}
        </Text>
        <Text style={styles.cta}>{t('ota.apply')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '100%',
    ...shadow.sh2,
  },
  text: { fontFamily: font.body, fontSize: 13, color: C.ink, flexShrink: 1 },
  cta: { fontFamily: font.bodyBold, fontSize: 13, color: C.primary },
});
