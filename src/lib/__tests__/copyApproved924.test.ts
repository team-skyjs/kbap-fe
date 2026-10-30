/** KB-924 — 예진 승인(10/30) 한국어 문구 10키 잠금. ko 값만(다른 로케일 무변) · 보간 토큰 유지 · 직선 따옴표 · 가운데 점·이모지 0 */
import * as fs from 'fs';
import * as path from 'path';

const ko = JSON.parse(fs.readFileSync(path.join(__dirname, '../i18n/ko.json'), 'utf8')) as Record<string, Record<string, string>>;
const get = (k: string) => { const [a, b] = k.split(/\.(.+)/); return ko[a][b]; };

const APPROVED: Record<string, string> = {
  // 안전·법적
  'packaged.noAvoidMatchTitle': '확인한 성분 중 피하는 재료 없음',
  'detail.verdictMayContain': '못 먹는 재료가 들어 있을 수 있어요: {{list}}',
  'gate.photoRemovalTitle': '리뷰 사진 삭제 요청',
  'ugc.consentAgree': '확인하고 사진 선택',
  'gate.photoRemovalSub': '가입하면 리뷰 사진 삭제를 요청할 수 있어요.',
  // Codex 권고
  'states.offlineBody': '메뉴 스캔과 리뷰 불러오기에는 인터넷 연결이 필요해요.',
  'community.blockConfirmBody': "그 사용자의 리뷰가 더 이상 보이지 않아요. 프로필의 '차단한 사용자'에서 언제든 차단을 해제할 수 있어요.",
  'saved.emptyBody': '음식의 별을 누르면 여기에 모여요.',
  'packagedScan.freeExplain': '이 시간 동안은 가공식품을 횟수 제한 없이 스캔할 수 있어요. 메뉴판 스캔은 해당되지 않아요.',
  'profile.languageHintAndroid': "앱 설정이 열려요. '언어'를 눌러 주세요.",
};

describe('KB-924 승인 문구', () => {
  it.each(Object.entries(APPROVED))('%s', (k, v) => {
    expect(get(k)).toBe(v);
    expect(v).not.toMatch(/[·‘’“”]|\p{Extended_Pictographic}/u);
  });
  it('detail.verdictMayContain 보간 토큰 {{list}} 유지(en과 같은 토큰)', () => {
    const en = JSON.parse(fs.readFileSync(path.join(__dirname, '../i18n/en.json'), 'utf8')) as Record<string, Record<string, string>>;
    expect(en.detail.verdictMayContain).toContain('{{list}}');
    expect(get('detail.verdictMayContain').match(/\{\{\w+\}\}/g)).toEqual(['{{list}}']);
  });
  it('K-128 그대로: packaged.unverifiedTitle', () => {
    expect(get('packaged.unverifiedTitle')).toBe('일부 성분을 확인할 수 없어요');
  });
});
