/**
 * KB-1014(서버 KB-1012 #600): 메뉴 음식의 대표 편의점 음식 — 음식 상세·스캔 v2 결과(matched만) 공용.
 * 표시 전용 — 위험도·재료 판정은 메뉴 음식 값 그대로(연결 상품 판정 섞지 않음, 예진 11/6).
 * id·name 없음 = 연결 없음(null). imageUrl = 승인 누끼 절대 URL만(그 밖 null = 음식 사진 그대로).
 */
export interface LinkedProcessedFood {
  id: string;
  name: string;
  nameKo: string | null;
  imageUrl: string | null;
}
export function adaptLinkedProcessed(w: unknown): LinkedProcessedFood | null {
  if (!w || typeof w !== 'object') return null;
  const o = w as { id?: unknown; name?: unknown; nameKo?: unknown; imageUrl?: unknown };
  const id = typeof o.id === 'number' && Number.isFinite(o.id) ? String(o.id) : typeof o.id === 'string' && /^\d+$/.test(o.id) ? o.id : null;
  const name = typeof o.name === 'string' && o.name.trim() ? o.name : null;
  if (!id || !name) return null;
  return {
    id,
    name,
    nameKo: typeof o.nameKo === 'string' && o.nameKo.trim() && o.nameKo !== name ? o.nameKo : null,
    imageUrl: typeof o.imageUrl === 'string' && /^https?:\/\//.test(o.imageUrl) ? o.imageUrl : null,
  };
}
