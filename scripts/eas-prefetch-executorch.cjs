/**
 * KB-1019(시연 브랜치 전용): EAS 설치 전에 executorch 네이티브 라이브러리를 캐시에 미리 채운다.
 * 11/9 GitHub 릴리스 다운로드가 익명 요청에 간헐 504 → postinstall(download-libs.js)이 빌드를 죽였다.
 * 재시도 + asset API 경로 폴백으로 받아 ~/.cache/react-native-executorch/<ver>에 두면 postinstall은 캐시 적중.
 * ponytail: 실패해도 종료 코드 0 — 원래 postinstall이 마지막 기회로 다시 시도한다.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { Buffer } = require('buffer');

const VER = '0.11.0';
const REPO = 'software-mansion/react-native-executorch';
const NAMES = ['headers', 'core-ios', 'xnnpack-ios', 'coreml-ios'];
const DIR = process.env.RNET_LIBS_CACHE_DIR || path.join(os.homedir(), '.cache', 'react-native-executorch', VER);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, headers = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': 'kbap-eas-prefetch', ...headers }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function assetUrls() {
  try {
    const rel = JSON.parse((await get(`https://api.github.com/repos/${REPO}/releases/tags/v${VER}-libs`)).toString());
    return Object.fromEntries(rel.assets.map((a) => [a.name, a.url]));
  } catch (e) {
    console.log(`[prefetch] asset 목록 실패: ${e.message}`);
    return {};
  }
}

async function fetchOne(file, api) {
  for (let i = 0; i < 6; i++) {
    try {
      return await get(`https://github.com/${REPO}/releases/download/v${VER}-libs/${file}`);
    } catch (e) {
      console.log(`[prefetch] ${file} 시도 ${i + 1}: ${e.message}`);
      if (api[file]) {
        try {
          return await get(api[file], { Accept: 'application/octet-stream' });
        } catch (e2) {
          console.log(`[prefetch] ${file} API 경로: ${e2.message}`);
        }
      }
      await sleep(2000 * (i + 1));
    }
  }
  throw new Error(`${file} 6회 실패`);
}

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const api = await assetUrls();
  for (const n of NAMES) {
    try {
      const tar = await fetchOne(`${n}.tar.gz`, api);
      const sum = (await fetchOne(`${n}.tar.gz.sha256`, api)).toString().trim();
      const got = crypto.createHash('sha256').update(tar).digest('hex');
      if (got !== sum) throw new Error(`checksum 불일치 ${n}`);
      fs.writeFileSync(path.join(DIR, `${n}.tar.gz`), tar);
      fs.writeFileSync(path.join(DIR, `${n}.tar.gz.sha256`), sum);
      console.log(`[prefetch] ${n} ok`);
    } catch (e) {
      console.log(`[prefetch] ${n} 포기(postinstall이 다시 시도): ${e.message}`);
    }
  }
})();
