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
 *
 * P-147: 게이트 판별 = **서버 profile.provider 정본** — Firebase providerData
 * 판별 폐기(링크 잔존 오판, 8/10 실사례). 프로필 미로드/오류 = 보수적으로
 * 게이트 발동(revoke 없는 애플 탈퇴를 만들지 않는 KB-162 원칙). 탈퇴 성공
 * 후 Firebase 계정 클린업(best effort — 재가입 시 링크 잔존 재발 방지).
 */
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useRouter, type Href } from 'expo-router';
import { FLAGS } from '@/lib/flags';
import { useTranslation } from 'react-i18next';
import { color as C } from '@/lib/theme';
import { SubHeader, Btn, RiskMark, IconCheck } from '@/components';
import { D4OctagonAlert } from '@/components/design4Assets';
import { useBottomInset } from '@/lib/useBottomInset';
import { useMe } from '@/lib/data/useMe';
import { useSubmitGuard } from '@/lib/useSubmitGuard';
import { EVENTS, track } from '@/lib/analytics';

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
  const { data: me } = useMe(); // P-147: provider 정본 — 탈퇴 화면 진입 시 이미 캐시됨
  const [agreed, setAgreed] = useState(false);
  const bottom = useBottomInset(); // P-055: 안드 내비바 보정
  const [gate, setGate] = useState<AppleGateState>(null);
  const [revoking, setRevoking] = useState(false);
  // P-173: 탈퇴 흐름 전체 단일 비행 — withdraw PATCH 7발·cleanup 5회 중복(로그 실증) 봉쇄
  const { busy: withdrawing, run: runWithdraw } = useSubmitGuard();

  // KB-67: 탈퇴 실호출 → 세션 정리 → 재로그인 화면
  async function doWithdraw() {
    track(EVENTS.auth_account_delete); // P-214: 이탈 지표(props 없음 — 사유·식별자 금지)
    // lazy require — 파일 내 session/appleRevoke와 동일 관례 (웹 번들 안전 + jest 호환)
    const { withdrawBe } = require('@/lib/auth/beAuth') as typeof import('@/lib/auth/beAuth');
    await withdrawBe().catch(() => {}); // 실패해도 로컬 세션은 정리됨
    // P-010(KB-177): 탈퇴한 계정의 로컬 잔재(온보딩 draft·맵기) 정리 —
    // 게스트 진입 시 재개 모달 오노출 방지 (로그아웃과 달리 탈퇴는 무조건 소거)
    const { clearMemberLocalState } = require('@/lib/auth/clearMemberLocal') as typeof import('@/lib/auth/clearMemberLocal');
    await clearMemberLocalState().catch(() => {});
    if (Platform.OS !== 'web') {
      // P-147 ②: Firebase 계정 잔재 정리(best effort) — 재가입 시 링크 잔존 재발 방지.
      // signOut 전에 수행(정리엔 currentUser 필요). 실패해도 탈퇴 흐름 계속.
      const { cleanupFirebaseAccount } = require('@/lib/auth/firebaseCleanup') as typeof import('@/lib/auth/firebaseCleanup');
      await cleanupFirebaseAccount().catch(() => {});
      const session = require('@/lib/auth/session') as typeof import('@/lib/auth/session');
      await session.logOut().catch(() => {});
    }
    // P-088④: 탈퇴 후 로그인 진입도 스택 리셋 — 잔여 스택이 재가입 온보딩의
    // 스와이프 백 표적이 되는 것 차단
    try {
      if (router.canDismiss()) router.dismissAll();
    } catch { /* 스택 밖 — 무시 */ }
    router.replace('/login' as Href);
  }

  // P-147 ③: provider drift 진단 — 서버 정본 ≠ Firebase providerData 구성이면 로그
  useEffect(() => {
    if (Platform.OS === 'web' || !me?.provider) return;
    try {
      const rev = require('@/lib/auth/appleRevoke') as typeof import('@/lib/auth/appleRevoke');
      const fbApple = rev.currentIsAppleUser();
      if ((me.provider === 'APPLE') !== fbApple) {
        console.log(`[auth] provider drift — server=${me.provider} firebaseAppleLink=${fbApple} (링크 잔존/재결합 의심)`);
      }
    } catch { /* 네이티브 모듈 부재(웹 등) — 진단 생략 */ }
  }, [me?.provider]);

  // KB-162→P-147: 애플 게이트 판별 = **서버 profile.provider** (Firebase 판별 폐기).
  // 미로드/오류(me 없음)는 보수적으로 게이트 발동 — revoke 없는 애플 탈퇴 금지 원칙.
  function onConfirm() {
    if (Platform.OS === 'ios') {
      const provider = me?.provider;
      if (provider === 'APPLE' || provider == null) return setGate('prompt');
    }
    void runWithdraw(doWithdraw); // P-173: 성공 시 화면 이탈까지 busy 유지 — 재발사 0
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
        {/* 제목 20/700 중앙 2줄(4150:14547 @y198) */}
        <Text style={styles.title}>{t('profile.delete.title')}</Text>

        {/* 불릿 카드 2개 — pad 16 gap 12, 첫 카드 하단 line 1px */}
        <View>
          <View style={[styles.bullet, FLAGS.reviewsEnabled && styles.bulletDivider]}>
            <D4OctagonAlert size={20} color={C.ink2} />
            <Text style={styles.bulletText}>{t('profile.delete.dataLine')}</Text>
          </View>
          {/* 리뷰 익명화 안내 — reviewsEnabled 게이트 유지 */}
          {FLAGS.reviewsEnabled && (
            <View style={styles.bullet}>
              <D4OctagonAlert size={20} color={C.ink2} />
              <Text style={styles.bulletText}>{t('profile.delete.reviewsLine')}</Text>
            </View>
          )}
        </View>

        {/* 체크박스 행 중앙 — Checkbox 20 r4(D-5 consent 문법) */}
        <Pressable style={styles.consent} onPress={() => setAgreed(!agreed)}>
          <View style={[styles.check, agreed && styles.checkOn]}>{agreed && <IconCheck size={13} color="#fff" />}</View>
          <Text style={styles.consentText}>{t('profile.delete.confirm')}</Text>
        </Pressable>
      </View>

      {/* FixedBottom — outline Cancel + primary Delete(시안 primary 오렌지 — danger 빨강 금지, 예진 확정 9/5) */}
      <View style={[styles.bottomBar, { paddingBottom: bottom + 10 }]} testID="delete-bottom-bar">
        <View style={{ flex: 1 }}>
          <Btn variant="ghost" onPress={() => router.back()}>
            {t('profile.delete.cancel')}
          </Btn>
        </View>
        <View style={{ flex: 1 }}>
          <Btn
            variant={agreed ? 'primary' : 'off'}
            onPress={agreed && !withdrawing ? onConfirm : undefined}
            busy={withdrawing}
            testID="delete-confirm"
          >
            {t('profile.delete.confirmBtn')}
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
                <Btn variant={revoking ? 'off' : 'primary'} onPress={revoking ? undefined : () => void runWithdraw(onAppleContinue)}>
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
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 96, gap: 24 },
  title: { fontSize: 20, fontWeight: '700', color: '#1C1E21', textAlign: 'center', lineHeight: 28, paddingHorizontal: 24 },

  bullet: { alignItems: 'center', gap: 12, padding: 16 },
  bulletDivider: { borderBottomWidth: 1, borderBottomColor: C.line },
  bulletText: { fontSize: 14, fontWeight: '500', color: '#4B4F58', textAlign: 'center', lineHeight: 20 },

  consent: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
  check: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: C.line2, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: C.primary, borderColor: C.primary },
  consentText: { fontSize: 14, fontWeight: '500', color: '#1C1E21' },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 16, paddingHorizontal: 20, paddingTop: 10, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: C.line },

  // KB-162 Apple 재인증 게이트 (D-1 Alert 카드 문법)
  gateBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', zIndex: 20, padding: 28 },
  gateCard: { backgroundColor: C.card, borderRadius: 20, padding: 22, alignItems: 'center', gap: 12, maxWidth: 340, alignSelf: 'stretch' },
  gateText: { fontSize: 13.5, fontWeight: '400', color: C.ink, textAlign: 'center', lineHeight: 20 },
});
