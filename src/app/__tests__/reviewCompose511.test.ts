/** P-348(KB-511) — 리뷰 작성 7건 + 공용 PhotoViewer 잠금. */
const read = (p: string) => require('fs').readFileSync(p, 'utf8') as string;

it('① Star = 1px 절대 보더(strokeWidth 16/size — P-349 ①: vectorEffect는 clipPath 충돌로 금지)', () => {
  const st = read('src/components/Stars.tsx');
  expect((st.match(/strokeWidth=\{16 \/ size\}/g) ?? []).length).toBe(2);
  expect(st).not.toContain('vectorEffect='); // KB-512 실기: clipPath 부분 채움이 조각 렌더
  expect(st).not.toContain('sw?:');
  expect(read('src/app/food/[id]/review.tsx')).not.toContain('sw={3}');
  expect(read('src/features/review/ReviewCellParts.tsx')).not.toContain('sw={2}');
});

it('② 평점 캡션 = 숫자만(labels·ratingValue 소멸, 빈 상태 tapToRate 유지) + 키 10로케일 제거', () => {
  const rv = read('src/app/food/[id]/review.tsx');
  expect(rv).toContain("rating ? String(rating) : t('review.tapToRate')");
  expect(rv).not.toContain("t('review.ratingValue'");
  expect(rv).not.toContain("t('review.labels'");
  for (const loc of ['ko', 'en', 'ja', 'es', 'id', 'ru', 'th', 'vi', 'zh-Hans', 'zh-Hant']) {
    const j = read(`src/lib/i18n/${loc}.json`);
    expect(j).not.toContain('ratingValue');
    expect(j).not.toContain('photosLabel');
  }
});

it('③④ 사진 슬롯 = 아이콘만 + 탭 = 촬영/갤러리 시트(choosePhotoSource 재사용·권한 거부 = 스캔 문법)', () => {
  const rv = read('src/app/food/[id]/review.tsx');
  expect(rv).not.toContain('photoCap:'); // 스타일 소멸(photoCapNote 스낵바 키는 별개)
  expect(rv).not.toContain('photosLabel');
  expect(rv).toContain('choosePhotoSource({');
  expect(rv).toContain("ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })");
  expect(rv).toContain('requestCameraPermissionsAsync');
  expect(rv).toContain("t('scan.permissionSettingsBody')"); // 거부 = 설정 유도(스캔 동일)
  expect(rv).not.toContain("require('expo-document-picker')"); // 파일 선택 = 비범위(TODO — 주석 언급만 허용)
});

it('⑤ 키보드 — 수동 kbH 패딩 소멸 + iOS automaticallyAdjustKeyboardInsets(커서 추종 kbH 실측은 유지)', () => {
  const rv = read('src/app/food/[id]/review.tsx');
  expect(rv).toContain('{ paddingBottom: 28 }');
  expect(rv).not.toContain('28 + kbH');
  expect(rv).toContain("automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}");
  expect(rv).toContain('ensureCursorVisible'); // 스크롤 계산용 실측 유지
});

it('⑥ 공용 PhotoViewer — 두 호출처 교체 + 임계 상수·충돌 방지·RootView 잠금', () => {
  const pv = read('src/components/PhotoViewer.tsx');
  expect(pv).toContain('export const VIEWER_DISMISS_DY = 100');
  expect(pv).toContain('export const VIEWER_DISMISS_VY = 800');
  // P-349 ②: 임계 상수화(±16/±40) — 구체값은 field0910Kb512가 잠금
  expect(pv).toContain('.activeOffsetY([-VIEWER_PAN_ACTIVE_Y, VIEWER_PAN_ACTIVE_Y])');
  expect(pv).toContain('.failOffsetX([-VIEWER_PAN_FAIL_X, VIEWER_PAN_FAIL_X])');
  expect(pv).toContain('.runOnJS(true)');
  expect(pv).toContain('<GestureHandlerRootView style={{ flex: 1 }} testID="photo-viewer">'); // P-337 문법(안드 Modal)
  expect(read('src/features/review/ReviewCellParts.tsx')).toContain('<PhotoViewer uris={photos} index={openAt}');
  expect(read('src/app/profile/order/[id].tsx')).toContain('<PhotoViewer uris={[q.data.scanImageUrl]}');
});

it('⑦ Service 줄바꿈 — 라벨 1줄 고정(flexShrink 0)·별 행 축소·extrasBox mx 20', () => {
  const rc = read('src/features/review/ReviewCellParts.tsx');
  expect(rc).toContain('extrasBox: { gap: 18, marginHorizontal: 20 }');
  expect(rc).toMatch(/extrasLabelWrap: \{[^}]*flexShrink: 0/);
  expect(rc).toContain('<Text style={styles.extrasLabel} numberOfLines={1}>');
});
