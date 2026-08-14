/**
 * useDietPresets (P-208/KB-305) — 프리셋 매핑 서버 스왑: GET /api/ingredients/diets
 * (무인증 공개·lang 파라미터). 카탈로그(P-174) 문법: 서버 우선 · 실패/로딩 =
 * **P-203 하드코딩 상수 폴백**(오프라인 온보딩 생존 — 정본 대조 유닛도 상수 기준 존치).
 *
 * 실측(8/14): 라이브 15종 코드·매핑 = 확정본 1:1(자이나 흥거 제외 포함).
 * ⚠️ `diets[].name`은 lang 미해석(en 요청에도 ko 고정 — ingredients[].name은 en 정상):
 * BE 수정 전까지 표시명은 FE i18n(labelKey) 유지, 서버 name은 운반만(수정 시 1줄 전환).
 * 서버에만 있는 신규 코드는 무시(그룹·라벨 미정 — 상수 갱신 발주에서 수용).
 */
import { useQuery } from '@tanstack/react-query';
import { api, apiLang } from '@/lib/api/client';
import { DIET_PRESETS, presetSubstanceCodes, type DietPreset } from '@/lib/onboarding/dietPresets';

interface DietWire {
  code?: string;
  name?: string;
  ingredients?: { code?: string }[];
}

/** 화면 소비 형태 — 상수와 동일 축 + codes 확정(서버 or 상수 파생). */
export interface ResolvedPreset extends Pick<DietPreset, 'id' | 'group' | 'labelKey'> {
  codes: string[];
  /** 서버 표시명(현재 lang 미해석 — 전환 대기, 미사용 운반). */
  serverName: string | null;
}

function fromConstants(): ResolvedPreset[] {
  return DIET_PRESETS.map((p) => ({ id: p.id, group: p.group, labelKey: p.labelKey, codes: presetSubstanceCodes(p), serverName: null }));
}

async function fetchDietPresets(): Promise<Map<string, { codes: string[]; name: string | null }>> {
  const wire = await api.get<{ diets?: DietWire[] }>(`/api/ingredients/diets?lang=${apiLang()}`);
  const map = new Map<string, { codes: string[]; name: string | null }>();
  for (const d of wire?.diets ?? []) {
    if (!d.code) continue;
    const codes = (d.ingredients ?? []).map((i) => i.code).filter((c): c is string => !!c);
    if (codes.length) map.set(d.code, { codes, name: d.name ?? null });
  }
  return map;
}

/** 프리셋 15종 — 서버 매핑 우선, 실패·로딩·부재 코드는 상수 폴백. UI 축(그룹·라벨)은 상수. */
export function useDietPresets(): ResolvedPreset[] {
  const q = useQuery({
    queryKey: ['diets', 'presets', apiLang()],
    queryFn: fetchDietPresets,
    staleTime: 24 * 60 * 60_000, // 카탈로그 관례 — 매핑은 하루 단위면 충분
  });
  const server = q.data;
  return DIET_PRESETS.map((p) => {
    const hit = server?.get(p.id);
    return {
      id: p.id,
      group: p.group,
      labelKey: p.labelKey,
      codes: hit?.codes ?? presetSubstanceCodes(p), // 서버 우선 · 폴백 = 정본 상수
      serverName: hit?.name ?? null,
    };
  });
}

export { fromConstants as _constantPresetsForTest, fetchDietPresets as _fetchDietPresetsForTest };
