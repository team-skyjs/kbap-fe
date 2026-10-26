/**
 * KB-873 ②a — 앱 안 덮개의 유일한 출입구. 같은 이름·같은 모양이라 호출부는 import만 바꾼다.
 * react-native의 Modal·Alert를 직접 쓰면 잠금 테스트가 실패한다. 사진 선택기는 occlusionPickers(네이티브 모듈을 Modal 사용처에 끌어오지 않게 분리).
 */
import * as React from 'react';
import { Alert as RNAlert, Modal as RNModal, type AlertButton, type AlertOptions, type ModalProps } from 'react-native';
import { pushOcclusion, useOcclusion } from './occlusion';

/** RN Modal과 같음 + 보이는 동안 가림(visible 기본 true — RN과 동일) */
export function Modal(props: ModalProps) {
  useOcclusion(props.visible ?? true);
  return <RNModal {...props} />;
}

/** RN Alert와 같음 + 떠 있는 동안 가림. 버튼 누름·Android 바깥 닫힘(onDismiss) = 해제 */
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions): void {
    const release = pushOcclusion();
    // ponytail: 버튼 없는 Alert는 RN 기본 "OK" 하나를 명시로 둔다(해제 지점이 필요) — 현재 호출부는 전부 버튼을 넘긴다
    const list = buttons?.length ? buttons : [{ text: 'OK' }];
    RNAlert.alert(
      title,
      message,
      list.map((b) => {
        const press = b.onPress as ((value?: unknown) => void) | undefined; // RN 타입 = 함수 유니온(prompt용 login 형) — 값은 그대로 통과만
        return { ...b, onPress: (value?: unknown) => { release(); press?.(value); } };
      }),
      { ...options, onDismiss: () => { release(); options?.onDismiss?.(); } },
    );
  },
};
