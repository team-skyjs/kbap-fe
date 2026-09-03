/**
 * useMe / useUpdateMe / useMyReviews — profile (KB-68 실연결 2026-07-13).
 *
 * - useMe: BE 세션이 있으면 LIVE GET /members/me/profile (랭킹 요약 동반),
 *   없으면(비회원/웹/개발) mock — 게스트 흐름이 프로필 없이도 돌게.
 * - useUpdateMe: PATCH /members/me/profile — **화면이 보낸 필드만** 와이어로
 *   매핑(부분 수정). avoidanceSubstanceCodes 빈 배열 = 전부 해제이므로
 *   restrictions는 호출측이 명시했을 때만 전송한다. spiceTolerance는 서버
 *   실연결(KB-150) — 해제(null)는 -1 센티널 전송(7/16 확정), 로컬 보관은
 *   구서버 대비 fallback.
 * - useMyReviews: 리뷰 API 미배포(KB-73) — mock 유지.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import i18n from '../i18n';
import type { Review, User, UserUpdate } from '../api/types';
import { api, apiLang } from '../api/client';
import { adaptProfile, type MyProfileWire, type ProfileUpdateWire } from '../api/memberAdapter';
import { adaptReviewPage, type ReviewPageWire } from '../api/reviewAdapter';
import { hasBeSession } from '../auth/beAuth';
import { setSentryUser } from '../sentry';
import { FLAGS } from '../flags';
import { loadLocalSpice, SPICE_KEY } from '../onboarding/submit';
import { spiceChoiceToWire } from '../api/spiceAdapter';
import { MOCK_MY_REVIEWS, MOCK_USER } from '../mocks/me';
import { toBeCode } from '../mocks/ingredients';


/** 내 프로필 fetch — 훅과 부트 프리페치(P-018 bootGate)가 공유. */
export async function fetchMe(): Promise<User> {
  if (!(await hasBeSession())) {
    setSentryUser(null); // P-197: 게스트 = 식별 해제
    return MOCK_USER; // guest/dev fallback
  }
  const wire = await api.get<MyProfileWire>('/members/me/profile');
  const user = adaptProfile(wire, await loadLocalSpice());
  setSentryUser(user.id); // P-197: 유저 식별 = memberId만(PII 발주 고정)
  return user;
}

export function useMe() {
  return useQuery({
    // 언어 전환 시 성분명 지역화 대비(현재 프로필은 코드만이라 무해)
    queryKey: ['me', i18n.language],
    queryFn: fetchMe,
  });
}

/** 훅 밖 분리 — 플래그 스위칭 유닛 잠금용 (P-086). */
export async function fetchMyReviews(): Promise<Review[]> {
  // P-086 봉인: 실연결 off → P-077 목 경로 그대로(세션 유저 빈 목록 — mock
  // 리뷰 오해 방지, 목 CRUD는 뮤테이션 훅이 캐시로 반영. mock은 게스트/개발만).
  if (!FLAGS.reviewsLiveEnabled) return (await hasBeSession()) ? [] : MOCK_MY_REVIEWS;
  if (!(await hasBeSession())) return MOCK_MY_REVIEWS;
  // P-085(KB-73) → P-165(#144) 버전리스: GET /api/reviews/me (lang 필수, keyset) —
  // 화면들이 전체 배열을 기대하므로(카운트·상세 조회) 커서를 끝까지 수집. 내 리뷰 수는 작다.
  const all: Review[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 20; page++) {
    // ponytail: 20페이지 안전 상한 — 초과분은 잘림(개인 리뷰 수백 건이면 그때 페이지네이션 UI)
    const res = adaptReviewPage(
      await api.get<ReviewPageWire>(`/api/reviews/me?lang=${apiLang()}${cursor ? `&cursor=${cursor}` : ''}`),
    );
    all.push(...res.items);
    if (!res.hasNext || !res.nextCursor) break;
    cursor = res.nextCursor;
  }
  return all;
}

export function useMyReviews() {
  return useQuery({ queryKey: ['me', 'reviews'], queryFn: fetchMyReviews });
}

/**
 * PATCH /members/me/profile — 호출측이 명시한 필드만 전송(엄격 분리, KB-68).
 * 응답은 Unit(빈) — 성공 시 ['me'] 무효화로 재조회해 진실을 서버에서 받는다.
 */
export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: UserUpdate): Promise<void> => {
      // spice 로컬 보관은 유지 — 마이그레이션 기간 fallback (adaptProfile 참조, KB-150 후속)
      // P-081: enum 문자열 저장, SKIP(해제)은 제거
      if (patch.spiceTolerance !== undefined) {
        if (patch.spiceTolerance !== 'SKIP') {
          await AsyncStorage.setItem(SPICE_KEY, patch.spiceTolerance).catch(() => {});
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
      // KB-150 확정(7/16): 해제 = -1 센티널 전송(SKIP) — 서버 왕복 후에도 미설정
      // 유지. 생략은 여전히 "유지". P-081: enum→정수는 spiceAdapter 격리.
      if (patch.spiceTolerance !== undefined) {
        body.spicinessPreference = spiceChoiceToWire(patch.spiceTolerance);
      }
      if (patch.profileImageUrl !== undefined) body.profileImageUrl = patch.profileImageUrl; // KB-149
      if (patch.nickname !== undefined) body.nickname = patch.nickname;
      // P-078: 국적 수정 불가(7/29 정책) — PATCH에서 countryCode 미전송 (BE 필드 제거 동보조)
      // P-060②: appLanguage 철거(BE 계약 삭제 확인) — 언어는 서버 무저장, 매 요청 lang
      if (patch.currency !== undefined) body.currency = patch.currency; // P-165(#145) — null = 미설정(국적 폴백)
      if (patch.restrictions !== undefined) {
        // 와이어 경계: BE 표준 코드만 (KB-75) — unmapped 드롭+로그
        body.avoidanceSubstanceCodes = patch.restrictions.flatMap((r) => {
          const be = toBeCode(r.code);
          if (!be) console.log('[profile] dropping unmapped ingredient code:', r.code);
          return be ? [be] : [];
        });
      }
      // P-243(BE #179): 식이 카테고리 — 풀 셋 교체(해제 실동작). 회피와 한 요청 가능.
      if (patch.dietCategories !== undefined) body.dietCategories = patch.dietCategories;
      if (Object.keys(body).length === 0) return; // 와이어 필드 없는 패치 — 서버 호출 불필요
      // P-209 → KB-418: 전 채널 1.1(ProfileUpdateNoCountryRequest 그룹 — countryCode
      // 무필드, 전송은 P-078부터 이미 0. prod 서버 1.1+ 핸들러 실측으로 분기 제거)
      await api.patch('/members/me/profile', body, { headers: { 'X-API-Version': '1.1' } });
    },
    onSuccess: async (_data, patch) => {
      // KB-68 반려 수정: restrictions 변경은 개인화의 기준 자체가 바뀌는 것 —
      // 홈(['home'])·목록/검색(['foods'])·상세(['food']) 위험도가 전부 stale.
      // 키를 열거하면 개인화 쿼리가 새로 생길 때마다 재발하므로 전면 무효화.
      // ⚠️ clear()가 아니라 invalidateQueries()여야 한다(2차 반려): clear()는
      // 캐시 제거만 하고 마운트된 옵저버를 재조회시키지 않는다 — 탭 화면은
      // 언마운트되지 않으므로 홈이 stale 판정을 계속 보여주는 false-safe.
      // invalidateQueries()는 전체를 stale 마킹하고 활성 쿼리를 즉시 재조회.
      // mock 경로(무세션)는 캐시 병합이 진실이라 전면 무효화 시 수정 증발 → 제외.
      if (patch.restrictions !== undefined && (await hasBeSession())) {
        void qc.invalidateQueries();
        return;
      }
      // 닉네임/국가/언어 등 비개인화 필드는 기존 범위 유지 (반려 비범위)
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
