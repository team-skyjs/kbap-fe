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

export type StateTone = 'default' | 'err' | 'unable';

export function StateBlock({
  icon,
  title,
  body,
  tone = 'default',
  primary,
  secondary,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone?: StateTone;
  primary?: { label: string; icon?: React.ReactNode; onPress?: () => void };
  secondary?: { label: string; onPress?: () => void };
}) {
  return (
    <View style={styles.root}>
      <View style={[styles.ic, TONE_BG[tone]]}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {(primary || secondary) && (
        <View style={styles.btns}>
          {primary && (
            <Btn icon={primary.icon} onPress={primary.onPress}>
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
  ic: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.display, fontSize: 20, color: C.ink, textAlign: 'center' },
  body: { fontFamily: font.body, fontSize: 14, color: C.ink2, lineHeight: 21, textAlign: 'center' },
  btns: { width: '100%', gap: 9, marginTop: 6 },
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
  if (classifyQueryError(error) === 'offline') {
    return (
      <StateBlock
        icon={<IconWifiOff size={38} color={stateIconColor.default} />}
        title={t('states.offlineTitle')}
        body={t('states.offlineBody')}
        primary={{ label: t('common.retry'), icon: <IconRetry size={17} color="#fff" />, onPress: onRetry }}
      />
    );
  }
  return (
    <StateBlock
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
