/**
 * KB-982 — 메뉴판 스캔 담기 카트(itemId → 수량). 구 scan.tsx 로컬 state(P-136)를 모듈 스토어로 올려
 * 스캔 진입 음식 상세(`/food/[id]?src=scan&item=`)와 공유한다. 스캔 세션 한정 — 재촬영·스캔 화면 언마운트 = 초기화.
 * 담기·빼기 이벤트는 여기 한 곳(결과 리스트·상세가 같은 계측).
 */
import { useSyncExternalStore } from 'react';
import { EVENTS, track } from '@/lib/analytics';
import { airbridge } from '@/lib/airbridge';
import type { ResultDish } from '@/lib/scan/segmentMenu';

export type CartDish = Pick<ResultDish, 'itemId' | 'risk' | 'foodId' | 'koreanName' | 'rawMenuName'>;

let cart: ReadonlyMap<number, number> = new Map();
let dishes: ReadonlyMap<number, CartDish> = new Map();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

export function bumpScanCart(itemId: number, delta: number): void {
  const next = new Map(cart);
  const q = (next.get(itemId) ?? 0) + delta;
  if (q <= 0) next.delete(itemId);
  else next.set(itemId, q);
  cart = next;
  emit();
}

export function addScanItem(d: CartDish): void {
  track(EVENTS.scan_item_add, { risk: d.risk });
  airbridge.addToCart({ id: d.foodId ?? `menu:${d.itemId}`, name: d.koreanName ?? d.rawMenuName });
  bumpScanCart(d.itemId, 1);
}

export function removeScanItem(d: CartDish): void {
  track(EVENTS.scan_item_remove, { risk: d.risk });
  bumpScanCart(d.itemId, -1);
}

/** 상세 열기 직전 — 상세가 itemId로 찾을 메뉴(담기 이벤트 속성용). 카트는 건드리지 않는다 */
export function rememberScanDish(d: CartDish): void {
  const next = new Map(dishes);
  next.set(d.itemId, { itemId: d.itemId, risk: d.risk, foodId: d.foodId, koreanName: d.koreanName, rawMenuName: d.rawMenuName });
  dishes = next;
  emit();
}

/** 재촬영·스캔 화면 닫힘 */
export function resetScanCart(): void {
  if (cart.size === 0 && dishes.size === 0) return;
  cart = new Map();
  dishes = new Map();
  emit();
}

export function useScanCart(): ReadonlyMap<number, number> {
  return useSyncExternalStore(subscribe, () => cart, () => cart);
}

export function useScanCartDish(itemId: number | null): CartDish | null {
  return useSyncExternalStore(subscribe, () => (itemId == null ? null : dishes.get(itemId) ?? null), () => null);
}
