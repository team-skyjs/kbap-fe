/**
 * LegalDocBody — 약관·개인정보처리방침 전문(원격 HTML → 구조 블록) 본문. 불러오기·실패·재시도·블록 렌더를 한곳에.
 * KB-773: 온보딩 동의 시트에서 도입 → KB-776(QA B2-4): 프로필 법적 문서 화면이 같은 본문을 재사용(문서 렌더 두 벌 금지).
 * 표는 폰 폭에 3열이 안 들어가 **행마다 카드**(머리 라벨 + 값). 목록 불릿 = 작은 원(View) — 기호 문자·가운데 점 금지.
 */
import * as React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Txt as Text } from '@/components/Txt';
import { color as C, font, radius } from '@/lib/theme';
import { fetchLegalBlocks, type LegalBlock, type LegalDoc } from '@/lib/legalText';

export function LegalDocBody({ doc }: { doc: LegalDoc }) {
  const { t } = useTranslation();
  // KB-603 3R: 결과·실패 모두 **어느 문서의 것인지** 달아 저장 — 이전 문서의 늦은 응답이 다음 문서에 붙지 않는다. 표시는 현재 doc과 같을 때만.
  const [remote, setRemote] = React.useState<{ doc: LegalDoc; blocks: LegalBlock[] } | null>(null);
  const [errorDoc, setErrorDoc] = React.useState<LegalDoc | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    let live = true; // 문서 전환·언마운트 뒤 늦은 응답 무시
    fetchLegalBlocks(doc)
      .then((blocks) => live && setRemote({ doc, blocks }))
      .catch(() => live && setErrorDoc(doc));
    return () => {
      live = false;
    };
  }, [doc, attempt]);

  if (errorDoc === doc) {
    return (
      <View style={styles.error}>
        <Text style={styles.errorText}>{t('onboarding.legalLoadError')}</Text>
        <Pressable onPress={() => { setErrorDoc(null); setAttempt((n) => n + 1); }} hitSlop={8} accessibilityRole="button" testID="legal-retry">
          <Text style={styles.retry}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }
  if (remote?.doc !== doc) {
    return (
      <View style={styles.loading} testID="legal-loading">
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }
  return <LegalBlocks blocks={remote.blocks} />;
}

function LegalBlocks({ blocks }: { blocks: LegalBlock[] }) {
  return (
    <View style={styles.blocks} testID="legal-blocks">
      {blocks.map((b, i) => {
        if (b.type === 'heading') return <Text key={i} style={b.level === 1 ? styles.h1 : b.level === 2 ? styles.h2 : styles.h3} accessibilityRole="header">{b.text}</Text>;
        if (b.type === 'paragraph') return <Text key={i} style={styles.p}>{b.text}</Text>;
        if (b.type === 'listItem')
          return (
            <View key={i} style={styles.li}>
              <View style={styles.bullet} />
              <Text style={[styles.p, { flex: 1 }]}>{b.text}</Text>
            </View>
          );
        return (
          <View key={i} style={styles.table} testID="legal-table">
            {b.rows.map((row, r) => (
              <View key={r} style={[styles.row, r > 0 && styles.rowSep]}>
                {row.map((cell, c) => (
                  <View key={c} style={styles.cell}>
                    {!!b.head[c] && <Text style={styles.cellHead}>{b.head[c]}</Text>}
                    <Text style={c === 0 ? styles.cellFirst : styles.p}>{cell}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  blocks: { gap: 10, paddingVertical: 10 },
  h1: { fontFamily: font.bodyBold, fontSize: 17, lineHeight: 24, color: C.ink, marginTop: 4 },
  h2: { fontFamily: font.bodyBold, fontSize: 15, lineHeight: 22, color: C.ink, marginTop: 12 },
  h3: { fontFamily: font.bodyBold, fontSize: 14, lineHeight: 20, color: C.ink, marginTop: 6 },
  p: { fontFamily: font.body, fontSize: 13, color: C.ink, lineHeight: 20 },
  li: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingLeft: 4 },
  bullet: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.ink2, marginTop: 8 },
  table: { borderWidth: 1, borderColor: C.line, borderRadius: radius.sm, overflow: 'hidden' },
  row: { padding: 12, gap: 6 },
  rowSep: { borderTopWidth: 1, borderTopColor: C.line },
  cell: { gap: 2 },
  cellHead: { fontFamily: font.body, fontSize: 11, lineHeight: 15, color: C.ink3 },
  cellFirst: { fontFamily: font.bodyBold, fontSize: 13, lineHeight: 20, color: C.ink },
  loading: { paddingVertical: 40, alignItems: 'center' },
  error: { paddingVertical: 30, alignItems: 'center', gap: 10 },
  errorText: { fontFamily: font.body, fontSize: 13, color: C.ink2, textAlign: 'center' },
  retry: { fontFamily: font.bodyBold, fontSize: 13.5, color: C.primary, padding: 4 },
});
