/**
 * 운영진 채팅 플로팅 버튼 (KB-1008, P-614 배치 확정) — 탭 화면 공용 우하단(탭바 위 18). 스캔·카메라는 탭이 아니라 자동 제외.
 * 커뮤니티 탭에선 Write review 알약(최대 높이) 위로 고정 — 알약이 compact로 줄어도 버튼은 안 움직인다.
 * 안읽음 = 빨간 점 + 마지막 운영진 메시지 미리보기 말풍선(탭 = 채팅). 플래그 off = 렌더 0.
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSpeech } from '@/components';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { TABBAR_CONTENT_H } from '@/components/TabBar';
import { FLAGS } from '@/lib/flags';
import { useChatUnread } from '@/lib/data/useChat';
import { color as C, radius, shadow } from '@/lib/theme';

export const CHAT_FAB_SIZE = 52;
export const CHAT_FAB_GAP = 18;
/** 커뮤니티 탭 들어 올림 — ReviewFeed Write review 알약 최대 높이 ~40 + 간격 12 · 글 기능(posts) 켜지면 작성 FAB 54 + 12 */
export const communityLift = (): number => (FLAGS.communityPostsEnabled ? 54 + 12 : 40 + 12);
/** 안읽음 점 — 알림 관례의 빨강(위험도 색 토큰과 별개 — 헌법 III 고정 의미를 빌리지 않는다) */
const UNREAD_RED = '#FF3B30';
// 11/5 예진: 검정 FAB가 "너무 안 보임" → 흰 바탕 + 주황 선 말풍선(채움 없음) + C.line 1px 테두리·sh1 그림자로 흰 화면과 분리(주황 채움 = 스캔 버튼과 겹침, 청록 = 취소 — 최종 확정). 빨간 점은 흰 테두리 2.5.

export function chatFabBottom(insetBottom: number, activeRoute: string): number {
  return TABBAR_CONTENT_H + Math.max(insetBottom, 10) + CHAT_FAB_GAP + (activeRoute === 'community' ? communityLift() : 0);
}

export function ChatFab({ activeRoute }: { activeRoute: string }) {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // 탭 화면이 보일 때만 안읽음 조회(로그인·온보딩·채팅이 위에 push되면 멈춘다)
  const [focused, setFocused] = React.useState(true);
  useFocusEffect(
    React.useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const unread = useChatUnread(FLAGS.operatorChatEnabled && focused);
  if (!FLAGS.operatorChatEnabled) return null;
  const count = unread.data?.count ?? 0;
  const preview = count > 0 ? unread.data?.last ?? null : null;
  const open = () => router.push('/chat' as Href);
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: chatFabBottom(insets.bottom, activeRoute) }]} testID="chat-fab-wrap">
      {!!preview && (
        <Pressable style={styles.preview} onPress={open} accessibilityRole="button" accessibilityLabel={t('chat.title')} testID="chat-fab-preview">
          <Text style={styles.previewName}>{t('chat.team')}</Text>
          <Text style={styles.previewText} numberOfLines={2}>{preview.content}</Text>
        </Pressable>
      )}
      <Pressable style={styles.fab} onPress={open} accessibilityRole="button" accessibilityLabel={t('chat.title')} testID="chat-fab">
        <IconSpeech size={24} color={C.primary} />
        {count > 0 && <View style={styles.dot} testID="chat-fab-dot" />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: CHAT_FAB_GAP, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  fab: { width: CHAT_FAB_SIZE, height: CHAT_FAB_SIZE, borderRadius: radius.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', ...shadow.sh1 },
  dot: { position: 'absolute', top: 2, right: 2, width: 13, height: 13, borderRadius: 6.5, backgroundColor: UNREAD_RED, borderWidth: 2.5, borderColor: C.surface },
  preview: { maxWidth: 220, backgroundColor: '#fff', borderRadius: radius.lg, borderBottomRightRadius: radius.xs, paddingHorizontal: 12, paddingVertical: 8, gap: 2, ...shadow.sh1 },
  previewName: { fontSize: 12, fontWeight: '600', color: C.ink3 },
  previewText: { fontSize: 14, lineHeight: 19, color: C.ink },
});
