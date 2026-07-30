/**
 * Community compose (P-087/KB-251 D-03 v2.3) — 글 작성/수정.
 *
 * 본문 2,000자(카운터 1,800 노출 → 1,950 강조 → 초과 시 Post 비활성) · 사진 4장
 * (첫 장 커버 — **길게 눌러 커버로 승격** = 재정렬 해석, 개별 X 삭제) · 태그 =
 * 92% 바텀시트(X·제목·Done): 음식 검색 **기존 /foods/search 실 API 재사용**,
 * 장소 검색은 목 UI(KB-249 별도) · 평면 결과 원탭 추가, 상한 음식 3·장소 1 —
 * 상한 도달 시에도 버튼 탭 가능(시트 안내 문구+제거 동선) · 툴바 첨부 상태 =
 * 틴트(점 뱃지 금지), 상한 = 회색 · 이탈 확인 모달(빈 초안은 조용히 닫힘) ·
 * 게시 성공 모달(마스코트 슬롯 = SuccessCheck 대체).
 */
import * as React from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { color as C, font, primaryTint, radius, shadow } from '@/lib/theme';
import { Btn, Flag, IconClose, IconFood, IconGallery, IconMapPin, IconSearch, SubHeader } from '@/components';
import { SuccessCheck } from '@/components/SuccessCheck';
import { useBottomInset } from '@/lib/useBottomInset';
import { useIsGuest } from '@/lib/auth/useSession';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { useSearchFoods } from '@/lib/data/useFoods';
import { useCommunityPost, useCreatePost, useUpdatePost } from '@/lib/community/hooks';
import { searchPlaces } from '@/lib/community/places';
import type { FoodTagRef, PlaceTagRef } from '@/lib/community/types';

const BODY_MAX = 2000;
const COUNTER_SHOW = 1800;
const COUNTER_WARN = 1950;
const PHOTO_MAX = 4;
const FOOD_TAG_MAX = 3;

export default function CommunityCompose() {
  const router = useRouter();
  const { t } = useTranslation();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const bottomInset = useBottomInset();
  const isGuest = useIsGuest();

  const { data: editingPost } = useCommunityPost(editId ?? '');
  const createPost = useCreatePost();
  const updatePost = useUpdatePost();

  const [body, setBody] = React.useState('');
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [foodTags, setFoodTags] = React.useState<FoodTagRef[]>([]);
  const [placeTag, setPlaceTag] = React.useState<PlaceTagRef | null>(null);
  const [tagSheet, setTagSheet] = React.useState<'food' | 'place' | null>(null);
  const [leaveConfirm, setLeaveConfirm] = React.useState(false);
  const [posted, setPosted] = React.useState(false);
  const seeded = React.useRef(false);

  // 수정 모드 — 기존 글 프리필 (1회)
  React.useEffect(() => {
    if (editingPost && !seeded.current) {
      setBody(editingPost.body);
      setPhotos(editingPost.photos);
      setFoodTags(editingPost.foodTags);
      setPlaceTag(editingPost.placeTag);
      seeded.current = true;
    }
  }, [editingPost]);

  const len = body.length;
  const overLimit = len > BODY_MAX;
  const canPost = body.trim().length > 0 && !overLimit && !createPost.isPending && !updatePost.isPending;
  const dirty = body.trim().length > 0 || photos.length > 0 || foodTags.length > 0 || placeTag != null;

  const back = () => {
    if (dirty && !posted) return setLeaveConfirm(true); // 빈 초안은 조용히 닫힘
    router.back();
  };

  const pickPhotos = async () => {
    if (photos.length >= PHOTO_MAX) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: PHOTO_MAX - photos.length,
    });
    if (!res.canceled && res.assets?.length) {
      setPhotos((cur) => [...cur, ...res.assets.map((a) => a.uri)].slice(0, PHOTO_MAX));
    }
  };

  /** 길게 눌러 커버로 승격 — "첫 장 커버 + 길게 눌러 재정렬"의 최소 해석. */
  const promoteCover = (uri: string) => {
    setPhotos((cur) => [uri, ...cur.filter((u) => u !== uri)]);
  };

  const submit = () => {
    if (!canPost) return;
    const input = { body: body.trim(), photos, foodTags, placeTag };
    if (editId) {
      updatePost.mutate({ id: editId, ...input }, { onSuccess: () => setPosted(true) });
    } else {
      createPost.mutate(input, { onSuccess: () => setPosted(true) });
    }
  };

  if (isGuest) {
    return (
      <View style={styles.root}>
        <SubHeader title={t('community.composeTitle')} onBack={() => router.back()} />
        <AuthGateSheet context="profile" open onClose={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SubHeader
        title={t(editId ? 'community.editTitle' : 'community.composeTitle')}
        onBack={back}
        trailing={
          <Pressable onPress={submit} hitSlop={8} disabled={!canPost}>
            <Text style={[styles.postLink, !canPost && styles.postLinkOff]}>{t('community.post')}</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder={t('community.composePlaceholder')}
          placeholderTextColor={C.ink3}
          multiline
          style={styles.textarea}
          textAlignVertical="top"
          autoFocus={!editId}
        />
        {/* 카운터 — 1,800부터 노출, 1,950 강조, 초과는 Post 비활성과 동기 */}
        {len >= COUNTER_SHOW && (
          <Text style={[styles.counter, len >= COUNTER_WARN && styles.counterWarn, overLimit && styles.counterOver]}>
            {len.toLocaleString()} / {BODY_MAX.toLocaleString()}
          </Text>
        )}

        {/* 사진 — [0] = 커버, 길게 눌러 커버 승격, X 삭제 */}
        {photos.length > 0 && (
          <View style={styles.photoRow}>
            {photos.map((uri, i) => (
              <Pressable key={uri} style={styles.photoWrap} onLongPress={() => promoteCover(uri)} delayLongPress={250}>
                <Image source={{ uri }} style={styles.photo} />
                {i === 0 && (
                  <View style={styles.coverBadge}>
                    <Text style={styles.coverBadgeText}>{t('community.cover')}</Text>
                  </View>
                )}
                <Pressable style={styles.photoDel} hitSlop={8} onPress={() => setPhotos((cur) => cur.filter((u) => u !== uri))}>
                  <IconClose size={11} color="#fff" />
                </Pressable>
              </Pressable>
            ))}
          </View>
        )}

        {/* 선택된 태그 칩 */}
        {(foodTags.length > 0 || placeTag) && (
          <View style={styles.tagRow}>
            {foodTags.map((f) => (
              <Pressable key={f.foodId} style={styles.tagChip} onPress={() => setFoodTags((cur) => cur.filter((x) => x.foodId !== f.foodId))}>
                <IconFood size={13} color={C.primary} />
                <Text style={styles.tagChipText} numberOfLines={1}>
                  {f.name}
                </Text>
                <IconClose size={11} color={C.ink3} />
              </Pressable>
            ))}
            {placeTag && (
              <Pressable style={styles.tagChip} onPress={() => setPlaceTag(null)}>
                <IconMapPin size={13} color={C.accent} />
                <Text style={styles.tagChipText} numberOfLines={1}>
                  {placeTag.name}
                </Text>
                <IconClose size={11} color={C.ink3} />
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>

      {/* 툴바 — 첨부 상태 = 틴트 에코(점 뱃지 금지), 상한 = 회색. 상한이어도 탭 가능(시트에서 제거 동선) */}
      <View style={[styles.toolbar, { paddingBottom: bottomInset + 10 }]}>
        <ToolBtn
          icon={<IconGallery size={20} color={photos.length >= PHOTO_MAX ? C.ink3 : photos.length > 0 ? C.primary : C.ink2} />}
          tinted={photos.length > 0 && photos.length < PHOTO_MAX}
          onPress={() => void pickPhotos()}
        />
        <ToolBtn
          icon={<IconFood size={20} color={foodTags.length >= FOOD_TAG_MAX ? C.ink3 : foodTags.length > 0 ? C.primary : C.ink2} />}
          tinted={foodTags.length > 0 && foodTags.length < FOOD_TAG_MAX}
          onPress={() => setTagSheet('food')}
        />
        <ToolBtn
          icon={<IconMapPin size={20} color={placeTag ? C.ink3 : C.ink2} />}
          tinted={false}
          onPress={() => setTagSheet('place')}
        />
      </View>

      {/* 태그 검색 시트 (92%) */}
      <TagPickerSheet
        kind={tagSheet}
        foodTags={foodTags}
        placeTag={placeTag}
        onToggleFood={(f) =>
          setFoodTags((cur) =>
            cur.some((x) => x.foodId === f.foodId) ? cur.filter((x) => x.foodId !== f.foodId) : cur.length < FOOD_TAG_MAX ? [...cur, f] : cur,
          )
        }
        onTogglePlace={(p) => setPlaceTag((cur) => (cur?.name === p.name ? null : p))}
        onClose={() => setTagSheet(null)}
        t={t}
      />

      {/* 이탈 확인 — dirty만 (빈 초안은 조용히 닫힘) */}
      <Modal visible={leaveConfirm} transparent animationType="fade" onRequestClose={() => setLeaveConfirm(false)}>
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>{t('community.leaveTitle')}</Text>
            <Text style={styles.confirmBody}>{t('community.leaveBody')}</Text>
            <View style={{ gap: 9, marginTop: 6 }}>
              <Btn variant="ghost" onPress={() => setLeaveConfirm(false)}>
                {t('community.keepWriting')}
              </Btn>
              <Pressable style={styles.discardRow} onPress={() => { setLeaveConfirm(false); router.back(); }}>
                <Text style={styles.discardText}>{t('community.discard')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 게시 성공 — 마스코트 에셋 부재 → SuccessCheck 대체 (스펙 허용) */}
      <Modal visible={posted} transparent animationType="fade">
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <View style={{ alignItems: 'center', gap: 12 }}>
              <SuccessCheck size={72} />
              <Text style={styles.confirmTitle}>{t(editId ? 'community.editedTitle' : 'community.postedTitle')}</Text>
              <View style={{ alignSelf: 'stretch' }}>
                <Btn onPress={() => router.back()}>{t('common.gotIt')}</Btn>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ToolBtn({ icon, tinted, onPress }: { icon: React.ReactNode; tinted: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.toolBtn, tinted && styles.toolBtnTinted]} onPress={onPress} hitSlop={6}>
      {icon}
    </Pressable>
  );
}

/* ---- 태그 검색 시트 — 음식(실 /foods/search)·장소(목) ---- */

type TFn = ReturnType<typeof useTranslation>['t'];

function TagPickerSheet({
  kind,
  foodTags,
  placeTag,
  onToggleFood,
  onTogglePlace,
  onClose,
  t,
}: {
  kind: 'food' | 'place' | null;
  foodTags: FoodTagRef[];
  placeTag: PlaceTagRef | null;
  onToggleFood: (f: FoodTagRef) => void;
  onTogglePlace: (p: PlaceTagRef) => void;
  onClose: () => void;
  t: TFn;
}) {
  const [q, setQ] = React.useState('');
  const foods = useSearchFoods(kind === 'food' ? q : '');
  React.useEffect(() => {
    if (kind == null) setQ('');
  }, [kind]);
  if (!kind) return null;

  const atCap = kind === 'food' ? foodTags.length >= FOOD_TAG_MAX : placeTag != null;
  const places = kind === 'place' ? searchPlaces(q) : [];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.pickerBackdrop}>
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHeader}>
            <Pressable hitSlop={10} onPress={onClose}>
              <IconClose size={20} color={C.ink2} />
            </Pressable>
            <Text style={styles.pickerTitle}>{t(kind === 'food' ? 'community.tagFoodTitle' : 'community.tagPlaceTitle')}</Text>
            <Pressable hitSlop={10} onPress={onClose}>
              <Text style={styles.doneLink}>{t('community.done')}</Text>
            </Pressable>
          </View>

          {/* 상한 안내 — 상한 도달 시에도 시트는 열린다(제거 동선) */}
          {atCap && (
            <Text style={styles.capNote}>
              {t(kind === 'food' ? 'community.foodTagCap' : 'community.placeTagCap')}
            </Text>
          )}

          {/* 시트 내 선택 칩 */}
          {(kind === 'food' ? foodTags.length > 0 : placeTag != null) && (
            <View style={styles.tagRow}>
              {kind === 'food'
                ? foodTags.map((f) => (
                    <Pressable key={f.foodId} style={styles.tagChip} onPress={() => onToggleFood(f)}>
                      <IconFood size={13} color={C.primary} />
                      <Text style={styles.tagChipText}>{f.name}</Text>
                      <IconClose size={11} color={C.ink3} />
                    </Pressable>
                  ))
                : placeTag && (
                    <Pressable style={styles.tagChip} onPress={() => onTogglePlace(placeTag)}>
                      <IconMapPin size={13} color={C.accent} />
                      <Text style={styles.tagChipText}>{placeTag.name}</Text>
                      <IconClose size={11} color={C.ink3} />
                    </Pressable>
                  )}
            </View>
          )}

          <View style={styles.searchBox}>
            <IconSearch size={17} color={C.ink2} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={t(kind === 'food' ? 'community.searchFoods' : 'community.searchPlaces')}
              placeholderTextColor={C.ink3}
              style={styles.searchInput}
              autoCorrect={false}
            />
          </View>

          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
            {kind === 'food' ? (
              (foods.data ?? []).map((f) => {
                const selected = foodTags.some((x) => x.foodId === f.foodId);
                return (
                  <Pressable
                    key={f.foodId}
                    style={styles.resultRow}
                    onPress={() => onToggleFood({ foodId: f.foodId, name: f.name })}
                  >
                    <IconFood size={16} color={selected ? C.primary : C.ink3} />
                    <Text style={[styles.resultText, selected && styles.resultTextOn]} numberOfLines={1}>
                      {f.name}
                    </Text>
                    {selected && <Text style={styles.addedTag}>{t('community.added')}</Text>}
                  </Pressable>
                );
              })
            ) : (
              places.map((p) => {
                const selected = placeTag?.name === p.name;
                return (
                  <Pressable key={p.name} style={styles.resultRow} onPress={() => onTogglePlace(p)}>
                    <IconMapPin size={16} color={selected ? C.accent : C.ink3} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.resultText, selected && styles.resultTextOn]} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={styles.resultSub} numberOfLines={1}>
                        {p.roadAddress}
                      </Text>
                    </View>
                    {selected && <Text style={styles.addedTag}>{t('community.added')}</Text>}
                  </Pressable>
                );
              })
            )}
            {kind === 'food' && q.trim().length === 0 && (
              <Text style={styles.searchHint}>{t('community.searchFoodsHint')}</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { padding: 18, gap: 14, paddingBottom: 30 },
  postLink: { fontFamily: font.bodyBold, fontSize: 14.5, color: C.primaryText, marginRight: 8 },
  postLinkOff: { color: C.ink3 },

  textarea: { minHeight: 160, fontFamily: font.body, fontSize: 15.5, color: C.ink, lineHeight: 23 },
  counter: { fontFamily: font.body, fontSize: 12, color: C.ink3, textAlign: 'right' },
  counterWarn: { fontFamily: font.bodyBold, color: C.primaryText },
  counterOver: { color: '#8e2f3c' },

  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoWrap: { width: 82, height: 82 },
  photo: { width: 82, height: 82, borderRadius: 12, backgroundColor: C.surface2 },
  coverBadge: { position: 'absolute', left: 5, bottom: 5, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  coverBadgeText: { fontFamily: font.bodyBold, fontSize: 9.5, color: '#fff' },
  photoDel: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface2, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, maxWidth: 240 },
  tagChipText: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink, flexShrink: 1 },

  toolbar: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.hair, backgroundColor: C.surface },
  toolBtn: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toolBtnTinted: { backgroundColor: primaryTint },

  confirmBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  confirmCard: { alignSelf: 'stretch', backgroundColor: C.card, borderRadius: radius.lg, padding: 22, gap: 8, ...shadow.shPop },
  confirmTitle: { fontFamily: font.display, fontSize: 17.5, color: C.ink, textAlign: 'center' },
  confirmBody: { fontFamily: font.body, fontSize: 13.5, color: C.ink2, lineHeight: 19, textAlign: 'center' },
  discardRow: { alignItems: 'center', paddingVertical: 11 },
  discardText: { fontFamily: font.bodyBold, fontSize: 14, color: '#8e2f3c' },

  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  pickerSheet: { height: '92%', backgroundColor: C.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, gap: 12, ...shadow.sh2 },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerTitle: { fontFamily: font.display, fontSize: 17, color: C.ink },
  doneLink: { fontFamily: font.bodyBold, fontSize: 14.5, color: C.primaryText },
  capNote: { fontFamily: font.body, fontSize: 12.5, color: C.ink2, backgroundColor: C.surface2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: 13, paddingHorizontal: 13 },
  searchInput: { flex: 1, paddingVertical: 11, fontFamily: font.body, fontSize: 14.5, color: C.ink },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  resultText: { fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink, flexShrink: 1 },
  resultTextOn: { color: C.primaryText },
  resultSub: { fontFamily: font.body, fontSize: 11.5, color: C.ink3, marginTop: 1 },
  addedTag: { fontFamily: font.bodyBold, fontSize: 11.5, color: C.ink3, marginLeft: 'auto' },
  searchHint: { fontFamily: font.body, fontSize: 13, color: C.ink3, textAlign: 'center', paddingVertical: 26 },
});
