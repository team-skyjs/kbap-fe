/**
 * KB-711: 제출 중 화면을 떠나면 진행 중인 사진 업로드를 취소한다(리뷰 작성·문의 작성·커뮤니티 글쓰기).
 * 제출마다 새 신호를 받고(`next()`), 화면이 언마운트되면 그 신호를 중단 → uploadImage가 PUT을 취소하고 다음 단계로 가지 않는다.
 * 업로드가 이미 끝나 본 요청이 나간 뒤라면 취소할 것이 없다(그 경우는 그대로 — 결과 안내는 KB-711 ③ 보고).
 */
import * as React from 'react';

export function useUploadAbort(): () => AbortSignal {
  const ctl = React.useRef<AbortController | null>(null);
  React.useEffect(() => () => ctl.current?.abort(), []);
  return React.useCallback(() => {
    ctl.current = new AbortController();
    return ctl.current.signal;
  }, []);
}
