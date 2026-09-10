/**
 * P-315(KB-482) — 시안 정합 4건 잠금: 배지 오프셋·사진 정적 bg 제거·랭킹 카드
 * 그라데이션/메달 글로우 제거·탭 아바타 상태 규칙.
 */
import * as fs from 'fs';

it('① 배지 오프셋 top -4/left 3 — 그리드·recent·스캔 전수(시안 2072:1788 걸침)', () => {
  const cards = fs.readFileSync('src/features/food/FoodCards.tsx', 'utf8');
  expect(cards).toContain("gbadge: { position: 'absolute', top: -4, left: 3 }");
  expect(cards).toContain("rbadge: { position: 'absolute', top: -4, left: 3 }");
  expect(fs.readFileSync('src/features/scan/ScanRichList.tsx', 'utf8')).toContain("thumbBadge: { position: 'absolute', top: -4, left: 3 }");
});

it('① 회색 띠 — 사진 컨테이너 정적 bg 제거(폴백만 유지)·그리드 CardPhoto 라운딩 전달', () => {
  const cards = fs.readFileSync('src/features/food/FoodCards.tsx', 'utf8');
  expect(cards).toContain("gphoto: { aspectRatio: 174 / 203, borderRadius: 4, overflow: 'visible' }");
  expect(cards).toContain('rthumb: { width: 100, height: 100, borderRadius: 4 }');
  // P-353 ③: 아이콘 폴백 박스 소멸 — CardPhoto가 null/실패 시 기본 음식 이미지
  expect(cards).toContain('recyclingKey={food.foodId} borderRadius={4} />'); // 그리드 라운딩
  // 배지 그림자(shBadge)는 유지 — 시안 DROP 1,1 3.7 0.6 동일
  expect(fs.readFileSync('src/components/RiskBadge.tsx', 'utf8')).toContain('shadow.shBadge');
});

it('② 랭킹 카드 — 그라데이션 #FF7134 α0→0.05·보더 hair·메달 글로우 제거·숫자 16/800', () => {
  const profile = fs.readFileSync('src/app/(tabs)/profile.tsx', 'utf8');
  expect(profile).toContain("colors={['rgba(255,113,52,0)', 'rgba(255,113,52,0.05)']}");
  expect(profile).toContain("rankTrack: { flex: 1, height: 10, borderRadius: 16, backgroundColor: '#EDEFF4'");
  const medal = fs.readFileSync('src/components/RankMedal.tsx', 'utf8');
  expect(medal).not.toContain('shadowGlow(');
  expect(medal).toContain("fontSize: (size * 16) / 28, fontWeight: '800'");
});

it('③ 탭 아바타 — 원형 이중(내부 radius)·비활성 opacity 0.6·플레이스홀더 동일 링 규칙', () => {
  const tab = fs.readFileSync('src/components/TabBar.tsx', 'utf8');
  expect(tab).toContain('borderRadius: (size - 4) / 2'); // RemoteImage 자체 라운딩(이중)
  expect(tab).toContain("avatarDim: { opacity: 0.6 }");
  expect(tab).toContain("!active && styles.avatarDim"); // 비활성 흐림(사진·플레이스홀더 공통)
  expect(tab).toContain("testID={showPhoto ? 'tab-avatar-photo' : 'tab-avatar-fb'}"); // 동일 링 래퍼
});

it('①-b Codex #77 P2 → P-353 ③: photoUrl null/실패 = CardPhoto 내부 기본 음식 이미지(아이콘 박스 소멸)', () => {
  const cards = fs.readFileSync('src/features/food/FoodCards.tsx', 'utf8');
  expect(cards).not.toContain('gphotoFb:');
  expect(cards).not.toContain('<IconFood size={28}');
  const cp = fs.readFileSync('src/components/CardPhoto.tsx', 'utf8');
  expect(cp).toContain('const source: string | number = !uri || failed ? DEFAULT_FOOD_IMAGE : uri;'); // KB-515 후속: 로컬 에셋
});
