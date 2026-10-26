/** KB-873 ②a — 시스템 사진 선택기·카메라 = 떠 있는 동안 가림. expo-image-picker의 launch*는 이것으로만(잠금 테스트) */
import * as ImagePicker from 'expo-image-picker';
import { withOcclusion } from './occlusion';

export const launchImageLibraryAsync = (options?: ImagePicker.ImagePickerOptions) => withOcclusion(() => ImagePicker.launchImageLibraryAsync(options));
export const launchCameraAsync = (options?: ImagePicker.ImagePickerOptions) => withOcclusion(() => ImagePicker.launchCameraAsync(options));
