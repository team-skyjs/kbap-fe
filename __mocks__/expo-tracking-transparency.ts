/** jest 수동 목(KB-739) — ATT 결과를 테스트가 바꾼다 */
export const mockAtt = { granted: false, calls: 0 };
export async function requestTrackingPermissionsAsync() { mockAtt.calls += 1; return { granted: mockAtt.granted, status: mockAtt.granted ? 'granted' : 'denied' }; }
export async function getTrackingPermissionsAsync() { return { granted: mockAtt.granted, status: mockAtt.granted ? 'granted' : 'denied' }; }
