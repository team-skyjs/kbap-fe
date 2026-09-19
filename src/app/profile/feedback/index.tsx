/**
 * 내 문의 (P-394/KB-586) — 최신순 목록 + 상태 칩. 게스트 포함(기기 식별로 조회된다).
 *
 * 기존 자산 재활용(9/18 예진): `SubHeader`·공용 `Chip`·`StateBlock`(빈/오류)·
 * 스켈레톤·커서 무한 스크롤 문법. 새 스타일 상수는 최소(목록 행 여백만).
 */
import * as React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Btn, Chip, SubHeader, Spinner } from '@/components';
import { EmptyBlock, QueryErrorBlock, ScreenCenterFill } from '@/components/StateBlock';
import { SkeletonList } from '@/components/Skeleton';
import { useMyFeedbacks, type FeedbackItem } from '@/lib/data/useFeedback';
import { formatOrderDate } from '@/app/profile/my-foods';
import { color as C, radius } from '@/lib/theme';

const STATUS_KEY = { OPEN: 'feedback.statusOpen', ANSWERED: 'feedback.statusAnswered', CLOSED: 'feedback.statusClosed' } as const;

export default function MyFeedbackScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const q = useMyFeedbacks();
  const items: FeedbackItem[] = q.data?.flat ?? [];

  return (
    <View style={styles.root}>
      <SubHeader title={t('feedback.myTitle')} onBack={() => router.back()} />
      {q.isLoading ? (
        <SkeletonList />
      ) : q.isError && items.length === 0 ? (
        <ScreenCenterFill>
          <QueryErrorBlock error={q.error} onRetry={() => void q.refetch()} />
        </ScreenCenterFill>
      ) : items.length === 0 ? (
        <ScreenCenterFill>
          <EmptyBlock label={t('feedback.emptyTitle')} />
          <Btn variant="ghost" onPress={() => router.push('/profile/feedback/new' as Href)} testID="feedback-empty-cta">
            {t('feedback.title')}
          </Btn>
        </ScreenCenterFill>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(f) => f.id}
          contentContainerStyle={styles.list}
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage(); }}
          ListFooterComponent={
            q.isFetchingNextPage ? (
              <View style={styles.foot}><Spinner size={18} color={C.ink3} /></View>
            ) : q.isFetchNextPageError ? (
              /* 다음 페이지 실패 = 푸터 소형 에러. 기존 페이지가 남아 전체 오류 블록이 안 뜨고
                 onEndReached는 콘텐츠 길이가 그대로라 다시 안 불린다 — 여기서만 재시도가 가능하다
                 (Codex #170 P2 · 커뮤니티 피드 feed-next-error와 같은 문법). */
              <View style={styles.footErr} testID="feedback-next-error">
                <Text style={styles.footErrText}>{t('states.errorTitle')}</Text>
                <Pressable style={styles.footRetry} onPress={() => void q.fetchNextPage()} testID="feedback-next-retry">
                  <Text style={styles.footRetryText}>{t('common.retry')}</Text>
                </Pressable>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => router.push(`/profile/feedback/${item.id}` as Href)}
              testID={`feedback-row-${item.id}`}
            >
              <View style={styles.rowTop}>
                <Chip label={t(STATUS_KEY[item.status])} selected={item.status === 'ANSWERED'} />
                <Text style={styles.date}>{formatOrderDate(Date.parse(item.createdAt))}</Text>
              </View>
              <Text style={styles.preview} numberOfLines={2}>{item.content}</Text>
              {item.replies.length > 0 && (
                <Text style={styles.replyCount}>{t('feedback.replyCount', { count: item.replies.length })}</Text>
              )}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  list: { padding: 20, gap: 12 },
  foot: { paddingVertical: 16, alignItems: 'center' },
  // 커뮤니티 피드 푸터 에러와 같은 치수(새 값 발명 없음)
  footErr: { paddingVertical: 20, alignItems: 'center', gap: 10 },
  footErrText: { fontSize: 13, fontWeight: '500', color: C.inkInfo },
  footRetry: { borderWidth: 1, borderColor: C.line2, borderRadius: radius.sm, paddingHorizontal: 20, paddingVertical: 8 },
  footRetryText: { fontSize: 14, fontWeight: '600', color: C.ink },
  row: { gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: C.line, borderRadius: radius.sm },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  date: { fontSize: 12, fontWeight: '400', color: C.ink3 },
  preview: { fontSize: 14, fontWeight: '400', color: C.ink },
  replyCount: { fontSize: 12, fontWeight: '600', color: C.primaryText },
});
