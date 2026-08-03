/**
 * appConfigAdapter — `GET /app-config`(무인증) 와이어 경계 (P-111/KB-269).
 *
 * ⚠️ BE 미배포(8/3 스냅샷에 없음 — 종한 티켓 별도). 아래는 **예상 계약**:
 *   { minSupportedVersion: "1.0.0", latestVersion: "1.0.1", storeUrls: { ios, android } }
 * 배포 시 실계약과 다르면 **이 파일만** 스왑(스파이스 어댑터 관례). 그때까지는
 * 404 → 호출측 페일 오픈으로 항상 통과 — FE 선작업이 무해한 이유.
 *
 * ⚠️ 운영 규칙(코드 아님): minSupportedVersion은 **항상 심사 중(스토어 배포된)
 * 버전 이하로만** 설정할 것 — 스토어에 없는 버전을 min으로 올리면 업데이트가
 * 불가능한 벽돌이 된다.
 *
 * 페일 오픈: 필드 누락·semver 형식 불량 = null 반환 → 게이트 통과.
 */
import { parseSemver } from '../semver';

export interface AppConfig {
  minSupportedVersion: string;
  latestVersion: string | null; // 없으면 소프트 넛지 미동작(하드 게이트만)
  storeUrls: { ios: string | null; android: string | null };
}

export function adaptAppConfig(wire: unknown): AppConfig | null {
  if (!wire || typeof wire !== 'object') return null;
  const w = wire as Record<string, unknown>;
  const min = typeof w.minSupportedVersion === 'string' && parseSemver(w.minSupportedVersion) ? w.minSupportedVersion : null;
  if (!min) return null; // min 없으면 게이트 성립 불가 — 페일 오픈
  const latest = typeof w.latestVersion === 'string' && parseSemver(w.latestVersion) ? w.latestVersion : null;
  const urls = (w.storeUrls ?? {}) as Record<string, unknown>;
  const url = (v: unknown) => (typeof v === 'string' && /^https?:\/\//.test(v) ? v : null);
  return {
    minSupportedVersion: min,
    latestVersion: latest,
    storeUrls: { ios: url(urls.ios), android: url(urls.android) },
  };
}
