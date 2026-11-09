// KB-1019: 홈 최상단 진입은 시연 채널 게이트 뒤에만, 프로브(임시)로 연결, 문구는 i18n 키.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readFileSync } = require('fs');

const src = readFileSync('src/app/(tabs)/index.tsx', 'utf8') as string;
const en = JSON.parse(readFileSync('src/lib/i18n/en.json', 'utf8'));

it('진입 버튼은 isBbqProbeChannel 게이트 뒤', () => {
  expect(src).toContain('const [bbqEntry] = useState(isBbqProbeChannel);');
  expect(src).toMatch(/\{bbqEntry && \(\s*<Pressable onPress=\{\(\) => router\.push\('\/dev\/bbq-probe' as Href\)\}/);
});

it('헤더 첫 요소 = 진입 버튼(업데이트 넛지·검색보다 위)', () => {
  const i = src.indexOf('testID="home-bbq-entry"');
  expect(i).toBeGreaterThan(0);
  expect(i).toBeLessThan(src.indexOf('<UpdateNudgeBanner />'));
});

it('문구는 en 키(가운뎃점 없음)', () => {
  expect(en.bbqGuide).toEqual({ entryTitle: 'Having Korean BBQ?', entrySub: 'Follow along with the guide.' });
  expect(src).toContain("t('bbqGuide.entryTitle')");
  expect(JSON.stringify(en.bbqGuide)).not.toContain('·');
});
