import * as React from 'react';
import { InteractionManager } from 'react-native';
import { usePathname } from 'expo-router';
import { UnlockCelebration } from './UnlockCelebration';
export function UnlockCelebrationHost() {
  const path = usePathname();
  const [settled, setSettled] = React.useState<string | null>(null);
  React.useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setSettled(path));
    return () => task.cancel();
  }, [path]);
  return <UnlockCelebration eligible={settled === path && (path === '/' || /^\/food\/[^/]+$/.test(path))} />;
}
