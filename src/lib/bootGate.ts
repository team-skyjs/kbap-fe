/**
 * bootGate.ts — 스플래시 게이팅 (P-018/KB-194, QA Q-07).
 *
 * "~0.1초 반짝"과 "무한 스플래시"를 동시에 막는다:
 *   - 최소 노출 SPLASH_MIN_MS: 준비가 일찍 끝나도 min을 채운 뒤 hide (반짝임 소멸)
 *   - 상한 SPLASH_CAP_MS: 초과 시 프리페치를 버리고 진입 — KB-174 스켈레톤/J4가
 *     이어받는다. 프리페치 실패·오프라인은 스플래시를 붙잡지 않는다(reject=settle).
 *
 * 프리페치 쿼리 키는 각 훅의 실키(lang 종속)와 일치해야 한다 — 불일치면
 * 프리페치가 무의미해진다 (LocaleProvider LANG_DEPENDENT_KEYS와 같은 대상).
 */
import i18n from '@/lib/i18n';
import { queryClient } from '@/lib/queryClient';
import { resolveInitialLang } from '@/lib/i18n/LocaleProvider';
import { fetchHome } from '@/lib/data/useHome';
import { fetchFoodsPage } from '@/lib/data/useFoods';
import { fetchMe } from '@/lib/data/useMe';
import { hasBeSession } from '@/lib/auth/beAuth';

export const SPLASH_MIN_MS = 1200;
export const SPLASH_CAP_MS = 4000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * hide 시점 판정 (순수 — 타이머 주입 가능):
 * resolve 조건 = max(min 경과, min(모든 작업 settle, cap 경과)).
 * ready/prefetch 는 reject 여도 settle 로 취급 — hide 를 지연시키지 않는다.
 */
export async function gateSplash(opts: {
  ready: Promise<unknown>;
  prefetch: Promise<unknown>;
  minMs?: number;
  capMs?: number;
  delay?: (ms: number) => Promise<void>;
}): Promise<void> {
  const delay = opts.delay ?? sleep;
  const settled = Promise.allSettled([opts.ready, opts.prefetch]).then(() => {});
  await Promise.all([Promise.race([settled, delay(opts.capMs ?? SPLASH_CAP_MS)]), delay(opts.minMs ?? SPLASH_MIN_MS)]);
}

/**
 * 부트 프리페치 — 홈·음식 목록(+세션 있으면 me). 저장 언어를 먼저 적용해
 * (LocaleProvider 마운트 전) 캐시 키·Accept-Language 가 실키와 일치하게 한다.
 * 어떤 실패도 삼킨다 — 부트를 막지 않고, 화면 쿼리가 정상 경로로 재시도.
 */
export async function prefetchBootData(): Promise<void> {
  try {
    const lang = await resolveInitialLang();
    if (i18n.language !== lang) await i18n.changeLanguage(lang).catch(() => {});
    const jobs: Promise<unknown>[] = [
      queryClient.prefetchQuery({ queryKey: ['home', lang], queryFn: fetchHome }),
      queryClient.prefetchInfiniteQuery({
        queryKey: ['foods', 'list', lang],
        queryFn: () => fetchFoodsPage(undefined),
        initialPageParam: undefined as number | undefined,
      }),
    ];
    if (await hasBeSession()) {
      jobs.push(queryClient.prefetchQuery({ queryKey: ['me', lang], queryFn: fetchMe }));
    }
    await Promise.allSettled(jobs);
  } catch {
    /* 프리페치는 best-effort — 실패해도 부트 진행 */
  }
}
