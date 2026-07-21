/**
 * P-034(KB-203 재수정, Q-16): 계정 연동 아이콘 = 공식 로고 잠금.
 * 스트로크 근사치로 되돌아가면 여기서 잡힌다.
 *  - IconGoogleG: 공식 4색(#4285F4/#34A853/#FBBC05/#EA4335) 채움 4패스
 *  - IconApple: 단색 필드(채움) 마크 — 스트로크 아님
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { IconApple, IconGoogleG } from '../icons';
import { color as C } from '@/lib/theme';

function flat(el: React.ReactElement): string {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  const s = JSON.stringify(tree.toJSON());
  act(() => tree.unmount());
  return s;
}

/** react-native-svg는 fill을 ARGB 숫자 payload로 직렬화 — hex → payload 변환 */
const payload = (hex: string) => ((0xff000000 | parseInt(hex.replace('#', ''), 16)) >>> 0).toString();

it('IconGoogleG — 공식 4색 브랜드 채움 (색 고정)', () => {
  const s = flat(<IconGoogleG size={17} />);
  for (const hex of ['#4285F4', '#34A853', '#FBBC05', '#EA4335']) {
    expect(s).toContain(payload(hex));
  }
});

it('IconApple — 필드(채움) 모노크롬, 기본 ink', () => {
  const s = flat(<IconApple size={17} />);
  expect(s).toContain(payload(C.ink)); // 채움 색 = ink
  expect(s).not.toContain('"stroke"'); // 스트로크판 회귀 방지
});
