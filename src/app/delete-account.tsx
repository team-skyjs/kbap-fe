/**
 * Delete account confirm (mockup Screen I2) — FR-032. Spells out that sensitive
 * data is deleted immediately while reviews are kept but anonymized. Requires an
 * explicit acknowledgement before the destructive action.
 *
 * LIVE (KB-67): confirming PATCHes /auth/withdraw, clears the BE session and
 * Firebase sign-in, then routes to /login. (리뷰 익명화 등 데이터 처리는 BE 몫.)
 *
 * KB-162 (경로 A — 심사 요건): 애플 가입 회원은 탈퇴 확정 전에 Apple 재인증
 * 게이트를 통과해야 한다 — 시트 재호출 → 본인 대조 → 토큰 revoke 성공 시에만
 * 탈퇴 진행. 취소/타계정/실패 = 탈퇴 중단 + 안내 (revoke 없는 탈퇴 금지).
 * 구글 회원·웹은 기존 흐름 무변 (provider 판별: appleRevoke.currentIsAppleUser).
 */
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useRouter, type Href } from 'expo-router';
import { FLAGS } from '@/lib/flags';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius } from '@/lib/theme';
import { SubHeader, Btn, RiskMark, IconCheck, IconTrash } from '@/components';

/** Apple 재인증 게이트 카드 상태 — null=닫힘, prompt=안내+시트 진입, 나머지=중단 사유. */
type AppleGateState = null | 'prompt' | 'cancelled' | 'mismatch' | 'failed';

const GATE_MSG: Record<Exclude<AppleGateState, null>, string> = {
  prompt: 'profile.delete.appleGateBody',
  cancelled: 'profile.delete.appleCancelled',
  mismatch: 'profile.delete.appleMismatch',
  failed: 'profile.delete.appleFailed',
};

export default function DeleteAccount() {
  const router = useRouter();
  const { t } = useTranslation();
  const [agreed, setAgreed] = useState(false);
  const [gate, setGate] = useState<AppleGateState>(null);
  const [revoking, setRevoking] = useState(false);

  // KB-67: 탈퇴 실호출 → 세션 정리 → 재로그인 화면
  async function doWithdraw() {
    // lazy require — 파일 내 session/appleRevoke와 동일 관례 (웹 번들 안전 + jest 호환)
    const { withdrawBe } = require('@/lib/auth/beAuth') as typeof import('@/lib/auth/beAuth');
    await withdrawBe().catch(() => {}); // 실패해도 로컬 세션은 정리됨
    // P-010(KB-177): 탈퇴한 계정의 로컬 잔재(온보딩 draft·맵기) 정리 —
    // 게스트 진입 시 재개 모달 오노출 방지 (로그아웃과 달리 탈퇴는 무조건 소거)
    const { clearMemberLocalState } = require('@/lib/auth/clearMemberLocal') as typeof import('@/lib/auth/clearMemberLocal');
    await clearMemberLocalState().catch(() => {});
    if (Platform.OS !== 'web') {
      const session = require('@/lib/auth/session') as typeof import('@/lib/auth/session');
      await session.logOut().catch(() => {});
    }
    router.replace('/login' as Href);
  }

  // KB-162: 애플 회원만 재인증 게이트 — 구글 회원·웹은 바로 기존 탈퇴 흐름
  function onConfirm() {
    if (Platform.OS === 'ios') {
      const rev = require('@/lib/auth/appleRevoke') as typeof import('@/lib/auth/appleRevoke');
      if (rev.currentIsAppleUser()) return setGate('prompt');
    }
    void doWithdraw();
  }

  // 게이트 계속: 시트 → 본인 대조 → revoke. 'revoked'일 때만 탈퇴 진행.
  async function onAppleContinue() {
    setRevoking(true);
    const rev = require('@/lib/auth/appleRevoke') as typeof import('@/lib/auth/appleRevoke');
    const r = await rev.reauthAndRevokeApple();
    setRevoking(false);
    if (r === 'revoked') {
      setGate(null);
      void doWithdraw();
    } else {
      setGate(r); // cancelled | mismatch | failed — 탈퇴 중단 + 사유 안내 (계정 유지)
    }
  }

  return (
    <View style={styles.root}>
      <SubHeader title={t('profile.deleteAccount')} onBack={() => router.back()} />
      <View style={styles.body}>
        <View style={styles.icon}>
          <IconTrash size={30} color={C.riskDanger} />
        </View>
        <Text style={styles.title}>{t('profile.delete.title')}</Text>

        <View style={styles.list}>
          {/* P-082(KB-258): RiskMark 틴트 칩 solid 통일 — 게이트 카드와 filled/outline 혼용 정리 */}
          <View style={styles.row}>
            <RiskMark state="danger" size={20} />
            <Text style={styles.rowText}>{t('profile.delete.dataLine')}</Text>
          </View>
          {/* 리뷰 익명화 안내 — KB-148 MVP 제외(숨김) */}
          {FLAGS.reviewsEnabled && (
            <View style={styles.row}>
              <RiskMark state="safe" size={20} />
              <Text style={styles.rowText}>{t('profile.delete.reviewsLine')}</Text>
            </View>
          )}
        </View>

        <Pressable style={styles.consent} onPress={() => setAgreed(!agreed)}>
          <View style={[styles.check, agreed && styles.checkOn]}>{agreed && <IconCheck size={14} color="#fff" />}</View>
          <Text style={styles.consentText}>{t('profile.delete.confirm')}</Text>
        </Pressable>

        <View style={{ gap: 9 }}>
          <Btn
            variant={agreed ? 'danger' : 'off'}
            icon={agreed ? <IconTrash size={16} color="#fff" /> : undefined}
            onPress={agreed ? onConfirm : undefined}
          >
            {t('profile.delete.confirmBtn')}
          </Btn>
          <Btn variant="ghost" onPress={() => router.back()}>
            {t('profile.delete.cancel')}
          </Btn>
        </View>
      </View>

      {/* KB-162 Apple 재인증 게이트 — prompt: 안내+시트 진입 / 그 외: 중단 사유 (계정 유지) */}
      {gate != null && (
        <Pressable style={styles.gateBackdrop} onPress={revoking ? undefined : () => setGate(null)}>
          <Pressable style={styles.gateCard} onPress={() => {}}>
            <RiskMark state={gate === 'prompt' ? 'caution' : 'unable'} size={30} />
            <Text style={styles.gateText}>{t(GATE_MSG[gate])}</Text>
            <View style={{ alignSelf: 'stretch', gap: 9 }}>
              {gate === 'prompt' && (
                <Btn variant={revoking ? 'off' : 'primary'} onPress={revoking ? undefined : () => void onAppleContinue()}>
                  {t('profile.delete.appleGateBtn')}
                </Btn>
              )}
              <Btn variant="ghost" onPress={revoking ? undefined : () => setGate(null)}>
                {t('profile.delete.cancel')}
              </Btn>
            </View>
          </Pressable>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: 22, gap: 18 },
  icon: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fdecea', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  title: { fontFamily: font.display, fontSize: 22, color: C.ink, textAlign: 'center' },
  list: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, padding: 13 },
  rowText: { flex: 1, fontFamily: font.body, fontSize: 13.5, color: C.ink, lineHeight: 19 },
  consent: { flexDirection: 'row', alignItems: 'center', gap: 11, justifyContent: 'center' },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: C.primary, borderColor: C.primary },
  consentText: { fontFamily: font.bodyBold, fontSize: 13.5, color: C.ink },
  // KB-162 Apple 재인증 게이트 (scan.tsx UnmatchedNotice 카드 패턴)
  gateBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', zIndex: 20, padding: 28 },
  gateCard: { backgroundColor: C.card, borderRadius: 20, padding: 22, alignItems: 'center', gap: 12, maxWidth: 340, alignSelf: 'stretch' },
  gateText: { fontFamily: font.body, fontSize: 13.5, color: C.ink, textAlign: 'center', lineHeight: 20 },
});
