/**
 * MaintenanceOverlay — 점검 화면(KB-1026, 11/22 AWS → 홈서버 이전). 루트 _layout 마운트.
 * 원격 스위치(lib/maintenance)가 true일 때만 전체 화면, false가 되면 자동으로 닫힌다. 버튼 없음·dismiss 불가.
 * 버전 게이트 blocked가 우선(그땐 그리지 않음).
 *
 * 디자인(예진 11/22 참고 화면 방향): 항상 어두운 단색 배경(라이트·다크 무관) · 세로 중앙보다 약간 위에 원형 그래픽 하나 =
 * K-Bap 앱 아이콘(브랜드 정본 kbap-design/brand/icon-1024.png와 바이트 동일한 assets/images/icon.png) ·
 * 그 아래 굵은 흰 제목 · 흐린 회색 본문, 가운데 정렬. 색은 전부 theme 토큰(ink = gray-1000 배경, surface = 흰 제목, inkMute = 본문).
 * 상태 표시줄 글자는 밝게. 긴 번역(ru·es·th)에서 제목이 3줄이 돼도 잘리지 않게 줄 수 제한 없음 + 스크롤.
 */
import * as React from 'react';
import { BackHandler, Image, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { Txt as Text } from '@/components/Txt';
import { color as C, font } from '@/lib/theme';
import { startMaintenance, useMaintenance } from '@/lib/maintenance';
import { useVersionGate } from '@/lib/versionGate';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- 로컬 번들 이미지(Metro 자산)
const APP_ICON = require('../../assets/images/icon.png') as number;

export function MaintenanceOverlay() {
  const on = useMaintenance();
  const gate = useVersionGate();
  const { t } = useTranslation();
  React.useEffect(() => startMaintenance(), []);
  const show = on && gate.mode !== 'blocked';
  // 안드 하드웨어 백 차단 — 점검 화면은 dismiss 불가(스위치가 풀리면 자동으로 닫힌다)
  React.useEffect(() => {
    if (!show) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [show]);
  if (!show) return null;
  return (
    <View style={styles.cover} testID="maintenance-gate">
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} bounces={false} showsVerticalScrollIndicator={false}>
        <Image source={APP_ICON} style={styles.logo} accessibilityIgnoresInvertColors testID="maintenance-logo" />
        <Text style={styles.title} accessibilityRole="header">{t('maintenance.title')}</Text>
        <Text style={styles.body}>{t('maintenance.body')}</Text>
      </ScrollView>
    </View>
  );
}

const LOGO = 112;
const styles = StyleSheet.create({
  cover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 1000, backgroundColor: C.ink },
  // 세로 중앙보다 약간 위: 아래 여백을 더 크게(위 1 : 아래 1.4)
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, paddingTop: 48, paddingBottom: 120 },
  logo: { width: LOGO, height: LOGO, borderRadius: LOGO / 2, marginBottom: 32 },
  title: { fontFamily: font.display, fontSize: 28, lineHeight: 36, color: C.surface, letterSpacing: -0.4, textAlign: 'center' },
  body: { marginTop: 14, fontFamily: font.body, fontSize: 16, lineHeight: 24, color: C.inkMute, textAlign: 'center' },
});
