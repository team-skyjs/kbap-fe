# P-610 / KB-998: ML Kit 입력 수집 (teamtest, BE=dev)

이 화면은 개발용 사진 32장의 실제 ML Kit 글자·좌표를 수집한다. 모델, 정답, confidence, 메뉴 분할, 서버 스캔·업로드·티켓·차감은 사용하지 않는다. 기존 스캔 경로는 유지한다. 자료는 최종 시험도, 한국어 전용 세트도 아니다.

## 진입과 준비

- 경로: `kbap://ocr-collector` (메뉴에는 링크 없음).
- 허용: `development` 또는 `teamtest`, 혹은 채널 없는(null/undefined/빈 문자열) 로컬 개발 번들(`__DEV__=true`) **및** `BE_BASE === https://dev.kbap.site`.
- production/preview/알 수 없는 채널, prod BE, 채널 없는 release는 딥링크로도 화면을 마운트하지 않는다.
- 기존 네이티브 모듈만 사용한다. Expo Go는 사용할 수 없다. 사진·manifest·정답은 Metro asset import가 없으며 Git/운영 asset graph에 포함하지 않는다. 코드에는 manifest SHA256만 고정한다.

기존 호환 dev client를 설치한 시뮬레이터/기기에서 기능 브랜치의 Metro를 열 수 있다. teamtest 빌드/OTA를 기능 브랜치에서 발행하지 않는다. 새 바이너리가 필요하면 별도 승인된 develop 통합·푸시된 클린 커밋·build 태그 절차를 따른다.

```sh
NODE_OPTIONS=--dns-result-order=ipv4first EXPO_PUBLIC_BE_BASE=https://dev.kbap.site EXPO_NO_TELEMETRY=1 npx expo start --dev-client --localhost --port 8098 --max-workers 2 --clear
# 로컬 iOS 시뮬레이터. IPv4 우선 옵션으로 Metro manifest의 주소와 바인딩을 맞춘다.
xcrun simctl openurl <SIMULATOR_UDID> 'exp+kbap://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8098'
xcrun simctl openurl <SIMULATOR_UDID> 'kbap://ocr-collector'
```

실물 dev client는 같은 로컬 네트워크의 Mac Metro에 연결한다. 기존 QA 서버/앱의 설정은 변경하지 않는다. iPhone14Pro, iPhoneXS, GalaxyS22의 실제 OS/앱 빌드는 실행 시 확인한다. 모델명은 작업자가 확인해 입력하며 출처를 `operator-confirmed`로 남긴다. iOS 실기/시뮬 유형은 native release type과 대조하고 UNKNOWN/조회 실패는 차단한다. Android 유형은 작업자가 확인한 값이다.

## 사진 공급: 로컬 HTTP 또는 파일 선택

```sh
python3 scripts/mlkit-fixture-server.py \
  --fixtures /Users/yejinkim/dev/kfood/kbap-scan-classifier-experiment/artifacts/routing-v2-mobile-ocr \
  --bind 127.0.0.1
```

시뮬레이터 화면에는 `127.0.0.1`, 실물폰에는 `--bind`로 지정한 **개발 Mac의 RFC1918 IPv4 주소**를 입력한다. 포트는8878 고정이다. `0.0.0.0`, 외부 IP/호스트, 사용자정보·토큰·경로는 허용하지 않는다. HTTP 서버는 원본32장과 manifest만 정확한 경로로 응답하며 정답/lock/디렉터리 목록/쿼리/다른 파일은404다. 시작 때 모든 원본 해시를 검증하고 메모리의 검증된 바이트만 공급한다. 로컬 네트워크 권한을 거부하면 파일 방식으로 전환한다. 작업 후 서버를 종료한다.

**ATS/Android cleartext 정책을 전역으로 완화하지 않는다.** 개발 바이너리는 HTTP가 동작할 수 있지만 teamtest release는 기기/빌드 정책에 따라 차단될 수 있다. 이때 화면의 ‘파일에서 manifest와 사진32장 가져오기’를 사용한다. Mac에서 원본을 아래처럼 평평한 폴더로 복사하고 USB/AirDrop 등 로컬 전송으로 기기의 Files에 넣는다. Photos로 가져오면 재인코딩될 수 있으므로 사용하지 않는다. 클라우드 공유 서비스로 업로드하지 않는다.

```sh
mkdir -p /tmp/kb998-public-fixtures
cp /Users/yejinkim/dev/kfood/kbap-scan-classifier-experiment/artifacts/routing-v2-mobile-ocr/manifest.json /tmp/kb998-public-fixtures/
cp /Users/yejinkim/dev/kfood/kbap-scan-classifier-experiment/artifacts/routing-v2-mobile-ocr/images/*.jpg /tmp/kb998-public-fixtures/
```

파일 선택기에서 manifest와 JPEG32개, 총33개를 선택한다. 중복/누락/변경된 바이트는 거부한다. 사진 공급 두 방식 모두 SHA256을 실제 바이트에 적용한다. 다운로드/가져오기가 끝나면 서버를 끄고 비행기 모드에서 수집한다. 앱 재시작 때 로컬 manifest와32장 해시를 다시 확인한다.

## 실행·중단·재시도·복구

1. 기기 모델·실기/시뮬을 확인한다.
2. ‘남은 사진 실행’으로32장을 순차 처리한다.
3. 한 장 실패는 error/code로 저장하고 계속한다. 글자0줄 성공은 `ok + []`로 구분한다.
4. 취소/백그라운드/60초 timeout은 새 작업 예약을 멈춘다. native cancel API가 없으므로 기존 작업이 끝날 때까지 실행 잠금을 유지하고 늦게 온 결과는 버린다. 현재 실패를 먼저 저장한다. 남은 미실행 사진은 성공/오류로 만들어 넣지 않는다.
5. 실패한 사진만 재시도할 수 있다. 최종 samples는 ID당1개이고 attempts에는 시도별 결과·순서·세션ID를 남긴다.
6. 각 결과를 앱 Documents의 `mlkit-collector-v1/capture-<uuid>.json`에 저장한다. 프로세스가 종료돼도 다음 실행에서 latest 포인터로 복구한다. 미완료 파일은 strict importer가 거부하므로32개의 최종 결과가 있어야 내보내기 버튼이 열린다.
7. JSON 공유 시트에서 로컬 파일로 저장한다. 원문/좌표는 로그나 분석 이벤트에 담지 않는다. 공용 버튼의 일반 클릭 계측에는 고정 버튼ID만 남는다.

시간은 `performance.now()`로 측정하며 원본 해시 확인·EXIF 디코드·OCR·정규화를 포함한다. 순서는 first/subsequent-in-session으로 기록한다. OS/모델 캐시 초기화를 수행하지 않으므로 cold/warm 지연시간이라고 주장하지 않는다.

원본 JPEG의 SOF 치수와 EXIF orientation을 직접 읽는다. ImageManipulator로 EXIF를 적용한 full-resolution PNG를 만든 뒤 치수가 예상 회전 결과와 같은지 검사한다. resize/crop와 JPEG 재압축은 하지 않는다. OCR 정규화 분모의 실제 측정값/선택 근거도 preprocessing에 남긴다. 임시 PNG는 작업 후 삭제한다. 이 변환 경로는 실제 원본 JPEG 직접 OCR과 구분해야 한다.

## 실측 JSON 검사

```sh
cd /Users/yejinkim/dev/kfood/kbap-scan-classifier-experiment
uv run --offline --frozen python mobile_ocr_bridge.py ingest --capture /absolute/path/to/capture.json
```

실제로 OCR을 실행한 캡처에만 이 명령을 사용한다. 테스트 목·NOT_RUN 템플릿은 실측으로 수입하지 않는다. receipt의 `phone_measured`는 physical일 때만 true다. 분류 정확도는 이 수집 도구에서 측정하지 않는다.

## 검증과 남은 게이트

자동 검사는 잘못된 채널/BE, 외부 주소, 누락·중복 manifest, confidence/좌표 오류, timeout 뒤 native 작업 중첩 방지, 취소/백그라운드, 실패 재시도, 빈 텍스트, 기기유형 UNKNOWN 및 OCR 로그 차단을 확인한다. 단위 테스트는 native 실측의 대체가 아니다.

별도 기기 기록에는 OS, 바이너리/JS커밋, simulator/physical, 공급 방식과 네트워크 정책,32장 ok/error/empty, ingest receipt, 스캔/업로드/티켓/차감 요청 관찰 범위를 남긴다. 연결되지 않은 기기는 미측정이다. 전체 실기 검증 전 Draft PR을 유지한다. 머지·운영 배포·teamtest 발행은 이 작업에서 하지 않는다.


## 2026-11-05 KST 실행 기록

- JS 커밋 `e4a591f8`, 별도 `kb998-collector` iPhone 17 시뮬레이터, iOS **26.4.1**, 설치된 개발 바이너리 **1.0.4/1**, ML Kit 래퍼 **2.0.0 / KOREAN**. 다른 QA 시뮬레이터는 변경하지 않았다. 새 native build/OTA 없음.
- 실제 런타임은 `__DEV__=true`, BE=dev, `Updates.channel=""`였다. 채널 없는 로컬 개발 클라이언트에 이 값을 포함했다. 빈 채널의 release 및 prod BE는 테스트에서 계속 거부한다. 중앙 딥링크의 기존 로그인/온보딩 게이트를 거쳐 정상 게스트 진입했다.
- UI에서 로컬 HTTP로32장 다운로드. 시뮬레이터 Documents의32장 SHA256를 다시 대조해 전부 일치. **fixture 서버 종료 후** native OCR 실행. 비행기 모드 및 앱 전체 네트워크 단절 검증은 아니다.
- **32/32 ok, 오류0, 빈 OCR 성공1, 총1,278줄.** 시도32개이며 confidence·정답·예측 없음. 총 처리시간20,956.05ms, 사진별98.68–1,942.00ms, 중앙값525.46ms. 해시·디코드·OCR·정규화 포함, 호스트 과부하가 있던 개발 시뮬레이터 값이므로 폰 성능·순수 OCR·cold/warm 지표로 해석하지 않는다.
- 앱 강제 종료·재시작 후32개 결과·기기 정보 복구 및 캡처 해시 불변을 확인. 준비 수 표시도 복구된 manifest에 맞춘다.
- JSON 공유 시트가 실제 열림을 확인. 앱 Documents의 동일 파일을 로컬 실험 폴더로 복사해 `mobile_ocr_bridge.py ingest` 성공. 공유 대상 서비스로 업로드하지 않았다.
- 캡처 SHA256: `b3aa55fa9a8e9b5f5f6577c1c52465412b036a45ae12e421e2e6cce5f606f4bc`.
- receipt: `kbap-scan-classifier-experiment/runs/routing-v2-pilot/mobile-ocr-imports/<위 SHA256>/receipt.json`; `phone_measured=false`, `classification_evaluated=false`, `labels_used_as_model_input=false`.
- 로컬 증거: `kbap-scan-classifier-experiment/artifacts/kb998-collector-validation/`의 캡처·집계·receipt 경로·스크린샷·검증 로그. 원본/결과 JSON/사진은 FE Git에 넣지 않았다.
- 전체 Jest **394 suites / 3,722 tests / 7 snapshots 통과** 후 마지막 중앙 딥링크·빈 채널 변경은 관련 **7 suites / 60 tests 통과**로 추가 검증. tsc0, 변경 줄 lint14파일 새 문제0. Jest 열린 핸들/worker 종료 경고가 있어 `--forceExit`를 사용했으며 핸들 누수 해결을 주장하지 않는다.
- 수집 화면 진입 이후 Metro 로그에서 `/scans`, `/tickets`, `/uploads`, `[MLKit]`, `[OCR]`, 실제 소문자 접두 `[ocr]` 일치0. 수집 소스에 API client/scan hook/segmentMenu import0. 이는 로그·소스 관찰 범위이며 네이티브 SDK 전체 패킷 감사는 아니다. 일반 앱 초기 진입에는 기존 홈·광고 동의 통신이 있다.

### 다음 기기 실행

1. iPhone14Pro / iPhoneXS / GalaxyS22는 **모두 미측정**이다. 잠금 해제된 기기와 호환 dev client를 준비한다. 새 teamtest 바이너리가 필요하면 별도 develop 통합·빌드 승인 절차를 따른다. 이 PR은 Draft 유지한다.
2. BE=dev로 위 Metro 명령을 기기에서 접근 가능한 LAN 모드(`--localhost` 대신 `--lan`)로 실행한다. 정상 게스트/로그인 진입 후 `kbap://ocr-collector`를 연다. release는 teamtest 또는 development 채널이어야 한다.
3. 기기 모델을 확인하고 physical로 설정한다. 로컬 fixture 서버에서 공급하거나 Files의33개 파일을 선택한다. HTTP가 ATS/cleartext 정책으로 막히면 Files 방식으로 전환하며 전역 보안 설정을 완화하지 않는다.
4. 준비 후 서버 종료·비행기 모드에서32장 실행, 각 기기의 OS/앱 빌드/ok·error·빈 결과를 확인한다. 취소·백그라운드·재시도·권한 거부·Files 공급은 단위 테스트 외에 실물 기기에서 추가 확인한다.
5. JSON을 로컬로 저장·전달한 뒤 위 ingest 명령을 실행한다. 완전한32개 결과만 수입하며 미실행 행을 만들지 않는다. 기기별 캡처와 receipt를 따로 보존한다. 이 수집 결과로 모델의 분류 정확도를 자동 주장하지 않는다.
