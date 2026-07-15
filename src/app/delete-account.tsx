/**
 * Delete account confirm (mockup Screen I2) — FR-032. Spells out that sensitive
 * data is deleted immediately while reviews are kept but anonymized. Requires an
 * explicit acknowledgement before the destructive action.
 *
 * LIVE (KB-67): confirming PATCHes /auth/withdraw, clears the BE session and
 * Firebase sign-in, then routes to /login. (리뷰 익명화 등 데이터 처리는 BE 몫.)
 */
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useRouter, type Href } from 'expo-router';
import { FLAGS } from '@/lib/flags';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius } from '@/lib/theme';
import { SubHeader, Btn, RiskMark, IconCheck, IconTrash } from '@/components';

export default function DeleteAccount() {
  const router = useRouter();
  const { t } = useTranslation();
  const [agreed, setAgreed] = useState(false);

  return (
    <View style={styles.root}>
      <SubHeader title={t('profile.deleteAccount')} onBack={() => router.back()} />
      <View style={styles.body}>
        <View style={styles.icon}>
          <IconTrash size={30} color={C.riskDanger} />
        </View>
        <Text style={styles.title}>{t('profile.delete.title')}</Text>

        <View style={styles.list}>
          <View style={styles.row}>
            <RiskMark state="danger" size={20} variant="outline" />
            <Text style={styles.rowText}>{t('profile.delete.dataLine')}</Text>
          </View>
          {/* 리뷰 익명화 안내 — KB-148 MVP 제외(숨김) */}
          {FLAGS.reviewsEnabled && (
            <View style={styles.row}>
              <RiskMark state="safe" size={20} variant="outline" />
              <Text style={styles.rowText}>{t('profile.delete.reviewsLine')}</Text>
            </View>
          )}
        </View>

        <Pressable style={styles.consent} onPress={() => setAgreed(!agreed)}>
          <View style={[styles.check, agreed && styles.checkOn]}>{agreed && <IconCheck size={14} color="#fff" />}</View>
          <Text style={styles.consentText}>{t('profile.delete.confirm')}</Text>
        </Pressable>

        <View style={{ gap: 9 }}>
          <Btn
            variant={agreed ? 'danger' : 'off'}
            icon={agreed ? <IconTrash size={16} color="#fff" /> : undefined}
            onPress={
              agreed
                ? () => {
                    // KB-67: 탈퇴 실호출 → 세션 정리 → 재로그인 화면
                    void (async () => {
                      const { withdrawBe } = await import('@/lib/auth/beAuth');
                      await withdrawBe().catch(() => {}); // 실패해도 로컬 세션은 정리됨
                      if (Platform.OS !== 'web') {
                        const session = require('@/lib/auth/session') as typeof import('@/lib/auth/session');
                        await session.logOut().catch(() => {});
                      }
                      router.replace('/login' as Href);
                    })();
                  }
                : undefined
            }
          >
            {t('profile.delete.confirmBtn')}
          </Btn>
          <Btn variant="ghost" onPress={() => router.back()}>
            {t('profile.delete.cancel')}
          </Btn>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: 22, gap: 18 },
  icon: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fdecea', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  title: { fontFamily: font.display, fontSize: 22, color: C.ink, textAlign: 'center' },
  list: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, padding: 13 },
  rowText: { flex: 1, fontFamily: font.body, fontSize: 13.5, color: C.ink, lineHeight: 19 },
  consent: { flexDirection: 'row', alignItems: 'center', gap: 11, justifyContent: 'center' },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: C.primary, borderColor: C.primary },
  consentText: { fontFamily: font.bodyBold, fontSize: 13.5, color: C.ink },
});
