---
name: ota-prod
description: >-
  Ship the current app state to TestFlight testers, choosing the right path
  automatically: JS/asset-only changes → production OTA (eas update, minutes,
  no review); native changes → full rebuild + submit (eas build + eas submit).
  The fingerprint check decides — the user doesn't have to know which applies.
  Triggers: "테스트플라이트 배포", "테플에 올려줘", "프로덕션 OTA", "테플 반영",
  "production 배포", "eas update production", "TestFlight 재배포".
---

# ota-prod — ship to TestFlight (OTA or rebuild, decided automatically)

Three commands exist; this skill picks between two paths:

| Path | Commands | When |
|---|---|---|
| **A. OTA** | `eas update --branch production` | JS/asset-only change (fingerprint unchanged) |
| **B. Rebuild** | `eas build` → `eas submit` | native changed (fingerprint differs) |

`eas build` alone never reaches testers — it must be followed by `eas submit`.

⚠️ Both paths reach REAL testers. Guards are hard stops; publishing/submitting
requires explicit user confirmation.

Run the steps in order. Stop and report if a guard fails.

## 0. Sanity: project is OTA-capable + logged in

```bash
cd /Users/yejinkim/dev/kfood/kbap-fe
node -e "const e=require('./app.json').expo; if(!e.updates?.url){console.log('NO_UPDATES');process.exit(1)} console.log('runtimeVersion='+JSON.stringify(e.runtimeVersion))"
npx eas-cli whoami 2>&1 | grep -viE 'available|To upgrade|npm install|outdated|Proceeding' | tail -1
```
- `NO_UPDATES` → EAS Update not configured. Stop.
- No username → tell them to run `npx eas-cli login`. Stop.

## 1. Preflight: working tree MUST be committed

```bash
git status --porcelain
```
- Non-empty → **stop**. Production ships must be reproducible from git.
  Ask the user to commit (or stash) first — no "publish anyway" for production.

## 2. Channel ↔ branch consistency

```bash
node -e "const b=require('./eas.json').build.production; console.log('build.channel='+(b&&b.channel))"
```
- Expected `production` (we publish with `--branch production`).
- Anything else → **stop** and report.

## 3. DECIDE: fingerprint compare → Path A or Path B

runtimeVersion policy is **fingerprint**. An OTA only reaches builds whose
runtimeVersion == the update's fingerprint.

```bash
CUR=$(npx expo-updates fingerprint:generate --platform ios 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).hash)}catch{console.log('FAIL')}})")
BUILD_RV=$(npx eas-cli build:list --platform ios --channel production --status finished --limit 1 --json --non-interactive 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const a=JSON.parse(s);console.log(a[0]?.runtimeVersion||a[0]?.fingerprint?.hash||'')}catch{console.log('')}})")
echo "current=$CUR  latestProdBuildRV=$BUILD_RV"
```
- `CUR == BUILD_RV` → JS-only change → **Path A (step 4A)**.
- `CUR != BUILD_RV` (BUILD_RV non-empty) → native changed → **Path B (step 4B)**.
  Explain to the user why (OTA can't reach the installed build) before starting.
- BUILD_RV empty (no production build ever) → **Path B** (first build).

### 3-1. Mismatch but suspicious? Check for an eas.json-only diff first

`eas.json` IS a fingerprint source, so editing submit metadata (ascAppId 등)
rotates the hash with ZERO native change. Before falling into Path B, verify:

```bash
# find the eas.json content the latest prod build was made with, swap it in, recompute
git log --oneline -5 -- eas.json   # identify the commit that changed it
git show <that-commit>~1:eas.json > /tmp/eas-old.json
cp eas.json /tmp/eas-new.json && cp /tmp/eas-old.json eas.json
npx expo-updates fingerprint:generate --platform ios | ...   # recompute
cp /tmp/eas-new.json eas.json
```
- Recomputed == BUILD_RV → **the app is compatible.** Publish Path A with the
  OLD eas.json swapped in during `eas update` (restore right after) — the JS
  bundle doesn't include eas.json, so the shipped content is identical.
- Recomputed still differs → real native change → Path B.
- ⚠️ Do NOT add eas.json to `.fingerprintignore` mid-cycle — it changes the
  source set and rotates the hash AGAIN (breaks compat with the installed
  build). Adopt the ignore file together with the NEXT native rebuild instead.

---

## Path A — OTA (JS/asset only)

### 4A. Compose message + confirm + publish

Message: one line, default to `git log -1 --pretty=%s`.

**Ask the user to confirm** (show branch=production, message, runtime hash 앞 8자).

```bash
npx eas-cli update --branch production --environment production \
  --message "<MSG>" --non-interactive \
  2>&1 | grep -viE 'available|To upgrade|npm install -g|outdated version|Proceeding with' | tail -20
```
- Confirm output shows **Branch: production** and **Runtime version** = `$CUR`.
- runtimeVersion / no-compatible-builds errors → switch to Path B.

### 5A. Re-baseline (only if changed)

```bash
[ -n "$CUR" ] && echo "$CUR" > .ota/runtime-fingerprint-production.txt
```
Commit if it changed.

### 6A. Tell the user how it lands

> ✅ 프로덕션 OTA 발행 완료 (branch: production, runtime `<CUR 앞 8자>`).
> 테스터 폰에서: 앱 **완전 종료 후 재실행 2번** (1번째 실행에서 다운로드,
> 2번째 실행에 적용). 별도 조작·알림 없음 — JS만 교체된 거라서요.

---

## Path B — Rebuild + Submit (native changed / first build)

### 4B. Confirm scope, then build

Tell the user: 네이티브 변경이라 OTA 불가, 재빌드+재제출 필요 (빌드 15~30분 +
TestFlight 처리 수십 분). **Ask to proceed.**

```bash
npx eas-cli build --platform ios --profile production --non-interactive --no-wait \
  2>&1 | tail -15
```
- `--no-wait` returns immediately with a build URL. Poll status:
```bash
npx eas-cli build:list --platform ios --limit 1 --json --non-interactive 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const b=JSON.parse(s)[0];console.log(b.status, b.id)})"
```
  Wait until `FINISHED` (check every few minutes; report the build page URL so
  the user can watch too). `ERRORED` → surface the log URL, stop.
- Credentials prompts can appear on a first-ever build — if the command fails
  non-interactively, tell the user to run `eas build` once by hand (`!` prefix)
  to set up signing, then re-run this skill.

### 5B. Submit to TestFlight

**Ask the user to confirm** (this uploads to App Store Connect).

```bash
npx eas-cli submit --platform ios --profile production --latest --non-interactive \
  2>&1 | tail -15
```
- `--latest` picks the build from 4B.
- ASC API key/credentials missing → tell the user to run it once by hand to
  authenticate, then re-run.

### 6B. Re-baseline the new fingerprint

```bash
[ -n "$CUR" ] && echo "$CUR" > .ota/runtime-fingerprint-production.txt
```
Commit if it changed.

### 7B. Tell the user how it lands

> ✅ 빌드 제출 완료. App Store Connect 처리(수십 분) 후 TestFlight에 새 빌드가
> 뜹니다. 테스터는 **TestFlight 앱에서 업데이트 설치** (푸시 알림 감).
> 이후의 JS-only 변경은 다시 OTA(Path A)로 나갑니다.

---

## Notes
- 판단 기준 요약: **네이티브가 바뀌었나?** 아니오 → A (몇 분). 예 → B (시간 단위).
  fingerprint 비교(step 3)가 이 판단을 자동으로 해준다 — 라이브러리 추가/제거,
  app.json 네이티브 설정(아이콘·권한·scheme), SDK 업그레이드가 대표적 B 사유.
- dev-channel OTA는 `ota-publish` 스킬 (development branch, 런처 Updates 탭 수동).
- Branch/channel hardcoded to `production`.
