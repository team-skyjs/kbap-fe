#!/usr/bin/env bash
# KB-420(Codex #18 P1→P2) — OTA fingerprint 게이트: runtimeVersion.policy=fingerprint라
# 네이티브 변경이 섞인 커밋에서 발행하면 새 fp로 나가 설치 빌드 도달 0(P-199 계열
# 조용한 실패). 현재 fp ≠ 설치(teamtest 최신 빌드) fp면 잡을 실패시켜 발행을 막는다.
# 우회는 넣지 않는다 — 필요하면 수동 eas update(발주 명시).
#
# P2(fail closed): 설치 기준값의 "명시적 부재"와 "조회 실패"를 구분한다 —
#   NONE   = build:list가 빈 목록([])을 정상 반환(빌드 0건) → WARN 후 통과(도달 대상 없음)
#   '' 또는 LOOKUP_FAIL = 조회/파싱 실패·필드 누락 → **잡 실패**(열린 게이트 통과 금지)
# 사용: ota-fp-gate.sh <cur_ios> <cur_android> <installed_ios|NONE|LOOKUP_FAIL> <installed_android|NONE|LOOKUP_FAIL>
CUR_IOS="${1:?cur ios fp}"
CUR_AND="${2:?cur android fp}"
BUILD_IOS="${3:-}"
BUILD_AND="${4:-}"

echo "fp ios:     current=$CUR_IOS installed=${BUILD_IOS:-'(조회 실패)'}"
echo "fp android: current=$CUR_AND installed=${BUILD_AND:-'(조회 실패)'}"

FAIL=0
check() { # $1=라벨 $2=현재 $3=설치
  if [ "$3" = "NONE" ]; then
    echo "WARN: $1 teamtest 설치 빌드 없음 — 대조 생략(도달 대상 없음)"
  elif [ -z "$3" ] || [ "$3" = "LOOKUP_FAIL" ]; then
    echo "FAIL: $1 설치 fp 조회 실패 — 게이트 판정 불가, 수동 확인 필요(fail closed)"
    FAIL=1
  elif [ "$2" != "$3" ]; then
    echo "FAIL: $1 fp 불일치 — 네이티브 변경 감지 → teamtest 새 빌드 필요, OTA 미발행"
    FAIL=1
  fi
}
check ios "$CUR_IOS" "$BUILD_IOS"
check android "$CUR_AND" "$BUILD_AND"
exit $FAIL
