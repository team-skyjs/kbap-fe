/**
 * Blocked users (P-087/KB-251 D-06) — 설정 내 차단 목록 (Apple 1.2 해제 수단).
 * 단방향 차단 안내(확정 카피 계열) · Unblock = 행 내 즉시(확인 없음) · 빈 상태.
 */
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow } from '@/lib/theme';
import { Flag, IconProfile, IconUserX, SubHeader } from '@/components';
import { QueryErrorBlock } from '@/components/StateBlock';
import { useBlockedUsers, useUnblockUser } from '@/lib/community/hooks';
import { authorName } from '@/features/community/parts';

export default function BlockedUsers() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data: blocked, error, refetch } = useBlockedUsers(); // P-164: 에러 표면
  const unblock = useUnblockUser();

  return (
    <View style={styles.root}>
      <SubHeader title={t('community.blockedTitle')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* 단방향 설명 — "You won't see their posts or comments" 계열 (양방향 카피 불채택) */}
        <Text style={styles.note}>{t('community.blockedNote')}</Text>
        {/* P-164: 로드 실패 = 공용 에러(+재시도) — 빈 화면 방치 금지 */}
        {error && !blocked ? (
          <QueryErrorBlock error={error} onRetry={() => void refetch()} onGoBack={() => router.back()} />
        ) : (blocked ?? []).length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIc}>
              <IconUserX size={26} color={C.ink3} />
            </View>
            <Text style={styles.emptyTitle}>{t('community.blockedEmptyTitle')}</Text>
            <Text style={styles.emptyBody}>{t('community.blockedEmptyBody')}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {(blocked ?? []).map((u, i) => (
              <View key={u.id} style={[styles.row, i > 0 && styles.rowDivider]}>
                {u.nationality ? (
                  <Flag code={u.nationality} size={26} />
                ) : (
                  <View style={styles.anonAvatar}>
                    <IconProfile size={15} color={C.ink3} />
                  </View>
                )}
                <Text style={styles.name} numberOfLines={1}>
                  {authorName({ id: u.id, nickname: u.nickname, nationality: u.nationality }, t)}
                </Text>
                <Pressable style={styles.unblockBtn} onPress={() => unblock.mutate(u.id)} hitSlop={6}>
                  <Text style={styles.unblockText}>{t('community.unblock')}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { padding: 18, gap: 14 },
  note: { fontFamily: font.body, fontSize: 12.5, color: C.ink2, lineHeight: 18 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, ...shadow.sh1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 13 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.hair },
  anonAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink },
  unblockBtn: { borderWidth: 1.5, borderColor: C.line, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 },
  unblockText: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink },

  empty: { alignItems: 'center', gap: 10, paddingTop: 60, paddingHorizontal: 26 },
  emptyIc: { width: 58, height: 58, borderRadius: 18, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: font.display, fontSize: 17, color: C.ink },
  emptyBody: { fontFamily: font.body, fontSize: 13, color: C.ink2, textAlign: 'center', lineHeight: 19 },
});
