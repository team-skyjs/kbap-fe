/**
 * Food tab — P-318(KB-484) v2: 찾는 카탈로그(세로 그리드 + 필터·정렬).
 * 정본: specs/001-personalized-menu-mvp/home-food-tabs-v2.md.
 * KB-812: 상단 Dishes | Packaged 세그먼트(R-95) — Dishes = 기존 카탈로그 그대로, Packaged = 가공식품 검색.
 * (Dishes 안은 세그먼트 없음 — 칩(위험 4 + Saved 토글) + 정렬 드롭다운, 홈 "See all"의
 * segment·risk 파라미터를 초기 적용(미지값은 parseFoodFilterParams가 강등).
 * 구 greeting·categoryUI(플래그 false 표면)·BrowseCard 소멸 — 데이터 훅·
 * 북마크 토글·위험 필터 로직은 FoodExplorer가 소유(홈 구현 이동, 무변).
 */
import { View, StyleSheet } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StickyHeader, useStickyScroll, useHeaderHeight } from '@/components';
import { color as C } from '@/lib/theme';
import { EVENTS, track } from '@/lib/analytics';
import { FLAGS } from '@/lib/flags';
import { useIsGuest } from '@/lib/auth/useSession';
import { useUnreadCount } from '@/lib/data/useNotifications';
import { FoodExplorer } from '@/features/food/FoodExplorer';
import { parseFoodFilterParams, defaultFoodSegment } from '@/features/food/foodFilterParams';
import { FoodSegmentRow, PackagedExplorer, type FoodSegment } from '@/features/processedFood/PackagedExplorer';
import { PackagedCoachOverlay, takePackagedCoachStep2, usePackagedCoach } from '@/features/coach/PackagedCoach';
import { useCallback, useEffect, useRef, useState } from 'react';

// KB-812: 세그먼트 선택 유지(앱 세션 동안 — 탭 화면이 다시 마운트돼도).
// KB-957(예진 11/2): 첫 진입 기본 = Packaged(운영 채널 = 가공식품 없음 → Dishes). 홈 See all(t·view)·딥링크 우선순위는 아래 전이 그대로
let lastSegment: FoodSegment = defaultFoodSegment(FLAGS.processedFoodEnabled);
const rememberSegment = (s: FoodSegment) => { lastSegment = s; };

export default function Food() {
  const router = useRouter();
  const { onScroll, hidden, atTop } = useStickyScroll();
  const headerH = useHeaderHeight();
  const isGuest = useIsGuest();
  const unread = useUnreadCount();
  // P-318: 홈 See all 파라미터 수신 — 배열형(중복 쿼리)은 첫 값, 미지값은 파서가 강등
  const raw = useLocalSearchParams<{ segment?: string | string[]; risk?: string | string[]; t?: string | string[]; view?: string | string[]; via?: string | string[] }>();
  const one = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);
  const { segment, risk } = parseFoodFilterParams({ segment: one(raw.segment), risk: one(raw.risk) });
  // Codex #308 P2: 홈 "See all"(새 t 파라미터) = 요리 카탈로그 요청 — Packaged에 있었어도 Dishes로(렌더 중 전이 비교, KB-603)
  // KB-955: 홈 편의점 줄 See all = view=packaged → Packaged 세그먼트(운영 채널 = 세그먼트 없음 → Dishes 그대로)
  const seeAllKey = one(raw.t) ?? '';
  const seeAllTarget: FoodSegment = one(raw.view) === 'packaged' && FLAGS.processedFoodEnabled ? 'packaged' : 'dishes';
  // QA Q-389: 음식 탭을 한 번도 안 연 채 See all로 들어오면 첫 마운트의 t가 곧 prevSeeAll이라 "바뀜"이 없어 view가 무시됐다 → 첫 마운트에도 적용
  const [foodSegment, setFoodSegmentState] = useState<FoodSegment>(() => {
    if (!seeAllKey) return lastSegment;
    rememberSegment(seeAllTarget);
    return seeAllTarget;
  });
  const setFoodSegment = (s: FoodSegment) => { rememberSegment(s); setFoodSegmentState(s); };
  const [prevSeeAll, setPrevSeeAll] = useState(seeAllKey);
  if (seeAllKey !== prevSeeAll) {
    setPrevSeeAll(seeAllKey);
    if (seeAllKey) { rememberSegment(seeAllTarget); setFoodSegmentState(seeAllTarget); }
  }
  // KB-870: 운영 채널(운영 서버에 가공식품 API 없음) = 세그먼트째 없음 → Dishes 고정(main과 같은 화면)
  // KB-957: Dishes | Packaged = 헤더 로고 줄 안(별도 세그먼트 줄 소멸)
  // KB-973: 세그먼트 전환 계측 — 탭 = 바뀔 때만(source tap) · 링크 진입(새 t) = 진입마다 1회(source = 코치마크 via=coach | see_all)
  const pickSegment = (s: FoodSegment) => {
    if (s !== foodSegment) track(EVENTS.food_segment_select, { segment: s, source: 'tap' });
    setFoodSegment(s);
  };
  const via = one(raw.via) === 'coach' ? 'coach' : 'see_all';
  const segTrackedKey = useRef('');
  useEffect(() => {
    if (!seeAllKey || !FLAGS.processedFoodEnabled || segTrackedKey.current === seeAllKey) return;
    segTrackedKey.current = seeAllKey;
    track(EVENTS.food_segment_select, { segment: seeAllTarget, source: via });
  }, [seeAllKey, seeAllTarget, via]);
  const segRow = FLAGS.processedFoodEnabled ? <FoodSegmentRow value={foodSegment} onChange={pickSegment} /> : null;
  // KB-968: 코치마크 2단계 — 홈 1단계 탭으로 들어왔을 때만(포커스에서 가져감)
  // KB-971: 진입부터 Packaged 선택(view=packaged) · 탭 = 종료(선택 유지 — 아래 설정은 같은 값이라 무변)
  const foodCoach = usePackagedCoach('food', { next: () => setFoodSegment('packaged') });
  const showFoodCoach = foodCoach.show;
  const abortFoodCoach = foodCoach.abort;
  useFocusEffect(
    useCallback(() => {
      if (takePackagedCoachStep2()) showFoodCoach();
      return () => abortFoodCoach(); // 2단계가 떠 있는 채 탭 전환 = 닫기(홈과 같은 규칙)
    }, [showFoodCoach, abortFoodCoach]),
  );

  return (
    <View style={styles.root}>
      {segRow && foodSegment === 'packaged' ? (
        <PackagedExplorer top={null} topPad={headerH} onScroll={onScroll} />
      ) : (
      <FoodExplorer
        variant="screen"
        guest={isGuest}
        initialSaved={segment === 'saved'}
        paramsKey={one(raw.t) ?? ''}
        initialRisk={risk}
        srcTag="list"
        onScroll={onScroll}
        topPad={headerH}
      />
      )}
      <StickyHeader
        center={segRow}
        hidden={hidden}
        atTop={atTop}
        mode="brand"
        bell={FLAGS.notificationCenter}
        bellCount={unread}
        onBell={() => router.push('/notifications' as Href)}
      />
      <PackagedCoachOverlay {...foodCoach.props} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
});
