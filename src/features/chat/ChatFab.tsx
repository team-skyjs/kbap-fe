/**
 * 운영진 채팅 플로팅 버튼 (KB-1008, P-614 배치 확정) — 탭 화면 공용 우하단(탭바 위 18). 스캔·카메라는 탭이 아니라 자동 제외.
 * 리뷰 탭(community)에선 렌더 0 · 안읽음 조회도 멈춤(11/6 예진 — 리뷰 탭 버튼과 겹침 방지).
 * 안읽음 = 빨간 점 + 마지막 운영진 메시지 미리보기 말풍선(탭 = 채팅). 플래그 off = 렌더 0.
 */
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
/** 11/6 예진: 리뷰 탭(community 라우트 = 리뷰 피드)에선 숨김 — Write review·작성 FAB와 겹침 방지. 탭 밖(상세·작성)은 루트 스택이 위를 덮는다. */
export const CHAT_FAB_HIDDEN_ROUTES: readonly string[] = ['community'];
/** 안읽음 점 — 알림 관례의 빨강(위험도 색 토큰과 별개 — 헌법 III 고정 의미를 빌리지 않는다) */
const UNREAD_RED = '#FF3B30';
// 11/5 예진: 검정 FAB가 "너무 안 보임" → 흰 바탕 + 주황 선 말풍선(채움 없음) + C.line 1px 테두리·sh1 그림자로 흰 화면과 분리(주황 채움 = 스캔 버튼과 겹침, 청록 = 취소 — 최종 확정). 빨간 점은 흰 테두리 2.5.

/** KB-1013(예진 11/6): 채팅 버튼 첫 탭 전까지 FAB 위 코치마크 — 기기 1회(로컬 저장, 계정 무관 안내 문구) */
export const CHAT_FAB_COACH_KEY = 'kbap.chatFabCoach.v1';

export function chatFabBottom(insetBottom: number): number {
  return TABBAR_CONTENT_H + Math.max(insetBottom, 10) + CHAT_FAB_GAP;
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
  // 코치마크 = 저장값 확인 전(null)엔 숨김 — 읽기 실패도 숨김(안내로 흐름 방해 금지)
  const [coachSeen, setCoachSeen] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    let alive = true;
    void (async () => {
      let seen = true; // 읽기 실패(동기 throw 포함) = 본 것으로 — 안내로 흐름 방해 금지
      try {
        seen = (await AsyncStorage.getItem(CHAT_FAB_COACH_KEY)) != null;
      } catch {
        /* 비치명 */
      }
      if (alive) setCoachSeen(seen);
    })();
    return () => { alive = false; };
  }, []);
  const hidden = !FLAGS.operatorChatEnabled || CHAT_FAB_HIDDEN_ROUTES.includes(activeRoute);
  const unread = useChatUnread(!hidden && focused);
  if (hidden) return null;
  const count = unread.data?.count ?? 0;
  const preview = count > 0 ? unread.data?.last ?? null : null;
  const showCoach = coachSeen === false && !preview; // 미리보기 우선 — 같은 자리라 둘은 동시에 안 뜬다
  const open = (src: 'fab' | 'fab_preview' | 'coach') => {
    if (coachSeen === false) {
      setCoachSeen(true);
      void AsyncStorage.setItem(CHAT_FAB_COACH_KEY, '1').catch(() => {});
    }
    router.push(`/chat?src=${src}` as Href); // KB-1010 진입 출처
  };
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: chatFabBottom(insets.bottom) }]} testID="chat-fab-wrap">
      {/* KB-1013: 말풍선 = FAB 위(오른쪽 끝 정렬) · 꼬리(오른쪽 아래 모서리) = 아래 FAB 쪽 */}
      {!!preview && (
        <Pressable style={styles.preview} onPress={() => open('fab_preview')} accessibilityRole="button" accessibilityLabel={t('chat.title')} testID="chat-fab-preview">
          <Text style={styles.previewName}>{t('chat.team')}</Text>
          <Text style={styles.previewText} numberOfLines={2}>{preview.content}</Text>
        </Pressable>
      )}
      {showCoach && (
        <Pressable style={styles.preview} onPress={() => open('coach')} accessibilityRole="button" accessibilityLabel={t('chat.fabCoach')} testID="chat-fab-coach">
          <Text style={styles.previewText} numberOfLines={2}>{t('chat.fabCoach')}</Text>
        </Pressable>
      )}
      <Pressable style={styles.fab} onPress={() => open('fab')} accessibilityRole="button" accessibilityLabel={t('chat.title')} testID="chat-fab">
        <IconSpeech size={24} color={C.primary} />
        {count > 0 && <View style={styles.dot} testID="chat-fab-dot" />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: CHAT_FAB_GAP, flexDirection: 'column', alignItems: 'flex-end', gap: 8 }, // KB-1013 세로(말풍선 위 · FAB 아래)
  fab: { width: CHAT_FAB_SIZE, height: CHAT_FAB_SIZE, borderRadius: radius.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', ...shadow.sh1 },
  dot: { position: 'absolute', top: 2, right: 2, width: 13, height: 13, borderRadius: 6.5, backgroundColor: UNREAD_RED, borderWidth: 2.5, borderColor: C.surface },
  preview: { maxWidth: 220, backgroundColor: '#fff', borderRadius: radius.lg, borderBottomRightRadius: radius.xs, paddingHorizontal: 12, paddingVertical: 8, gap: 2, ...shadow.sh1 },
  previewName: { fontSize: 12, fontWeight: '600', color: C.ink3 },
  previewText: { fontSize: 14, lineHeight: 19, color: C.ink },
});
