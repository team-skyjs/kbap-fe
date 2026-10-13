/**
 * KB-780(예진 10/14 실기, 스토어 Android 1.0.4) — 주문 카드 둘레 두꺼운 회색 띠.
 * 원인: 카드 바탕 primaryTint(rgba 5%) + 그림자 sh1(elevation 1). Android는 elevation 그림자를 뷰 **아래 전체**에 그리고, 반투명 바탕이
 * 그 그림자를 비춰 보인다(iOS shadow*는 바깥에만 — 무관). 수정: 흰 화면 위 합성값을 불투명으로(primaryTintSolid) — iOS 시각 동일.
 * + 전수 잠금: "반투명 바탕 + 그림자/elevation" 한 스타일 객체 — 알려진 3곳 외 신규 0(같은 Android 띠 재발 방지).
 */
import * as fs from 'fs';
import * as path from 'path';
import { primaryTintSolid } from '@/lib/theme';

const SRC = path.join(__dirname, '..', '..', '..');
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p);
  return e.name.endsWith('.tsx') ? [p] : [];
});

it('primaryTintSolid = primaryTint(#FF7134 · 5%)를 흰 바탕 위에 합성한 불투명값', () => {
  const comp = [255, 113, 52].map((c) => Math.round(255 * 0.95 + c * 0.05));
  expect(primaryTintSolid).toBe(`#${comp.map((v) => v.toString(16).toUpperCase().padStart(2, '0')).join('')}`);
});

it('주문 카드(flipCard) = 불투명 바탕 + 그림자 유지(iOS 시각 동일)', () => {
  const src = fs.readFileSync(path.join(SRC, 'features', 'order', 'FlippedOrderCard.tsx'), 'utf8');
  const block = /\n  flipCard: \{([\s\S]*?)\n  \},/.exec(src)![1];
  expect(block).toContain('backgroundColor: primaryTintSolid');
  expect(block).not.toMatch(/backgroundColor: primaryTint\b,/);
  expect(block).toContain('...shadow.sh1');
});

it('전수: 반투명 바탕 + 그림자/elevation 한 스타일 객체 = 알려진 곳만(신규 0) — 새로 생기면 불투명 합성값으로', () => {
  const hits: string[] = [];
  for (const f of walk(SRC)) {
    const s = fs.readFileSync(f, 'utf8');
    for (const m of s.matchAll(/\n\s*([A-Za-z0-9_]+): \{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g)) {
      const body = m[2];
      const shadowed = /elevation:\s*[1-9]|\.\.\.shadow\.(sh1|sh2|shPop|shBadge)/.test(body);
      const translucent = /backgroundColor:\s*(primaryTint2?\b|'rgba\([^)]*,\s*0?\.\d+\)')/.test(body);
      if (shadowed && translucent) hits.push(`${path.relative(SRC, f)}:${m[1]}`);
    }
  }
  // 알려진 3곳(KB-780 보고 — 바탕이 흰색이 아닐 수 있어 합성값을 부모 색으로 정해야 함, 별도 판단): 여기서 줄기만 허용
  expect(hits.sort()).toEqual(['app/community/compose.tsx:bodyBoxFocus', 'app/onboarding/index.tsx:av', 'components/Btn.tsx:dangerGhost']);
});
