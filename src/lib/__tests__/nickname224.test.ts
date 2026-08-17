/**
 * P-224(KB-307·39): 긴 닉네임 잘림 일원화 — 절단 헬퍼 경계·공용 지점 내장·
 * 단독형 1줄 잘림 소스 잠금.
 */
import { displayNickname, NICKNAME_DISPLAY_MAX } from '../nickname';

const fs = require('fs');
const read = (p: string) => fs.readFileSync(p, 'utf8') as string;

describe('displayNickname — 절단 경계', () => {
  it('정확히 max = 무절단 · max+1 = 절단+… (경계 케이스)', () => {
    const exact = 'a'.repeat(NICKNAME_DISPLAY_MAX);
    expect(displayNickname(exact)).toBe(exact);
    const over = 'a'.repeat(NICKNAME_DISPLAY_MAX + 1);
    expect(displayNickname(over)).toBe('a'.repeat(NICKNAME_DISPLAY_MAX) + '…');
  });

  it('이모지(서로게이트 쌍) — 절단 지점이 쌍을 반으로 가르지 않는다', () => {
    const emoji = '😀'.repeat(NICKNAME_DISPLAY_MAX + 2); // 각각 2 code unit
    const cut = displayNickname(emoji);
    expect(cut).toBe('😀'.repeat(NICKNAME_DISPLAY_MAX) + '…');
    expect(cut.includes('�')).toBe(false); // 깨진 문자 없음
  });

  it('예진 실측 닉네임 — 절단 후 1줄 분량 + null/빈값 안전', () => {
    const long = '심종한애플프프프프프_프프프프프프프_프프';
    expect(Array.from(displayNickname(long)).length).toBe(NICKNAME_DISPLAY_MAX + 1); // max + …
    expect(displayNickname(null)).toBe('');
    expect(displayNickname(undefined)).toBe('');
  });
});

describe('배선 — 두 계층 일원화(표면별 땜질 금지)', () => {
  it('보간형: authorName(공용 지점)에 절단 내장 — 모더레이션 시트 3곳·피드 셀 커버', () => {
    const parts = read('src/features/community/parts.tsx');
    expect(parts).toContain('displayNickname(author.nickname)');
    // 모더레이션은 authorName 경유 하나뿐(개별 보간 지점에 raw 닉네임 없음)
    const mod = read('src/features/community/moderation.tsx');
    expect(mod).toContain('authorName(target.author, t)');
    expect(mod).not.toContain('target.author.nickname ??'); // 우회 접근 금지
    // 댓글 답글 표시줄도 절단 경유
    expect(read('src/app/community/post/[id].tsx')).toContain('displayNickname(reply!.mention)');
  });

  it('단독형: 홈 인사·프로필 탭·compose 작성자 = numberOfLines 1(레이아웃 잘림)', () => {
    const home = read('src/app/(tabs)/index.tsx');
    // 홈 인사(26pt): 1줄 + ko "님"·ja "さん" 접미 보호를 위한 절단 병용
    expect(home).toContain('style={styles.greetTitle} numberOfLines={1}');
    expect(home).toContain('displayNickname(me.nickname)');
    expect(read('src/app/(tabs)/profile.tsx')).toContain('style={styles.name} numberOfLines={1}');
    const compose = read('src/app/community/compose.tsx');
    expect(compose).toContain('style={styles.authorName} numberOfLines={1}');
    expect(compose).toContain('flexShrink: 1'); // 국기·랭크 옆 행이라 shrink 필요
  });

  it('ActionSheet 공용 수리 — rowText 1줄 + flexShrink(임의 긴 라벨 이중 방어)', () => {
    const sheet = read('src/components/ActionSheet.tsx');
    expect(sheet).toMatch(/rowTextDestructive\]\} numberOfLines=\{1\}/);
    expect(sheet).toMatch(/rowText: \{[^}]*flexShrink: 1/);
  });
});
