/**
 * ScanCoachMark (P-134 시안 Ob4Coach) — 첫 스캔 결과 1회성 코치마크.
 * 스크림+카드·돋보기 글리프·4행(RiskMark 24 + 이름 + 한 줄 설명)·Got it·캡션.
 * 설명 카피 = 위험도 정본 의미(BE 판정 기준 — 맵기 언급 금지, 시안 카피 이식 금지).
 * 노출: AsyncStorage 1회 플래그 · 재열람 = 스캔 결과/상세의 RiskMark 탭(마크 데모 대체).
 */
import * as React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Txt as Text } from '@/components/Txt';
import { color as C, font, radius, shadow, type RiskState } from '@/lib/theme';
import { Btn, IconSearch, RiskMark } from '@/components';

const SEEN_KEY = 'kbap.scanCoach.v1';

export async function shouldShowCoachMark(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SEEN_KEY)) == null;
  } catch {
    return false; // 스토리지 오류 — 코치마크로 흐름 방해 금지
  }
}

export function markCoachSeen(): void {
  void AsyncStorage.setItem(SEEN_KEY, '1').catch(() => {});
}

const ROWS: { risk: RiskState; nameKey: string; descKey: string }[] = [
  { risk: 'safe', nameKey: 'risk.safe', descKey: 'coach.safe' },
  { risk: 'caution', nameKey: 'risk.caution', descKey: 'coach.caution' },
  { risk: 'danger', nameKey: 'risk.danger', descKey: 'coach.danger' },
  { risk: 'unable', nameKey: 'risk.unable', descKey: 'coach.unable' },
];

export function ScanCoachMark({
  open,
  onClose,
  onDismiss,
  t,
}: {
  open: boolean;
  onClose: () => void;
  /** iOS 전용 — 네이티브 dismiss **완료 후** 발화(P-267 Codex P1: 후속 모달
   *  present는 이 시점 이후여야 presentation race가 없다). 안드는 미발화. */
  onDismiss?: () => void;
  t: (k: string) => string;
}) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} onDismiss={onDismiss}>
      <View style={styles.scrim}>
        <View style={styles.card} testID="scan-coach">
          <View style={styles.ic}>
            <IconSearch size={22} color={C.primary} />
          </View>
          <Text style={styles.title}>{t('coach.title')}</Text>
          <View style={styles.rows}>
            {ROWS.map((r) => (
              <View key={r.risk} style={styles.row} testID={`coach-${r.risk}`}>
                <RiskMark state={r.risk} size={24} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rowName}>{t(r.nameKey)}</Text>
                  <Text style={styles.rowDesc}>{t(r.descKey)}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={{ alignSelf: 'stretch', marginTop: 4 }}>
            <Btn onPress={onClose}>{t('common.gotIt')}</Btn>
          </View>
          <Text style={styles.caption}>{t('coach.caption')}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 26 },
  card: { alignSelf: 'stretch', backgroundColor: C.card, borderRadius: radius.lg, padding: 22, alignItems: 'center', gap: 10, ...shadow.shPop },
  ic: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(226,88,12,0.1)', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.display, fontSize: 18, color: C.ink, textAlign: 'center' },
  rows: { alignSelf: 'stretch', gap: 11, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  rowName: { fontFamily: font.bodyBold, fontSize: 13.5, color: C.ink },
  rowDesc: { fontFamily: font.body, fontSize: 12, lineHeight: 17, color: C.ink2 },
  caption: { fontFamily: font.body, fontSize: 11, color: C.ink3, textAlign: 'center' },
});
