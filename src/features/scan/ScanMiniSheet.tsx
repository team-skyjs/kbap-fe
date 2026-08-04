/**
 * ScanMiniSheet (P-125/KB-240) — 사진 뷰 하단 상주 미니 바텀시트 (목업 .sheet).
 *
 * 그립 + 행(번호 칩 16pt 원형 #eee7dd · 음식명 · 우측 위험도 텍스트). 캡슐 탭 →
 * 해당 행 스크롤+하이라이트(#fdf0e6 + primary 반투명 아웃라인 — 목업 .hl).
 * 그립 위/아래 드래그(릴리즈 판정) 또는 탭 = 확장/축소 — 확장 시 **전 항목**
 * (photoOnly 등 마커 없는 항목 포함 — 안전 게이트: 리스트에서 절대 숨김 금지,
 * 번호 없는 항목은 "–" 칩). PanResponder(JS 스레드)만 — 워클릿 0.
 */
import * as React from 'react';
import { LayoutAnimation, PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { color as C, font } from '@/lib/theme';
import type { ResultDish } from '@/lib/scan/segmentMenu';
import type { NumberedDish } from './capsuleMarker';

const ROW_H = 40;
const COLLAPSED_ROWS = 2.5; // 잘린 행이 스크롤 힌트

/** 목업 .risk 팔레트 — 시트(밝은 배경)용 진한 변형. unable은 잉크 회색. */
const RISK_TEXT = { safe: '#2f8f5b', caution: '#a06a00', danger: '#a02418', unable: C.ink3 } as const;

export function ScanMiniSheet({
  numbered,
  extras,
  highlightId,
  riskLabel,
  onRowPress,
  bottomOffset,
  initiallyExpanded = false,
}: {
  /** 번호 보유(마커와 1:1) — assignScanNumbers 순서 그대로 */
  numbered: NumberedDish[];
  /** 마커 없는 전 항목 잔여(photoOnly 등) — 확장 시 말미에 "–" 칩으로 */
  extras: ResultDish[];
  highlightId: number | null;
  riskLabel: (risk: ResultDish['risk']) => string;
  onRowPress: (dish: ResultDish) => void;
  bottomOffset: number;
  /** 테스트/딥링크용 초기 확장 상태 */
  initiallyExpanded?: boolean;
}) {
  const [expanded, setExpanded] = React.useState(initiallyExpanded);
  const scrollRef = React.useRef<ScrollView>(null);

  // 그립 — 릴리즈 시 방향 판정(위=확장·아래=축소), 무이동 탭=토글. 1:1 추종 없음.
  const toggleTo = (next: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(180, 'easeInEaseOut', 'opacity'));
    setExpanded(next);
  };
  const pan = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderRelease: (_e, g) => {
        if (g.dy < -16) toggleTo(true);
        else if (g.dy > 16) toggleTo(false);
        else toggleTo(!expandedRef.current); // 탭 토글
      },
      onPanResponderTerminationRequest: () => true,
    }),
  ).current;
  const expandedRef = React.useRef(expanded);
  expandedRef.current = expanded;

  // 캡슐 탭 → 해당 행으로 스크롤 (번호 순 고정 행 높이라 index×ROW_H)
  React.useEffect(() => {
    if (highlightId == null) return;
    const idx = numbered.findIndex((d) => d.itemId === highlightId);
    if (idx >= 0) scrollRef.current?.scrollTo({ y: idx * ROW_H, animated: true });
  }, [highlightId, numbered]);

  const listH = expanded ? ROW_H * 9 : ROW_H * COLLAPSED_ROWS;
  const rows: (NumberedDish | (ResultDish & { no?: undefined }))[] = expanded ? [...numbered, ...extras] : numbered;

  return (
    <View style={[styles.sheet, { bottom: bottomOffset }]} testID="scan-mini-sheet">
      <View {...pan.panHandlers} style={styles.gripArea} testID="sheet-grip">
        <View style={styles.grip} />
      </View>
      <ScrollView ref={scrollRef} style={{ height: listH }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
        {rows.map((d) => {
          const hl = d.itemId === highlightId;
          return (
            <Pressable
              key={d.itemId}
              style={[styles.row, hl && styles.rowHl]}
              onPress={() => onRowPress(d)}
              testID={`sheet-row-${d.itemId}`}
            >
              <View style={styles.no}>
                <Text style={styles.noText}>{d.no ?? '–'}</Text>
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {d.displayName}
              </Text>
              <Text style={[styles.risk, { color: RISK_TEXT[d.risk] }]}>{riskLabel(d.risk)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 10,
    paddingBottom: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -5 },
    elevation: 10,
  },
  gripArea: { paddingVertical: 7, alignItems: 'center' },
  grip: { width: 32, height: 4, borderRadius: 2, backgroundColor: '#d8d0c6' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, height: ROW_H, paddingHorizontal: 6, borderRadius: 10 },
  rowHl: { backgroundColor: '#fdf0e6', borderWidth: 2, borderColor: 'rgba(226,88,12,0.5)' }, // 목업 .hl
  no: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#eee7dd', alignItems: 'center', justifyContent: 'center' },
  noText: { fontFamily: font.bodyBlack, fontSize: 9.5, color: '#7C6B5E', fontVariant: ['tabular-nums'] },
  name: { flex: 1, fontFamily: font.bodyBold, fontSize: 13, color: C.ink },
  risk: { fontFamily: font.bodyBlack, fontSize: 11.5 },
});
