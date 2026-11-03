# 운영(production) OTA 발행·재발행 절차 (KB-885)

**사고(10/23)**: OTA1(c5cad2e3)·OTA2(5bed242c)가 `EXPO_PUBLIC_BE_BASE`만 인라인하고 export돼
`EXPO_PUBLIC_AMPLITUDE_API_KEY`가 번들에 없었다 → 운영 analytics no-op(idol_pick·curation 이벤트 0).
`eas update`/`expo export`는 eas.json **build 프로필 env를 읽지 않는다**. EAS production environment에는
secret(AIRBRIDGE_APP_TOKEN·SENTRY_AUTH_TOKEN)뿐이라 `--environment production`도 키를 넣지 않는다.
복구 = OTA3 `ota-prod-20261027`(같은 5bed242c + 키).

## 정본 명령 (10/20 ①② · 10/27 OTA3에서 실제로 쓴 형태)

예진 승인(FE 세션 승인 프롬프트) · 스토어 심사 진행 중 아님 · `main` 클린 커밋에서만.

```bash
# 1) main 커밋의 전용 워크트리 + 자체 npm ci(공유 node_modules 금지 — 지문 오판)
git worktree add --detach <dir> origin/main && cd <dir> && npm ci
# 2) 지문 = EAS production 최신 설치 빌드 runtimeVersion (양 OS, 불일치 = 중단)
npx expo-updates fingerprint:generate --platform ios|android
npx eas-cli build:list --platform ios|android --channel production --status finished --limit 1 --json --non-interactive
# 3) build.production.env 두 키를 셸로 (값 출력 금지 — 길이만 확인)
unset NODE_OPTIONS
export EXPO_PUBLIC_BE_BASE=$(node -p "require('./eas.json').build.production.env.EXPO_PUBLIC_BE_BASE")
export EXPO_PUBLIC_AMPLITUDE_API_KEY=$(node -p "require('./eas.json').build.production.env.EXPO_PUBLIC_AMPLITUDE_API_KEY")
echo "BE=$EXPO_PUBLIC_BE_BASE keylen=${#EXPO_PUBLIC_AMPLITUDE_API_KEY}"
# 4) export + 게이트 (prod 호스트 1+ · dev 0 · 키 1+, 플랫폼별 launch 번들)
npx expo export --clear --platform ios --platform android --output-dir dist
node scripts/prod-export-gate.mjs production dist || exit 1
# 5) 같은 셸에서 플랫폼별 발행 (--platform 생략 = all → web export 실패)
for p in ios android; do
  npx eas-cli update --branch production --environment production --platform $p --clear-cache \
    --non-interactive --json --message "ota-prod-YYYYMMDD: …"
  node scripts/prod-export-gate.mjs production dist || exit 1   # eas가 재번들한 실제 업로드분
done
# 6) 원격 manifest(update:view의 manifestPermalink) launchAsset.hash = 로컬 launch HBC SHA256(base64url) 대조
#    → annotated 태그 ota-prod-YYYYMMDD push, FE-OTA*-PRODUCTION-*.md 기록
```

- `--skip-bundler`는 쓰지 않는다(10/20·10/27 동일). eas가 같은 셸 env로 다시 번들하므로 **5)의 발행 후
  게이트 + 6)의 해시 대조**가 업로드된 바이트를 검사하는 단계다. `--skip-bundler`를 쓰면 4)에서 검사한
  dist가 그대로 올라가 재검사가 필요 없지만, 정본 형태를 바꾸는 건 별도 결정.
- 게이트는 `metadata.json`이 가리키는 launch HBC만 본다 — `.hbc.map` sourcesContent의 dev 설명 주석은 실행 코드가 아니다.
- teamtest·development export에는 운영 키가 **없어야** 한다: `node scripts/prod-export-gate.mjs teamtest dist`
  (teamtest 워크플로의 `teamtest-target.mjs guard`는 그대로 — 이 스크립트는 그와 독립).

## 대안 메모

키를 **EAS production environment 변수(plain/sensitive)로 등록**(예진 계정)하면 `--environment production`이 자동 주입해
셸 인라인 누락이 구조적으로 사라진다 — 단 값이 eas.json과 두 군데가 되어 회전 시 드리프트 위험이 있고, 로컬 export엔
여전히 셸 env(또는 `eas env:pull`)가 필요하다. 이 게이트는 어느 쪽이든 유지한다.
