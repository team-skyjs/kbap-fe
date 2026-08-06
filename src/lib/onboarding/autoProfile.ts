/**
 * autoProfile (P-130/온보딩 v3) — 자동 프로필 배정 (유저 무노출, 마찰 제로).
 *
 * 닉네임 = 로마자 한식명 풀 + '_' + 4자리 난수 (예: Bibimbap_3021) — 프로필
 * 수정에서 언제든 변경. 중복 정책은 BE 유니크 여부 확인 중(종한 ⑧) — 충돌 시
 * 서버 에러가 표면화되므로 클라 재시도는 그때 판단.
 *
 * 아바타: BE 색상별 기본 이미지 세트가 정석(종한 ⑧) — 준비 전 임시 = 현행 기본
 * path. TODO(BE 색상 세트 배포 시): 세트 경로 배열에서 랜덤으로 스왑.
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
