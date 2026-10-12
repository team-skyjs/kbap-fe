# app.json 설정 메모 (KB-738에서 이동)

app.json 안의 `_comment`·`_*Comment` 키는 ① expo-doctor 57 스키마 검사가 루트·android의 추가 속성을 거부하고 ② `extra`는 런타임·OTA 매니페스트에, `ios.infoPlist` 값은 빌드된 Info.plist에 그대로 실려 내부 결정 기록이 공개된다(#248 /review 4·5). 그래서 설명문은 전부 이 문서로 옮기고 app.json엔 설정값만 둔다. **app.json을 바꿀 때 해당 항목의 메모도 여기서 같이 고친다.**

## `plugins[expo-location]._comment`

P-200: 리뷰 장소 태그 nearby용 — 사용 중 권한만(백그라운드 없음). 네이티브 — 빌드18 반영

## `plugins[expo-notifications]._comment`

P-192: 안드 상태바 아이콘 = 모노크롬 실루엣(흰 단색 규격), 틴트 = 브랜드. 네이티브 — 다음 빌드 반영(OTA 동승 금지)

## `plugins[expo-splash-screen]._comment`

P-288/P-291/P-307(KB-437·475): 흰 배경 + 정지 마크. iOS 스토리보드 = 정사각 imageView(imageWidth²)·aspectFit — 세로 긴 PNG(245×285)가 높이에 맞아 폭 69.6pt로 축소되던 것을 95(≈81.614×285/245 반올림 — 94는 폭 80.8pt로 JS 81.614pt 대비 미세 축소, Codex #68 P2)로 보정 → 마크 실폭 81pt(JS와 일치, 크기 점프 0). 안드 = P-054 원형 마스크 정사각 396(마크 중앙), 131×245/396=81pt 무변. 다크 변형 없음(흰 고정 — 시안 2200:20667). 네이티브 — 다음 빌드 반영

## `plugins[expo-secure-store]._comment`

KB-592: 생체 인증을 쓰지 않는다(requireAuthentication 호출 0) — 기본 플레이스홀더 문구가 그대로 출고되던 것을 제거. 나중에 requireAuthentication을 쓰면 이 문구를 **반드시** 되살릴 것(없으면 호출 시 크래시).

## `plugins[expo-sensors]._comment`

KB-592 후속(P-407 b35 제출 거부 ITMS-90683): scan.tsx가 DeviceMotion(가로 힌트)을 실제로 쓴다 — 문구 필수. expo-location motionUsagePermission도 **같은 문구**(두 플러그인이 같은 NSMotionUsageDescription을 쓰므로 적용 순서와 무관하게 결과를 고정). false로 되돌리면 업로드가 거부된다.

## `plugins[@sentry/react-native/expo]._comment`

P-197: 소스맵 업로드는 빌드 시 SENTRY_AUTH_TOKEN(EAS env — 예진 콘솔 생성) 필요, 미설정 시 업로드만 스킵(빌드 무영향)

## `plugins[expo-media-library]._comment`

P-380(KB-518): 저장 전용 — 기본값은 READ_MEDIA_IMAGES/VIDEO/AUDIO 3종을 다 선언한다(실측). 우리는 이미지 저장만 하므로 photo로 좁힌다. photosPermission은 넘기지 않는다 — expo-image-picker가 이미 세운 NSPhotoLibraryUsageDescription을 보존(undefined면 기존 값 유지). KB-592: 시스템 문구도 로케일화했다(app.json locales → InfoPlist.strings 10로케일) — 여기 영어 값은 폴백

## `plugins[react-native-fbsdk-next]._comment`

KB-600(P-397): 설치 어트리뷰션 목적. iosUserTrackingPermission은 **의도적으로 생략** — ATT 프롬프트 없이 간다(9/21 예진 D2). iOS는 ATT가 없으니 IDFA가 0이라 advertiserIDCollectionEnabled:true여도 iOS 라벨 영향 없음(JS setAdvertiserTrackingEnabled(false) 유지). Android는 광고 ID 수집 허용(9/22 예진 — 이 문서의 "`expo.android` 광고 ID 권한(차단하지 않음)" 절). clientToken은 공개값(App Secret 아님). 네이티브 — 다음 빌드 반영

## `plugins[react-native-share]._comment`

P-380(KB-518): 옵션 객체 필수 — 문자열로 넣으면 plugin이 props.android를 읽다 prebuild가 죽는다(실측). android 배열 = Android 11+ 패키지 가시성 <queries> — 없으면 인스타 설치 여부 판별·실행이 막힌다. iOS 스킴은 ios.infoPlist.LSApplicationQueriesSchemes에 명시(플러그인이 기존 값을 보존·병합)

## `expo.ios.infoPlist.LSApplicationQueriesSchemes`

P-380(KB-518): 인스타 스토리 스킴 조회(react-native-share 플러그인이 이 배열을 보존·병합). 사진첩 저장 문구는 expo-media-library 플러그인 savePhotosPermission에 있다. 네이티브 — 다음 빌드 반영

## `expo.extra.metaAppId`

P-380(KB-518): Meta App ID — iOS 인스타 스토리 공유의 전제(react-native-share 계약). 공개 값이라 커밋 OK(시크릿 아님). 발급 = developers.facebook.com 팀 계정 앱 'K-Bap'. 비면 iOS Story 버튼은 숨고 Download만 남는다(Android 무관)

## `expo.locales`

KB-592: iOS 권한 문구 로케일화. Expo 내장 기능 — 이 맵이 <lang>.lproj/InfoPlist.strings를 생성한다(@expo/config-plugins ios/Locales). 플러그인 옵션의 영어 문구는 **폴백이라 지우지 않는다**(여기 없는 로케일이 그걸 쓴다). 키는 실제로 쓰는 5종만(9/22 모션 추가 — scan.tsx DeviceMotion, ASC ITMS-90683).

## `expo.android.permissions` / `blockedPermissions`(RECORD_AUDIO)

KB-592: RECORD_AUDIO 제거 — 오디오 녹음 코드가 0인데 선언만 남아 Play 스토어에 '오디오 녹음'으로 노출됐다(미사용 권한 선언 = 정책 리스크). expo-camera의 recordAudioAndroid: false로 플러그인 경로를 막고, 그래도 라이브러리 AndroidManifest가 직접 선언하므로(prebuild 실측) blockedPermissions로 병합 단계에서 제거한다.

## `expo.android` 광고 ID 권한(차단하지 않음)

KB-600(P-397 6): 광고 ID 허용 — 9/22 예진 결정. facebook-core AAR이 스스로 선언하는 광고 권한(AD_ID·ACCESS_ADSERVICES_AD_ID/ATTRIBUTION/CUSTOM_AUDIENCE/TOPICS)을 **차단하지 않는다**(9/21 초안의 차단은 되돌림). advertiserIDCollectionEnabled:true와 한 쌍 — 선언만 두고 수집을 끄면 의미가 없다. ⚠️ Play Console 데이터 보안에 '광고 ID 수집' 신고가 필요하다(이미 출시된 목록의 신고 변경). 병합은 Gradle 단계라 expo prebuild 출력엔 안 보인다 — 빌드 로그/APK 매니페스트로 확인.

## `expo.android.blockedPermissions`(READ_MEDIA_*)

KB-600(P-408 vc24 거부, 9/24 예진 결정): Play 사진·동영상 권한 정책 — "핵심 기능" 선언 대신 READ_MEDIA_IMAGES·READ_MEDIA_VISUAL_USER_SELECTED·READ_EXTERNAL_STORAGE 제거. 앨범 선택은 시스템 Photo Picker(권한 불필요), 스토리 카드 저장은 Android 10+ 읽기 권한 불필요. expo-image-picker·expo-media-library가 라이브러리 매니페스트로 선언하므로 병합 단계 차단.

