/**
 * 운영진 1:1 채팅 (KB-1008, P-614 — S-971 계약 v0). 레퍼런스 = 일반 CS 'Chat with us'.
 *
 * - 사용자당 대화방 1개(서버가 첫 메시지에 자동 생성). 지난 문의 이력은 같은 목록 위쪽(legacy)에 가볍게 구분.
 * - 운영진 'K-Bap 팀'(브랜드 타일) 말풍선 왼쪽 · 내 말풍선 오른쪽 primary · 시간. 운영진 메시지가 아직 없으면
 *   맨 위에 기본 인사(저장 안 하는 화면 표시).
 * - 열려 있는 동안 5초 폴링, 읽음 = 화면이 보이고 맨 아래를 볼 때만(조회로는 읽음 안 됨).
 * - 보내기: 사진 ≤3(문의 업로드 재사용 — **로그인 사용자만**: 게스트는 업로드 경로가 없어 서버가 400, 버튼 자체를 숨긴다) · 공용 제출 가드 · 실패한 말풍선 = 탭해서 다시 보내기. 429 CHAT-001 = 전용 안내(서버 문구 노출 0).
 * - 진입: 탭 화면 플로팅 버튼 · 프로필 Contact us · 광고 신고(?prefill=ad — 입력창만 채움, 자동 전송 0) · 푸시 OPERATOR_CHAT.
 */
import * as React from 'react';
import { FlatList, Image, KeyboardAvoidingView, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SubHeader, QueryErrorBlock, IconClose, IconGallery, IconSend } from '@/components';
import { BrandTile } from '@/components/Brand';
import { Pressable } from '@/components/Pressable';
import { Txt as Text } from '@/components/Txt';
import { Input } from '@/components/KeyboardDismissBar';
import { RemoteImage } from '@/components/RemoteImage';
import { SkBar } from '@/components/Skeleton';
import { showTopToast } from '@/components/topToastStore';
import { KAV_BEHAVIOR, KAV_OFFSET } from '@/lib/keyboardAvoid';
import { useSubmitGuard } from '@/lib/useSubmitGuard';
import { useUploadAbort } from '@/lib/useUploadAbort';
import { isUploadAborted } from '@/lib/api/uploadAbort';
import { pickLibraryPhotos } from '@/features/feedback/FeedbackForm';
import { useSession } from '@/lib/auth/useSession';
import { useAppActive } from '@/lib/useAppActive';
import { FLAGS } from '@/lib/flags';
import { CHAT_KEYS, CHAT_MAX_LEN, CHAT_MAX_PHOTOS, markChatRead, useChatMessages, useSendChat, type ChatMessage } from '@/lib/data/useChat';
import { color as C, radius } from '@/lib/theme';

/** Codex #441 P2: 읽음 실패 재시도 간격 */
export const CHAT_READ_RETRY_MS = 10_000;

/** 보낸 직후 서버 재조회 전까지 들고 있는 내 말풍선(실패면 탭해서 다시 보내기) */
interface Outgoing {
  localId: string;
  content: string;
  photos: string[];
  failed: boolean;
}

type Row = { kind: 'msg'; m: ChatMessage } | { kind: 'out'; o: Outgoing } | { kind: 'legacyDivider' };

/** S-971 에러 코드 → 안내 문구 키(서버 message는 노출하지 않는다). 미지 = 일반 실패 */
export function chatErrorKey(code: string | undefined): string {
  switch (code) {
    case 'CHAT-001': return 'chat.rateLimited'; // 429 기기당 24시간 100건
    case 'FEEDBACK-001': return 'chat.tooLong'; // 본문 길이
    case 'FEEDBACK-002': return 'chat.photoInvalid'; // 사진 검증
    case 'COMMON-002': return 'chat.invalid'; // 400 요청 형식
    default: return 'chat.sendFailed';
  }
}

/** 같은 날 = HH:mm, 다른 날 = M/D HH:mm(기기 시간대). 파싱 실패 = 빈 문자열 */
export function chatTime(iso: string, now: Date): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return d.toDateString() === now.toDateString() ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

/** 목록 행(최신 → 과거, inverted가 그대로 그린다). 지난 문의(legacy)가 시작되는 경계에 구분선 1개 */
export function chatRows(outgoing: Outgoing[], items: ChatMessage[]): Row[] {
  const rows: Row[] = [...outgoing].reverse().map((o) => ({ kind: 'out' as const, o }));
  items.forEach((m, i) => {
    const newer = i > 0 ? items[i - 1] : null;
    if (m.legacy && (!newer || !newer.legacy) && i > 0) rows.push({ kind: 'legacyDivider' });
    rows.push({ kind: 'msg', m });
  });
  return rows;
}

/** Codex #441 P2: 킬스위치가 꺼져 있으면 /chat 진입(알림 탭·딥링크 포함) = 기존 문의 화면으로 — 채팅 API는 부르지 않는다 */
export default function ChatRoute() {
  return FLAGS.operatorChatEnabled ? <ChatScreen /> : <Redirect href={'/profile/feedback' as Href} />;
}

export function ChatScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();
  const [focused, setFocused] = React.useState(true);
  useFocusEffect(
    React.useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const q = useChatMessages(focused);
  const send = useSendChat();
  const guard = useSubmitGuard(); // P-173: 동기 ref + busy — 같은 틱 더블탭 1건만
  const nextUploadSignal = useUploadAbort(); // KB-711: 전송 중 떠나면 사진 업로드 취소
  // 광고 신고 = 입력창 프리필만(자동 전송 0 — P-614 결정)
  const [body, setBody] = React.useState(() => (prefill === 'ad' ? t('ads.reportPrefill') : ''));
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [importing, setImporting] = React.useState(false);
  const [outgoing, setOutgoing] = React.useState<Outgoing[]>([]);
  const [atBottom, setAtBottom] = React.useState(true);
  // S-971 확정: 사진 = 로그인 사용자만. 세션 미확정(null)도 숨김 — 서버가 아는 사실(토큰 유무)이 정본, 회원으로 확정될 때만 보인다
  const canAttach = useSession() === true;
  // '오늘' 기준 시각 = 마운트 때 한 번(state) — 렌더 중 new Date()는 React Compiler 메모에 굳는다(KB-697 sweep)
  const [now] = React.useState(() => new Date());
  // Codex #441 P2: 앱을 내려도 화면 포커스는 그대로 — 전경일 때만 읽음 처리(내려 둔 사이 온 답장은 안읽음으로 남는다)
  const appActive = useAppActive();
  // Codex #441 P2: 읽음 실패는 재시도 예약 — 같은 최신 id면 effect가 다시 안 돌아 영영 안읽음이 됐다
  const [readRetry, setReadRetry] = React.useState(0);

  const items = q.data?.flat ?? [];
  const newestId = items[0]?.id ?? null;
  // 읽음 = 보이는 중 + 맨 아래 + 새 최신 id일 때 1회(조회로는 읽음 안 됨 — S-971)
  const lastRead = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!focused || !appActive || !atBottom || !newestId || lastRead.current === newestId) return;
    lastRead.current = newestId;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void markChatRead(newestId)
      .then(() => qc.invalidateQueries({ queryKey: CHAT_KEYS.unread }))
      .catch(() => {
        lastRead.current = null; // 실패 = 10초 뒤 다시(화면을 떠나면 effect 정리로 취소)
        timer = setTimeout(() => setReadRetry((n) => n + 1), CHAT_READ_RETRY_MS);
      });
    return () => clearTimeout(timer);
  }, [focused, appActive, atBottom, newestId, qc, readRetry]);

  // 보내기 본체 — 제출 가드 안에서만 부른다(아래 onSend·재전송)
  const deliverInner = async (o: Outgoing) => {
      setOutgoing((cur) => cur.map((x) => (x.localId === o.localId ? { ...x, failed: false } : x)));
      try {
        await send.mutateAsync({ content: o.content, photoUris: o.photos, signal: nextUploadSignal() }); // onSuccess 재조회까지 기다린다
        setOutgoing((cur) => cur.filter((x) => x.localId !== o.localId));
      } catch (e) {
        if (isUploadAborted(e)) return; // 떠나서 취소 — 다른 화면 위 실패 토스트 금지
        setOutgoing((cur) => cur.map((x) => (x.localId === o.localId ? { ...x, failed: true } : x)));
        showTopToast(t(chatErrorKey((e as { code?: string })?.code)), { error: true }); // 서버 message 노출 0
      }
  };
  const deliver = (o: Outgoing) => void guard.run(() => deliverInner(o));

  const canSend = body.trim().length > 0 && !guard.busy;
  // Codex #441 P2: 보낼 말풍선 만들기·입력창 비우기도 같은 동기 가드 안 — 같은 틱 더블탭이면 두 번째는 말풍선조차 안 생긴다
  // (밖에 두면 두 번째 말풍선이 요청 없이 '보내는 중'에 영영 남았다)
  const onSend = () => {
    if (!canSend) return;
    void guard.run(async () => {
      // 로그인 중 고른 사진이 있어도 그새 게스트가 됐으면 싣지 않는다(서버 400 FEEDBACK-002 예방)
      const o: Outgoing = { localId: `${Date.now()}-${Math.random()}`, content: body.trim().slice(0, CHAT_MAX_LEN), photos: canAttach ? photos : [], failed: false };
      setOutgoing((cur) => [...cur, o]);
      setBody('');
      setPhotos([]);
      await deliverInner(o);
    });
  };

  const pickPhoto = async () => {
    const remaining = CHAT_MAX_PHOTOS - photos.length;
    if (remaining <= 0 || importing) return;
    setImporting(true);
    try {
      const uris = await pickLibraryPhotos(remaining, t);
      if (uris.length) setPhotos((cur) => [...new Set([...cur, ...uris])].slice(0, CHAT_MAX_PHOTOS));
    } finally {
      setImporting(false);
    }
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setAtBottom(e.nativeEvent.contentOffset.y < 48); // inverted: 0 = 맨 아래
  const showGreeting = !q.isPending && !q.hasNextPage && !items.some((m) => m.role === 'operator');
  const rows = chatRows(outgoing, items);

  return (
    <KeyboardAvoidingView style={styles.root} behavior={KAV_BEHAVIOR} keyboardVerticalOffset={KAV_OFFSET} testID="chat-screen">
      <SubHeader title={t('chat.title')} onBack={() => router.back()} />
      <View style={styles.teamBar} testID="chat-team-bar">
        <BrandTile size={32} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.teamName}>{t('chat.team')}</Text>
          <Text style={styles.teamNote}>{t('chat.repliesWithin')}</Text>
        </View>
      </View>
      {q.isPending ? (
        <View style={styles.skeleton} testID="chat-skeleton">
          <SkBar w={200} h={40} />
          <View style={{ alignSelf: 'flex-end' }}><SkBar w={160} h={40} /></View>
          <SkBar w={220} h={40} />
        </View>
      ) : q.isError && !q.data ? (
        <QueryErrorBlock error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          inverted
          data={rows}
          keyExtractor={(r, i) => (r.kind === 'msg' ? `m${r.m.id}` : r.kind === 'out' ? `o${r.o.localId}` : `d${i}`)}
          renderItem={({ item }) => <ChatRow row={item} onRetry={deliver} now={now} t={t} />}
          onScroll={onScroll}
          scrollEventThrottle={64}
          onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage(); }}
          onEndReachedThreshold={0.3}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={showGreeting ? <OperatorBubble text={t('chat.greeting')} time="" t={t} testID="chat-greeting" /> : null}
          testID="chat-list"
        />
      )}
      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow} style={styles.photoBar}>
          {photos.map((uri) => (
            <View key={uri} style={styles.photoThumbWrap}>
              <Image source={{ uri }} style={styles.photoThumb} />
              <Pressable testID="chat-photo-remove" accessibilityLabel={t('review.removePhoto')} style={styles.photoDel} hitSlop={8} onPress={() => setPhotos((cur) => cur.filter((u) => u !== uri))}>
                <IconClose size={10} color="#fff" />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {canAttach && (
          <Pressable accessibilityLabel={t('review.addPhoto')} style={styles.iconBtn} onPress={() => void pickPhoto()} disabled={photos.length >= CHAT_MAX_PHOTOS} testID="chat-photo-add">
            <IconGallery size={22} color={photos.length >= CHAT_MAX_PHOTOS ? C.line : C.ink2} />
          </Pressable>
        )}
        <Input
          value={body}
          onChangeText={(v) => setBody(v.slice(0, CHAT_MAX_LEN))}
          placeholder={t('chat.placeholder')}
          placeholderTextColor={C.ink3}
          multiline
          style={styles.input}
          testID="chat-input"
        />
        {/* 활성/비활성 = 색만(P-151 프레임 불변) */}
        <Pressable accessibilityLabel={t('chat.send')} accessibilityState={{ disabled: !canSend }} style={[styles.sendBtn, { backgroundColor: canSend ? C.primary : C.line }]} onPress={onSend} disabled={!canSend} testID="chat-send">
          <IconSend size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function ChatRow({ row, onRetry, now, t }: { row: Row; onRetry: (o: Outgoing) => void; now: Date; t: (k: string) => string }) {
  if (row.kind === 'legacyDivider') {
    return (
      <View style={styles.divider} testID="chat-legacy-divider">
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t('chat.earlierInquiries')}</Text>
        <View style={styles.dividerLine} />
      </View>
    );
  }
  if (row.kind === 'out') {
    const o = row.o;
    return (
      <Pressable disabled={!o.failed} onPress={() => onRetry(o)} style={styles.mineWrap} testID={`chat-out-${o.failed ? 'failed' : 'sending'}`}>
        <View style={[styles.mine, { opacity: o.failed ? 1 : 0.6 }]}>
          {o.photos.length > 0 && <View style={styles.imgRow}>{o.photos.map((u) => <Image key={u} source={{ uri: u }} style={styles.img} />)}</View>}
          <Text style={styles.mineText}>{o.content}</Text>
        </View>
        {o.failed && <Text style={styles.failText}>{t('chat.failedTapRetry')}</Text>}
      </Pressable>
    );
  }
  const m = row.m;
  const time = chatTime(m.createdAt, now);
  if (m.role === 'operator') return <OperatorBubble text={m.content} images={m.imageUrls} time={time} t={t} testID={`chat-op-${m.id}`} />;
  return (
    <View style={styles.mineWrap} testID={`chat-me-${m.id}`}>
      <View style={styles.mine}>
        {m.imageUrls.length > 0 && <View style={styles.imgRow}>{m.imageUrls.map((u) => <RemoteImage key={u} uri={u} style={styles.img} />)}</View>}
        {!!m.content && <Text style={styles.mineText}>{m.content}</Text>}
      </View>
      {!!time && <Text style={styles.time}>{time}</Text>}
    </View>
  );
}

function OperatorBubble({ text, images = [], time, t, testID }: { text: string; images?: string[]; time: string; t: (k: string) => string; testID: string }) {
  return (
    <View style={styles.opWrap} testID={testID}>
      <BrandTile size={28} />
      <View style={{ flexShrink: 1, gap: 4 }}>
        <Text style={styles.opName}>{t('chat.team')}</Text>
        <View style={styles.op}>
          {images.length > 0 && <View style={styles.imgRow}>{images.map((u) => <RemoteImage key={u} uri={u} style={styles.img} />)}</View>}
          {!!text && <Text style={styles.opText}>{text}</Text>}
        </View>
        {!!time && <Text style={[styles.time, { alignSelf: 'flex-start' }]}>{time}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  teamBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  teamName: { fontSize: 15, fontWeight: '700', color: C.ink },
  teamNote: { fontSize: 13, color: C.ink3 },
  skeleton: { flex: 1, padding: 20, gap: 14, justifyContent: 'flex-end' },
  list: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  opWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, maxWidth: '85%' },
  opName: { fontSize: 12, fontWeight: '600', color: C.ink3 },
  op: { backgroundColor: C.surface2, borderRadius: radius.lg, borderTopLeftRadius: radius.xs, paddingHorizontal: 12, paddingVertical: 9, gap: 6 },
  opText: { fontSize: 15, lineHeight: 21, color: C.ink },
  mineWrap: { alignSelf: 'flex-end', alignItems: 'flex-end', maxWidth: '80%', gap: 4 },
  mine: { backgroundColor: C.primary, borderRadius: radius.lg, borderTopRightRadius: radius.xs, paddingHorizontal: 12, paddingVertical: 9, gap: 6 },
  mineText: { fontSize: 15, lineHeight: 21, color: '#fff' },
  time: { fontSize: 11, color: C.ink3 },
  failText: { fontSize: 12, fontWeight: '600', color: C.primaryText }, // 위험도 색(헌법 III 고정 의미)은 쓰지 않는다
  imgRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  img: { width: 120, height: 120, borderRadius: radius.md },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.line },
  dividerText: { fontSize: 12, color: C.ink3 },
  photoBar: { flexGrow: 0, borderTopWidth: 1, borderTopColor: C.line },
  photoRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  photoThumbWrap: { width: 64, height: 64 },
  photoThumb: { width: 64, height: 64, borderRadius: radius.md },
  photoDel: { position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: '#fff' },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 40, maxHeight: 120, borderWidth: 1, borderColor: C.line, borderRadius: radius.lg, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, fontSize: 15, color: C.ink },
  sendBtn: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
