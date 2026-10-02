/**
 * KB-710(P-450 ①) — 입력창 글자도 Txt와 같은 큰 글자 상한(×1.3). AX3에서 문의 본문·닉네임이 주변 글자의 약 2배였다.
 * 앱의 텍스트 입력은 공용 Input(KeyboardDismissBar) 하나를 거친다 → 거기 한 곳 + "그 밖에 TextInput 직접 렌더 0" 구조 잠금.
 */
import * as React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { readdirSync, readFileSync } from 'fs';
import { Input } from '../KeyboardDismissBar';
import { MAX_FONT_SCALE } from '../Txt';

it('공용 Input = maxFontSizeMultiplier MAX_FONT_SCALE(1.3, Txt와 같은 값) · 호출부가 명시하면 그 값', () => {
  let t!: ReactTestRenderer;
  act(() => { t = renderer.create(<Input value="" onChangeText={() => {}} />); });
  expect(MAX_FONT_SCALE).toBe(1.3);
  expect(t.root.findByType(TextInput).props.maxFontSizeMultiplier).toBe(MAX_FONT_SCALE);
  act(() => { t.update(<Input value="" onChangeText={() => {}} maxFontSizeMultiplier={1} />); });
  expect(t.root.findByType(TextInput).props.maxFontSizeMultiplier).toBe(1);
});

it('구조 잠금: 앱 소스에서 <TextInput>을 직접 그리는 곳은 공용 Input 하나뿐(새 입력창도 상한을 자동으로 받게)', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== '__tests__') walk(p); } else if (/\.tsx$/.test(e.name)) files.push(p);
    }
  };
  walk('src');
  // JSX 태그만(`useRef<TextInput>` 같은 타입 인자는 제외) — `<TextInput` 뒤 공백·줄바꿈·`/`
  const direct = files.filter((f) => /<TextInput[\s/]/.test(readFileSync(f, 'utf8')));
  expect(direct).toEqual(['src/components/KeyboardDismissBar.tsx']);
  expect(readFileSync('src/components/KeyboardDismissBar.tsx', 'utf8')).toContain('maxFontSizeMultiplier={MAX_FONT_SCALE}');
});

it('(5) /states — 위 안전 영역은 SubHeader가 더한다: 화면 루트에서 또 더하지 않음(헤더 20pt 아래로 밀리던 것)', () => {
  const src = readFileSync('src/app/states.tsx', 'utf8');
  expect(src).toContain('<SubHeader');
  expect(src).not.toMatch(/paddingTop:\s*insets\.top/);
  expect(readFileSync('src/components/SubHeader.tsx', 'utf8')).toContain('paddingTop: insets.top + 8');
});
