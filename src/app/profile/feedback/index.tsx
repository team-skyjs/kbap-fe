/**
 * 문의 (P-394/KB-586 → P-406/KB-627) — 프로필 "Contact us"의 **첫 화면**. 게스트 포함(기기 식별로 조회된다).
 *
 * P-406(9/22 예진 실기 결정 · 참고 시안 = 채팅 목록형): 목록이 먼저, 하단 우측 알약 "+ New"로 작성.
 * 행은 보더·구분선 없이 **제목 1줄 + 상대시간(+상태, 구분 문자 없이 gap 8) + chevron**만. 칩·답변 수·우상단 날짜는 뺐다.
 * 치수는 발주 전사 그대로(임의 값 없음), 색은 DS 토큰.
 * 재활용: `SubHeader`·`StateBlock`(빈/오류)·스켈레톤·커서 무한 스크롤·`timeAgo`(커뮤니티)·`IconPlus`(커뮤니티 글 FAB).
 */
import * as React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt as Text } from '@/components/Txt';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { IconChevron, IconPlus, SubHeader, Spinner } from '@/components';
import { EmptyBlock, QueryErrorBlock, ScreenCenterFill } from '@/components/StateBlock';
import { SkeletonList } from '@/components/Skeleton';
import { timeAgo } from '@/features/community/parts';
import { useMyFeedbacks, type FeedbackItem } from '@/lib/data/useFeedback';
import { color as C, radius } from '@/lib/theme';

/** 서브 줄에 붙이는 상태 — OPEN은 시간만(발주: 답변·종료만 표기). */
const STATUS_KEY = { ANSWERED: 'feedback.statusAnswered', CLOSED: 'feedback.statusClosed' } as const;

/** 행 제목 = 본문의 **첫 비지 않은 줄**(trim). 전부 공백이면 '' — 행은 숨기지 않고 제목만 생략(서버 데이터
 *  누락 금지, 9/22 FE 질문 답). */
function firstLine(content: string): string {
  return content.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
}

export default function FeedbackListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const q = useMyFeedbacks();
  const items: FeedbackItem[] = q.data?.flat ?? [];

  return (
    <View style={styles.root}>
      <SubHeader title={t('feedback.title')} onBack={() => router.back()} />
      {q.isLoading ? (
        <SkeletonList />
      ) : q.isError && items.length === 0 ? (
        <ScreenCenterFill>
          <QueryErrorBlock error={q.error} onRetry={() => void q.refetch()} />
        </ScreenCenterFill>
      ) : items.length === 0 ? (
        <ScreenCenterFill>
          <EmptyBlock label={t('feedback.emptyTitle')} />
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
          renderItem={({ item }) => {
            const title = firstLine(item.content);
            const when = timeAgo(item.createdAt, t);
            const statusKey = item.status === 'OPEN' ? null : STATUS_KEY[item.status];
            return (
              <Pressable
                style={styles.row}
                onPress={() => router.push(`/profile/feedback/${item.id}` as Href)}
                testID={`feedback-row-${item.id}`}
              >
                <View style={styles.rowText}>
                  {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : null}
                  {/* 시간·상태는 구분 문자 없이 gap으로만 나눈다 — 가운뎃점 0(Q-62 · P-385 전수 잠금) */}
                  <View style={styles.subRow}>
                    <Text style={styles.sub}>{when}</Text>
                    {statusKey ? <Text style={styles.sub} testID="feedback-row-status">{t(statusKey)}</Text> : null}
                  </View>
                </View>
                <IconChevron size={20} color={C.ink3} />
              </Pressable>
            );
          }}
        />
      )}
      {/* 목록 위 절대 배치 — 빈 상태에도 그대로(빈 상태 CTA 대신). 하 여백 96이 마지막 행을 비켜 준다. */}
      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
        onPress={() => router.push('/profile/feedback/new' as Href)}
        testID="feedback-new-fab"
      >
        <IconPlus size={20} color="#FFFFFF" />
        <Text style={styles.fabLabel}>{t('feedback.newInquiry')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  list: { paddingTop: 8, paddingHorizontal: 0, paddingBottom: 96 },
  foot: { paddingVertical: 16, alignItems: 'center' },
  // 커뮤니티 피드 푸터 에러와 같은 치수(새 값 발명 없음)
  footErr: { paddingVertical: 20, alignItems: 'center', gap: 10 },
  footErrText: { fontSize: 13, fontWeight: '500', color: C.inkInfo },
  footRetry: { borderWidth: 1, borderColor: C.line2, borderRadius: radius.sm, paddingHorizontal: 20, paddingVertical: 8 },
  footRetryText: { fontSize: 14, fontWeight: '600', color: C.ink },
  // P-406 전사: 보더·구분선 없음 — 여백만. 좌 세로 스택(gap 4) + 우 chevron(앞 gap 12) 수직 중앙.
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  rowText: { flex: 1, gap: 4 },
  title: { fontSize: 17, fontWeight: '400', color: C.ink },
  subRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  sub: { fontSize: 15, fontWeight: '400', color: C.ink3 },
  // 알약: 우 24 · 하 insets+24(인라인) · 높이 52 · 좌우 24 · 라운딩 26 · 배경 C.ink · 그림자 없음
  fab: {
    position: 'absolute', right: 24, height: 52, paddingHorizontal: 24, borderRadius: 26,
    backgroundColor: C.ink, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  fabLabel: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
});
