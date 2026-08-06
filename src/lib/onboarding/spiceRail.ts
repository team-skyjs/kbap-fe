/**
 * spiceRail (P-134/온보딩 v3) — 맵기 레벨별 대표 음식 사진 레일 상수.
 * 사진 = 기존 음식 DB CDN 재사용(신규 에셋 0, dev 실존 foodId — 8/6 실측 선정).
 * 오프라인/미로드 폴백 = 색 카드(렌더 측). 스펙: onboarding-v3 §4.
 */
import type { SpiceLevel } from '@/lib/spice';

export interface RailFood {
  foodId: string;
  name: string; // en
  nameKo: string;
  imageUrl: string;
}

const CDN = 'https://d29c1cr2ng7w0.cloudfront.net/images/webp/food';

export const SPICE_RAIL: Record<SpiceLevel, RailFood[]> = {
  NONE: [
    { foodId: '246', name: 'Seolleongtang', nameKo: '설렁탕', imageUrl: `${CDN}/b33a2dd389f9_7e891c51fdc246f9.webp` },
    { foodId: '454', name: 'Triangle Kimbap', nameKo: '삼각김밥', imageUrl: `${CDN}/a97acd96cf2b_71b6bf223de2431d.webp` },
    { foodId: '364', name: 'Japchae Rice', nameKo: '잡채밥', imageUrl: `${CDN}/2ee3c87f4acd_56d3d910e2a748d2.webp` },
  ],
  MILD: [
    { foodId: '296', name: 'Steamed Egg', nameKo: '계란찜', imageUrl: `${CDN}/4db8a258c453_2283a90514774194.webp` },
    { foodId: '290', name: 'Doenjang', nameKo: '강된장', imageUrl: `${CDN}/72fc154f9240_31d64b7afd9a4f4a.webp` },
    { foodId: '471', name: 'Ganja Kimbap', nameKo: '마약김밥', imageUrl: `${CDN}/4287774f5d81_be87cd3241f042bc.webp` },
  ],
  MEDIUM: [
    { foodId: '259', name: 'Ugeojigalbitang', nameKo: '우거지갈비탕', imageUrl: `${CDN}/a07752684831_fd319c6e37ba43da.webp` },
    { foodId: '301', name: 'Spicy Pork Stir-fry', nameKo: '제육볶음', imageUrl: `${CDN}/63bbab1cdcea_20f05c100bb24720.webp` },
    { foodId: '371', name: 'Gangdoenjang Bibimbap', nameKo: '강된장비빔밥', imageUrl: `${CDN}/c263dcdd4c80_5b6c3b3ecece4e9c.webp` },
  ],
  HOT: [
    { foodId: '483', name: 'Gukmul Tteokbokki', nameKo: '국물떡볶이', imageUrl: `${CDN}/19b176949c19_dcaacf80b5e94d5f.webp` },
    { foodId: '369', name: 'Dakgalbi Rice Bowl', nameKo: '닭갈비덮밥', imageUrl: `${CDN}/75f3c6f8dfe7_c728c2ed39004d69.webp` },
    { foodId: '386', name: 'Naengjjambbong', nameKo: '냉짬뽕', imageUrl: `${CDN}/a4d6d8946c17_0905ee377abc4750.webp` },
  ],
  EXTREME: [
    { foodId: '480', name: 'Spicy Bulgogi Noodles', nameKo: '불닭볶음면', imageUrl: `${CDN}/d96283d7c71b_e927d7f8656e4eb0.webp` },
    { foodId: '387', name: 'Nagasaki Champon', nameKo: '나가사키짬뽕', imageUrl: `${CDN}/6b99579f1610_689ca1dc95244a5e.webp` },
    { foodId: '235', name: 'Bone-in Dak Galbi', nameKo: '뼈닭갈비', imageUrl: `${CDN}/6cb00d669d14_78344d12c09b4795.webp` },
  ],
};
