/**
 * 문의 상세 (P-394/KB-586) — 내 본문·사진 + 답변 스레드.
 *
 * ⚠️ 계약(feedback-contract §2)에 **앱용 단건 조회가 없다**(GET /{id}는 어드민 전용) —
 * 그래서 별도 쿼리를 만들지 않고 목록 쿼리(['feedbacks','me'])에서 id로 찾는다.
 * 딥링크·콜드 스타트로 들어와 첫 페이지에 없으면 **찾을 때까지 다음 페이지를 당긴다**
 * (목록에서 탭해 들어온 보통 경로는 캐시가 이미 더워서 즉시 그려진다).
 *
 * 답변자 표시는 "K-Bap team" 고정 — 계약상 어드민 계정 정보는 앱에 내려오지 않는다.
 */
import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Chip, SubHeader } from '@/components';
import { EmptyBlock, QueryErrorBlock, ScreenCenterFill } from '@/components/StateBlock';
import { SkeletonList } from '@/components/Skeleton';
import { RemoteImage } from '@/components/RemoteImage';
import { useMyFeedbacks } from '@/lib/data/useFeedback';
import { formatOrderDate } from '@/app/profile/my-foods';
import { color as C, radius } from '@/lib/theme';

const STATUS_KEY = { OPEN: 'feedback.statusOpen', ANSWERED: 'feedback.statusAnswered', CLOSED: 'feedback.statusClosed' } as const;

export default function FeedbackDetailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useMyFeedbacks();
  const item = q.data?.flat.find((f) => f.id === id);

  // 캐시에 없고 뒤 페이지가 남았으면 당겨본다 — 다 훑어도 없으면 아래 "없음" 분기.
  // ⚠️ 페이지 요청이 실패해도 마지막 성공 페이지가 hasNextPage=true를 유지한다 —
  // 그대로 두면 이 이펙트가 실패한 요청을 무한 재발행하고 스켈레톤이 영원히 남는다(Codex #170).
  // `isFetchNextPageError`가 서면 멈추고 아래 오류 폴백(재시도 버튼)으로 넘긴다.
  // 또 하나: 캐시가 stale인 채로 들어오면 기존 페이지 **재조회가 이미 떠 있을 수** 있다.
  // 그때 fetchNextPage를 부르면 그 갱신을 앞질러(기본 취소 동작) 낡은 체인을 계속 훑다가
  // 새로 도착했을 문의를 "없음"으로 끝낸다 — 진행 중인 요청이 끝난 뒤에 당긴다(Codex #170).
  const pageFailed = q.isFetchNextPageError;
  const busy = q.isFetching; // 초기 로드·백그라운드 재조회·다음 페이지 전부 포함
  React.useEffect(() => {
    if (!item && q.hasNextPage && !busy && !pageFailed) void q.fetchNextPage();
  }, [item, q.hasNextPage, busy, pageFailed, q]);

  const searching = !pageFailed && (q.isLoading || (!item && (q.hasNextPage || busy)));

  return (
    <View style={styles.root}>
      <SubHeader title={t('feedback.myTitle')} onBack={() => router.back()} />
      {searching ? (
        <SkeletonList />
      ) : (q.isError || pageFailed) && !item ? (
        <ScreenCenterFill>
          {/* refetch는 기존 페이지를 다시 받아 실패 상태를 풀어준다 — 그러면 위 이펙트가 이어서 탐색 */}
          <QueryErrorBlock error={q.error} onRetry={() => void q.refetch()} />
        </ScreenCenterFill>
      ) : !item ? (
        <ScreenCenterFill>
          <EmptyBlock label={t('feedback.notFound')} />
        </ScreenCenterFill>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.head}>
            <Chip label={t(STATUS_KEY[item.status])} selected={item.status === 'ANSWERED'} />
            <Text style={styles.date}>{formatOrderDate(Date.parse(item.createdAt))}</Text>
          </View>
          <Text style={styles.content} testID="feedback-detail-content">{item.content}</Text>
          {item.imageUrls.map((url) => (
            <RemoteImage key={url} uri={url} style={styles.photo} contentFit="cover" />
          ))}
          {/* 답변 스레드 — 0건이면 섹션 헤더 자체를 내지 않는다(빈 헤더 금지 P-210) */}
          {item.replies.length > 0 && (
            <View style={styles.replies} testID="feedback-detail-replies">
              {item.replies.map((r) => (
                <View key={r.id} style={styles.reply}>
                  <View style={styles.head}>
                    <Text style={styles.author}>{t('feedback.teamName')}</Text>
                    <Text style={styles.date}>{formatOrderDate(Date.parse(r.createdAt))}</Text>
                  </View>
                  <Text style={styles.content}>{r.content}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  body: { padding: 20, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  date: { fontSize: 12, fontWeight: '400', color: C.ink3 },
  content: { fontSize: 15, fontWeight: '400', color: C.ink, lineHeight: 22 },
  photo: { width: '100%', aspectRatio: 1, borderRadius: radius.sm },
  replies: { gap: 12, marginTop: 8 },
  // 답변 = 옅은 면으로 내 본문과 구분(색만 — 프레임은 본문과 동일 여백)
  reply: { gap: 6, padding: 14, borderRadius: radius.sm, backgroundColor: C.surface2 },
  author: { fontSize: 14, fontWeight: '600', color: C.ink },
});
