/**
 * Review compose (mockup Screen H) — rate 1–5 + write a review for a dish.
 * Compose state → submitted confirmation (counts toward ranking).
 *
 * Mock: posting is a no-op that shows the submitted view (no real POST under
 * MOCK_MODE). Rating is required (1–5 integer, contract). No emoji; reader text
 * i18n'd; risk colors fixed.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { color as C, font, radius, shadow } from '@/lib/theme';
import { SubHeader, Btn, Star, Stars, Rosette, RiskMark, IconCheck } from '@/components';
import { useFoodDetail } from '@/lib/data/useFoods';
import { useMe } from '@/lib/data/useMe';
import { personalRisk } from '@/lib/risk';

const MAX = 500;

export default function ReviewCompose() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { data: food } = useFoodDetail(id ?? '');
  const { data: me } = useMe();

  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const labels = (t('review.labels', { returnObjects: true }) as string[]) ?? [];
  const canPost = rating > 0;
  const post = () => canPost && setSubmitted(true);

  if (submitted) {
    return (
      <View style={styles.root}>
        <SubHeader title={t('review.title')} onBack={() => router.back()} />
        <View style={styles.okWrap}>
          <View style={styles.okIc}>
            <IconCheck size={34} color="#fff" />
          </View>
          <Text style={styles.okTitle}>{t('review.postedTitle')}</Text>
          <Text style={styles.okBody}>
            {t('review.postedBody', { rating, name: food?.name ?? '' })}
          </Text>
          <View style={styles.okMeta}>
            <Stars value={rating} size={18} />
            <View style={styles.rankPill}>
              <Rosette level={me?.rank.level ?? 1} size={18} />
              <Text style={styles.rankText}>{me?.rank.tier ?? ''}</Text>
            </View>
          </View>
          <View style={{ width: '100%', marginTop: 14, gap: 9 }}>
            <Btn onPress={() => router.back()}>{t('review.backToDish')}</Btn>
            <Btn variant="ghost" onPress={() => router.replace('/profile' as Href)}>
              {t('review.seeMyReviews')}
            </Btn>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SubHeader
        title={t('review.title')}
        onBack={() => router.back()}
        trailing={
          <Pressable onPress={post} hitSlop={8} disabled={!canPost}>
            <Text style={[styles.postLink, !canPost && styles.postLinkOff]}>{t('review.post')}</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* food chip */}
        <View style={styles.foodChip}>
          <View style={styles.foodPh} />
          <View style={{ flex: 1 }}>
            <Text style={styles.foodName}>{food?.name ?? ''}</Text>
            <Text style={styles.foodKo}>{food?.nameKo ?? ''}</Text>
          </View>
          {food && <RiskMark state={personalRisk(food.risk, (me?.restrictions.length ?? 0) > 0)} size={22} />}
        </View>

        {/* rating */}
        <View style={styles.block}>
          <Text style={styles.label}>{t('review.ratingLabel')}</Text>
          <View style={styles.starPick}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Pressable key={i} onPress={() => setRating(i)} hitSlop={4}>
                <Star size={44} fillPct={i <= rating ? 100 : 0} fillColor={C.primary} emptyColor={C.ink3} />
              </Pressable>
            ))}
          </View>
          <Text style={[styles.starCap, !rating && styles.starCapEmpty]}>
            {rating ? t('review.ratingValue', { value: rating, label: labels[rating] ?? '' }) : t('review.tapToRate')}
          </Text>
        </View>

        {/* body */}
        <View style={styles.block}>
          <Text style={styles.label}>{t('review.reviewLabel')}</Text>
          <TextInput
            value={body}
            onChangeText={(v) => setBody(v.slice(0, MAX))}
            placeholder={t('review.placeholder')}
            placeholderTextColor={C.ink3}
            multiline
            style={styles.textarea}
            textAlignVertical="top"
          />
          <View style={styles.metaRow}>
            <Text style={styles.tag}>{t('review.langDetected')}</Text>
            <Text style={styles.tag}>{t('review.charCount', { count: body.length })}</Text>
          </View>
        </View>

        <View style={{ marginTop: 4 }}>
          <Btn variant={canPost ? 'primary' : 'off'} icon={<Star size={17} fillPct={100} fillColor="#fff" />} onPress={post}>
            {t('review.postReview')}
          </Btn>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { padding: 18, gap: 20 },

  postLink: { fontFamily: font.bodyBold, fontSize: 14, color: C.primary, marginRight: 8 },
  postLinkOff: { color: C.ink3 },

  foodChip: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, padding: 12, ...shadow.sh1 },
  foodPh: { width: 48, height: 48, borderRadius: 12, backgroundColor: C.surface2 },
  foodName: { fontFamily: font.display, fontSize: 16, color: C.ink },
  foodKo: { fontFamily: font.ko, fontSize: 12, color: C.ink2 },

  block: { gap: 12 },
  label: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink2 },
  starPick: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 4 },
  starCap: { fontFamily: font.bodyBold, fontSize: 14, color: C.primary, textAlign: 'center' },
  starCapEmpty: { color: C.ink3 },

  textarea: { minHeight: 120, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: 13, padding: 14, fontFamily: font.body, fontSize: 14.5, color: C.ink, lineHeight: 21, ...shadow.sh1 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  tag: { fontFamily: font.body, fontSize: 11.5, color: C.ink3 },

  // submitted
  okWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, gap: 10 },
  okIc: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.riskSafe, alignItems: 'center', justifyContent: 'center' },
  okTitle: { fontFamily: font.display, fontSize: 22, color: C.ink, marginTop: 4 },
  okBody: { fontFamily: font.body, fontSize: 14, color: C.ink2, textAlign: 'center', lineHeight: 21 },
  okMeta: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 2 },
  rankPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  rankText: { fontFamily: font.bodyBold, fontSize: 12.5, color: C.ink },
});
