/** Design-system barrel — shared chrome ported from the hi-fi mockup kit. */
export * from './icons';
export { RiskMark, RiskDot, RISK } from './RiskMark';
export { RiskPill } from './RiskPill';
export { Stars, Star, RatingLine, BookmarkStar } from './Stars';
export { FlagEmoji as Flag, FlagEmoji } from './FlagEmoji'; // P-130: 국기 = 이모지 (구 Flag SVG 벤더 소멸)
export { Rosette, MedalEmblem } from './Rosette';
export { Btn, type BtnVariant } from './Btn';
export { StickyHeader, useStickyScroll, useHeaderHeight, type StickyHeaderProps } from './StickyHeader';
export { SubHeader } from './SubHeader';
export { TabBar, type TabKey, type TabBarLabels } from './TabBar';
export { TopBar } from './TopBar';
export { StateBlock, stateIconColor, QueryErrorBlock, classifyQueryError, ScreenCenterFill, type StateTone } from './StateBlock';
export { SkeletonList, SkeletonHome, SkeletonFoodGrid, SkeletonProfile, Shimmer } from './Skeleton';
export { CardPhoto } from './CardPhoto';
export { PressScale } from './PressScale';
export { Spinner } from './Spinner';
export { ActionSheet, DESTRUCTIVE, type ActionSheetItem } from './ActionSheet';
export { ShellPlaceholder } from './ShellPlaceholder';
export { KeyboardDismissBar, Input, KEYBOARD_ACCESSORY_ID } from './KeyboardDismissBar';
// SocialAuthButtons is intentionally NOT re-exported here: it pulls native-only
// Firebase/google-signin modules (KB-109) — import it directly from
// '@/components/SocialAuthButtons' so only auth screens carry that weight.
// KB-429 디자인 4차 프리미티브
export { RiskBadge } from './RiskBadge';
export { Chip } from './Chip';
export { SectionHead } from './SectionHead';
export { Checkbox, Radio } from './Choice';
export { RankMedal } from './RankMedal';
