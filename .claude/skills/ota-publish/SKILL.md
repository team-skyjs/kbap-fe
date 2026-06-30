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
client downloads the new bundle. This only works for **JS/asset** changes; native
changes need a rebuild (detected in step 3).

Run these steps in order. Stop and report if any guard fails.

## 0. Sanity: project is OTA-capable

```bash
cd /Users/yejinkim/dev/kfood/kbap-fe
node -e "const e=require('./app.json').expo; if(!e.updates?.url){console.log('NO_UPDATES');process.exit(1)} console.log('runtimeVersion='+JSON.stringify(e.runtimeVersion))"
npx eas-cli whoami 2>&1 | grep -viE 'available|upgrade|npm install|outdated' | tail -1
```
- If `NO_UPDATES` → EAS Update isn't configured; tell the user to run OTA setup first. Stop.
- If `whoami` shows no user → tell them to run `npx eas-cli login`. Stop.

## 1. Preflight: working tree must be committed

```bash
git status --porcelain
```
- If output is non-empty → **warn**: there are uncommitted changes; the OTA will
  publish the working tree but git won't have a record of exactly what shipped.
  Ask whether to commit first (preferred) or publish anyway. Do not silently proceed.

## 2. Channel ↔ branch consistency (prevents the #1 "phone never updates" mistake)

The installed build listens on a **channel**; `eas update` publishes to a **branch**.
For dev they must both be `development`.

```bash
node -e "const b=require('./eas.json').build.development; console.log('build.channel='+(b&&b.channel))"
```
- Expected: `build.channel=development`. We will publish with `--branch development`.
- If the channel is missing or not `development` → **stop** and report the mismatch
  (the phone would never receive the update). Fix eas.json or publish to the matching branch.

## 3. Native-change detection (is OTA even possible?)

runtimeVersion policy is **fingerprint**: if native deps / config plugins / app
config / ios|android dirs changed, the fingerprint changes and the OTA will NOT
reach the currently-installed build. Detect that before publishing.

```bash
CUR=$(npx expo-updates fingerprint:generate --platform ios 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).hash)}catch{console.log('FAIL')}})")
BASE=$(cat .ota/runtime-fingerprint.txt 2>/dev/null || echo "")
echo "current=$CUR baseline=$BASE"
```
- `CUR == BASE` (or BASE empty on first ever run) → JS-only change → **OTA is possible**, continue.
- `CUR != BASE` → **native config changed → this update is OTA-INCOMPATIBLE with the installed build.**
  Tell the user verbatim:
  > 이번 변경은 네이티브 설정이 바뀌어서 **OTA로는 못 받습니다. 재빌드가 필요**합니다:
  > `eas build --profile development --platform ios` → 새 빌드를 폰에 재설치하세요.
  Then **STOP** — do not publish — UNLESS the user explicitly says they just rebuilt
  and reinstalled this exact config. If they confirm the rebuild, re-baseline
  (`echo "$CUR" > .ota/runtime-fingerprint.txt`, commit it) and continue.

## 4. Compose the update message

Summarize what changed (one line). Default to the latest commit subject; refine if
multiple recent commits are relevant.

```bash
git log -1 --pretty=%s
```
Use that (or a short hand-written summary) as `<MSG>` below.

## 5. Publish the OTA

```bash
npx eas-cli update --branch development --message "<MSG>" --non-interactive 2>&1 | grep -viE 'available|upgrade|npm install|outdated'
```
- Confirm the output shows a published update with **Runtime version** equal to a
  fingerprint hash and **Branch: development**. Note the update group ID / link.
- If it errors about runtimeVersion / no compatible builds → fall back to step 3's
  rebuild guidance.

## 6. Re-baseline the fingerprint

Keep the baseline current so the next run compares against this publish:

```bash
echo "$CUR" > .ota/runtime-fingerprint.txt
```
(Only meaningful if it changed; harmless otherwise. Commit it if it changed.)

## 7. Tell the user what to do on the phone

Output this to the user:

> ✅ OTA 발행 완료 (branch: development).
> 폰에서: **K-Bap dev client 앱을 완전히 종료**(앱 스위처에서 위로 밀어 닫기) 후 **다시 실행**하세요.
> (또는 앱에서 흔들기 → **Reload**.) 인터넷을 통해 최신 번들이 자동 다운로드됩니다.
> 안 보이면: 같은 채널(development) 빌드인지, 폰이 인터넷에 연결됐는지 확인.

## Notes
- This skill never runs `eas build` (slow, native). It only publishes JS/asset OTAs.
- First-time setup (expo-updates install, channels, an OTA-capable rebuild) is a
  one-off and is NOT part of this skill.
- Branch/channel are hardcoded to `development` because that's the dev workflow;
  for preview/production publish to those branches with matching channels instead.
