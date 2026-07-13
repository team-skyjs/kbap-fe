/**
 * useMe / useUpdateMe / useMyReviews — profile (KB-68 실연결 2026-07-13).
 *
 * - useMe: BE 세션이 있으면 LIVE GET /members/me/profile (랭킹 요약 동반),
 *   없으면(비회원/웹/개발) mock — 게스트 흐름이 프로필 없이도 돌게.
 * - useUpdateMe: PATCH /members/me/profile — **화면이 보낸 필드만** 와이어로
 *   매핑(부분 수정). avoidanceSubstanceCodes 빈 배열 = 전부 해제이므로
 *   restrictions는 호출측이 명시했을 때만 전송한다. spiceTolerance는 계약에
 *   없어 로컬(AsyncStorage) 보관.
 * - useMyReviews: 리뷰 API 미배포(KB-73) — mock 유지.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import i18n from '../i18n';
import type { Review, User, UserUpdate } from '../api/types';
import { api } from '../api/client';
import { adaptProfile, type MyProfileWire, type ProfileUpdateWire } from '../api/memberAdapter';
import { hasBeSession } from '../auth/beAuth';
import { loadLocalSpice } from '../onboarding/submit';
import { MOCK_MY_REVIEWS, MOCK_USER } from '../mocks/me';
import { toBeCode } from '../mocks/ingredients';

const SPICE_KEY = 'kbap.profile.spice.v1'; // submit.ts와 동일 키

export function useMe() {
  return useQuery({
    // 언어 전환 시 성분명 지역화 대비(현재 프로필은 코드만이라 무해)
    queryKey: ['me', i18n.language],
    queryFn: async (): Promise<User> => {
      if (!(await hasBeSession())) return MOCK_USER; // guest/dev fallback
      const wire = await api.get<MyProfileWire>('/members/me/profile');
      return adaptProfile(wire, await loadLocalSpice());
    },
  });
}

export function useMyReviews() {
  return useQuery({
    queryKey: ['me', 'reviews'],
    // 리뷰 API 미배포(KB-73). 실계정에 mock 리뷰가 보이면 오해 소지 →
    // 세션 유저는 빈 목록, mock은 게스트/개발 경로만.
    queryFn: async (): Promise<Review[]> =>
      (await hasBeSession()) ? [] : MOCK_MY_REVIEWS,
  });
}

/**
 * PATCH /members/me/profile — 호출측이 명시한 필드만 전송(엄격 분리, KB-68).
 * 응답은 Unit(빈) — 성공 시 ['me'] 무효화로 재조회해 진실을 서버에서 받는다.
 */
export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: UserUpdate): Promise<void> => {
      // spice는 계약 밖 — 로컬 보관 (제공된 경우만)
      if ('spiceTolerance' in patch) {
        if (patch.spiceTolerance != null) {
          await AsyncStorage.setItem(SPICE_KEY, String(patch.spiceTolerance)).catch(() => {});
        } else {
          await AsyncStorage.removeItem(SPICE_KEY).catch(() => {});
        }
      }

      if (!(await hasBeSession())) {
        // mock 경로: 캐시에 병합만
        const cur = qc.getQueryData<User>(['me', i18n.language]) ?? MOCK_USER;
        qc.setQueryData(['me', i18n.language], { ...cur, ...patch });
        return;
      }

      // 제공된 키만 와이어로 — 미전송 = 유지, restrictions 빈 배열 = 전부 해제
      const body: ProfileUpdateWire = {};
      if (patch.nickname !== undefined) body.nickname = patch.nickname;
      if (patch.nationality !== undefined) body.countryCode = patch.nationality;
      if (patch.readerLanguage !== undefined) body.appLanguage = patch.readerLanguage;
      if (patch.restrictions !== undefined) {
        // 와이어 경계: BE 표준 코드만 (KB-75) — unmapped 드롭+로그
        body.avoidanceSubstanceCodes = patch.restrictions.flatMap((r) => {
          const be = toBeCode(r.code);
          if (!be) console.log('[profile] dropping unmapped ingredient code:', r.code);
          return be ? [be] : [];
        });
      }
      if (Object.keys(body).length === 0) return; // spice-only 패치 등 — 서버 호출 불필요
      await api.patch('/members/me/profile', body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
