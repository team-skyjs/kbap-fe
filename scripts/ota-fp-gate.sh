#!/usr/bin/env bash
# KB-420(Codex #18 P1→P2) — OTA fingerprint 게이트: runtimeVersion.policy=fingerprint라
# 네이티브 변경이 섞인 커밋에서 발행하면 새 fp로 나가 설치 빌드 도달 0(P-199 계열
# 조용한 실패). 우회는 넣지 않는다 — 필요하면 수동 eas update(발주 명시).
#
# P-293b(플랫폼별 판정 — #52 OTA 차단 사고): 안드 teamtest가 재빌드 전(구 fp)이라는
# 이유로 iOS 발행까지 전체 차단되던 것을 분리 — 불일치 플랫폼만 SKIP(발행 제외),
# 일치·NONE 플랫폼은 발행 목록에 남긴다. 발행 목록은 $5(기본 /tmp/ota-publish-platforms)
# 파일에 공백 구분으로 쓴다(워크플로 publish 스텝이 소비).
#
# P2(fail closed) 유지:
#   NONE   = build:list가 빈 목록([])을 정상 반환(빌드 0건) → WARN 후 발행 포함(도달 대상 없음)
#   '' 또는 LOOKUP_FAIL = 조회/파싱 실패·필드 누락 → **잡 실패**(열린 게이트 통과 금지)
#   발행 가능 플랫폼 0(전 플랫폼 불일치) → **잡 실패**(재빌드 필요 신호)
# 사용: ota-fp-gate.sh <cur_ios> <cur_android> <installed_ios|NONE|LOOKUP_FAIL> <installed_android|NONE|LOOKUP_FAIL> [platforms_out]
CUR_IOS="${1:?cur ios fp}"
CUR_AND="${2:?cur android fp}"
BUILD_IOS="${3:-}"
BUILD_AND="${4:-}"
OUT="${5:-/tmp/ota-publish-platforms}"

echo "fp ios:     current=$CUR_IOS installed=${BUILD_IOS:-'(조회 실패)'}"
echo "fp android: current=$CUR_AND installed=${BUILD_AND:-'(조회 실패)'}"

FAIL=0
PUBLISH=""
check() { # $1=라벨 $2=현재 $3=설치
  if [ "$3" = "NONE" ]; then
    echo "WARN: $1 teamtest 설치 빌드 없음 — 대조 생략(도달 대상 없음), 발행은 포함"
    PUBLISH="$PUBLISH $1"
  elif [ -z "$3" ] || [ "$3" = "LOOKUP_FAIL" ]; then
    echo "FAIL: $1 설치 fp 조회 실패 — 게이트 판정 불가, 수동 확인 필요(fail closed)"
    FAIL=1
  elif [ "$2" != "$3" ]; then
    echo "SKIP: $1 fp 불일치(installed=$3 ≠ current=$2). 네이티브 변경 감지 — $1 은 teamtest 새 빌드 전까지 발행 제외"
  else
    PUBLISH="$PUBLISH $1"
  fi
}
check ios "$CUR_IOS" "$BUILD_IOS"
check android "$CUR_AND" "$BUILD_AND"

PUBLISH="${PUBLISH# }"
if [ "$FAIL" -eq 0 ] && [ -z "$PUBLISH" ]; then
  echo "FAIL: 발행 가능 플랫폼 0 — 전 플랫폼 네이티브 회전, teamtest 재빌드 필요"
  FAIL=1
fi
echo "$PUBLISH" > "$OUT"
echo "publish platforms: ${PUBLISH:-'(없음)'}"
exit $FAIL
