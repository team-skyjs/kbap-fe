/**
 * 지도 선택(KB-863, Figma D-29 Map links v2 B — iPhone 12371:48515 · Android 12371:48599) — "Open in maps" + Google Maps / Kakao Map / NAVER Map + Cancel.
 * - iOS = 네이티브 액션 시트(ActionSheetIOS): 제목 "Open in maps" · 부제 = 장소명 · 지도 이름 **검정**(tintColor) · Cancel **빨강**(cancelButtonTintColor, 따로 떨어진 자리 그대로)
 * - Android = 앱 목록 대화상자(Alert 버튼 3개 제한) — 제목 · 세 항목(검정) · 오른쪽 아래 Cancel(빨강)
 * 예진 결정: 시안의 주황 지도 이름·검정 Cancel을 뒤집는다(이름 검정 · Cancel 빨강). 빨강 = 앱 destructive 토큰(위험도 빨강과 구분 — ActionSheet 규칙).
 */
import * as React from 'react';
import { ActionSheetIOS, StyleSheet, View } from 'react-native';
import { Modal } from '@/lib/engagement/occlusionSurfaces';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { DESTRUCTIVE } from '@/components/ActionSheet';
import { color as C, font, radius } from '@/lib/theme';
import { MAP_PROVIDERS, type MapProvider } from '@/lib/curation/mapLinks';

type TFn = (k: string, o?: Record<string, unknown>) => string;
const LABEL_KEY: Record<MapProvider, string> = { google: 'curation.mapGoogle', kakao: 'curation.mapKakao', naver: 'curation.mapNaver' };

/** iOS 시트 옵션(색 규칙 포함) — 테스트가 그대로 잠근다 */
export function iosMapSheetOptions(t: TFn, placeName: string) {
  return {
    title: t('curation.openInMaps'),
    message: placeName,
    options: [...MAP_PROVIDERS.map((p) => t(LABEL_KEY[p])), t('common.cancel')],
    cancelButtonIndex: MAP_PROVIDERS.length,
    tintColor: C.ink, // 지도 이름 = 검정
    cancelButtonTintColor: DESTRUCTIVE, // Cancel = 빨강
  };
}

/** iOS: 네이티브 시트를 띄우고 고른 지도를 돌려준다(Cancel = 호출 없음) */
export function showIosMapSheet(t: TFn, placeName: string, onPick: (p: MapProvider) => void) {
  ActionSheetIOS.showActionSheetWithOptions(iosMapSheetOptions(t, placeName), (i) => {
    const p = MAP_PROVIDERS[i];
    if (p) onPick(p);
  });
}

/** Android: 앱 목록 대화상자 */
export function MapChoiceDialog({ open, t, onPick, onClose }: { open: boolean; t: TFn; onPick: (p: MapProvider) => void; onClose: () => void }) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* Codex #334: 바깥·대화상자 래퍼는 접근성 요소가 아니다 — TalkBack이 세 지도·Cancel을 하나씩 잡게(래퍼가 묶으면 활성화 = 닫힘) */}
      <Pressable style={st.scrim} onPress={onClose} accessible={false} testID="map-choice-scrim" /* 바깥 탭 = 닫기(실제 동작이라 계측 대상 — noTrack은 빈 인터셉터 전용, R7) */>
        <Pressable style={st.dialog} onPress={() => {}} noTrack accessible={false} testID="map-choice-dialog">
          <Text style={st.title} accessibilityRole="header">{t('curation.openInMaps')}</Text>
          <View style={st.items}>
            {MAP_PROVIDERS.map((p) => (
              <Pressable key={p} style={st.item} onPress={() => onPick(p)} accessibilityRole="button" testID={`map-choice-${p}`}>
                <Text style={st.itemText}>{t(LABEL_KEY[p])}</Text>
              </Pressable>
            ))}
          </View>
          <View style={st.actions}>
            <Pressable style={st.cancel} onPress={onClose} accessibilityRole="button" testID="map-choice-cancel">
              <Text style={st.cancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// 시안 E(12371:48599) 구조 — 바깥 24 · 안쪽 24 · 제목 → 목록 → 오른쪽 아래 Cancel. 실제 모양은 앱 소유 대화상자(OS 테마 아님)
const st = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', justifyContent: 'center', paddingHorizontal: 24 },
  dialog: { backgroundColor: C.card, borderRadius: radius.xl, paddingTop: 24, paddingBottom: 12, paddingHorizontal: 24 },
  title: { fontFamily: font.bodyBold, fontSize: 20, lineHeight: 27, color: C.ink, marginBottom: 12 },
  items: { marginHorizontal: -24 },
  item: { minHeight: 52, justifyContent: 'center', paddingHorizontal: 24 },
  itemText: { fontFamily: font.body, fontSize: 16, lineHeight: 22, color: C.ink }, // 지도 이름 = 검정
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  cancel: { minHeight: 44, minWidth: 64, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: font.bodySemi, fontSize: 16, lineHeight: 22, color: DESTRUCTIVE }, // Cancel = 빨강
});
