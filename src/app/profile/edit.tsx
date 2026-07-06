/**
 * Edit profile (mockup Screen I3) — reached from the pencil on the profile
 * identity card. Change photo (stub), Nickname (staged, saved on Save),
 * Nationality → I4, Reader language → shared LanguagePicker (I5), read-only
 * Email. Nationality + reader language apply immediately when picked (same as
 * the account Language row); Save persists the nickname via PATCH /me.
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow } from '@/lib/theme';
import { SubHeader, Btn, Flag, IconProfile, IconCamera, IconGlobe, IconChevron, IconEnvelope, IconCheck } from '@/components';
import { LanguagePicker } from '@/components/LanguagePicker';
import { NationalityPicker } from '@/components/NationalityPicker';
import { countryByCode } from '@/lib/onboarding/countries';
import { LANG_ENDONYM } from '@/lib/i18n/languages';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { useMe, useUpdateMe } from '@/lib/data/useMe';

export default function EditProfile() {
  const router = useRouter();
  const { t } = useTranslation();
  const { lang } = useLocale();
  const { data: me } = useMe();
  const update = useUpdateMe();

  const [nickname, setNickname] = useState('');
  const [seeded, setSeeded] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [natOpen, setNatOpen] = useState(false);
  useEffect(() => {
    if (me && !seeded) {
      setNickname(me.nickname);
      setSeeded(true);
    }
  }, [me, seeded]);

  const nation = me?.nationality ? countryByCode(me.nationality) : undefined;

  function save() {
    update.mutate({ nickname: nickname.trim() || me?.nickname }, { onSuccess: () => router.back() });
  }

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
        {/* avatar */}
        <View style={styles.avatarWrap}>
          <Pressable style={styles.av}>
            <IconProfile size={44} color={C.primary} />
            <View style={styles.cam}>
              <IconCamera size={16} color="#fff" />
            </View>
          </Pressable>
          <Text style={styles.phLbl}>{t('editProfile.changePhoto')}</Text>
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

        {/* nationality → I4 */}
        <View style={styles.fieldset}>
          <Text style={styles.fieldLbl}>{t('editProfile.nationality')} *</Text>
          <Pressable style={styles.field} onPress={() => setNatOpen(true)}>
            {nation ? <Flag code={nation.code} size={20} /> : <IconGlobe size={18} color={C.ink2} />}
            <Text style={styles.val}>{nation?.name ?? me?.nationality}</Text>
            <IconChevron size={16} color={C.ink3} />
          </Pressable>
          <Text style={[styles.hint, styles.hintWarn]}>{t('editProfile.nationalityHint')}</Text>
        </View>

        {/* reader language → I5 (shared picker) */}
        <View style={styles.fieldset}>
          <Text style={styles.fieldLbl}>{t('editProfile.readerLanguage')} *</Text>
          <Pressable style={styles.field} onPress={() => setLangOpen(true)}>
            <IconGlobe size={18} color={C.ink2} />
            <Text style={styles.val}>{LANG_ENDONYM[lang] ?? lang}</Text>
            <IconChevron size={16} color={C.ink3} />
          </Pressable>
          <Text style={styles.hint}>{t('editProfile.readerLanguageHint')}</Text>
        </View>

        {/* linked email (read-only) */}
        <View style={styles.sec}>
          <Text style={styles.secTitle}>{t('editProfile.linkedTitle')}</Text>
          <View style={styles.acctList}>
            <View style={styles.acctRow}>
              <View style={styles.acctIc}>
                <IconEnvelope size={17} color={C.ink2} />
              </View>
              <Text style={styles.acctLabel}>{t('editProfile.email')}</Text>
              <Text style={styles.acctVal}>{me?.email}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.savebar}>
        <Btn icon={<IconCheck size={17} color="#fff" />} onPress={save}>
          {t('editProfile.save')}
        </Btn>
      </View>

      <LanguagePicker open={langOpen} onClose={() => setLangOpen(false)} />
      <NationalityPicker
        open={natOpen}
        selectedCode={me?.nationality}
        onSelect={(code) => update.mutate({ nationality: code })}
        onClose={() => setNatOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 28, gap: 18 },
  saveWrap: { paddingHorizontal: 6, height: 38, justifyContent: 'center' },
  saveLink: { fontFamily: font.bodyBold, fontSize: 14, color: C.primary },

  avatarWrap: { alignItems: 'center', gap: 10, paddingVertical: 4 },
  av: { width: 92, height: 92, borderRadius: 46, backgroundColor: 'rgba(226,88,12,0.08)', alignItems: 'center', justifyContent: 'center', ...shadow.sh1 },
  cam: { position: 'absolute', right: -2, bottom: -2, width: 32, height: 32, borderRadius: 16, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: C.surface },
  phLbl: { fontFamily: font.bodyBold, fontSize: 13, color: C.primary },

  fieldset: { gap: 6 },
  fieldLbl: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink2 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: 13, paddingHorizontal: 14, minHeight: 52, ...shadow.sh1 },
  input: { flex: 1, fontFamily: font.bodyBold, fontSize: 15, color: C.ink, paddingVertical: 13 },
  val: { flex: 1, fontFamily: font.bodyBold, fontSize: 15, color: C.ink },
  hint: { fontFamily: font.body, fontSize: 12, color: C.ink2, marginLeft: 2, marginTop: 3, lineHeight: 17 },
  hintWarn: { fontFamily: font.bodyBold, color: C.riskCaution },

  sec: { gap: 10 },
  secTitle: { fontFamily: font.display, fontSize: 16, color: C.ink, letterSpacing: -0.2 },
  acctList: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.lg, overflow: 'hidden', ...shadow.sh1 },
  acctRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, paddingVertical: 14 },
  acctIc: { width: 30, height: 30, borderRadius: 9, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  acctLabel: { flex: 1, fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink },
  acctVal: { fontFamily: font.body, fontSize: 13, color: C.ink3 },

  savebar: { padding: 18, paddingBottom: 30, backgroundColor: 'rgba(252,245,239,0.92)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.hair },
});
