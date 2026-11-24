/**
 * AffiliateCard (KB-1031) — Amazon 제휴 링크의 유일한 표면. 자리 4곳이 모양(variant)만 바꿔 쓴다.
 * - 추적 ID가 비어 있으면 **null**(래퍼·여백 0) — 호출처는 조건 없이 놓아도 된다.
 * - 고지 문구를 늘 같이 그린다(제휴 UI가 있는 화면 = 고지가 있는 화면).
 * - 누르면 OS가 연다(아마존 앱·기본 브라우저). 앱 안 기능은 누르지 않아도 그대로다 — 이 컴포넌트는 아무것도 막지 않는다.
 * - 글자는 한글 어절 단위로 줄바꿈(iOS hangul-word — Q-434: 고지 문구가 낱말 중간에서 끊겼다).
 * - 가격·로고 0(글자 "Amazon"만). 판정 띠 위·안에 두지 말 것(호출처 책임 — affiliate1031 테스트가 순서를 잠근다).
 */
import * as React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Btn } from '@/components/Btn';
import { IconArrowRight } from '@/components/icons';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { affiliateEnabled, affiliateItemAt, openAmazon, type AffiliatePlacement } from '@/lib/affiliate';
import { EVENTS, track } from '@/lib/analytics';
import { color as C, font, radius } from '@/lib/theme';

/** button = 상세의 구매 버튼 · link = 한 줄 링크 · row = 화면 폭 카드 · cell = 2열 그리드 한 칸 */
export type AffiliateVariant = 'button' | 'link' | 'row' | 'cell';

type Props = { placement: AffiliatePlacement; variant: AffiliateVariant; query: string; title: string; style?: StyleProp<ViewStyle>; testID: string };

export function AffiliateCard({ placement, variant, query, title, style, testID }: Props) {
  const { t } = useTranslation();
  const [on] = React.useState(affiliateEnabled); // 추적 ID = 빌드 상수 — 한 번만 읽는다(렌더 중 바깥 값 읽기 0)
  React.useEffect(() => {
    // ponytail: 노출 = 마운트 1회(FlatList 칸은 화면 근처에서 마운트). 정밀한 50% 노출 판정이 필요해지면 홈 useImpressionRef로
    if (on) track(EVENTS.affiliate_impression, { placement, query });
  }, [on, placement, query]);
  if (!on) return null;
  const open = () => { void openAmazon(placement, query); }; // 실패는 openStoreLink가 잡아 토스트(거부가 새지 않는다)
  const disclosure = <Text style={st.disclosure} lineBreakStrategyIOS="hangul-word" testID={`${testID}-disclosure`}>{t('affiliate.disclosure')}</Text>;

  if (variant === 'button') {
    return (
      <View style={[st.stack, style]} testID={testID}>
        <Btn variant="ghost" onPress={open} iconEnd={<IconArrowRight size={16} color={C.ink} />} testID={`${testID}-open`}>{title}</Btn>
        {disclosure}
      </View>
    );
  }
  if (variant === 'link') {
    return (
      <View style={[st.stack, style]} testID={testID}>
        <Pressable style={st.link} onPress={open} accessibilityRole="link" testID={`${testID}-open`}>
          <Text style={st.linkText} lineBreakStrategyIOS="hangul-word">{title}</Text>
          <IconArrowRight size={16} color={C.primaryText} />
        </Pressable>
        {disclosure}
      </View>
    );
  }
  return (
    <Pressable style={[variant === 'cell' ? st.cell : st.row, style]} onPress={open} accessibilityRole="link" testID={testID}>
      <View style={st.body}>
        <Text style={st.title} lineBreakStrategyIOS="hangul-word">{title}</Text>
        {disclosure}
      </View>
      <IconArrowRight size={18} color={C.ink2} />
    </Pressable>
  );
}

/** 고정 검색어 목록의 n번째로 그리는 카드 — 홈·목록·스캔 대기 */
export function AffiliateItemCard({ n, ...rest }: Omit<Props, 'query' | 'title'> & { n: number }) {
  const { t } = useTranslation();
  const item = affiliateItemAt(n);
  return <AffiliateCard {...rest} query={item.query} title={t('affiliate.shop', { item: t(`affiliate.items.${item.key}`) })} />;
}

const st = StyleSheet.create({
  stack: { gap: 8 },
  disclosure: { fontFamily: font.body, fontSize: 12, lineHeight: 17, color: C.inkInfo },
  link: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkText: { flexShrink: 1, fontFamily: font.bodySemi, fontSize: 14, lineHeight: 20, color: C.primaryText },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, borderWidth: 1, borderColor: C.line, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.card },
  cell: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderColor: C.line, borderRadius: radius.md, padding: 12, backgroundColor: C.card },
  body: { flex: 1, minWidth: 0, gap: 6 },
  title: { fontFamily: font.bodyBold, fontSize: 15, lineHeight: 21, color: C.ink },
});
