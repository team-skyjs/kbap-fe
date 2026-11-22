import { NitroModules } from 'react-native-nitro-modules';
import type { HandPose } from './specs/HandPose.nitro';

export type { HandPose };
export const createHandPose = (): HandPose => NitroModules.createHybridObject<HandPose>('HandPose');
