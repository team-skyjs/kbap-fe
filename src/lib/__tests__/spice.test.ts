/**
 * P-081(KB-261 후속): 맵기 내부 enum 코어 잠금 — 순서 비교·SKIP 경고 없음·
 * 라벨/예시 키 완전성. (정수 와이어 변환은 spiceAdapter.test가 잠근다.)
 */
import { SPICE_LEVELS, SPICE_LEVEL_EXAMPLE, SPICE_LEVEL_LABEL, foodSpiceText, isSpiceLevel, spiceRank, spicierThanUser } from '../spice';

it('enum 순서 정본 — NONE<MILD<MEDIUM<HOT<EXTREME (rank 0..4)', () => {
  expect(SPICE_LEVELS).toEqual(['NONE', 'MILD', 'MEDIUM', 'HOT', 'EXTREME']);
  SPICE_LEVELS.forEach((l, i) => expect(spiceRank(l)).toBe(i));
});

it('경고 판정 — 단계(음식) > 단계(유저)만, 같은 단계·SKIP은 경고 없음', () => {
  expect(spicierThanUser('MEDIUM', 'MEDIUM')).toBe(false); // 같은 단계 — 원값 비교였다면 모순 가능
  expect(spicierThanUser('HOT', 'MEDIUM')).toBe(true);
  expect(spicierThanUser('MILD', 'NONE')).toBe(true);
  expect(spicierThanUser('NONE', 'NONE')).toBe(false);
  expect(spicierThanUser('EXTREME', 'SKIP')).toBe(false); // SKIP(미설정) = 경고 없음
});

it('라벨·예시 i18n 키 — 5단계 전부 존재 (표시 소스 단일화)', () => {
  SPICE_LEVELS.forEach((l, i) => {
    expect(SPICE_LEVEL_LABEL[l]).toBe(`spice.band.${i}`);
    expect(SPICE_LEVEL_EXAMPLE[l]).toBe(`spice.example.${i}`);
  });
});

it('음식 맵기 표시(P-104) — NONE은 자기설명 키, 나머지는 🌶️×rank+밴드 라벨', () => {
  const t = (k: string) => k;
  expect(foodSpiceText('NONE', t)).toBe('spice.foodNone'); // 고아 "None" 소멸(자기설명 키)
  // P-231: 라벨만 — 고추는 SpicePeppers 5개 프레임이 담당(반복 이모지 조립 소멸)
  expect(foodSpiceText('MILD', t)).toBe('spice.band.1');
  expect(foodSpiceText('MILD', t)).not.toContain('\u{1F336}');
  expect(foodSpiceText('EXTREME', t)).toBe('spice.band.4'); // P-231: 라벨만(EXTREME도 밴드 4 라벨 공유 무변)
});

it('isSpiceLevel — enum 판별 (SKIP·임의 문자열·숫자는 아님)', () => {
  expect(isSpiceLevel('HOT')).toBe(true);
  expect(isSpiceLevel('SKIP')).toBe(false);
  expect(isSpiceLevel('hot')).toBe(false);
  expect(isSpiceLevel(7)).toBe(false);
});
