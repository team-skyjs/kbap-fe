/**
 * KB-982 — 메뉴판 스캔 담기 카트(scanCartKey → 수량). KB-1006: 키 = itemId(+ 수량 옵션 index) — 옵션마다 따로 담긴다. 구 scan.tsx 로컬 state(P-136)를 모듈 스토어로 올려
 * 스캔 진입 음식 상세(`/food/[id]?src=scan&item=`)와 공유한다. 스캔 세션 한정 — 재촬영·스캔 화면 언마운트 = 초기화.
 * 담기·빼기 이벤트는 여기 한 곳(결과 리스트·상세가 같은 계측).
 */
import { useSyncExternalStore } from 'react';
import { EVENTS, track } from '@/lib/analytics';
import { airbridge } from '@/lib/airbridge';
import type { ResultDish } from '@/lib/scan/segmentMenu';

export type CartDish = Pick<ResultDish, 'itemId' | 'risk' | 'foodId' | 'koreanName' | 'rawMenuName'> & {
  /** KB-1006(Codex #440 P2): 수량 옵션 메뉴면 0 — 상세는 첫 옵션(= 표시 가격 price, S-969 계약) 키로 담는다. 옵션 없음 = null/부재 */
  opt?: number | null;
};

/** KB-1006: 카트 키 — 옵션 없음 = "itemId", 옵션 = "itemId#index"(주문 카드에 옵션별 한 줄) */
export function scanCartKey(itemId: number, opt?: number | null): string {
  return opt == null ? String(itemId) : `${itemId}#${opt}`;
}

let cart: ReadonlyMap<string, number> = new Map();
let dishes: ReadonlyMap<number, CartDish> = new Map();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

export function bumpScanCart(key: string, delta: number): void {
  const next = new Map(cart);
  const q = (next.get(key) ?? 0) + delta;
  if (q <= 0) next.delete(key);
  else next.set(key, q);
  cart = next;
  emit();
}

export function addScanItem(d: CartDish, opt?: number | null): void {
  track(EVENTS.scan_item_add, { risk: d.risk });
  airbridge.addToCart({ id: d.foodId ?? `menu:${d.itemId}`, name: d.koreanName ?? d.rawMenuName });
  bumpScanCart(scanCartKey(d.itemId, opt), 1);
}

export function removeScanItem(d: CartDish, opt?: number | null): void {
  track(EVENTS.scan_item_remove, { risk: d.risk });
  bumpScanCart(scanCartKey(d.itemId, opt), -1);
}

/** 상세 열기 직전 — 상세가 itemId로 찾을 메뉴(담기 이벤트 속성용). 카트는 건드리지 않는다 */
export function rememberScanDish(d: CartDish): void {
  const next = new Map(dishes);
  next.set(d.itemId, { itemId: d.itemId, risk: d.risk, foodId: d.foodId, koreanName: d.koreanName, rawMenuName: d.rawMenuName, opt: d.opt ?? null });
  dishes = next;
  emit();
}

/** KB-1006(Codex #440 P2): 옵션 없이 담긴 수량을 옵션 키로 옮긴다 — AI 줄을 응답 전에 담았는데 응답이 수량 옵션을 주면
 *  옵션 없는 키는 줄·주문 카드 어디서도 안 읽혀 필 숫자에만 남는다. price = 첫 옵션 값(S-969)이라 옵션 0으로 */
export function migrateScanCartKey(from: string, to: string): void {
  const q = cart.get(from) ?? 0;
  if (q <= 0 || from === to) return;
  const next = new Map(cart);
  next.delete(from);
  next.set(to, (next.get(to) ?? 0) + q);
  cart = next;
  emit();
}

/** 재촬영·스캔 화면 닫힘 */
export function resetScanCart(): void {
  if (cart.size === 0 && dishes.size === 0) return;
  cart = new Map();
  dishes = new Map();
  emit();
}

export function useScanCart(): ReadonlyMap<string, number> {
  return useSyncExternalStore(subscribe, () => cart, () => cart);
}

export function useScanCartDish(itemId: number | null): CartDish | null {
  return useSyncExternalStore(subscribe, () => (itemId == null ? null : dishes.get(itemId) ?? null), () => null);
}
