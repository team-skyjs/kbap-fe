/**
 * Edit profile (mockup Screen I3) — reached from the pencil on the profile
 * identity card. Change photo (KB-149 실연결 — 선택 즉시 업로드+PATCH, 국적
 * 행과 같은 즉시 적용 시맨틱), Nickname (staged, saved on Save),
 * Nationality read-only(P-078 — 7/29 정책: 국적 수정 불가, 온보딩 최초 설정만),
 * Reader language → OS 앱 언어 설정(P-060, 안드12- 숨김), read-only linked
 * provider (KB-203 — Apple/Google). Save persists nickname/spice via PATCH /me.
 */
import { RemoteImage } from '@/components/RemoteImage';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, View, Linking, Platform } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { setUserProps } from '@/lib/analytics';
import { color as C } from '@/lib/theme';
import { SubHeader, Btn, Flag, IconProfile, IconCamera, IconChevron, IconCheck, IconApple, IconGoogleG, IconSearch, Input } from '@/components';
import { AvatarPlaceholder } from '@/components/design4Assets';
import { useBottomInset } from '@/lib/useBottomInset';
import { SpiceLevelSlider } from '@/components/SpiceLevelSlider';
import { type SpiceChoice } from '@/lib/spice';
import { countryByCode } from '@/lib/onboarding/countries';
import { IconLock } from '@/components/icons';
import { LANG_ENDONYM } from '@/lib/i18n/languages';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { useMe, useUpdateMe } from '@/lib/data/useMe';
import { useSubmitGuard } from '@/lib/useSubmitGuard';
import { isDefaultProfileImage, providerLabelKey } from '@/lib/api/memberAdapter';
import { choosePhotoSource, pickBySource, uploadProfileImage, PROFILE_IMAGE_CLEAR } from '@/lib/data/profileImage';
import { currencyForCountry, currencyUpdateFor, saveCurrency, SUPPORTED_CURRENCIES } from '@/lib/exchange';

export default function EditProfile() {
  const router = useRouter();
  const { t } = useTranslation();
  const { lang } = useLocale();
  const { data: me } = useMe();
  const update = useUpdateMe();
  const bottom = useBottomInset(); // P-055: 안드 내비바 보정

  const [nickname, setNickname] = useState('');
  const [spice, setSpice] = useState<SpiceChoice>('SKIP'); // KB-150→P-081 — SKIP = 미설정
  // P-165(#145): 통화 — null = 미설정(국적 폴백), 저장 시 PATCH currency(null 허용)
  const [currency, setCurrency] = useState<string | null>(null);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [currencyQ, setCurrencyQ] = useState('');
  const [sliderDragging, setSliderDragging] = useState(false); // P-098②a 스크롤 잠금
  const [seeded, setSeeded] = useState(false);
  // P-060: 언어 = OS 정본 — OS 앱 설정 열기, 안드12- 숨김
  const canOpenLangSettings = Platform.OS === 'ios' || (Platform.OS === 'android' && Number(Platform.Version) >= 33);
  useEffect(() => {
    if (me && !seeded) {
      setNickname(me.nickname);
      setSpice(me.spiceTolerance);
      // P-165 → KB-418: 서버값이 국가 파생값과 같으면 "자동"으로 시딩 — 자동
      // 저장 후에도(서버엔 파생 코드가 실제로 저장됨) UI는 자동으로 보인다.
      setCurrency(me.currency == null || me.currency === currencyForCountry(me.nationality) ? null : me.currency);
      setSeeded(true);
    }
  }, [me, seeded]);

  const nation = me?.nationality ? countryByCode(me.nationality) : undefined;

  const { busy: saving, run: runSave } = useSubmitGuard(); // P-173: 저장 연타 = PATCH 중복 봉쇄
  function save() {
    if (photoBusy) return; // P-120: 업로드 중 저장 차단(버튼 비활성과 이중 방어)
    // KB-418: "자동" = 국가 파생 코드 명시 송신(서버 null=유지라 null 송신은 무동작).
    // undefined = 무변(필드 생략=유지).
    const currencyWire = currencyUpdateFor(currency, me?.nationality, me?.currency);
    void runSave(async () => {
      await new Promise<void>((resolve) => {
    // spice: 해제 = SKIP — 와이어 -1 센티널 변환은 spiceAdapter (KB-150→P-081)
    update.mutate(
      {
        nickname: nickname.trim() || me?.nickname,
        spiceTolerance: spice,
        ...(currencyWire !== undefined ? { currency: currencyWire } : {}),
        // P-120: 사진 드래프트 — 있을 때만 합류(1회 PATCH), 없으면 필드 생략(유지)
        ...(photoDraft != null ? { profileImageUrl: photoDraft } : {}),
      },
      {
        onSuccess: () => {
          setUserProps({ user_info_spice_level: spice }); // P-144: CSV 트리거(프로필 수정 시 갱신)
          // P-165: 로컬 캐시 동기화 — 서버 정본 원칙(resolveCurrency 체인의 캐시 강등).
          // KB-418: 항상 실코드 저장(자동도 파생 코드가 나감 — null 캐시 클리어 소멸)
          if (currencyWire !== undefined) saveCurrency(currencyWire);
          router.back();
        },
        onSettled: () => resolve(), // P-173: 응답(성공/실패)까지 busy 유지
      },
    );
      });
    });
  }

  // P-120(KB-192, 8/4 예진): 사진 = **로컬 드래프트** — 선택 시 업로드는 즉시
  // (미리보기+스피너)하되 PATCH는 저장 탭에서 다른 필드와 1회 합류. 뒤로가기 =
  // 드래프트 폐기(서버 무변, 미리보기 원복). 구 즉시-PATCH(KB-149) 폐기.
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const [photoDraft, setPhotoDraft] = useState<string | null>(null); // PATCH 값: path 또는 PROFILE_IMAGE_CLEAR
  const [photoPreview, setPhotoPreview] = useState<string | null>(null); // 로컬 uri — 서버 path는 렌더 불가(P-006)

  // 표시 사진 = 드래프트 우선: 삭제 드래프트 → 플레이스홀더 / 새 사진 드래프트 → 로컬 미리보기
  const shownPhotoUri = photoDraft === PROFILE_IMAGE_CLEAR ? null : (photoPreview ?? me?.profileImageUrl ?? null);
  const hasCustomPhoto =
    photoDraft === PROFILE_IMAGE_CLEAR
      ? false
      : photoDraft != null || (!!me?.profileImageUrl && !isDefaultProfileImage(me.profileImageUrl));

  const draftRemovePhoto = () => {
    setPhotoError(false);
    setPhotoDraft(PROFILE_IMAGE_CLEAR);
    setPhotoPreview(null);
  };

  // P-049(KB-218): 시스템 선택 시트(촬영/갤러리/[iOS]삭제) → 소스별 픽업 → 업로드.
  const changePhoto = async () => {
    setPhotoError(false);
    const src = await choosePhotoSource({
      title: t('photo.sheetTitle'),
      camera: t('photo.take'),
      gallery: t('photo.gallery'),
      remove: hasCustomPhoto ? t('editProfile.removePhoto') : undefined,
      cancel: t('common.cancel'),
    });
    if (!src) return; // 취소
    if (src === 'remove') return draftRemovePhoto(); // P-120: 즉시 PATCH → 드래프트
    setPhotoBusy(true); // P-191: 픽커 복귀~원본 준비(iCloud) 구간도 스피너 커버
    const file = await pickBySource(src, {
      permTitle: t('photo.permTitle'),
      permBody: t('photo.permBody'),
      openSettings: t('photo.openSettings'),
      cancel: t('common.cancel'),
    }).catch(() => null);
    if (!file) {
      setPhotoBusy(false); // 취소/권한 거부 — 복구
      return;
    }
    const prevPreview = photoPreview;
    setPhotoPreview(file.uri); // 미리보기 즉시
    try {
      const path = await uploadProfileImage(file);
      setPhotoDraft(path); // 보관만 — 전송은 save()에서
    } catch (e) {
      console.log('[profile] photo upload failed:', (e as Error)?.message ?? e);
      setPhotoPreview(prevPreview); // 실패 = 드래프트 미반영 + 미리보기 원복
      setPhotoError(true);
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <SubHeader
        title={t('editProfile.title')}
        onBack={() => router.back()}
        trailing={
          <Pressable onPress={save} disabled={photoBusy || saving} hitSlop={8} style={[styles.saveWrap, (photoBusy || saving) && { opacity: 0.35 }]}>
            <Text style={styles.saveLink}>{t('common.save')}</Text>
          </Pressable>
        }
      />
      <ScrollView keyboardDismissMode="on-drag" scrollEnabled={!sliderDragging} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* 아바타 100 원 + 카메라 배지 32(#2F3137, 흰 1.5px 링) — KB-149 업로드 실연결 유지 */}
        <View style={styles.avatarWrap}>
          <Pressable testID='avatar' style={styles.av} onPress={photoBusy ? undefined : () => void changePhoto()}>
            {shownPhotoUri ? (
              <RemoteImage uri={shownPhotoUri} style={styles.avImg} />
            ) : (
              <AvatarPlaceholder height={100} />
            )}
            {photoBusy && (
              <View style={[styles.avImg, styles.avBusy]}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
            <View style={styles.cam}>
              <IconCamera size={16} color="#fff" />
            </View>
          </Pressable>
          {/* P-120: 에러 시에만 문구(P-013) */}
          {photoError && <Text style={styles.phErr}>{t('editProfile.photoError')}</Text>}
        </View>

        {/* nickname — Input/Text Filled(4150:14473) */}
        <View style={styles.fieldset}>
          <Text style={styles.fieldLbl}>{t('editProfile.nickname')}</Text>
          <View style={styles.field}>
            <Input
              style={styles.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder={t('editProfile.nicknamePlaceholder')}
              placeholderTextColor={C.inkDisabled}
              autoCorrect={false}
              maxLength={24}
            />
          </View>
          <Text style={styles.hint}>{t('editProfile.nicknameHint')}</Text>
        </View>

        {/* nationality — P-078: 수정 불가(7/29 정책), Disabled 필드 */}
        <View style={styles.fieldset}>
          <Text style={styles.fieldLbl}>{t('editProfile.nationality')}</Text>
          <View style={[styles.field, styles.fieldDisabled]}>
            {!!me?.nationality && <Flag code={me.nationality} size={18} />}
            <Text style={[styles.val, styles.valDisabled]}>{nation?.name ?? me?.nationality}</Text>
            <IconLock size={15} color={C.ink3} />
          </View>
          <Text style={styles.hint}>{t('editProfile.nationalityLocked')}</Text>
        </View>

        {/* P-165(#145): 통화 — 탭 시 피커 시트(문법 무변), 미설정 = 국적 폴백 표시 */}
        <View style={styles.fieldset}>
          <Text style={styles.fieldLbl}>{t('editProfile.currency')}</Text>
          <Pressable style={styles.field} onPress={() => setCurrencyOpen(true)} testID="currency-row">
            <Text style={styles.val}>
              {currency
                ? `${currency} (${SUPPORTED_CURRENCIES.find((c) => c.code === currency)?.symbol ?? ''})`
                : t('editProfile.currencyAuto', { code: currencyForCountry(me?.nationality) })}
            </Text>
            <IconChevron size={16} color={C.ink3} />
          </Pressable>
        </View>

        {/* P-060: 언어 = OS 정본 — 탭 시 OS 앱 설정(언어 항목), 안드12- 숨김 */}
        {canOpenLangSettings && (
          <View style={styles.fieldset}>
            <Text style={styles.fieldLbl}>{t('editProfile.readerLanguage')}</Text>
            <Pressable style={styles.field} onPress={() => void Linking.openSettings()}>
              <Text style={styles.val}>{LANG_ENDONYM[lang] ?? lang}</Text>
              <IconChevron size={16} color={C.ink3} />
            </Pressable>
          </View>
        )}

        {/* spice tolerance — D-5 ② 슬라이더 박스(bg #F7F8FA r8) + Clear 14/600 primary */}
        <View style={styles.fieldset}>
          <Text style={styles.fieldLbl}>{t('editProfile.spice')}</Text>
          <View style={styles.spiceBox}>
            <SpiceLevelSlider level={spice === 'SKIP' ? null : spice} onChange={setSpice} onDragStateChange={setSliderDragging} />
          </View>
          {spice !== 'SKIP' && (
            <Pressable hitSlop={8} onPress={() => setSpice('SKIP')}>
              <Text style={styles.spiceClear}>{t('editProfile.spiceClear')}</Text>
            </Pressable>
          )}
        </View>

        {/* linked provider (read-only) — P-147 서버 정본 · P-034 공식 로고 */}
        <View style={styles.sec}>
          <Text style={styles.secTitle}>{t('editProfile.linkedTitle')}</Text>
          <View style={styles.linkedCard}>
            <View style={styles.linkedIc}>
              {me?.provider === 'APPLE' ? (
                <IconApple size={17} color={C.ink} />
              ) : me?.provider === 'GOOGLE' ? (
                <IconGoogleG size={17} />
              ) : (
                <IconProfile size={17} color={C.ink2} />
              )}
            </View>
            <Text style={styles.linkedLabel}>{t('editProfile.linkedVia')}</Text>
            <Text style={styles.linkedVal}>{t(providerLabelKey(me?.provider))}</Text>
          </View>
        </View>
      </ScrollView>

      {/* P-165: 통화 피커 — 온보딩 국가 피커 문법(natSearch 검색 + 행 리스트) 재사용 */}
      <Modal visible={currencyOpen} animationType="slide" onRequestClose={() => setCurrencyOpen(false)}>
        <View style={[styles.root, { paddingTop: 8 }]}>
          <SubHeader title={t('editProfile.currency')} onBack={() => setCurrencyOpen(false)} />
          <View style={styles.curBody}>
            <View style={styles.curSearch}>
              <IconSearch size={17} color={C.ink2} />
              <Input
                value={currencyQ}
                onChangeText={setCurrencyQ}
                placeholder={t('editProfile.currencySearch')}
                placeholderTextColor={C.ink3}
                style={styles.curSearchInput}
                autoCorrect={false}
                autoCapitalize="characters"
              />
            </View>
            <FlatList
              testID="currency-list"
              data={SUPPORTED_CURRENCIES.filter((c) => {
                const q = currencyQ.trim().toLowerCase();
                return !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
              })}
              keyExtractor={(c) => c.code}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                <Pressable
                  style={styles.curRow}
                  onPress={() => { setCurrency(null); setCurrencyOpen(false); setCurrencyQ(''); }}
                  testID="currency-auto"
                >
                  <Text style={styles.curName}>{t('editProfile.currencyAuto', { code: currencyForCountry(me?.nationality) })}</Text>
                  {currency == null && <IconCheck size={16} color={C.primary} />}
                </Pressable>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={styles.curRow}
                  onPress={() => { setCurrency(item.code); setCurrencyOpen(false); setCurrencyQ(''); }}
                  testID={`currency-${item.code}`}
                >
                  <Text style={styles.curSym}>{item.symbol}</Text>
                  <Text style={styles.curName}>{item.code} · {item.name}</Text>
                  {currency === item.code && <IconCheck size={16} color={C.primary} />}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* BottomBar Single(4150:14473) — primary "✓ Save changes"(P-173 가드 무변) */}
      <View style={[styles.savebar, { paddingBottom: bottom + 10 }]} testID="edit-bottom-bar">
        <Btn variant={photoBusy ? 'off' : 'primary'} busy={saving} icon={<IconCheck size={17} color="#fff" />} onPress={photoBusy ? undefined : save}>
          {t('editProfile.save')}
        </Btn>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 120, gap: 20 },
  saveWrap: { paddingHorizontal: 6, height: 38, justifyContent: 'center' },
  saveLink: { fontSize: 13, fontWeight: '600', color: '#1C1E21' },

  avatarWrap: { alignItems: 'center', gap: 10, paddingVertical: 4 },
  av: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#E8F6FF', alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  avImg: { position: 'absolute', top: 0, left: 0, width: 100, height: 100, borderRadius: 50 },
  avBusy: { backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  cam: { position: 'absolute', right: -2, bottom: -2, width: 32, height: 32, borderRadius: 16, backgroundColor: '#2F3137', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FFFFFF' },
  phErr: { fontSize: 13, fontWeight: '500', color: C.riskCaution },

  // Input/Text 필드(D-1 Filled) — bg #F7F8FA r8, Disabled = 동일 bg + 흐린 값
  fieldset: { gap: 6 },
  fieldLbl: { fontSize: 14, fontWeight: '600', color: '#8E8883' },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface2, borderRadius: 8, paddingHorizontal: 16, minHeight: 52 },
  fieldDisabled: { backgroundColor: C.surface2 },
  valDisabled: { color: C.ink3 },
  input: { flex: 1, fontSize: 15, fontWeight: '500', color: '#1C1E21', paddingVertical: 14 },
  val: { flex: 1, fontSize: 15, fontWeight: '500', color: '#1C1E21' },
  hint: { fontSize: 13, fontWeight: '500', color: C.ink2, marginLeft: 2, marginTop: 1, lineHeight: 18 },

  spiceBox: { backgroundColor: C.surface2, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 },
  spiceClear: { fontSize: 14, fontWeight: '600', color: C.primaryText, marginLeft: 2, marginTop: 4 },

  // Linked to account — 카드 border #EBE6E1 r12 pad 14/16
  sec: { gap: 10 },
  secTitle: { fontSize: 18, fontWeight: '600', color: '#1C1E21' },
  linkedCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#EBE6E1', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16 },
  linkedIc: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.hair, alignItems: 'center', justifyContent: 'center' },
  linkedLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1C1E21' },
  linkedVal: { fontSize: 13, fontWeight: '500', color: '#8E8883' },

  savebar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 10, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: C.line },

  // P-165 통화 피커 — 온보딩 natSearch/natRow 문법 수치 재사용
  curBody: { flex: 1, paddingHorizontal: 18, paddingTop: 8 },
  curSearch: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.surface2, borderRadius: 8, paddingHorizontal: 13, marginBottom: 10 },
  curSearchInput: { flex: 1, paddingVertical: 11, fontSize: 14.5, color: C.ink },
  curRow: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 56, paddingHorizontal: 12, borderRadius: 8 },
  curSym: { fontSize: 16, fontWeight: '600', color: C.ink2, minWidth: 34 },
  curName: { flex: 1, fontSize: 14.5, fontWeight: '500', color: C.ink },
});
