/* eslint-disable import/first -- jest.mock 뒤 import(레포 관례) */
/** KB-905 — 번역 버튼 접근성(T-067) · 작성자 사진 매핑(T-069) · 원격 이미지 로딩 바탕(T-021) · 시트·카드 소스 잠금(T-066·T-068·T-070·T-073·T-075) */
import * as React from 'react';
import * as fs from 'fs';
import { StyleSheet } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', t: (k: string) => k } }));
jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return { __esModule: true, default: { View }, useReducedMotion: () => true };
});

import { TranslateButton } from '../TranslateButton';
import { RemoteImage, SHIMMER_BASE } from '../RemoteImage';
import { adaptReview } from '@/lib/api/reviewAdapter';

const read = (p: string) => fs.readFileSync(p, 'utf8');

it('T-067 번역 버튼 = 상태마다 접근성 이름(라벨)을 명시 — 안드는 라벨 없이 busy만 있으면 busy 해제 뒤 content-desc 갱신을 건너뛰어 "busy"가 남았다', () => {
  let tree!: ReactTestRenderer;
  const btn = () => tree.root.findAll((n) => n.props?.testID === 'translate-btn' && n.props?.accessibilityRole === 'button')[0];
  act(() => { tree = renderer.create(<TranslateButton state="loading" source={null} onPress={jest.fn()} />); });
  expect([btn().props.accessibilityLabel, btn().props.accessibilityState]).toEqual(['reviews.translating', { busy: true }]);
  act(() => tree.update(<TranslateButton state="translated" source={null} onPress={jest.fn()} />));
  expect([btn().props.accessibilityLabel, btn().props.accessibilityState]).toEqual(['translation.translated', { busy: false }]);
  act(() => tree.update(<TranslateButton state="idle" source={null} onPress={jest.fn()} />));
  expect(btn().props.accessibilityLabel).toBe('translation.showTranslation');
});

it('T-069 작성자 profileImageUrl 매핑(절대 URL만) · 카드 = 내 리뷰만 사진, 남 = 기본 아바타 · 실패 = 기본 아바타', () => {
  const base = { reviewId: 1, rating: 5, content: 'x', imageUrls: [], createdAt: 1, likeCount: 0, likedByMe: false, author: { memberId: 7, nickname: 'n', countryCode: 'KR', tier: 'BRONZE', level: 1, score: 0 } };
  expect(adaptReview({ ...base, author: { ...base.author, profileImageUrl: 'https://cdn/x.jpg' } } as never).author?.profileImageUrl).toBe('https://cdn/x.jpg');
  expect(adaptReview({ ...base, author: { ...base.author, profileImageUrl: 'images/x.jpg' } } as never).author?.profileImageUrl).toBeNull();
  const card = read('src/features/review/FeedCard.tsx');
  expect(card).toContain('{mine && !anon && review.author?.profileImageUrl ? (');
  expect(card).toContain('if (failed) return <AvatarPlaceholder height={24} />;');
});

it('T-021 원격 이미지 로딩 = 사진 칸 바탕보다 진한 스켈레톤 바탕(스윕이 보이게) — RemoteImage·CardPhoto 같은 값', () => {
  let tree!: ReactTestRenderer;
  act(() => { tree = renderer.create(<RemoteImage uri="https://x/1.jpg" style={{ width: 100, height: 100, backgroundColor: '#F7F8FA' }} />); });
  const bg = tree.root.findAll((n) => typeof n.type === 'string' && StyleSheet.flatten(n.props.style)?.position === 'absolute' && StyleSheet.flatten(n.props.style)?.backgroundColor === SHIMMER_BASE.backgroundColor);
  expect(bg.length).toBeGreaterThan(0);
  expect(SHIMMER_BASE.backgroundColor).not.toBe('#F7F8FA');
  expect(read('src/components/CardPhoto.tsx')).toContain('[FILL, SHIMMER_BASE]');
});

it('T-066·T-068·T-070·T-073·T-075 소스 잠금', () => {
  const compose = read('src/app/community/compose.tsx');
  expect(compose).toContain("const pickedNone = kind === 'place' ? placeTag == null : foodTags.length === 0;");
  expect(compose).toContain("<Btn onPress={pickedNone ? undefined : onClose} variant={pickedNone ? 'off' : 'primary'} testID=\"picker-done\">");
  expect(compose).toContain('contentContainerStyle={{ paddingBottom: 16 }} keyboardShouldPersistTaps="handled"');
  const mod = read('src/features/community/moderation.tsx');
  expect(mod).toContain('<ReportSheet key={`${target.type}:${target.id}`} onSubmit={doReport} onCancel={close} />');
  expect(mod).toContain('<Btn testID="report-cancel" variant="ghost" onPress={onCancel}>');
  expect(mod).toContain('<Flag code={target.author.nationality} size={14} />'); // 국기 이모지 = 헌법 v2.3.0 허용, 크기만 행 배지와 같게
  expect(read('src/features/review/ReviewCellParts.tsx')).toContain('(photos.length > 1 ? PEEK_REVEAL : 0)');
});
