/**
 * SheetShell — 콘텐츠형 바텀시트 골격(P-409에서 장소 태그 시트의 로컬 셸을 공용화 — 새 컴포넌트 아님).
 * Modal fade + 스크림(0.4) + 하단 시트(흰 · 상단 라운드 16 · 패딩 20/39 · gap 24). 높이 = 콘텐츠 hug.
 * 닫기 = 스크림 탭 · 안드 백(onRequestClose) — **X 없음**(P-310).
 * 넘침(Codex #193 P2): 시트 최대 높이 = 창 높이 − 상단 안전영역. 내용은 ScrollView(flexGrow 0)라 **들어맞으면
 * hug 그대로**(장소 태그 시트 렌더 무변), 넘칠 때만 스크롤된다 — 큰 글자·작은 기기·긴 장소명에서 상단이 잘려
 * 닿을 수 없게 되는 것 방지.
 *
 * 사용처: 장소 태그 시트(placeMap — KB-431 치수) · 주문 상세 공유 카드 시트(KB-636).
 * 후속: community/tagSheets.tsx의 SheetShell 복사본(라운드 26 · 스크림 0.45)과 합치기 — 스타일이 달라 범위 밖.
 */
import * as React from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shadow } from '@/lib/theme';
import { useBottomInset } from '@/lib/useBottomInset';

export function SheetShell({
  children,
  onClose,
  overlay,
}: {
  children: React.ReactNode;
  onClose: () => void;
  /** 모달 **루트**에 얹는 노드(시트 박스 밖) — 예: 모달 컨텍스트 TopToastHost(P-370). 시트 안에 두면
   *  절대배치 기준이 시트 박스가 되어 토스트가 카드 위에 겹친다. */
  overlay?: React.ReactNode;
}) {
  const bottom = useBottomInset();
  const { height } = useWindowDimensions();
  const { top } = useSafeAreaInsets();
  const pad = Platform.OS === 'android' ? { paddingBottom: 18 + bottom } : null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, pad, { maxHeight: height - top }]} onPress={() => {}} testID="sheet-shell">
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} bounces={false} testID="sheet-shell-scroll">
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
      {overlay}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  // KB-431: 시트 흰 radius 16 상단, pad 20/39, gap 24
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 20, paddingTop: 39, paddingBottom: 39, gap: 24, ...shadow.sh2 },
  // 내용 hug(flexGrow 0) — 최대 높이에 닿을 때만 줄어들어 스크롤. 자식 간 gap 24는 여기서(시트 gap과 같은 값)
  scroll: { flexGrow: 0 },
  content: { gap: 24 },
});
