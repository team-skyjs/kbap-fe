/**
 * SubHeader — static back+title header for NON-scrolling sub-screens
 * (e.g. owner-confirmation card). Scrolling sub-screens use
 * <StickyHeader mode="back" /> instead so the header is scroll-aware (§6).
 */
import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color as C, font, shadow } from '@/lib/theme';
import { IconArrowLeft } from './icons';
import { PressScale } from './PressScale';

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
  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.row}>
        <PressScale style={styles.back} onPress={onBack} hitSlop={8}>
          <IconArrowLeft size={20} color={C.ink} />
        </PressScale>
        {/* 흐름에서 빼서 행 중앙에 고정 — 좌우 슬롯 폭과 무관해진다. pointerEvents 없이 두면
            타이틀이 back/trailing 위를 덮어 탭을 먹는다(StickyHeader와 같은 처리). */}
        <View style={styles.titleWrap} pointerEvents="none">
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
        </View>
        {trailing ?? <View style={{ width: 38 }} />}
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
   *  54 = back(38) + 이전 gap(16). **수정 전 흐름 배치에서 타이틀 박스가 놓이던 바로 그 자리**라,
   *  `trailing`을 안 쓰는 28개 화면의 타이틀 폭·위치가 그대로다(subHeaderTitleCenter403이 잠금). */
  titleWrap: { position: 'absolute', left: 54, right: 54, top: 0, bottom: 0, justifyContent: 'center' },
  title: { fontFamily: font.bodySemi, fontSize: 18, color: C.ink, textAlign: 'center' },
});

export default SubHeader;
