#!/usr/bin/env bash
# KB-420(Codex #18 P1) — OTA fingerprint 게이트: runtimeVersion.policy=fingerprint라
# 네이티브 변경이 섞인 커밋에서 발행하면 새 fp로 나가 설치 빌드 도달 0(P-199 계열
# 조용한 실패). 현재 fp ≠ 설치(teamtest 최신 빌드) fp면 잡을 실패시켜 발행을 막는다.
# 우회는 넣지 않는다 — 필요하면 수동 eas update(발주 명시).
# 사용: ota-fp-gate.sh <cur_ios> <cur_android> <installed_ios> <installed_android>
CUR_IOS="${1:?cur ios fp}"
CUR_AND="${2:?cur android fp}"
BUILD_IOS="${3:-}"
BUILD_AND="${4:-}"

echo "fp ios:     current=$CUR_IOS installed=${BUILD_IOS:-'(빌드 없음)'}"
echo "fp android: current=$CUR_AND installed=${BUILD_AND:-'(빌드 없음)'}"

FAIL=0
if [ -n "$BUILD_IOS" ] && [ "$CUR_IOS" != "$BUILD_IOS" ]; then
  echo "FAIL: ios fp 불일치 — 네이티브 변경 감지 → teamtest 새 빌드 필요, OTA 미발행"
  FAIL=1
fi
if [ -n "$BUILD_AND" ] && [ "$CUR_AND" != "$BUILD_AND" ]; then
  echo "FAIL: android fp 불일치 — 네이티브 변경 감지 → teamtest 새 빌드 필요, OTA 미발행"
  FAIL=1
fi
if [ -z "$BUILD_IOS" ] && [ -z "$BUILD_AND" ]; then
  # 설치 기준 빌드가 아직 없음 — 도달 대상도 없으니 발행은 무해(경고만)
  echo "WARN: teamtest 설치 빌드 없음 — fp 대조 생략(발행은 진행)"
fi
exit $FAIL
