/**
 * ChipScrollRow (KB-927 — Food 탭 Dishes 칩 줄에서 추출, Packaged 탭 판정·유형 칩 줄이 같이 쓴다).
 * 한 줄 가로 스크롤(줄바꿈 금지 — KB-909 Q-367) · 끝 여백 = 페이드 폭(끝까지 밀면 마지막 칩이 페이드 밖으로 완전히 나온다, KB-707)
 * · 오른쪽에 숨은 칩이 있을 때만 흰 페이드(터치 투과). 바깥 줄(정렬 버튼·자기 줄 규칙)은 호출측 몫.
 */
import * as React from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/** KB-707: 칩 줄 끝 페이드 폭 — 칩 줄 끝 여백도 이만큼 */
export const CHIP_FADE_W = 24;

/** KB-707: 끝 페이드("더 있다" 표시)는 아직 오른쪽에 숨은 칩이 있을 때만 — 끝까지 밀었거나 다 들어가면 숨김(마지막 칩을 덮지 않게) */
export function chipFadeShown(scrollX: number, contentW: number, viewW: number): boolean {
  return contentW - viewW - scrollX > 1;
}

/** KB-707: 가로 스크롤 줄 공용 — "오른쪽에 숨은 것이 있나"(끝 페이드 표시) + 바운스 끔. 칩 줄·홈 세그먼트 탭이 같이 쓴다.
 *  scrollProps를 ScrollView에 펼치고, more가 참일 때만 끝 페이드를 그린다. */
export function useMoreOnRight() {
  const m = React.useRef({ x: 0, content: 0, view: 0 });
  const [more, setMore] = React.useState(false);
  const update = () => setMore(chipFadeShown(m.current.x, m.current.content, m.current.view));
  const scrollProps = {
    scrollEventThrottle: 32,
    // 다 들어가는 언어에서 줄이 좌우로 튕기지 않게(iOS 기본 바운스 · Android 오버스크롤 글로우)
    alwaysBounceHorizontal: false,
    overScrollMode: 'never' as const,
    onScroll: (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      m.current.x = e.nativeEvent.contentOffset.x;
      update();
    },
    onContentSizeChange: (w: number) => {
      m.current.content = w;
      update();
    },
    onLayout: (e: { nativeEvent: { layout: { width: number } } }) => {
      m.current.view = e.nativeEvent.layout.width;
      update();
    },
  };
  return { more, scrollProps, metrics: m };
}

export function ChipScrollRow({ children, minHeight, style, scrollRef, keyboardShouldPersistTaps, scrollTestID, fadeTestID }: {
  children: React.ReactNode;
  /** 큰 글자에서 칩이 커진 만큼 줄도(고정 height면 라벨이 눌린다 — KB-903 T-101) */
  minHeight: number;
  /** 바깥 줄 안에서의 폭(전폭 / 정렬 버튼 옆 flex) */
  style?: StyleProp<ViewStyle>;
  scrollRef?: React.Ref<ScrollView>;
  /** 바깥 목록이 handled여도 안쪽 가로 줄의 첫 탭이 키보드 닫기에 쓰이지 않게(KB-901 T-017) */
  keyboardShouldPersistTaps?: 'handled';
  /** 안쪽 ScrollView testID(감싸는 부품 자체엔 testID 없음 — 기존 테스트가 첫 일치 노드 = 스크롤로 읽는다) */
  scrollTestID: string;
  fadeTestID: string;
}) {
  const line = useMoreOnRight();
  return (
    <View style={style}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        contentContainerStyle={[st.content, { minHeight }]}
        testID={scrollTestID}
        {...line.scrollProps}
      >
        {children}
      </ScrollView>
      {/* 우측 흰→투명 페이드 — 스크롤 가능함을 암시(터치 투과). KB-707: 오른쪽에 숨은 칩이 있을 때만 */}
      {line.more && (
        <LinearGradient
          colors={['rgba(255,255,255,0)', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={st.fade}
          pointerEvents="none"
          testID={fadeTestID}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  // 최소 높이 = 호출측 chipRowHeight(fontScale) 인라인 — KB-903(T-101)
  content: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 20, paddingRight: CHIP_FADE_W },
  fade: { position: 'absolute', right: 0, top: 0, bottom: 0, width: CHIP_FADE_W },
});
