/** KB-729 공부 #244 — 이번 실행 숨김은 메모리뿐(모듈 리셋 = 재시작이면 다시 묻는다) · 시트 표시 중 딥링크 보류 → 닫힌 뒤 순서대로. */
import { _resetSurveyHiddenForTest, deferUntilSurveyClosed, hideSurveyThisRun, isSurveyHiddenThisRun, isSurveyPresented, setSurveyPresented } from '@/lib/survey/surveySession';

beforeEach(() => _resetSurveyHiddenForTest());

it('hideSurveyThisRun = 메모리 플래그 — 영구 저장 0(AsyncStorage import 없음), 모듈 리셋(재시작)이면 false', () => {
  expect(isSurveyHiddenThisRun()).toBe(false);
  hideSurveyThisRun();
  expect(isSurveyHiddenThisRun()).toBe(true);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const src = require('fs').readFileSync('src/lib/survey/surveySession.ts', 'utf8') as string;
  expect(src).not.toContain('AsyncStorage');
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fresh = require('@/lib/survey/surveySession') as typeof import('@/lib/survey/surveySession');
    expect(fresh.isSurveyHiddenThisRun()).toBe(false); // 다음 실행 = 서버가 false면 다시 묻는다
  });
});

it('시트가 떠 있으면 딥링크 이동을 보류 → 닫힌 뒤 순서대로 1회 · 안 떠 있으면 즉시', () => {
  const log: string[] = [];
  deferUntilSurveyClosed(() => log.push('a'));
  expect(log).toEqual(['a']);
  setSurveyPresented(true);
  expect(isSurveyPresented()).toBe(true);
  deferUntilSurveyClosed(() => log.push('b'));
  deferUntilSurveyClosed(() => log.push('c'));
  expect(log).toEqual(['a']);
  setSurveyPresented(false);
  expect(log).toEqual(['a', 'b', 'c']);
  setSurveyPresented(false); // 다시 닫아도 재실행 0
  expect(log).toEqual(['a', 'b', 'c']);
});
