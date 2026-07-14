/** Design-system barrel — shared chrome ported from the hi-fi mockup kit. */
export * from './icons';
export { RiskMark, RiskDot, RISK } from './RiskMark';
export { RiskPill } from './RiskPill';
export { Stars, Star } from './Stars';
export { Flag } from './Flag';
export { Rosette } from './Rosette';
export { Btn, type BtnVariant } from './Btn';
export { StickyHeader, useStickyScroll, useHeaderHeight, type StickyHeaderProps } from './StickyHeader';
export { SubHeader } from './SubHeader';
export { TabBar, type TabKey, type TabBarLabels } from './TabBar';
export { TopBar } from './TopBar';
export { StateBlock, stateIconColor, type StateTone } from './StateBlock';
export { SkeletonList, Shimmer } from './Skeleton';
export { CardPhoto } from './CardPhoto';
export { Spinner } from './Spinner';
export { ShellPlaceholder } from './ShellPlaceholder';
export { NotificationsPanel } from './NotificationsPanel';
// SocialAuthButtons is intentionally NOT re-exported here: it pulls native-only
// Firebase/google-signin modules (KB-109) — import it directly from
// '@/components/SocialAuthButtons' so only auth screens carry that weight.
