/**
 * Edit profile (mockup Screen I3) — reached from the pencil on the profile
 * identity card. Change photo (KB-149 실연결 — 선택 즉시 업로드+PATCH, 국적
 * 행과 같은 즉시 적용 시맨틱), Nickname (staged, saved on Save),
 * Nationality read-only(P-078 — 7/29 정책: 국적 수정 불가, 온보딩 최초 설정만),
 * Reader language → OS 앱 언어 설정(P-060, 안드12- 숨김), read-only linked
 * provider (KB-203 — Apple/Google). Save persists nickname/spice via PATCH /me.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, TextInput, View, Linking, Platform } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow } from '@/lib/theme';
import { SubHeader, Btn, Flag, IconProfile, IconCamera, IconGlobe, IconChevron, IconCheck, IconFlame, IconApple, IconGoogleG } from '@/components';
import { SPICE_SCALE } from '@/lib/onboarding/data';
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
  const [spice, setSpice] = useState<number | null>(null); // KB-150 — null = 미설정
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
    // spice: 해제(null) = -1 센티널 전송 (KB-150 확정 7/16 — useMe 참조)
    update.mutate({ nickname: nickname.trim() || me?.nickname, spiceTolerance: spice }, { onSuccess: () => router.back() });
  }

  // KB-149: 사진은 국적 행처럼 즉시 적용 — 선택 → 업로드 → PATCH.
  // 실패는 정직한 에러 표시, 기존 사진/플레이스홀더 유지 (수정 자체를 막지 않음).
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  // P-049(KB-218): 시스템 선택 시트(촬영/갤러리/[iOS]삭제) → 소스별 픽업 → 업로드.
  const changePhoto = async () => {
    setPhotoError(false);
    const canRemove = !!me?.profileImageUrl && !isDefaultProfileImage(me.profileImageUrl);
    const src = await choosePhotoSource({
      title: t('photo.sheetTitle'),
      camera: t('photo.take'),
      gallery: t('photo.gallery'),
      remove: canRemove ? t('editProfile.removePhoto') : undefined,
      cancel: t('common.cancel'),
    });
    if (!src) return; // 취소
    if (src === 'remove') return update.mutate({ profileImageUrl: PROFILE_IMAGE_CLEAR }); // P-016 로직 재사용
    const file = await pickBySource(src, {
      permTitle: t('photo.permTitle'),
      permBody: t('photo.permBody'),
      openSettings: t('photo.openSettings'),
      cancel: t('common.cancel'),
    }).catch(() => null);
    if (!file) return; // 취소/권한 거부(안내 완료)
    setPhotoBusy(true);
    try {
      const url = await uploadProfileImage(file);
      update.mutate({ profileImageUrl: url });
    } catch (e) {
      console.log('[profile] photo upload failed:', (e as Error)?.message ?? e);
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
          <Pressable onPress={save} hitSlop={8} style={styles.saveWrap}>
            <Text style={styles.saveLink}>{t('common.save')}</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* avatar — KB-149 실연결 */}
        <View style={styles.avatarWrap}>
          <Pressable style={styles.av} onPress={photoBusy ? undefined : () => void changePhoto()}>
            {me?.profileImageUrl ? (
              <Image source={{ uri: me.profileImageUrl }} style={styles.avImg} />
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
          <Text style={photoError ? styles.phErr : styles.phLbl}>
            {photoError ? t('editProfile.photoError') : t('editProfile.changePhoto')}
          </Text>
          {/* P-013/P-016(KB-149 후속): 사진 삭제 — 커스텀 사진일 때만 노출 (서버가
              항상 URL을 주므로 기본 사진은 사진 없음 취급 — isDefaultProfileImage).
              확인 얼럿 없이 즉시(재선택으로 복구 용이). PATCH 기본 path →
              ['me'] invalidate 재조회로 기본 사진 복귀 (전송값 PROFILE_IMAGE_CLEAR). */}
          {!!me?.profileImageUrl && !isDefaultProfileImage(me.profileImageUrl) && !photoBusy && (
            <Pressable onPress={() => update.mutate({ profileImageUrl: PROFILE_IMAGE_CLEAR })} hitSlop={8}>
              <Text style={styles.phRemove}>{t('editProfile.removePhoto')}</Text>
            </Pressable>
          )}
        </View>

        {/* nickname */}
        <View style={styles.fieldset}>
          <Text style={styles.fieldLbl}>{t('editProfile.nickname')} *</Text>
          <View style={styles.field}>
            <IconProfile size={18} color={C.ink2} />
            <TextInput
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

        {/* spice tolerance (KB-150) — 온보딩 spice 스텝과 동일 0~10 스케일/라벨(SPICE_SCALE) 재사용 */}
        <View style={styles.fieldset}>
          <Text style={styles.fieldLbl}>{t('editProfile.spice')}</Text>
          <View style={[styles.field, styles.spiceField]}>
            <View style={styles.spiceRow}>
              {Array.from({ length: 11 }).map((_, i) => (
                <Pressable key={i} onPress={() => setSpice(i)} hitSlop={6}>
                  <IconFlame size={18} color={spice != null && i <= spice ? C.primary : C.ink3} />
                </Pressable>
              ))}
            </View>
            <Text style={[styles.spiceVal, spice == null && styles.spiceValUnset]}>
              {spice != null ? t('detail.spice', { level: spice, analogy: t(SPICE_SCALE[spice] ?? '') }) : t('profile.spiceUnset')}
            </Text>
          </View>
          {spice != null && (
            <Pressable hitSlop={8} onPress={() => setSpice(null)}>
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
        <Btn icon={<IconCheck size={17} color="#fff" />} onPress={save}>
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
  spiceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  spiceVal: { fontFamily: font.bodyBold, fontSize: 13, color: C.ink2, textAlign: 'center' },
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
