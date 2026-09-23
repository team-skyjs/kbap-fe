/**
 * SubHeader — static back+title header for NON-scrolling sub-screens
 * (e.g. owner-confirmation card). Scrolling sub-screens use
 * <StickyHeader mode="back" /> instead so the header is scroll-aware (§6).
 */
import * as React from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color as C, font, shadow } from '@/lib/theme';
import { IconArrowLeft } from './icons';
import { PressScale } from './PressScale';

/** back 버튼 폭 = `trailing` 부재 시 자리표시자 폭. 둘이 같아야 기존 화면이 안 바뀐다. */
const BACK_W = 38;
/** 슬롯과 타이틀 사이 최소 간격(수정 전 row의 `gap`과 같은 값). */
const SIDE_GAP = 16;
/** 대칭 예약을 포기하는 기준 — 타이틀에 이만큼도 안 남으면 중앙 정렬보다 **가독성**을 택한다.
 *  18pt 세미볼드로 짧은 제목 하나가 들어가는 폭. 하드 클램프가 아니라 **배치 모드 선택값**이다. */
const MIN_TITLE_W = 96;

export function SubHeader({
  title,
  onBack,
  trailing,
}: {
  title: string;
  onBack?: () => void;
  trailing?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [trailingW, setTrailingW] = React.useState(BACK_W);
  const onTrailingLayout = React.useCallback((e: LayoutChangeEvent) => {
    // ⚠️ 값을 안정시키는 건 **반올림**이다 — 서브픽셀 폭(120.4 → 120.2)이 그대로 들어오면
    // 인셋이 레이아웃마다 달라진다. 아래 동등성 비교는 그 위의 보수적 장치일 뿐이다
    // (숫자 state는 React가 같은 값이면 알아서 bail out 하므로 이것만으로는 부족하다).
    const w = Math.round(e.nativeEvent.layout.width);
    setTrailingW((prev) => (prev === w ? prev : w));
  }, []);
  const [rowW, setRowW] = React.useState(0);
  // 행 폭은 **임계값 비교에만** 쓰여서 서브픽셀이 결과를 안 바꾼다 — trailing 쪽과 달리
  // 반올림하지 않는다(뮤테이션으로 확인: 반올림을 빼도 어떤 유닛도 안 깨진다 = 하는 일이 없다).
  const onRowLayout = React.useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setRowW((prev) => (prev === w ? prev : w));
  }, []);

  /** 양옆에 **같은 폭**을 예약하면 중앙 정렬 + 타이틀이 trailing 밑으로 못 들어간다.
   *  `trailing` 부재 시 자리표시자가 BACK_W라 `38 + 16 = 54` — 기존과 완전히 같은 값이다. */
  const reserve = Math.max(BACK_W, trailingW) + SIDE_GAP;
  /** ⚠️ 대칭 예약은 **넓은 trailing의 비용을 두 배**로 문다(Codex #181 2R): 320pt 화면(내부 행
   *  288)에서 일본어 `マイお問い合わせ`가 120pt면 타이틀에 16pt만 남아 사실상 사라진다.
   *  1.3× 글자 크기에선 더 심하다.
   *
   *  그래서 **남는 폭을 보고 모드를 고른다**: 대칭으로 두고도 타이틀이 쓸 만하면 대칭(중앙 정렬),
   *  아니면 **비대칭**으로 떨어진다 — 좌 `back+gap` / 우 `trailing+gap`. 비대칭은 중앙에서
   *  벗어나지만 **겹치지 않고 타이틀 폭을 최대로** 준다(= 수정 전 `flex:1`이 하던 그 동작).
   *  겹침은 어느 모드에서도 허용하지 않고, 포기하는 건 **중앙 정렬**뿐이다.
   *
   *  `trailing`이 없으면 trailingW = BACK_W라 두 모드가 **같은 값(54/54)**으로 수렴한다 —
   *  28개 화면은 어느 쪽으로 가도 안 바뀐다. */
  const centered = rowW === 0 || rowW - reserve * 2 >= MIN_TITLE_W;
  const leftInset = centered ? reserve : BACK_W + SIDE_GAP;
  const rightInset = centered ? reserve : trailingW + SIDE_GAP;
  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.row} onLayout={onRowLayout}>
        <PressScale style={styles.back} onPress={onBack} hitSlop={8}>
          <IconArrowLeft size={20} color={C.ink} />
        </PressScale>
        {/* 흐름에서 빼서 행 중앙에 고정 — 좌우 슬롯 폭과 무관해진다. pointerEvents 없이 두면
            타이틀이 back/trailing 위를 덮어 탭을 먹는다(StickyHeader와 같은 처리). */}
        <View style={[styles.titleWrap, { left: leftInset, right: rightInset }]} pointerEvents="none">
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
        </View>
        {/* 래퍼의 폭 = 우측 슬롯의 실제 폭. `trailing`은 임의 노드라 onLayout을 꽂을 수 없다. */}
        <View onLayout={onTrailingLayout}>{trailing ?? <View style={{ width: BACK_W }} />}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // KB-429(AppBar 4123:3608): h56 · pad 16 · 흰 배경 · 하단선 없음 · 타이틀 18/600 중앙
  root: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  /** 패딩 없는 내부 행 — `titleWrap`의 left/right가 **이 행 기준**이 되어, 바깥 패딩을
   *  더해야 하는지 따질 필요가 없다(StickyHeader와 같은 구조). */
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** P-403 ①(KB-586): 타이틀을 **절대 위치로 행 중앙에** 고정한다.
   *
   *  이전에는 `flex:1 + textAlign:'center'`에, back(38)을 상쇄하는 우측 자리표시자가
   *  **`trailing`이 없을 때만** 들어갔다. `trailing`은 텍스트 링크(Save·My feedback)라 폭이
   *  38이 아니고 로케일마다 다르다 → 타이틀 박스가 `(38 - trailing폭)/2`만큼 밀렸다.
   *  자리표시자를 38로 고정하는 방식은 못 쓴다(링크 글자가 뭉개진다).
   *
   *  인셋은 **양쪽 모두 `max(BACK_W, trailing 실측폭) + SIDE_GAP`**이다. 고정값(54)으로 두면
   *  중앙 정렬은 되지만 타이틀 박스가 **넓은 trailing 밑까지 뻗어** 두 글자가 겹친다
   *  (Codex #181 P2 — 스페인어 `Editar perfil` × `Guardar cambios`가 실례). 이전 `flex:1`은
   *  실제 trailing 폭만큼 줄어들어 겹치진 않았으니, 고정값은 **중앙 이탈을 겹침과 맞바꾸는**
   *  셈이었다. 큰 쪽을 양옆에 같이 예약하면 둘 다 성립한다.
   *
   *  ⚠️ 순수 flexbox로는 안 된다 — 양쪽에 `flex:1`을 주면 폭은 같아지지만, RN은 웹과 달리
   *  `minWidth: auto`가 없어 **내용이 슬롯을 넘쳐도 밀어내지 못한다**(넓은 trailing이 그대로
   *  타이틀 위로 넘어온다). 그래서 실측한다.
   *
   *  `trailing`이 없으면 자리표시자가 BACK_W라 `38 + 16 = 54` — **수정 전 흐름 배치에서 타이틀
   *  박스가 놓이던 바로 그 자리**다. 28개 화면이 그대로인 이유(subHeaderTitleCenter403이 잠금). */
  titleWrap: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center' },
  title: { fontFamily: font.bodySemi, fontSize: 18, color: C.ink, textAlign: 'center' },
});

export default SubHeader;
