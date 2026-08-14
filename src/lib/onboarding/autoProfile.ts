/**
 * autoProfile (P-130/온보딩 v3 → P-209 강등) — ⚠️ **prod 채널(구 1.0 계약) 폴백 전용**.
 * dev 계열(1.1)은 서버가 닉네임(한식명_4자리 풀 30종)·아바타를 자동 지정 — 정본은
 * 서버. prod 서버 1.1 배포·채널 분기 해제 발주에서 이 파일 전체 삭제.
 *
 * 닉네임 = 로마자 한식명 풀 + '_' + 4자리 난수 (예: Bibimbap_3021) — 프로필
 * 수정에서 언제든 변경. 중복 정책은 BE 유니크 여부 확인 중(종한 ⑧) — 충돌 시
 * 서버 에러가 표면화되므로 클라 재시도는 그때 판단.
 *
 * 아바타(P-140): 색상 변형 6종(D-19, S3 `images/webp/default_profile/`) 중
 * 랜덤 — 전송은 **path**(P-016 컨벤션: FE는 CDN 도메인을 모름, 조회는 BE가
 * CDN 풀 URL로 에코). CloudFront 6종 200 실측(2026-08-07). 구 단일 기본
 * path(PROFILE_IMAGE_DEFAULT_PATH)는 폴백으로 보존.
 */

/** 로마자 한식명 풀 (~30종) — 라틴 전용(닉네임 형식 ^[A-Za-z]+_\\d{4}$). */
export const NICKNAME_POOL = [
  'Bibimbap', 'Kimchi', 'Tteokbokki', 'Bulgogi', 'Japchae', 'Gimbap', 'Mandu',
  'Samgyetang', 'Galbi', 'Naengmyeon', 'Sundubu', 'Doenjang', 'Gochujang',
  'Pajeon', 'Hotteok', 'Bingsu', 'Jjajangmyeon', 'Jjamppong', 'Dakgalbi',
  'Samgyeopsal', 'Kalguksu', 'Songpyeon', 'Yukgaejang', 'Bossam', 'Jokbal',
  'HaemulTang', 'Gamjatang', 'Miyeokguk', 'Omurice', 'Dakjuk',
] as const;

export function generateNickname(): string {
  const name = NICKNAME_POOL[Math.floor(Math.random() * NICKNAME_POOL.length)];
  const digits = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `${name}_${digits}`;
}

/** 기본 아바타 색상 slug 6종 (D-19 확정 — 종한 공유 목록과 동일). */
export const AVATAR_SLUGS = ['orange', 'teal', 'amber', 'olive', 'plum', 'navy'] as const;

/** 전송용 path 6종 — CDN 조합은 BE 몫(⚠️ S3 직링크 403, CloudFront 경유만). */
export const DEFAULT_AVATAR_PATHS = AVATAR_SLUGS.map(
  (slug) => `images/webp/default_profile/avatar-${slug}.png`,
);

/** 신규 가입 아바타 — 6색 중 랜덤 path. */
export function pickDefaultAvatarPath(): string {
  return DEFAULT_AVATAR_PATHS[Math.floor(Math.random() * DEFAULT_AVATAR_PATHS.length)];
}
