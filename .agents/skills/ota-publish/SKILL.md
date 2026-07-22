---
name: ota-publish
description: >-
  Publish an OTA (EAS Update) so the phone pulls the latest screens over the
  internet — no rebuild, works across networks (laptop at home, you outside).
  Use when the user wants to see current changes on their device. Triggers:
  "밖에서 확인할 수 있게 올려줘", "OTA 올려줘", "폰에서 최신 화면 보게", "업데이트 올려줘",
  "publish update", "push OTA", "ship to my phone". For dev builds on the
  `development` channel/branch.
---

# ota-publish — push the latest JS bundle to the phone over the air

Goal: run `eas update` on the **development** branch so the installed K-Bap dev
build can load the new bundle from the dev-launcher **Updates** tab. Only
**JS/asset** changes ship this way; native changes need a rebuild (step 3).

Run the steps in order. Stop and report if a guard fails.

## 0. Sanity: project is OTA-capable + logged in

```bash
cd /Users/yejinkim/dev/kfood/kbap-fe
node -e "const e=require('./app.json').expo; if(!e.updates?.url){console.log('NO_UPDATES');process.exit(1)} console.log('runtimeVersion='+JSON.stringify(e.runtimeVersion))"
npx eas-cli whoami 2>&1 | grep -viE 'available|To upgrade|npm install|outdated|Proceeding' | tail -1
```
- `NO_UPDATES` → EAS Update not configured; tell the user to run setup first. Stop.
- No username → tell them to run `npx eas-cli login`. Stop.

## 1. Preflight: working tree should be committed

```bash
git status --porcelain
```
- Non-empty → **warn**: OTA publishes the working tree but git won't record exactly
  what shipped. Ask to commit first (preferred) or publish anyway. Don't silently proceed.

## 2. Channel ↔ branch consistency

The build listens on a **channel**; `eas update` publishes to a **branch**. For dev
both are `development`.

```bash
node -e "const b=require('./eas.json').build.development; console.log('build.channel='+(b&&b.channel))"
```
- Expected `development`. We publish with `--branch development`.
- Anything else → **stop** and report (the phone would never receive it).

## 3. Compatibility: will this OTA reach the INSTALLED build?

runtimeVersion policy is **fingerprint**. The OTA only reaches a build whose
runtimeVersion == the update's fingerprint. Compare the current fingerprint to the
**latest finished development build's runtimeVersion** (ground truth):

```bash
CUR=$(npx expo-updates fingerprint:generate --platform ios 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).hash)}catch{console.log('FAIL')}})")
BUILD_RV=$(npx eas-cli build:list --platform ios --channel development --status finished --limit 1 --json --non-interactive 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const a=JSON.parse(s);console.log(a[0]?.runtimeVersion||a[0]?.fingerprint?.hash||'')}catch{console.log('')}})")
echo "current=$CUR  latestBuildRV=$BUILD_RV"
```
- `CUR == BUILD_RV` → **OTA-compatible**, continue.
- `CUR != BUILD_RV` (and BUILD_RV non-empty) → **native config changed since the
  installed build → this update is OTA-INCOMPATIBLE.** Tell the user verbatim:
  > 이번 변경은 네이티브 설정이 바뀌어서 **OTA로는 못 받습니다. 재빌드가 필요**합니다:
  > `eas build --profile development --platform ios` → 새 빌드를 폰에 재설치하세요.
  Then **STOP** — do not publish — unless the user says they'll rebuild anyway / want
  it staged for the next build.
- BUILD_RV empty (no build found / offline) → fall back to the baseline file
  `.ota/runtime-fingerprint.txt`: if it exists and differs from `CUR`, warn the same way.

## 4. Compose the update message

One line summarizing what changed. Default to the latest commit subject:

```bash
git log -1 --pretty=%s
```

## 5. Publish the OTA

`--environment` is REQUIRED in non-interactive mode (else it errors).

```bash
npx eas-cli update --branch development --environment development \
  --message "<MSG>" --non-interactive \
  2>&1 | grep -viE 'available|To upgrade|npm install -g|outdated version|Proceeding with' | tail -20
```
- Confirm the output shows **Branch: development** and **Runtime version** = the
  same hash as `$CUR`. Capture the Update group ID / EAS Dashboard link.
- If it errors about runtimeVersion / no compatible builds → go to step 3's rebuild guidance.

## 6. Re-baseline (only if it changed)

```bash
[ -n "$CUR" ] && echo "$CUR" > .ota/runtime-fingerprint.txt
```
Commit `.ota/runtime-fingerprint.txt` if it changed.

## 7. Tell the user how to load it ON THE PHONE (dev build = manual Updates tab)

This is a **dev build**, so the OTA does NOT auto-apply on relaunch — the user picks
it in the dev launcher. Output:

> ✅ OTA 발행 완료 (branch: development, runtime `<CUR 앞 8자>`).
> 폰에서:
> 1. **K-Bap 앱 열기** → 화면의 **⚙️ 톱니 아이콘 탭**(또는 폰 흔들기)으로 개발자 메뉴 → **"Go to home"**.
> 2. 런처 하단 **Updates** 탭 → 아래로 당겨 새로고침 → 방금 메시지의 업데이트를 **탭** → 로드됩니다.
> (Mac 꺼져 있어도 됩니다. 인터넷만 있으면 됩니다.)

### Troubleshooting (자주 나는 것)
- **"Expected MIME-Type … got 'text/html'" + 빨간 화면**: dev 빌드가 죽은 Metro/터널
  서버를 자동으로 부르는 중. Dismiss → ⚙️ 톱니 → **Go to home** → **Updates** 탭에서 OTA를 탭.
  (Metro가 안 떠 있으면 dev 서버 항목은 무시하고 Updates 탭을 쓸 것.)
- 업데이트가 Updates 탭에 안 보이면: runtime version이 빌드와 다른 것(=네이티브 변경) → 재빌드 필요(step 3).

## Notes
- This skill never runs `eas build` (slow, native). It only publishes JS/asset OTAs.
- **Dev build vs preview**: a `development` (dev-client) build loads OTAs manually via
  the Updates tab. If the user wants "open the app → latest runs automatically, no
  launcher", that's a **preview** build (`eas build --profile preview`) which runs the
  embedded/OTA bundle directly. Offer that if they ask for hands-off auto-update.
- Branch/channel hardcoded to `development` for the dev workflow.
