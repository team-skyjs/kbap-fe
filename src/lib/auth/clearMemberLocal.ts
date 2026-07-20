/**
 * clearMemberLocal.ts — 탈퇴 성공 시 회원 귀속 로컬 상태 일괄 정리 (P-010/KB-177).
 *
 * 탈퇴한 계정의 로컬 흔적이 게스트를 "온보딩 미완 회원"으로 오인시키던 버그
 * (재개 모달 노출). 정리 대상 = **계정에 귀속된** 상태만:
 *   - 온보딩 draft (kbap.onboardingDraft.v1) — 중단 저장분
 *   - 맵기 로컬 fallback (kbap.profile.spice.v1)
 * 유지(기기 귀속): introSeen · lang · installed 센티널 · recentSearches(기기
 * 로컬 검색 기록 — 서버 미전송, 계정 비귀속 판단. 보고 명시).
 *
 * 세션(BE 토큰·서버 캐시)은 withdrawBe/logoutBe 가, Keychain 잔존은
 * freshInstall.ts 가 각자 담당 — 여기는 AsyncStorage 회원 데이터 계층만.
 * 새 회원 귀속 키를 추가하면 여기에도 등록할 것.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearOnboardingDraft } from '@/lib/onboarding/draft';
import { SPICE_KEY } from '@/lib/onboarding/submit';

export async function clearMemberLocalState(): Promise<void> {
  await clearOnboardingDraft();
  await AsyncStorage.removeItem(SPICE_KEY).catch(() => {});
  console.log('[auth] member local state cleared (onboarding draft, spice)');
}
