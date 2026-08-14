/**
 * P-207: 원격 이미지 스켈레톤 전수 — RemoteImage 로딩/settle 상태 + 표면 소스 잠금
 * (expo-image 직접 사용 = 공용 3종 내부·로컬 전용 표면만).
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    useReducedMotion: () => false,
    Easing: { out: () => () => 0, quad: 0, linear: () => 0, inOut: () => () => 0 },
  };
});

import { RemoteImage } from '../RemoteImage';
import { Shimmer } from '../Skeleton';

function render(el: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  return tree;
}

it('로딩 = Shimmer 스켈레톤 → onLoad = 소멸(공백·팝인 소멸) · onError도 settle(폴백은 호출부)', () => {
  const tree = render(<RemoteImage uri="https://cdn/a.jpg" style={{ width: 72, height: 72 }} />);
  expect(tree.root.findAllByType(Shimmer).length).toBe(1); // 로딩 중 스켈레톤
  const img = tree.root.findAll((n) => typeof n.props?.onLoad === 'function')[0];
  act(() => img.props.onLoad());
  expect(tree.root.findAllByType(Shimmer).length).toBe(0); // 로드 = 스켈레톤 언마운트
  const err = render(<RemoteImage uri="https://cdn/b.jpg" style={{ width: 10, height: 10 }} />);
  act(() => err.root.findAll((n) => typeof n.props?.onError === 'function')[0].props.onError());
  expect(err.root.findAllByType(Shimmer).length).toBe(0); // 실패 = 무한 shimmer 잔존 금지
});

it('불변 규칙 소스 잠금 — expo-image 직접 사용 = 공용 3종 내부 + 로컬 전용 표면만', () => {
  const fs = require('fs');
  const path = require('path') as typeof import('path');
  // 원격 표면의 직접 사용 허용 목록: 공용 3종 + 로컬(촬영/첨부 미리보기) 전용 표면
  const ALLOWED = new Set([
    'src/components/CardPhoto.tsx',
    'src/components/AvoidTile.tsx',
    'src/components/RemoteImage.tsx',
    'src/app/community/compose.tsx', // 첨부 미리보기(로컬 uri)만 직접 — 원격 2곳은 RemoteImage
  ]);
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }) as { name: string; isDirectory(): boolean }[]) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== '__tests__') walk(p);
      } else if (/\.tsx$/.test(e.name)) {
        const src = fs.readFileSync(p, 'utf8') as string;
        if (src.includes("from 'expo-image'") && src.includes('<Image ') && !ALLOWED.has(p)) offenders.push(p);
      }
    }
  };
  walk('src');
  expect(offenders).toEqual([]); // 신규 원격 표면은 공용 3종 경유(CLAUDE.md 불변 규칙)
  // CLAUDE.md 승격 명문 존재
  expect(fs.readFileSync('CLAUDE.md', 'utf8')).toContain('원격 이미지·데이터 표면 = 로딩 스켈레톤 기본');
});
