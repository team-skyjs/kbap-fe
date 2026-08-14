/**
 * StateBlock — shared empty / error / offline / unable state (mockup Screen J).
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
import { IconAlertTri, IconRetry, IconWifiOff } from './icons';
import { useSegments } from 'expo-router';
import { EVENTS, track } from '@/lib/analytics';

export type StateTone = 'default' | 'err' | 'unable';

/**
 * P-214: 실패·빈 상태 계측 — **이 컴포넌트 한 곳**(전 화면 실패율). 화면 식별은
 * 라우트 **세그먼트 패턴**(`food/[id]` 형태 — 실제 id 미포함, PII 0)이라 호출처
 * 배선이 필요 없다. kind 미지정 시 tone에서 파생(err=error, 그 외 empty).
 */
export type StateKind = 'error' | 'offline' | 'empty';
function useScreenKey(): string {
  const segments = useSegments() as string[];
  return segments.join('/') || 'root';
}

export function StateBlock({
  icon,
  title,
  body,
  tone = 'default',
  primary,
  secondary,
  fill = false,
  kind,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone?: StateTone;
  primary?: { label: string; icon?: React.ReactNode; onPress?: () => void };
  secondary?: { label: string; onPress?: () => void };
  /** P-184: 화면 잔여 높이 세로 정중앙을 블록이 소유 — 화면별 수동 배치 금지(재발 방지 구조). */
  fill?: boolean;
  /** P-214: 계측 종류 — 미지정이면 tone 파생(QueryErrorBlock만 offline/error 명시). */
  kind?: StateKind;
}) {
  const screen = useScreenKey();
  const resolvedKind: StateKind = kind ?? (tone === 'err' ? 'error' : 'empty');
  React.useEffect(() => {
    track(EVENTS.error_state_view, { screen, kind: resolvedKind, action: 'view' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onPrimary = primary?.onPress
    ? () => {
        // 재시도 = 실패 상태에서만 의미(빈 상태의 primary는 유도 CTA라 제외)
        if (resolvedKind !== 'empty') track(EVENTS.error_state_view, { screen, kind: resolvedKind, action: 'retry' });
        primary.onPress?.();
      }
    : undefined;
  return (
    <View style={[styles.root, fill && styles.fill]}>
      <View style={[styles.ic, TONE_BG[tone]]}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {(primary || secondary) && (
        <View style={styles.btns}>
          {primary && (
            <Btn icon={primary.icon} onPress={onPrimary}>
              {primary.label}
            </Btn>
          )}
          {secondary && (
            <Btn variant="ghost" onPress={secondary.onPress}>
              {secondary.label}
            </Btn>
          )}
        </View>
      )}
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
  return <View style={[StyleSheet.absoluteFill, styles.screenCenter]}>{children}</View>;
}

/** Icon tint color for each tone (pass to the icon's color prop). */
export const stateIconColor: Record<StateTone, string> = {
  default: C.primary,
  err: riskTone.danger.fg,
  unable: C.riskUnable,
};

const TONE_BG: Record<StateTone, { backgroundColor: string }> = {
  default: { backgroundColor: 'rgba(226,88,12,0.08)' },
  err: { backgroundColor: riskTone.danger.bg },
  unable: { backgroundColor: '#eef0f2' },
};

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
  // P-184: 에러/오프라인은 항상 전체 표면 상태 — 세로 정중앙 자체 소유(수동 배치 금지)
  if (classifyQueryError(error) === 'offline') {
    return (
      <StateBlock
        fill
        kind="offline"
        icon={<IconWifiOff size={38} color={stateIconColor.default} />}
        title={t('states.offlineTitle')}
        body={t('states.offlineBody')}
        primary={{ label: t('common.retry'), icon: <IconRetry size={17} color="#fff" />, onPress: onRetry }}
      />
    );
  }
  return (
    <StateBlock
      fill
      tone="err"
      icon={<IconAlertTri size={38} color={stateIconColor.err} />}
      title={t('states.errorTitle')}
      body={t('states.errorBody')}
      primary={{ label: t('common.tryAgain'), icon: <IconRetry size={17} color="#fff" />, onPress: onRetry }}
      secondary={onGoBack ? { label: t('common.goBack'), onPress: onGoBack } : undefined}
    />
  );
}

export default StateBlock;
