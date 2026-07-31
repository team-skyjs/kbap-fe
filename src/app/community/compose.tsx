/**
 * Community compose (P-105/KB-251) — 확정 시안 hifi-compose2 v2.3 픽셀 정합.
 *
 * 2존 레이아웃: 상단 warm hero(X 원형 카드 버튼 · Post 필 · 아바타 52 · 헤딩 ·
 * 작성자 행) + 하단 흰 시트(top radius 26, 내부 스크롤). 시트 블록(gap 16):
 * ① 1.5px 보더 본문 필드(포커스 primary+글로우, 카운터 1,800~ 우하단)
 * ② 76px 사진 타일 + 대시 추가 타일(+, n/4) ③ 태그 행 2개(틴트 아이콘 타일
 * ·placeholder·mono 카운터·행 내 제거 칩) ④ 번역 힌트. 하단 44px 글리프 바
 * (갤러리·음식·핀)는 키보드 위에 붙음. 태그 시트 = 92%+그랩바·Done 필 전환·
 * RECENT/POPULAR 섹션·38 썸네일 2줄 행·+ 원형 30·mono 캡션.
 *
 * 기능 로직 유지(P-087): 본문 2,000자(1,800 노출→1,950 강조→초과 Post 비활성)
 * · 사진 4장(첫 장 커버, 길게 눌러 승격, X 삭제) · 태그 상한 음식 3·장소 1
 * (상한 도달 시에도 시트 열림 — 제거 동선) · 이탈 확인(빈 초안 조용히 닫힘) ·
 * 성공 모달 · 음식 검색 실 API(/foods/search)·장소 목(KB-249 대기).
 */
import * as React from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color as C, font, primaryTint, primaryTint2, accentTint, radius, shadow } from '@/lib/theme';
import { Btn, Flag, IconCheck, IconClose, IconFood, IconGallery, IconGlobe, IconMapPin, IconPlus, IconProfile, IconSearch, Rosette, SubHeader } from '@/components';
import { SuccessCheck } from '@/components/SuccessCheck';
import { useBottomInset } from '@/lib/useBottomInset';
import { useIsGuest } from '@/lib/auth/useSession';
import { AuthGateSheet } from '@/components/AuthGateSheet';
import { useMe } from '@/lib/data/useMe';
import { useInfiniteFoods, useSearchFoods } from '@/lib/data/useFoods';
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
  const insets = useSafeAreaInsets();
  const bottomInset = useBottomInset();
  const isGuest = useIsGuest();

  const { data: me } = useMe();
  const { data: editingPost } = useCommunityPost(editId ?? '');
  const createPost = useCreatePost();
  const updatePost = useUpdatePost();

  const [body, setBody] = React.useState('');
  const [bodyFocus, setBodyFocus] = React.useState(false);
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
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* ── 상단 warm hero (시안 1존) ── */}
      <View style={[styles.hero, { paddingTop: insets.top + 8 }]}>
        <View style={styles.heroBar}>
          <Pressable style={styles.xBtn} hitSlop={6} onPress={back}>
            <IconClose size={17} color={C.ink2} />
          </Pressable>
          <Pressable style={[styles.postPill, canPost ? styles.postPillOn : styles.postPillOff]} onPress={submit} disabled={!canPost}>
            <Text style={[styles.postPillText, !canPost && styles.postPillTextOff]}>{t('community.post')}</Text>
          </Pressable>
        </View>
        <View style={styles.heroCenter}>
          <View style={styles.avatar}>
            {me?.profileImageUrl ? (
              <Image source={{ uri: me.profileImageUrl }} style={styles.avatarImg} />
            ) : (
              <IconProfile size={26} color={C.primary} />
            )}
          </View>
          <Text style={styles.heading}>{t('community.composeHeading')}</Text>
          <View style={styles.authorRow}>
            <Text style={styles.authorName}>{me?.nickname ?? ''}</Text>
            {!!me?.nationality && <Flag code={me.nationality} size={16} />}
            {me && (
              <View style={styles.rankPill}>
                <Rosette level={me.rank.level} size={14} />
                <Text style={styles.rankText}>{t(`ranking.tier.${me.rank.tier}`)}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ── 하단 흰 시트 (시안 2존) — 내용은 시트 안에서 스크롤 ── */}
      <View style={styles.sheet}>
        <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {/* ① 본문 필드 — 1.5px 보더 박스, 포커스 primary+틴트 글로우 */}
          <View style={[styles.bodyBox, bodyFocus && styles.bodyBoxFocus]}>
            <TextInput
              value={body}
              onChangeText={setBody}
              onFocus={() => setBodyFocus(true)}
              onBlur={() => setBodyFocus(false)}
              placeholder={t('community.composePlaceholder')}
              placeholderTextColor={C.ink3}
              multiline
              style={styles.textarea}
              textAlignVertical="top"
              autoFocus={!editId}
            />
            {/* 카운터 — 1,800부터 필드 우하단, 1,950 강조, 초과는 Post 비활성과 동기 */}
            {len >= COUNTER_SHOW && (
              <Text style={[styles.counter, len >= COUNTER_WARN && styles.counterWarn, overLimit && styles.counterOver]}>
                {len.toLocaleString()} / {BODY_MAX.toLocaleString()}
              </Text>
            )}
          </View>

          {/* ② 사진 — 76px 타일 + 대시 보더 추가 타일(+, n/4). [0]=커버, 길게 눌러 승격 */}
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
            {photos.length < PHOTO_MAX && (
              <Pressable style={styles.addTile} onPress={() => void pickPhotos()}>
                <IconPlus size={16} color={C.ink3} />
                <Text style={styles.addTileText}>
                  {photos.length}/{PHOTO_MAX}
                </Text>
              </Pressable>
            )}
          </View>

          {/* ③ 태그 행 2개 — 틴트 아이콘 타일 + placeholder/칩 + mono 카운터 */}
          <TagRow
            iconTile={<View style={[styles.tagIconTile, { backgroundColor: primaryTint }]}><IconFood size={15} color={C.primary} /></View>}
            placeholder={t('community.tagDish')}
            counter={`${foodTags.length}/${FOOD_TAG_MAX}`}
            chips={foodTags.map((f) => ({ key: f.foodId, label: f.name, onRemove: () => setFoodTags((cur) => cur.filter((x) => x.foodId !== f.foodId)) }))}
            onPress={() => setTagSheet('food')}
          />
          <TagRow
            iconTile={<View style={[styles.tagIconTile, { backgroundColor: accentTint }]}><IconMapPin size={15} color={C.accent} /></View>}
            placeholder={t('community.tagPlace')}
            counter={`${placeTag ? 1 : 0}/1`}
            chips={placeTag ? [{ key: placeTag.name, label: placeTag.name, onRemove: () => setPlaceTag(null) }] : []}
            onPress={() => setTagSheet('place')}
          />

          {/* ④ 번역 힌트 */}
          <View style={styles.hintRow}>
            <IconGlobe size={14} color={C.ink3} />
            <Text style={styles.hintText}>{t('community.translateHint')}</Text>
          </View>
        </ScrollView>

        {/* ── 하단 글리프 바 — 키보드 위에 붙음(KAV), 첨부 상태 틴트 유지 ── */}
        <View style={[styles.toolbar, { paddingBottom: bottomInset + 8 }]}>
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

      {/* 이탈 확인 — dirty만 (빈 초안은 조용히 닫힘). 시안 문법: 라운드 26 카드 */}
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

      {/* 게시 성공 — 상단 원형 일러 슬롯(마스코트 부재 → SuccessCheck 대체, 스펙 허용) */}
      <Modal visible={posted} transparent animationType="fade">
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <View style={{ alignItems: 'center', gap: 12 }}>
              <View style={styles.illoSlot}>
                <SuccessCheck size={64} />
              </View>
              <Text style={styles.confirmTitle}>{t(editId ? 'community.editedTitle' : 'community.postedTitle')}</Text>
              <View style={{ alignSelf: 'stretch' }}>
                <Btn onPress={() => router.back()}>{t('common.gotIt')}</Btn>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

/** 시안 ③ 태그 행 — surface 배경 radius 14 · 좌 틴트 아이콘 타일 · 칩/placeholder · 우 mono 카운터. */
function TagRow({
  iconTile,
  placeholder,
  counter,
  chips,
  onPress,
}: {
  iconTile: React.ReactNode;
  placeholder: string;
  counter: string;
  chips: { key: string; label: string; onRemove: () => void }[];
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.tagRowBox} onPress={onPress}>
      {iconTile}
      {chips.length === 0 ? (
        <Text style={styles.tagRowPlaceholder}>{placeholder}</Text>
      ) : (
        <View style={styles.tagRowChips}>
          {chips.map((c) => (
            <View key={c.key} style={styles.tagChip}>
              <Text style={styles.tagChipText} numberOfLines={1}>
                {c.label}
              </Text>
              <Pressable hitSlop={8} onPress={c.onRemove}>
                <IconClose size={11} color={C.ink3} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <Text style={styles.tagRowCounter}>{counter}</Text>
    </Pressable>
  );
}

function ToolBtn({ icon, tinted, onPress }: { icon: React.ReactNode; tinted: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.toolBtn, tinted && styles.toolBtnTinted]} onPress={onPress} hitSlop={6}>
      {icon}
    </Pressable>
  );
}

/* ---- 태그 검색 시트 (시안 4) — 그랩바·Done 필 전환·RECENT/POPULAR·38 썸네일 행·mono 캡션 ---- */

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
  const bottomInset = useBottomInset();
  const [q, setQ] = React.useState('');
  const foods = useSearchFoods(kind === 'food' ? q : '');
  // 빈 검색 = POPULAR 섹션(브라우즈 1페이지). RECENT(개인 최근 태그) 저장소는 목 단계 미도입 —
  // 장소는 목 전체가 RECENT 섹션으로 노출(리뷰 장소 픽커 P-095와 동일 관례).
  const browse = useInfiniteFoods();
  React.useEffect(() => {
    if (kind == null) setQ('');
  }, [kind]);
  if (!kind) return null;

  const hasSelection = kind === 'food' ? foodTags.length > 0 : placeTag != null;
  const atCap = kind === 'food' ? foodTags.length >= FOOD_TAG_MAX : placeTag != null;
  const isBrowse = q.trim().length === 0;
  const foodList = isBrowse ? (browse.data ?? []).slice(0, 20) : (foods.data ?? []);
  const places = kind === 'place' ? searchPlaces(q) : [];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.pickerBackdrop}>
        <View style={styles.pickerSheet}>
          <View style={styles.grabBar} />
          <View style={styles.pickerHeader}>
            <Pressable hitSlop={10} onPress={onClose}>
              <IconClose size={20} color={C.ink2} />
            </Pressable>
            <Text style={styles.pickerTitle}>{t(kind === 'food' ? 'community.tagFoodTitle' : 'community.tagPlaceTitle')}</Text>
            {/* Done — 선택 전 회색 텍스트 → 선택 후 primary 필 */}
            <Pressable hitSlop={10} onPress={onClose} style={hasSelection ? styles.donePill : undefined}>
              <Text style={hasSelection ? styles.donePillText : styles.doneLinkOff}>{t('community.done')}</Text>
            </Pressable>
          </View>

          {/* 상한 안내 — 상한 도달 시에도 시트는 열린다(제거 동선) */}
          {atCap && (
            <Text style={styles.capNote}>{t(kind === 'food' ? 'community.foodTagCap' : 'community.placeTagCap')}</Text>
          )}

          {/* 시트 내 선택 칩 — 제거 동선 */}
          {hasSelection && (
            <View style={styles.sheetChipRow}>
              {kind === 'food'
                ? foodTags.map((f) => (
                    <View key={f.foodId} style={styles.tagChip}>
                      <Text style={styles.tagChipText} numberOfLines={1}>{f.name}</Text>
                      <Pressable hitSlop={8} onPress={() => onToggleFood(f)}>
                        <IconClose size={11} color={C.ink3} />
                      </Pressable>
                    </View>
                  ))
                : placeTag && (
                    <View style={styles.tagChip}>
                      <Text style={styles.tagChipText} numberOfLines={1}>{placeTag.name}</Text>
                      <Pressable hitSlop={8} onPress={() => onTogglePlace(placeTag)}>
                        <IconClose size={11} color={C.ink3} />
                      </Pressable>
                    </View>
                  )}
            </View>
          )}

          {/* 검색 필드 — primary 보더+글로우 (시안 상시) */}
          <View style={styles.searchBox}>
            <IconSearch size={17} color={C.primary} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={t(kind === 'food' ? 'community.searchFoods' : 'community.searchPlaces')}
              placeholderTextColor={C.ink3}
              style={styles.searchInput}
              autoCorrect={false}
            />
          </View>

          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
            {/* 섹션 헤더 — mono 대문자. 빈 검색: 음식=POPULAR(브라우즈)·장소=RECENT(목) */}
            {isBrowse && (
              <Text style={styles.sectionHead}>
                {t(kind === 'food' ? 'community.sectionPopular' : 'community.sectionRecent')}
              </Text>
            )}
            {kind === 'food'
              ? foodList.map((f) => {
                  const selected = foodTags.some((x) => x.foodId === f.foodId);
                  return (
                    <ResultRow
                      key={f.foodId}
                      thumb={
                        f.photoUrl ? (
                          <Image source={{ uri: f.photoUrl }} style={styles.rowThumb} />
                        ) : (
                          <View style={[styles.rowThumb, styles.rowThumbFallback]}>
                            <IconFood size={17} color={C.primary} />
                          </View>
                        )
                      }
                      name={f.name}
                      sub={f.nameKo}
                      selected={selected}
                      onPress={() => onToggleFood({ foodId: f.foodId, name: f.name })}
                    />
                  );
                })
              : places.map((p) => (
                  <ResultRow
                    key={p.name}
                    thumb={
                      <View style={[styles.rowThumb, styles.rowThumbPlace]}>
                        <IconMapPin size={17} color={C.accent} />
                      </View>
                    }
                    name={p.name}
                    sub={p.roadAddress}
                    selected={placeTag?.name === p.name}
                    onPress={() => onTogglePlace(p)}
                  />
                ))}
            {kind === 'food' && !isBrowse && foods.data?.length === 0 && (
              <Text style={styles.searchHint}>{t('community.searchFoodsHint')}</Text>
            )}
          </ScrollView>

          {/* 하단 mono 캡션 */}
          <Text style={[styles.sheetCaption, { paddingBottom: bottomInset + 6 }]}>
            {t(kind === 'food' ? 'community.foodSheetCaption' : 'community.placeSheetCaption')}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

/** 시트 결과 행 — 38 썸네일 + 이름/한국어명 2줄 + 우측 + 원형 30(선택=primary ✓). */
function ResultRow({
  thumb,
  name,
  sub,
  selected,
  onPress,
}: {
  thumb: React.ReactNode;
  name: string;
  sub: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.resultRow} onPress={onPress}>
      {thumb}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.resultText, selected && styles.resultTextOn]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.resultSub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <View style={[styles.addCircle, selected && styles.addCircleOn]}>
        {selected ? <IconCheck size={13} color="#fff" /> : <IconPlus size={13} color={C.ink2} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },

  /* hero — 시안 1존 */
  hero: { paddingHorizontal: 16, paddingBottom: 20 },
  heroBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  xBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, alignItems: 'center', justifyContent: 'center', ...shadow.sh1 },
  postPill: { borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 },
  postPillOn: { backgroundColor: C.primary, ...shadow.sh2 },
  postPillOff: { backgroundColor: C.surface2 },
  postPillText: { fontFamily: font.bodyBold, fontSize: 14.5, color: '#fff' },
  postPillTextOff: { color: C.ink3 },
  heroCenter: { alignItems: 'center', gap: 10, marginTop: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: primaryTint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 52, height: 52 },
  heading: { fontFamily: font.display, fontSize: 22, color: C.ink, letterSpacing: -0.3, textAlign: 'center', maxWidth: 280 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  authorName: { fontFamily: font.bodyBold, fontSize: 13.5, color: C.ink2 },
  rankPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: C.card },
  rankText: { fontFamily: font.bodyBold, fontSize: 11, color: C.ink2 },

  /* sheet — 시안 2존 */
  sheet: { flex: 1, backgroundColor: C.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: StyleSheet.hairlineWidth, borderColor: C.hair, overflow: 'hidden' },
  sheetBody: { padding: 18, gap: 16, paddingBottom: 26 },

  bodyBox: { borderWidth: 1.5, borderColor: C.line, borderRadius: 16, padding: 13, minHeight: 132 },
  bodyBoxFocus: { borderColor: C.primary, backgroundColor: primaryTint2, shadowColor: C.primary, shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  textarea: { minHeight: 96, fontFamily: font.body, fontSize: 15.5, color: C.ink, lineHeight: 23, padding: 0 },
  counter: { fontFamily: font.body, fontSize: 12, color: C.ink3, textAlign: 'right', marginTop: 6 },
  counterWarn: { fontFamily: font.bodyBold, color: C.primaryText },
  counterOver: { color: '#8e2f3c' },

  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoWrap: { width: 76, height: 76 },
  photo: { width: 76, height: 76, borderRadius: 12, backgroundColor: C.surface2 },
  addTile: { width: 76, height: 76, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line, alignItems: 'center', justifyContent: 'center', gap: 4 },
  addTileText: { fontFamily: font.bodyBold, fontSize: 10.5, letterSpacing: 0.8, color: C.ink3 },
  coverBadge: { position: 'absolute', left: 5, bottom: 5, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  coverBadgeText: { fontFamily: font.bodyBold, fontSize: 9.5, color: '#fff' },
  photoDel: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },

  tagRowBox: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: C.surface, borderRadius: 14, minHeight: 44, paddingHorizontal: 11, paddingVertical: 8 },
  tagIconTile: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tagRowPlaceholder: { flex: 1, fontFamily: font.bodySemi, fontSize: 13.5, color: C.ink3 },
  tagRowChips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tagRowCounter: { fontFamily: font.bodyBold, fontSize: 11, letterSpacing: 0.8, color: C.ink3 },

  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, maxWidth: 220 },
  tagChipText: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink, flexShrink: 1 },

  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  hintText: { fontFamily: font.body, fontSize: 12, color: C.ink3 },

  toolbar: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.hair, backgroundColor: C.card },
  toolBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toolBtnTinted: { backgroundColor: primaryTint },

  /* modals — 시안 문법: 라운드 26 카드 + 상단 원형 일러 슬롯 */
  confirmBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  confirmCard: { alignSelf: 'stretch', backgroundColor: C.card, borderRadius: 26, padding: 22, gap: 8, ...shadow.shPop },
  confirmTitle: { fontFamily: font.display, fontSize: 17.5, color: C.ink, textAlign: 'center' },
  confirmBody: { fontFamily: font.body, fontSize: 13.5, color: C.ink2, lineHeight: 19, textAlign: 'center' },
  discardRow: { alignItems: 'center', paddingVertical: 11 },
  discardText: { fontFamily: font.bodyBold, fontSize: 14, color: '#8e2f3c' },
  illoSlot: { width: 88, height: 88, borderRadius: 44, backgroundColor: primaryTint2, alignItems: 'center', justifyContent: 'center' },

  /* tag picker sheet — 시안 4 */
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  pickerSheet: { height: '92%', backgroundColor: C.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 8, gap: 12, ...shadow.sh2 },
  grabBar: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerTitle: { fontFamily: font.display, fontSize: 17, color: C.ink },
  donePill: { backgroundColor: C.primary, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 7, ...shadow.sh1 },
  donePillText: { fontFamily: font.bodyBold, fontSize: 13.5, color: '#fff' },
  doneLinkOff: { fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink3 },
  capNote: { fontFamily: font.body, fontSize: 12.5, color: C.ink2, backgroundColor: C.surface2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  sheetChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.primary, borderRadius: 13, paddingHorizontal: 13, shadowColor: C.primary, shadowOpacity: 0.15, shadowRadius: 9, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  searchInput: { flex: 1, paddingVertical: 11, fontFamily: font.body, fontSize: 14.5, color: C.ink },

  sectionHead: { fontFamily: font.bodyBold, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase', color: C.ink3, paddingTop: 4, paddingBottom: 7 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  rowThumb: { width: 38, height: 38, borderRadius: 10, backgroundColor: C.surface2 },
  rowThumbFallback: { backgroundColor: primaryTint, alignItems: 'center', justifyContent: 'center' },
  rowThumbPlace: { backgroundColor: accentTint, alignItems: 'center', justifyContent: 'center' },
  resultText: { fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink },
  resultTextOn: { color: C.primaryText },
  resultSub: { fontFamily: font.body, fontSize: 11.5, color: C.ink3, marginTop: 1 },
  addCircle: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  addCircleOn: { backgroundColor: C.primary, borderColor: C.primary },
  searchHint: { fontFamily: font.body, fontSize: 13, color: C.ink3, textAlign: 'center', paddingVertical: 26 },

  sheetCaption: { fontFamily: font.bodyBold, fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', color: C.ink3, textAlign: 'center', paddingTop: 8 },
});
