/**
 * P-380 4·5단계(KB-518) — 캡처·저장·공유 분기와 계측 스키마.
 * 네이티브 3종은 주입으로 갈아끼워 분기를 전부 잠근다(실기는 예진 로컬 네이티브 빌드 1회).
 */
import {
  CANVAS_H,
  CANVAS_W,
  CARD_SCALE,
  EXPORT_CARD_RATIO,
  EXPORT_H,
  EXPORT_W,
  saveCardToPhotos,
  shareCardToStory,
  storyShareAvailable,
  type ShareDeps,
} from '../shareExport';
import { SHARE_CARD_W } from '../shareCard';

const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;
const ref = { current: null } as never;

function deps(over: Partial<ShareDeps> = {}): ShareDeps {
  return {
    capture: jest.fn().mockResolvedValue('file:///tmp/card.png'),
    requestSavePermission: jest.fn().mockResolvedValue(true),
    saveToLibrary: jest.fn().mockResolvedValue(undefined),
    isInstagramInstalled: jest.fn().mockResolvedValue(true),
    shareToStory: jest.fn().mockResolvedValue(undefined),
    storyAvailable: jest.fn().mockReturnValue(true),
    ...over,
  };
}

describe('내보내기 규격 — 1080×1920, 카드는 캔버스 폭 75%', () => {
  it('9:16 · 카드 폭 810px에 맞는 배율', () => {
    expect(EXPORT_W / EXPORT_H).toBeCloseTo(9 / 16, 5);
    expect(CANVAS_W / CANVAS_H).toBeCloseTo(9 / 16, 5);
    expect(EXPORT_W * EXPORT_CARD_RATIO).toBe(810);
    // 확대 후 카드 폭 = 캔버스 폭의 75%
    expect(SHARE_CARD_W * CARD_SCALE).toBeCloseTo(CANVAS_W * 0.75, 5);
  });

  it('캡처는 dp 캔버스가 아니라 픽셀 규격으로 찍는다(업스케일 블러 방지)', () => {
    const src = read('src/features/order/shareExport.ts');
    expect(src).toContain('width: EXPORT_W, height: EXPORT_H');
  });

  it('캔버스는 화면 밖 좌표에 둔다 — opacity 0은 빈 이미지로 찍히는 플랫폼이 있다', () => {
    const src = read('src/features/order/OrderShareCard.tsx');
    expect(src).toContain('left: -10000');
    expect(src).not.toContain('exportHost: { opacity: 0');
  });
});

describe('저장(Download image)', () => {
  it('성공 — 권한 → 캡처 → 저장 순서', async () => {
    const d = deps();
    const order: string[] = [];
    (d.requestSavePermission as jest.Mock).mockImplementation(async () => { order.push('perm'); return true; });
    (d.capture as jest.Mock).mockImplementation(async () => { order.push('capture'); return 'file:///tmp/card.png'; });
    (d.saveToLibrary as jest.Mock).mockImplementation(async () => { order.push('save'); });
    expect(await saveCardToPhotos(ref, d)).toBe('success');
    expect(order).toEqual(['perm', 'capture', 'save']);
    expect(d.saveToLibrary).toHaveBeenCalledWith('file:///tmp/card.png');
  });

  it('권한 거부 = denied + **캡처·저장 미실행**(불필요한 작업 0)', async () => {
    const d = deps({ requestSavePermission: jest.fn().mockResolvedValue(false) });
    expect(await saveCardToPhotos(ref, d)).toBe('denied');
    expect(d.capture).not.toHaveBeenCalled();
    expect(d.saveToLibrary).not.toHaveBeenCalled();
  });

  it('캡처 실패·저장 실패 = error(throw 금지 — 화면이 토스트로 안내)', async () => {
    expect(await saveCardToPhotos(ref, deps({ capture: jest.fn().mockRejectedValue(new Error('x')) }))).toBe('error');
    expect(await saveCardToPhotos(ref, deps({ saveToLibrary: jest.fn().mockRejectedValue(new Error('x')) }))).toBe('error');
  });
});

describe('인스타 스토리', () => {
  it('성공 — 설치 확인 → 캡처 → 공유', async () => {
    const d = deps();
    expect(await shareCardToStory(ref, d)).toBe('success');
    expect(d.shareToStory).toHaveBeenCalledWith('file:///tmp/card.png');
  });

  it('미설치 = not_installed + 캡처·공유 미실행(앱스토어로 보내지 않는다)', async () => {
    const d = deps({ isInstagramInstalled: jest.fn().mockResolvedValue(false) });
    expect(await shareCardToStory(ref, d)).toBe('not_installed');
    expect(d.capture).not.toHaveBeenCalled();
    expect(d.shareToStory).not.toHaveBeenCalled();
  });

  it('공유 실패 = error(미설치와 구분 — 안내 문구가 다르다)', async () => {
    expect(await shareCardToStory(ref, deps({ shareToStory: jest.fn().mockRejectedValue(new Error('x')) }))).toBe('error');
  });

  it('Codex P1 — iOS는 Meta appId 있을 때만 성립 · Android는 appId 무관(4분기)', () => {
    expect(storyShareAvailable('ios', '')).toBe(false);
    expect(storyShareAvailable('ios', '  ')).toBe(false); // 공백뿐 = 없음
    expect(storyShareAvailable('ios', '1234567890')).toBe(true);
    expect(storyShareAvailable('android', '')).toBe(true);
    expect(storyShareAvailable('android', '1234567890')).toBe(true);
  });

  it('Codex P1 — appId 없는 iOS는 unavailable(캡처·공유 미실행) · 빈 appId 전달 금지', async () => {
    const d = deps({ storyAvailable: jest.fn().mockReturnValue(false) });
    expect(await shareCardToStory(ref, d)).toBe('unavailable');
    expect(d.capture).not.toHaveBeenCalled();
    expect(d.shareToStory).not.toHaveBeenCalled();
    const src = read('src/features/order/shareExport.ts');
    expect(src).toContain('...(META_APP_ID ? { appId: META_APP_ID } : {})'); // 빈 문자열을 넘기지 않는다
    // 값은 app.json extra 한 곳 — 코드 하드코딩·EAS 환경 3중 등록을 피한다
    expect(src).toContain("Constants.expoConfig?.extra as { metaAppId?: string }");
    expect(src).not.toMatch(/META_APP_ID = ['\"]\d/); // 리터럴 박기 금지
    const app = JSON.parse(read('app.json')) as { expo: { extra: { metaAppId?: string } } };
    expect(app.expo.extra.metaAppId).toMatch(/^\d{10,}$/);
  });

  it('Android 설치 판별은 패키지 가시성 대상 패키지를 그대로 쓴다(app.json <queries>와 한 쌍)', () => {
    const src = read('src/features/order/shareExport.ts');
    expect(src).toContain("isPackageInstalled('com.instagram.android')");
    const app = JSON.parse(read('app.json')) as { expo: { plugins: unknown[] } };
    const share = app.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'react-native-share') as [string, { android: string[] }];
    expect(share[1].android).toContain('com.instagram.android');
  });
});

describe('5단계 계측 — 이벤트·속성 스키마', () => {
  it('3종 이벤트가 EVENTS에 있고 속성은 음식 개수·장소 유무(+result)까지만', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EVENTS, sanitize } = require('@/lib/analytics') as typeof import('@/lib/analytics');
    expect(EVENTS.order_share_view).toBe('order_share_view');
    expect(EVENTS.order_share_save).toBe('order_share_save');
    expect(EVENTS.order_share_story).toBe('order_share_story');
    // 화이트리스트 밖(가게명·주소·사진 URI)은 드롭돼야 한다
    const dirty = { item_count: 3, has_place: true, place_name: '할머니 순두부', address: '서울 …', uri: 'file:///tmp/card.png' };
    expect(sanitize('order_share_save', { ...dirty, result: 'success' })).toEqual({ item_count: 3, has_place: true, result: 'success' });
    expect(sanitize('order_share_view', dirty)).toEqual({ item_count: 3, has_place: true });
  });

  it('화면 배선 — 탭·결과 2회 발화, 노출은 주문 1건당 1회', () => {
    const src = read('src/app/profile/order/[id].tsx');
    expect(src).toContain("track(EVENTS.order_share_save, { ...shareProps, result: 'tap' })");
    expect(src).toContain('track(EVENTS.order_share_save, { ...shareProps, result: r })');
    expect(src).toContain("track(EVENTS.order_share_story, { ...shareProps, result: 'tap' })");
    expect(src).toContain('track(EVENTS.order_share_story, { ...shareProps, result: r })');
    expect(src).toContain('viewTracked.current = true');
    // Codex 4R P2: 데이터 도착이 아니라 **뷰포트 진입** 기준(공유 섹션은 리스트 아래에 있다)
    expect(src).toContain('onScroll={(e) => maybeTrackShareView(e.nativeEvent.contentOffset.y)}');
    expect(src).toContain('if (sectionY.current > offsetY + viewportH.current) return;');
    // 속성 조립부에 사용자 생성 데이터가 섞이지 않는지(발주 고정)
    expect(src).toContain('const shareProps = { item_count:');
    // Codex 2R P2: 장소 유무 = 카드에 줄이 떴는지(주소 폴백 포함) — placeName만 보면 안 된다
    expect(src).toContain('has_place: !!(q.data && orderPlaceLabel(q.data))');
    expect(src).not.toContain('has_place: !!q.data?.placeName');
    expect(src).not.toContain('place_name:');
    // 권한 거부 안내 = 공용 시트(이 화면은 P-355로 네이티브 Alert를 걷어냈다)
    expect(src).toContain('setPhotoDenied(true)');
    expect(src).not.toContain('Alert.alert');
  });
});

describe('Codex P2 — 내보내기 이미지 로드 전 캡처 금지', () => {
  it('화면이 프리페치 완료까지 busy로 잠그고, 실패해도 영구 잠금되지 않는다', () => {
    const src = read('src/app/profile/order/[id].tsx');
    expect(src).toContain("const [photosState, setPhotosState] = React.useState<'loading' | 'ready' | 'failed'>('loading')");
    expect(src).toContain("busy={photosState !== 'ready'}");
    // 7R: 게이트 = 캔버스 실제 렌더 완료(프리페치 = URL 캐시일 뿐)
    expect(src).toContain("onReady={() => setPhotosState('ready')}");
    expect(src).toContain("onFailed={() => setPhotosState('failed')}");
    expect(src).not.toContain('Image.prefetch('); // 프리페치 기반 게이트 회귀 금지
    // 영구 비활성 방치 금지 — 재시도 = 캔버스 리마운트
    expect(src).toContain('onRetryPhotos={() => setRetry((n) => n + 1)}');
    // 10R: 재시도는 미리보기까지 함께 리마운트 — 둘을 감싼 View에 key(캔버스 전용 key 금지)
    expect(src).toContain('key={`share-${retry}`}');
    expect(src).not.toContain('key={`export-${retry}`}');
  });

  it('버튼 비활성은 불투명도만 — 프레임 메트릭 불변(P-151)', () => {
    const src = read('src/features/order/OrderShareCard.tsx');
    expect(src).toContain('actionBusy: { opacity: 0.45 }');
    expect(src).toContain('disabled={busy}');
    const busyStyle = src.slice(src.indexOf('actionBusy:'), src.indexOf('actionBusy:') + 60);
    for (const metric of ['padding', 'height', 'borderWidth', 'borderRadius', 'gap']) {
      expect(busyStyle).not.toContain(metric);
    }
  });

  it('프리페치 실패 = 재시도 줄 + 캡처 잠금 유지 · 문구 10로케일', () => {
    const src = read('src/features/order/OrderShareCard.tsx');
    expect(src).toContain('testID="share-photos-retry"');
    expect(src).toContain('{failed && !!failedLabel && (');
    for (const loc of ['ko', 'en', 'ja', 'es', 'id', 'ru', 'th', 'vi', 'zh-Hans', 'zh-Hant']) {
      const j = JSON.parse(read(`src/lib/i18n/${loc}.json`)) as { myFoods: Record<string, string> };
      expect(j.myFoods.sharePhotosFailed).toBeTruthy();
    }
  });

  it('스토리 버튼이 없으면 대체 경로 안내를 대신 보여 준다(빈 자리 금지)', () => {
    const src = read('src/features/order/OrderShareCard.tsx');
    expect(src).toContain('{storyAvailable && (');
    expect(src).toContain('testID="share-story-hint"');
    for (const loc of ['ko', 'en', 'ja', 'es', 'id', 'ru', 'th', 'vi', 'zh-Hans', 'zh-Hant']) {
      const j = JSON.parse(read(`src/lib/i18n/${loc}.json`)) as { myFoods: Record<string, string> };
      expect(j.myFoods.shareStoryHint).toBeTruthy();
    }
  });
});

describe('Codex 7R — 캡처 게이트는 캔버스의 실제 로드 이벤트', () => {
  it('칸 전부 로드 = ready · 한 칸이라도 실패 = failed(잠금 유지)', () => {
    const src = read('src/features/order/OrderShareCard.tsx');
    expect(src).toContain('if (done.current >= need)');
    expect(src).toContain('return onFailed?.()');
    expect(src).toContain('onLoad={() => onCellSettle?.(true)}');
    expect(src).toContain('onError={() => onCellSettle?.(false)}');
  });

  it('캡처 인스턴스는 페이드 0 — 전환 중 반투명이 찍히지 않는다', () => {
    const src = read('src/features/order/OrderShareCard.tsx');
    expect(src).toContain('transition={instant ? 0 : undefined}');
    expect(src).toContain('<OrderShareCard {...card} instant onCellSettle={onCellSettle} />');
  });

  it('RemoteImage가 실제 렌더 완료를 통지한다(게이트의 신호원)', () => {
    const src = read('src/components/RemoteImage.tsx');
    expect(src).toContain('onLoad?: () => void;');
    expect(src).toContain('onLoad?.();');
  });
});
