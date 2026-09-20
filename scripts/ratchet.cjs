// KB-602 래칫 게이트의 **순수 판정 로직** — git·eslint 없이 돌아가는 부분만 모았다.
//
// 왜 `lint-changed.mjs`에서 빼서 `.cjs`로 두는가(KB-612):
// 이 레포 jest는 babel/CJS 런타임이라 `import.meta`가 든 `.mjs`를 **파싱하지 못한다**
// (`--experimental-vm-modules` 없이는 동적 import도 막힌다). 게이트 본체는 `.mjs`여야 하고
// (`import.meta.url` 기반 main 가드), 그 안에 판정 로직이 있으면 **유닛에서 손댈 수 없다.**
// 그래서 순수 부분만 여기로 내린다 — `.mjs`는 이걸 import해서 쓰고, 유닛은 이걸 직접 부른다.
// 사본이 아니라 **단일 출처**다: 게이트가 실제로 쓰는 코드와 테스트가 보는 코드가 같다.

/** 진단의 종류 — **메시지 첫 줄 + 룰**.
 *  ⚠️ react-hooks 계열은 `message`에 **줄 번호가 박힌 코드 프레임**을 통째로 넣는다.
 *  메시지를 통으로 쓰면 위에 주석 한 줄만 추가해도 프레임이 달라져 같은 진단이
 *  "새 진단"으로 오인된다(실측). 그래서 첫 줄만 쓴다. */
const kindOf = (m) => `${m.ruleId ?? '?'}\u0000${String(m.message).split('\n')[0].trim()}`;

/** 진단의 정체성 = **종류 + 줄 + 열**.
 *  열까지 넣는 이유: 한 줄에 같은 종류의 진단이 여러 개 놓일 수 있다(예: `const [a] = useState(0);
 *  const [b] = useState(1);` — 위에 early return이 생기면 **둘 다** 조건부 훅이 된다).
 *  열이 없으면 두 건이 한 정체성으로 뭉쳐, 기준선 1건이 새 1건을 덮어쓴다. 안 바뀐 줄의
 *  열은 이동하지 않으므로 매핑이 필요 없다.
 *  ⚠️ 종류별 **개수만** 비교하면 상쇄된다(Codex #175 P1): 한 위반을 고치면서 같은 종류를
 *  파일 안 다른 곳에 새로 넣으면 개수가 그대로라 통과해 버린다. BASE 줄을 HEAD 줄로
 *  매핑해 위치까지 대조한다. */
const idOf = (m, line) => `${kindOf(m)}\u0000${line ?? 0}\u0000${m.column ?? 0}`;

/**
 * 기준선을 **소비하며** 새 부채만 골라낸다 — 이 게이트 판정의 핵심.
 *
 * `base`는 정체성별 **개수 맵**이다. 매칭될 때마다 하나씩 깎기 때문에 기준선 1건은 HEAD
 * **1건만** 면제한다 — `Set.has`로 보면 소비가 없어 1건이 여러 건을 덮는다(Codex #175 P2).
 *
 * ⚠️ 이 경로는 **게이트를 통째로 돌려서는 검증하기 어렵다**(KB-612). #175에서 다중도를
 * 노린 시나리오 테스트가 있었는데, BASE와 HEAD의 `rules-of-hooks` 메시지 꼬리가 달라
 * (`Did you accidentally call a React Hook after an early return?`가 HEAD에만 붙는다)
 * 애초에 종류가 안 맞아 **다중도 분기를 타지 않고** 통과했다. 그래서 합성 `Map`을 직접
 * 넣는 유닛으로 잠근다.
 *
 * 참고 실측(2026-09-21): 전체 진단 1,225건/244파일 중 개수가 2 이상인 정체성은 **0건**이고,
 * BASE→HEAD 줄 매퍼도 단조 증가라 단사다 — 즉 다중도는 **현재 도달하지 않는 방어선**이다.
 * 그래도 지우지 않는 건 정체성에서 열이 빠지는 순간(열을 주지 않는 진단 등) 바로 살아나기
 * 때문이다. 도달하지 않는 방어선일수록 유닛으로 잠가 둔다.
 *
 * 숫자는 낡는다 — 지우고 싶어지면 **다시 재라**(0이 아니면 이 경로는 살아 있는 것):
 *   npx eslint . -f json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
 *     let n=0;for(const f of JSON.parse(s)){const c=new Map();
 *     for(const m of f.messages){const k=[m.ruleId,String(m.message).split('\n')[0].trim(),m.line,m.column].join('|');
 *     c.set(k,(c.get(k)||0)+1);} for(const v of c.values()) if(v>1) n++;} console.log('중복 정체성:',n)})"
 *
 * @param {Array<object>} msgs HEAD 쪽 진단(줄로 못 거른 것들)
 * @param {Map<string, number>} base 기준선 정체성 → 개수. **이 함수가 소비하며 변형한다.**
 * @returns {Array<object>} 기준선에 없던 = 새 부채인 진단
 */
function newDebt(msgs, base) {
  const out = [];
  for (const m of msgs) {
    const id = idOf(m, m.line);
    const left = base.get(id) ?? 0;
    if (left > 0) base.set(id, left - 1); // **소비** — 기준선 1건은 HEAD 1건만 면제한다
    else out.push(m);
  }
  return out;
}

module.exports = { kindOf, idOf, newDebt };
