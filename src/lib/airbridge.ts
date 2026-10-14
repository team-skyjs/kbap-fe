/**
 * airbridge (KB-783) — 에어브릿지(MMP) 표준 이벤트·식별의 **유일한 진입점**. 화면은 SDK를 직접 부르지 않는다.
 *
 * 요금제 ABR_CORE = **표준 카테고리만**(커스텀 카테고리 금지 — 아래 EVENT 표 밖의 문자열을 보낼 길이 없다).
 * 속성은 이 파일이 고른 키만: 식별자(음식 id·이름)·개수·enum. **PII 금지**(이메일·닉네임·국적·회피 재료) — 식별은 회원 번호만.
 * 주문 완료엔 금액을 넣지 않는다(예상 합계는 실결제가 아님 — value·currency 없음).
 *
 * 네이티브 모듈이 없으면(웹·유닛·구 런타임) SDK가 스스로 no-op이다(NativeModules.EventInteractor 부재 → Dependency undefined).
 * 그래도 계측이 앱을 멈추면 안 되므로 호출마다 try/catch.
 */
import { Platform } from 'react-native';

/** 표준 카테고리·속성 키 — SDK 상수와 같은 값(유닛이 이름별로 SDK 실값과 대조). SDK를 모듈 로드 시점에 건드리지 않으려고 사본을 둔다:
 *  SDK는 import만으로 NativeModules를 읽어, react-native를 통째 목한 유닛(beAuth 경유 등)에서 로드가 깨진다. */
export const CATEGORY = {
  SIGN_UP: 'airbridge.user.signup',
  SIGN_IN: 'airbridge.user.signin',
  SIGN_OUT: 'airbridge.user.signout',
  COMPLETE_TUTORIAL: 'airbridge.completeTutorial',
  HOME_VIEWED: 'airbridge.ecommerce.home.viewed',
  SPEND_CREDITS: 'airbridge.spendCredits',
  PRODUCT_LIST_VIEWED: 'airbridge.ecommerce.productList.viewed',
  SEARCH_RESULTS_VIEWED: 'airbridge.ecommerce.searchResults.viewed',
  PRODUCT_VIEWED: 'airbridge.ecommerce.product.viewed',
  ADD_TO_WISHLIST: 'airbridge.addToWishlist',
  ADDED_TO_CART: 'airbridge.ecommerce.product.addedToCart',
  ORDER_COMPLETED: 'airbridge.ecommerce.order.completed',
  RATE: 'airbridge.rate',
  SHARE: 'airbridge.share',
  AD_IMPRESSION: 'airbridge.adImpression',
  AD_CLICK: 'airbridge.adClick',
  UNLOCK_ACHIEVEMENT: 'airbridge.unlockAchievement',
} as const;
export const ATTRIBUTE = {
  PRODUCTS: 'products',
  PRODUCT_ID: 'productID',
  PRODUCT_NAME: 'name',
  PRODUCT_QUANTITY: 'quantity',
  QUERY: 'query',
  TOTAL_QUANTITY: 'totalQuantity',
  RATE: 'rate',
  MAX_RATE: 'maxRate',
  SHARED_CHANNEL: 'sharedChannel',
  ACHIEVEMENT_ID: 'achievementID',
} as const;
const C = CATEGORY;
const A = ATTRIBUTE;

type Sdk = typeof import('airbridge-react-native-sdk');
let sdk: Sdk['Airbridge'] | null | undefined;
/** SDK 1회 지연 로드 — 실패(목 환경 등) = null, 계측만 빠진다. 앱(Metro)에선 import가 던지지 않는다(네이티브 부재도 SDK가 no-op). */
function ab(): Sdk['Airbridge'] | null {
  if (sdk !== undefined) return sdk;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sdk = (require('airbridge-react-native-sdk') as Sdk).Airbridge;
  } catch {
    sdk = null;
  }
  return sdk;
}

type Attrs = Record<string, unknown>;

function send(category: string, semantic?: Attrs, custom?: Attrs): void {
  if (Platform.OS === 'web') return;
  try {
    ab()?.trackEvent(category, semantic, custom);
  } catch {
    /* 계측만 포기 */
  }
}

type Product = { id: string; name?: string | null; quantity?: number };
const products = (list: Product[]) => ({
  [A.PRODUCTS]: list.map((p) => ({
    [A.PRODUCT_ID]: p.id,
    ...(p.name ? { [A.PRODUCT_NAME]: p.name } : {}),
    ...(p.quantity != null ? { [A.PRODUCT_QUANTITY]: p.quantity } : {}),
  })),
});

/** 가입·로그인 이벤트 대기분 — 로그인 응답 시점엔 회원 번호가 아직 없다(members/me 성공에서 식별). 식별 직후 1회 발사해 익명 전환으로 남지 않게. */
let pendingAuth: string | null = null;

/** 광고 형식 — lib/analytics의 ad_* format enum과 같은 값 */
export type AdFormat = 'banner' | 'interstitial' | 'rewarded' | 'native';

export const airbridge = {
  /** 1 회원가입 완료 = 서버가 신규 회원이라고 답한 로그인(newMember). **식별 뒤 발사**(#278 Codex P1) — setAirbridgeUser가 비운다 */
  signUp: () => {
    pendingAuth = C.SIGN_UP;
  },
  /** 2 기존 회원 로그인 — 위와 같이 식별 뒤 */
  signIn: () => {
    pendingAuth = C.SIGN_IN;
  },
  /** 3 사용자가 누른 로그아웃(만료·재설치 정리는 아님) */
  signOut: () => send(C.SIGN_OUT),
  /** 4 온보딩 완료(게스트 포함). guest = BE 토큰 유무(서버 세션이 정본), 모름(null) = 속성 생략 */
  completeTutorial: (p: { guest: boolean | null }) => send(C.COMPLETE_TUTORIAL, undefined, p.guest == null ? undefined : { is_guest: p.guest }),
  /** 5 홈 탭 진입 */
  homeView: () => send(C.HOME_VIEWED),
  /** 6a 스캔 성공 = 무료 스캔 1회 소모. 쿼터 = 스캔 **전** 서버 스냅샷(me.scanQuota) 그대로 — 클라가 빼서 만들지 않는다(scanTicket250 잠금 취지) */
  scanSpend: (quota: { remaining: number | 'unlimited'; unlocked: boolean } | null | undefined) =>
    send(C.SPEND_CREDITS, undefined, {
      credits: 1,
      ...(quota ? { remaining_before: String(quota.remaining), unlocked: quota.unlocked } : {}),
    }),
  /** 6b 스캔 결과 표시 — 인식 메뉴 수 */
  scanResults: (itemCount: number) => send(C.PRODUCT_LIST_VIEWED, undefined, { item_count: itemCount }),
  /** 7 검색 결과 — **자유 텍스트 검색어 전송 금지**(P-214 keywordPrivacy와 같은 규칙): 카탈로그에 매칭된 값만 query, 미매칭은 query 없이 결과 수만 */
  searchResults: (p: { keyword?: string; resultCount: number }) =>
    send(C.SEARCH_RESULTS_VIEWED, p.keyword ? { [A.QUERY]: p.keyword } : undefined, { result_count: p.resultCount, matched: !!p.keyword }),
  /** 8 음식 상세 */
  productView: (p: Product) => send(C.PRODUCT_VIEWED, products([p])),
  /** 9 저장 */
  wishlist: (p: Product) => send(C.ADD_TO_WISHLIST, products([p])),
  /** 10 주문 카드 담기 */
  addToCart: (p: Product) => send(C.ADDED_TO_CART, products([{ ...p, quantity: 1 }])),
  /** 11 주문 카드 Done — 금액 없음 */
  orderComplete: (itemCount: number) => send(C.ORDER_COMPLETED, { [A.TOTAL_QUANTITY]: itemCount }, { item_count: itemCount }),
  /** 12 리뷰 등록 */
  rate: (p: { foodId: string; rating: number; hasPhoto: boolean }) =>
    send(C.RATE, { [A.RATE]: p.rating, [A.MAX_RATE]: 5, ...products([{ id: p.foodId }]) }, { has_photo: p.hasPhoto }),
  /** 13 스토리 카드 저장·공유(성공만) */
  share: (channel: 'save' | 'instagram_story') => send(C.SHARE, { [A.SHARED_CHANNEL]: channel }),
  /** 14 광고 노출·클릭 */
  adImpression: (format: AdFormat, placement: string) => send(C.AD_IMPRESSION, undefined, { format, placement }),
  adClick: (format: AdFormat, placement: string) => send(C.AD_CLICK, undefined, { format, placement }),
  /** 15 스캔 무제한 해제 */
  unlock: (via: 'ad' | 'review') => send(C.UNLOCK_ACHIEVEMENT, { [A.ACHIEVEMENT_ID]: 'scan_unlimited' }, { via }),
};

let deeplinkInit = false;
/** 앱 시작 1회(app/_layout) — 에어브릿지 딥링크(트래킹 링크·지연 딥링크·kbap:// 재전달) → lib/deeplink 한 곳.
 *  처리기는 인자로 받는다 — 이 모듈이 라우터(expo-router)를 끌어오지 않게(beAuth·useMe 경유 유닛이 이 파일을 로드한다). */
export function initAirbridgeDeeplinks(handleDeeplink: (url: string) => unknown): void {
  if (deeplinkInit || Platform.OS === 'web') return;
  deeplinkInit = true;
  try {
    ab()?.setOnDeeplinkReceived((url: string) => {
      handleDeeplink(url);
    });
  } catch {
    /* noop */
  }
}

/** 로그인·세션 복원(members/me 성공 — lib/data/useMe) = 회원 번호만. 대기 중인 가입·로그인 이벤트는 식별 **다음에** 보낸다 */
export function setAirbridgeUser(memberId: string): void {
  if (Platform.OS === 'web') return;
  try {
    ab()?.setUserID(memberId);
  } catch {
    /* noop */
  }
  const auth = pendingAuth;
  pendingAuth = null;
  if (auth) send(auth);
}

/** 세션 끝(로그아웃·만료·탈퇴·재설치 정리 — beAuth.endSessionBoundary) */
export function clearAirbridgeUser(): void {
  quota = null;
  adUnlockPending = false; // #278 Codex P2: 세션 경계에서 같이 비운다 — 남으면 다음 회원의 리뷰 해제 전이를 삼킨다
  pendingAuth = null; // 식별 전에 세션이 끝났으면 그 가입·로그인은 누구의 것도 아니다
  if (Platform.OS === 'web') return;
  try {
    ab()?.clearUser();
  } catch {
    /* noop */
  }
}

/* ---- 15 해제 경로 판별 ----
 * 광고 해제는 보상 응답(scanUnlocked)에서 바로 'ad'로 보낸다. 리뷰 해제는 응답에 실리지 않아 **서버 프로필의 전이**로만 안다
 * (같은 회원의 unlocked false → true). 광고 해제도 같은 전이를 만들므로, 광고로 보낸 직후의 전이 1회는 건너뛴다(중복 0).
 * 앱이 꺼진 사이의 해제(이전 값 모름)는 보내지 않는다 — 추측으로 경로를 붙이지 않는다. */
let quota: { memberId: string; unlocked: boolean } | null = null;
let adUnlockPending = false;

export function noteAdUnlock(): void {
  adUnlockPending = true;
  airbridge.unlock('ad');
}

/** members/me 성공마다(useMe.fetchMe) — unlocked = adaptScanQuota 결과(null = 구서버·판별 불가 → 무시) */
export function observeScanQuota(memberId: string, unlocked: boolean | null | undefined): void {
  if (unlocked == null) return;
  const prev = quota;
  quota = { memberId, unlocked };
  if (unlocked && adUnlockPending) {
    adUnlockPending = false; // 광고 해제가 프로필에 반영된 첫 관측 — 전이 여부와 무관하게 소비(남아서 뒤의 리뷰 해제를 삼키지 않게)
    return;
  }
  if (!prev || prev.memberId !== memberId || prev.unlocked || !unlocked) return;
  airbridge.unlock('review');
}

/** 유닛 전용 */
export function __resetAirbridgeStateForTest(): void {
  sdk = undefined;
  pendingAuth = null;
  deeplinkInit = false;
  quota = null;
  adUnlockPending = false;
}
