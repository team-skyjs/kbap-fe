/**
 * ActionSheet — 콘텐츠 액션 공용 바텀시트, 'context' 변형 (P-087/KB-251 확정).
 *
 * AuthGateSheet 골격(Modal fade + 스크림 + 하단 시트) 재사용 — JS-only·의존성 0.
 * 헤더(아바타 슬롯 + 대상 명시 제목) + X 닫기, **Cancel 행 없음**, 단일 카드
 * hairline 행. 스크림 탭·안드 백버튼(onRequestClose) 닫기 필수.
 *
 * 남의 콘텐츠 = Report/Block, 내 것 = Edit/Delete — 행 구성은 호출측 몫.
 * destructive 톤은 위험도 `#cf3a2c`(riskDanger)와 **구분되는** 버건디 사용
 * (D-03 "Never red" — 위험도 4색 의미 예약 보호).
 *
 * 사용처: 커뮤니티 글·댓글·대댓글 ⋯ (리뷰 ⋯ 배선은 리뷰 트랙에서).
 * "시스템 기능 호출=시스템 UI(프로필 사진 시트), 콘텐츠 액션=이 컴포넌트" 구분.
 */
import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Txt as Text } from '@/components/Txt';
import { useBottomInset } from '@/lib/useBottomInset';
import { color as C, font, radius, shadow } from '@/lib/theme';
import { IconClose } from '@/components/icons';

/** 위험도 red(#cf3a2c)와 구분되는 destructive 버건디 — 의미색 예약 보호. */
export const DESTRUCTIVE = '#8e2f3c';

export interface ActionSheetItem {
  key: string;
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  onPress: () => void;
  /** P-190: 탭 시 자동 onClose 생략 — 페이즈 전환형(신고/차단)용. onClose가 플로우
   *  전체를 언마운트하는 소비처에서 조기 close가 전환을 죽이던 버그의 구조 수정. */
  keepOpen?: boolean;
}

export function ActionSheet({
  open,
  title,
  avatar,
  items,
  onClose,
}: {
  open: boolean;
  /** 대상 명시 제목 — 예: "Post by Mina" / "Your comment" */
  title: string;
  /** 아바타 슬롯 (국기·프로필 등 — 호출측 렌더) */
  avatar?: ReactNode;
  items: ActionSheetItem[];
  onClose: () => void;
}) {
  const bottom = useBottomInset();
  const sheetPad = Platform.OS === 'android' ? { paddingBottom: 14 + bottom } : null;
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, sheetPad]} onPress={() => {}}>
          <View style={styles.header}>
            {avatar && <View style={styles.avatar}>{avatar}</View>}
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Pressable hitSlop={10} onPress={onClose} style={styles.close}>
              <IconClose size={18} color={C.ink3} />
            </Pressable>
          </View>
          <View style={styles.card}>
            {items.map((it, i) => (
              <Pressable
                key={it.key}
                style={[styles.row, i > 0 && styles.rowDivider]}
                onPress={() => {
                  // P-190: keepOpen = 페이즈 전환형 — onClose(플로우 언마운트) 생략,
                  // 전환된 페이즈 렌더가 시트를 대체한다. 그 외는 현행(자동 닫힘) 무변.
                  if (!it.keepOpen) onClose();
                  it.onPress();
                }}
              >
                {it.icon}
                <Text style={[styles.rowText, it.destructive && styles.rowTextDestructive]}>{it.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 18,
    paddingBottom: 30,
    paddingHorizontal: 18,
    gap: 14,
    ...shadow.sh2,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  avatar: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontFamily: font.bodyBold, fontSize: 15, color: C.ink },
  close: { padding: 4 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, borderRadius: radius.sm, ...shadow.sh1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 15 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.hair },
  rowText: { fontFamily: font.bodyBold, fontSize: 14.5, color: C.ink },
  rowTextDestructive: { color: DESTRUCTIVE },
});

export default ActionSheet;
