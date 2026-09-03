/**
 * KB-418(P-201): prod 채널 구계약 분기 전수 청산 잠금.
 *
 * KB-389(맵기 구정수)와 같은 족보의 사고 — "prod 서버 미배포" 판단 시점에 심은
 * 채널 분기가 서버 통일(신계약) 후에도 잔존해 prod만 구계약을 쏘는 것 — 의
 * 재발을 소스 레벨에서 봉쇄한다: `isProdChannel()` 소비자는 **송신 계약과 무관한
 * 허용 목록**(flags 정의부·sentry 환경 라벨)만 남는다. 새 소비자가 생기면 이
 * 스위트가 즉시 실패 — 송신 분기가 필요하면 발주 근거와 함께 목록을 갱신할 것.
 */
import * as fs from 'fs';
import * as path from 'path';

/** 송신 계약과 무관한 isProdChannel 허용 소비자 — KB-418에서 확정. */
const ALLOWED = new Set([
  'src/lib/flags.ts', // 정의부
  'src/lib/sentry.ts', // 환경 라벨(prod/dev)·prod 셀프체크 트리거 무동작
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__') walk(p, out);
    } else if (/\.tsx?$/.test(e.name) && (fs.readFileSync(p, 'utf8') as string).includes('isProdChannel')) {
      out.push(p);
    }
  }
  return out;
}

it('isProdChannel 소비자 = 허용 목록뿐 — 송신 계약 채널 분기 잔존 0', () => {
  expect(walk('src').sort()).toEqual([...ALLOWED].sort());
});

it('청산된 분기의 재유입 금지 — 온보딩/프로필/스캔/환율', () => {
  const read = (p: string) => fs.readFileSync(p, 'utf8') as string;
  expect(read('src/lib/onboarding/submit.ts')).not.toContain('isProdChannel'); // P-209 1.0 폴백 소멸
  expect(read('src/lib/data/useMe.ts')).toContain("{ headers: { 'X-API-Version': '1.1' } }"); // 항상 1.1
  expect(read('src/lib/data/useScan.ts')).toContain('return FLAGS.scanV2;'); // P-219 채널 게이트 소멸(킬스위치만)
  expect(read('src/lib/exchange.ts')).not.toContain('RATE_FROM_KRW'); // v1 근사 테이블 소멸
  expect(fs.existsSync('src/lib/onboarding/autoProfile.ts')).toBe(false); // prod 1.0 폴백 전용 — 통삭제
});
