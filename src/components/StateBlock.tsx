/**
 * StateBlock.tsx — 상태 공용: EmptyBlock(디자이너 빈 상태)·QueryErrorBlock(에러)·ScreenCenterFill.
 * P-359(KB-522): 구 목업 StateBlock(주황 원·제목·본문·CTA)은 폐기 — 빈 상태는 EmptyBlock 단일.
 * Tone tints the icon bubble. Buttons are optional; labels are i18n text.
 *
 * QueryErrorBlock (P-007/KB-174): React Query 에러 → J3(에러)/J4(오프라인)
 * 분기 렌더 한 곳 — 화면별 복붙 금지. false-empty(에러를 빈 상태로 위장) 제거의
 * 공용 출구다: isError면 반드시 이걸 렌더하고, 빈 상태는 성공+0건일 때만.
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Txt as Text } from '@/components/Txt';
import { color as C, font, riskTone } from '@/lib/theme';
import { Btn } from './Btn';
import Svg from 'react-native-svg';
import { D4CircleDashed } from './design4Assets';
import { RiskGlyph } from './RiskMark';
import { useSegments } from 'expo-router';
import { EVENTS, track } from '@/lib/analytics';

/**
 * P-214: 실패·빈 상태 계측 — **이 컴포넌트 한 곳**(전 화면 실패율). 화면 식별은
 * 라우트 **세그먼트 패턴**(`food/[id]` 형태 — 실제 id 미포함, PII 0)이라 호출처
 * 배선이 필요 없다. kind 미지정 시 tone에서 파생(err=error, 그 외 empty).
 */
function useScreenKey(): string {
  const segments = useSegments() as string[];
  return segments.join('/') || 'root';
}

/** P-287(최종본 4003:6689): 공용 빈 상태 — circle-dashed 24 + 16/400 중앙, 버튼 없음.
 *  Codex #47 5차: 계측 0 — 빈 섹션은 에러 표면이 아님(P-213 지표 오염 방지, error/offline만 발화). */
export function EmptyBlock({ label, testID = 'empty-block' }: { label: string; testID?: string }) {
  return (
    <View style={styles.emptyWrap} testID={testID}>
      <D4CircleDashed size={24} color="#000000" />
      <Text style={styles.emptyText}>{label}</Text>
    </View>
  );
}

/**
 * ScreenCenterFill (P-196) — 탭 상태 블록(오프라인/에러/빈)의 **화면 기준 정중앙**
 * 공용 기준(스캔탭 문법). 탭마다 헤더 포함 여부·스크롤 구조가 달라 fill 기준
 * 높이가 제각각이던 편차의 단일 해법: absoluteFill이라 헤더/스크롤 무관하게
 * 화면 전체 기준 센터. 탭 루트(View flex:1) 직속에서만 사용.
 */
export function ScreenCenterFill({ children }: { children: React.ReactNode }) {
  // Codex #89 P2: absoluteFill이 헤더 뒤로가기·탭의 터치를 삼키던 결함 — 래퍼는
  // box-none(자신은 히트 불가, 내부 블록만 auto). P-330 스윕 전 화면 공통 수리.
  return (
    <View style={[StyleSheet.absoluteFill, styles.screenCenter]} pointerEvents="box-none">
      {children}
    </View>
  );
}

/** Icon tint color for each tone (pass to the icon's color prop). */
const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 11, paddingHorizontal: 24, paddingVertical: 24, maxWidth: 320, alignSelf: 'center' },
  // P-184: 잔여 높이 정중앙 — flex(플렉스 부모)+flexGrow(스크롤 콘텐츠) 겸용
  fill: { flex: 1, flexGrow: 1, justifyContent: 'center' },
  ic: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.display, fontSize: 20, color: C.ink, textAlign: 'center' },
  body: { fontFamily: font.body, fontSize: 14, color: C.ink2, lineHeight: 21, textAlign: 'center' },
  btns: { width: '100%', gap: 9, marginTop: 6 },
  // P-196: 화면 기준 정중앙 — 4탭 공용(paddingHorizontal은 게이트 카드류 대비)
  screenCenter: { justifyContent: 'center', paddingHorizontal: 18 },
  // P-287: 빈 상태(4003:6689) — 335 중앙, circle-dashed + 16/400
  emptyWrap: { alignItems: 'center', gap: 8, maxWidth: 335, alignSelf: 'center', paddingVertical: 32, paddingHorizontal: 20 },
  emptyText: { fontSize: 16, fontWeight: '400', color: '#000000', textAlign: 'center' },
  // P-287: 에러 블록(4003:12563) — 세로 중앙 pad 40/32 gap 16
  errWrap: { flex: 1, flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 40, paddingHorizontal: 32, maxWidth: 360, alignSelf: 'center', width: '100%' }, // A-ER-01(제목→본문 6)
  errMark: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,113,52,0.10)', alignItems: 'center', justifyContent: 'center' },
  errTitle: { fontSize: 16, fontWeight: '600', color: C.ink, textAlign: 'center' },
  errBody: { fontSize: 14, fontWeight: '400', color: C.ink2, textAlign: 'center', lineHeight: 20 },
});

/**
 * JS-only 오프라인 판별 (P-007 — NetInfo 추가 = 리빌드라 회피): fetch 자체가
 * 죽으면 공용 클라이언트가 'NETWORK: ' 프리픽스 ApiError를 던진다 → offline(J4).
 * 서버가 응답한 4xx/5xx는 error(J3). 한계: 연결은 있으나 서버 DNS만 죽는 등
 * 일부 경우가 offline으로 묶인다 — 정밀 판별은 NetInfo 도입(리빌드) 때.
 */
export function classifyQueryError(e: unknown): 'offline' | 'error' {
  return /^NETWORK/.test((e as Error)?.message ?? '') ? 'offline' : 'error';
}

/** React Query 에러 표준 렌더 — J3(Try again[+Go back]) / J4(Retry). 탭 루트는 goBack 생략. */
export function QueryErrorBlock({
  error,
  onRetry,
  onGoBack,
}: {
  error: unknown;
  onRetry: () => void;
  onGoBack?: () => void;
}) {
  const { t } = useTranslation();
  const offline = classifyQueryError(error) === 'offline';
  const screen = useScreenKey();
  React.useEffect(() => {
    track(EVENTS.error_state_view, { screen, kind: offline ? 'offline' : 'error', action: 'view' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // P-287(최종본 4003:12563): 마크 36 원 primary 10% + '!' 글리프(RiskMark caution 계열 SVG —
  // 기호 텍스트 금지 P-040) · 제목 16/600 · 본문 14/400 2줄 · outline Retry 풀폭.
  // 아이콘 장식(IconRetry) 소멸. 오프라인도 같은 골격(카피만 현 offline 키).
  return (
    <View style={styles.errWrap} testID="query-error-block">
      <View style={styles.errMark}>
        {/* Codex #47 P2: RiskGlyph는 svg Path — Svg 루트 필수(22그리드) */}
        <Svg width={18} height={18} viewBox="0 0 22 22">
          <RiskGlyph state="caution" fill={C.primary} />
        </Svg>
      </View>
      <Text style={styles.errTitle}>{t(offline ? 'states.offlineTitle' : 'states.errorTitle')}</Text>
      {/* Codex #47 6차: 줄수 제한 제거 — ja/ru/th 카피 절단 방지(i18n 가변 길이 헌법), 높이 hug */}
      <Text style={styles.errBody}>{t(offline ? 'states.offlineBody' : 'states.errorBody')}</Text>
      <View style={{ alignSelf: 'stretch', gap: 9, marginTop: 10 }}>{/* A-ER-02: 본문→버튼 16(gap 6 + 10) */}
        <Btn
          variant="ghost"
          onPress={() => {
            track(EVENTS.error_state_view, { screen, kind: offline ? 'offline' : 'error', action: 'retry' });
            onRetry();
          }}
        >
          {t('common.retry')}
        </Btn>
        {onGoBack && (
          <Btn variant="ghost" onPress={onGoBack}>
            {t('common.goBack')}
          </Btn>
        )}
      </View>
    </View>
  );
}

export default EmptyBlock;
