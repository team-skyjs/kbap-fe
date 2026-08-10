/**
 * Edit profile (mockup Screen I3) — reached from the pencil on the profile
 * identity card. Change photo (KB-149 실연결 — 선택 즉시 업로드+PATCH, 국적
 * 행과 같은 즉시 적용 시맨틱), Nickname (staged, saved on Save),
 * Nationality read-only(P-078 — 7/29 정책: 국적 수정 불가, 온보딩 최초 설정만),
 * Reader language → OS 앱 언어 설정(P-060, 안드12- 숨김), read-only linked
 * provider (KB-203 — Apple/Google). Save persists nickname/spice via PATCH /me.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View, Linking, Platform } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { setUserProps } from '@/lib/analytics';
import { color as C, font, radius, shadow } from '@/lib/theme';
import { SubHeader, Btn, Flag, IconProfile, IconCamera, IconGlobe, IconChevron, IconCheck, IconApple, IconGoogleG, Input } from '@/components';
import { SpiceLevelSlider } from '@/components/SpiceLevelSlider';
import { SPICE_LEVEL_LABEL, spiceRank, type SpiceChoice } from '@/lib/spice';
import { countryByCode } from '@/lib/onboarding/countries';
import { IconLock } from '@/components/icons';
import { LANG_ENDONYM } from '@/lib/i18n/languages';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { useMe, useUpdateMe } from '@/lib/data/useMe';
import { isDefaultProfileImage, providerLabelKey } from '@/lib/api/memberAdapter';
import { choosePhotoSource, pickBySource, uploadProfileImage, PROFILE_IMAGE_CLEAR } from '@/lib/data/profileImage';

export default function EditProfile() {
  const router = useRouter();
  const { t } = useTranslation();
  const { lang } = useLocale();
  const { data: me } = useMe();
  const update = useUpdateMe();

  const [nickname, setNickname] = useState('');
  const [spice, setSpice] = useState<SpiceChoice>('SKIP'); // KB-150→P-081 — SKIP = 미설정
  const [sliderDragging, setSliderDragging] = useState(false); // P-098②a 스크롤 잠금
  const [seeded, setSeeded] = useState(false);
  // P-060: 언어 = OS 정본 — OS 앱 설정 열기, 안드12- 숨김
  const canOpenLangSettings = Platform.OS === 'ios' || (Platform.OS === 'android' && Number(Platform.Version) >= 33);
  useEffect(() => {
    if (me && !seeded) {
      setNickname(me.nickname);
      setSpice(me.spiceTolerance);
      setSeeded(true);
    }
  }, [me, seeded]);

  const nation = me?.nationality ? countryByCode(me.nationality) : undefined;

  function save() {
    if (photoBusy) return; // P-120: 업로드 중 저장 차단(버튼 비활성과 이중 방어)
    // spice: 해제 = SKIP — 와이어 -1 센티널 변환은 spiceAdapter (KB-150→P-081)
    update.mutate(
      {
        nickname: nickname.trim() || me?.nickname,
        spiceTolerance: spice,
        // P-120: 사진 드래프트 — 있을 때만 합류(1회 PATCH), 없으면 필드 생략(유지)
        ...(photoDraft != null ? { profileImageUrl: photoDraft } : {}),
      },
      {
        onSuccess: () => {
          setUserProps({ spice_level: spice }); // P-144: CSV 트리거(프로필 수정 시 갱신)
          router.back();
        },
      },
    );
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
    const file = await pickBySource(src, {
      permTitle: t('photo.permTitle'),
      permBody: t('photo.permBody'),
      openSettings: t('photo.openSettings'),
      cancel: t('common.cancel'),
    }).catch(() => null);
    if (!file) return; // 취소/권한 거부(안내 완료)
    const prevPreview = photoPreview;
    setPhotoPreview(file.uri); // 미리보기 즉시
    setPhotoBusy(true);
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
          <Pressable onPress={save} disabled={photoBusy} hitSlop={8} style={[styles.saveWrap, photoBusy && { opacity: 0.35 }]}>
            <Text style={styles.saveLink}>{t('common.save')}</Text>
          </Pressable>
        }
      />
      <ScrollView keyboardDismissMode="on-drag" scrollEnabled={!sliderDragging} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* avatar — KB-149 실연결 */}
        <View style={styles.avatarWrap}>
          <Pressable testID='avatar' style={styles.av} onPress={photoBusy ? undefined : () => void changePhoto()}>
            {shownPhotoUri ? (
              <Image source={{ uri: shownPhotoUri }} style={styles.avImg} />
            ) : (
              <IconProfile size={44} color={C.primary} />
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
          {/* P-120: "사진 변경" 상시 라벨 제거(아바타 탭으로 충분) — 에러 시에만 그 자리(P-013 문구) */}
          {photoError && <Text style={styles.phErr}>{t('editProfile.photoError')}</Text>}
          {/* P-123: 안드 텍스트 삭제 버튼 소멸 — 시트(커뮤니티 ActionSheet 재사용)에
              빨간 삭제가 생겨 양 플랫폼 시트 일원화. */}
        </View>

        {/* nickname */}
        <View style={styles.fieldset}>
          <Text style={styles.fieldLbl}>{t('editProfile.nickname')} *</Text>
          <View style={styles.field}>
            <IconProfile size={18} color={C.ink2} />
            <Input
              style={styles.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder={t('editProfile.nicknamePlaceholder')}
              placeholderTextColor={C.ink3}
              autoCorrect={false}
              maxLength={24}
            />
          </View>
          <Text style={styles.hint}>{t('editProfile.nicknameHint')}</Text>
        </View>

        {/* nationality — P-078: 수정 불가(7/29 정책), 읽기 전용 표시 */}
        <View style={styles.fieldset}>
          <Text style={styles.fieldLbl}>{t('editProfile.nationality')}</Text>
          <View style={[styles.field, styles.fieldLocked]}>
            {!!me?.nationality && <Flag code={me.nationality} size={18} />}
            <Text style={[styles.val, styles.valLocked]}>{nation?.name ?? me?.nationality}</Text>
            <IconLock size={15} color={C.ink3} />
          </View>
          <Text style={styles.hint}>{t('editProfile.nationalityLocked')}</Text>
        </View>

        {/* P-060: 언어 = OS 정본 — 탭 시 OS 앱 설정(언어 항목), 안드12- 숨김 */}
        {canOpenLangSettings && (
          <View style={styles.fieldset}>
            <Text style={styles.fieldLbl}>{t('editProfile.readerLanguage')}</Text>
            <Pressable style={styles.field} onPress={() => void Linking.openSettings()}>
              <IconGlobe size={18} color={C.ink2} />
              <Text style={styles.val}>{LANG_ENDONYM[lang] ?? lang}</Text>
              <IconChevron size={16} color={C.ink3} />
            </Pressable>
          </View>
        )}

        {/* spice tolerance (KB-150→P-081) — 온보딩과 동일 5스톱 히트 슬라이더(공용
            SpiceLevelSlider) + 🌶️ 카운트 표시(불꽃·10-스케일 폐기, 헌법 v2.2.0 예외). */}
        <View style={styles.fieldset}>
          <Text style={styles.fieldLbl}>{t('editProfile.spice')}</Text>
          <View style={[styles.field, styles.spiceField]}>
            <SpiceLevelSlider level={spice === 'SKIP' ? null : spice} onChange={setSpice} onDragStateChange={setSliderDragging} />
            <Text style={[styles.spiceVal, spice === 'SKIP' && styles.spiceValUnset]}>
              {spice !== 'SKIP'
                ? `${spiceRank(spice) > 0 ? `${'\u{1F336}\u{FE0F}'.repeat(spiceRank(spice))} ` : ''}${t(SPICE_LEVEL_LABEL[spice])}`
                : t('profile.spiceUnset')}
            </Text>
          </View>
          {spice !== 'SKIP' && (
            <Pressable hitSlop={8} onPress={() => setSpice('SKIP')}>
              <Text style={styles.spiceClear}>{t('editProfile.spiceClear')}</Text>
            </Pressable>
          )}
        </View>

        {/* linked provider (read-only) — KB-203/P-029: email은 프로필 계약에 없어
            항상 undefined였음 → 가입 소셜(provider)로 교체. P-034(Q-16): 아이콘은
            공식 로고 — 애플 필드 마크 + 구글 4색 G(로그인 버튼과 SSOT). 미지원·누락 중립 폴백. */}
        <View style={styles.sec}>
          <Text style={styles.secTitle}>{t('editProfile.linkedTitle')}</Text>
          <View style={styles.acctList}>
            <View style={styles.acctRow}>
              <View style={styles.acctIc}>
                {me?.provider === 'APPLE' ? (
                  <IconApple size={17} color={C.ink} />
                ) : me?.provider === 'GOOGLE' ? (
                  <IconGoogleG size={17} />
                ) : (
                  <IconProfile size={17} color={C.ink2} />
                )}
              </View>
              <Text style={styles.acctLabel}>{t('editProfile.linkedVia')}</Text>
              <Text style={styles.acctVal}>{t(providerLabelKey(me?.provider))}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.savebar}>
        <Btn variant={photoBusy ? 'off' : 'primary'} icon={<IconCheck size={17} color="#fff" />} onPress={photoBusy ? undefined : save}>
          {t('editProfile.save')}
        </Btn>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 28, gap: 18 },
  saveWrap: { paddingHorizontal: 6, height: 38, justifyContent: 'center' },
  saveLink: { fontFamily: font.bodyBold, fontSize: 14, color: C.primaryText },

  avatarWrap: { alignItems: 'center', gap: 10, paddingVertical: 4 },
  av: { width: 92, height: 92, borderRadius: 46, backgroundColor: 'rgba(226,88,12,0.08)', alignItems: 'center', justifyContent: 'center', ...shadow.sh1 },
  avImg: { position: 'absolute', top: 0, left: 0, width: 92, height: 92, borderRadius: 46 },
  avBusy: { backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  cam: { position: 'absolute', right: -2, bottom: -2, width: 32, height: 32, borderRadius: 16, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: C.surface },
  phLbl: { fontFamily: font.bodyBold, fontSize: 13, color: C.primaryText },
  phErr: { fontFamily: font.bodyBold, fontSize: 13, color: C.riskCaution },
  phRemove: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.riskDanger, padding: 4 },

  fieldset: { gap: 6 },
  fieldLbl: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink2 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: 13, paddingHorizontal: 14, minHeight: 52, ...shadow.sh1 },
  fieldLocked: { backgroundColor: '#F5EEE7', borderColor: 'transparent' },
  valLocked: { color: C.ink2 },
  input: { flex: 1, fontFamily: font.bodyBold, fontSize: 15, color: C.ink, paddingVertical: 13 },
  val: { flex: 1, fontFamily: font.bodyBold, fontSize: 15, color: C.ink },
  hint: { fontFamily: font.body, fontSize: 12, color: C.ink2, marginLeft: 2, marginTop: 3, lineHeight: 17 },
  hintWarn: { fontFamily: font.bodyBold, color: C.riskCaution },

  spiceField: { flexDirection: 'column', alignItems: 'stretch', gap: 10, paddingVertical: 14 },
  // P-119: 🌶️ 유무(NONE=0개)로 줄 높이가 변해 화면이 들썩이던 것 고정
  spiceVal: { fontFamily: font.bodyBold, fontSize: 13, lineHeight: 22, color: C.ink2, textAlign: 'center' },
  spiceValUnset: { fontFamily: font.body, color: C.ink3 },
  spiceClear: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.primaryText, marginLeft: 2, marginTop: 3 },

  sec: { gap: 10 },
  secTitle: { fontFamily: font.display, fontSize: 16, color: C.ink, letterSpacing: -0.2 },
  acctList: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.lg, overflow: 'hidden', ...shadow.sh1 },
  acctRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, paddingVertical: 14 },
  acctIc: { width: 30, height: 30, borderRadius: 9, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  acctLabel: { flex: 1, fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink },
  acctVal: { fontFamily: font.body, fontSize: 13, color: C.ink3 },

  savebar: { padding: 18, paddingBottom: 30, backgroundColor: 'rgba(252,245,239,0.92)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.hair },
});
