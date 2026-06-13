#!/usr/bin/env node
/*
 * 이벤트 일러스트 자동 생성기 (OpenAI Images / gpt-image-1)
 * 삼국지(코에이 RoTK) 이벤트 CG풍 — 시대별 역사 이벤트 장면.
 *
 * 사용법:
 *   export OPENAI_API_KEY=sk-...
 *   npm i sharp                                  # 3:2 webp 변환(권장)
 *   node tools/gen-events.mjs                     # 없는 것만 생성 + EVENT_IMG 자동 등록
 *   node tools/gen-events.mjs --only u_ansi,g_pyeongyang
 *   node tools/gen-events.mjs --force             # 이미 있어도 다시 생성
 *   node tools/gen-events.mjs --dry-run           # 호출 없이 프롬프트만 출력
 *   node tools/gen-events.mjs --register-only     # 폴더 스캔해 EVENT_IMG만 갱신
 * 옵션 환경변수: OPENAI_IMAGE_MODEL(기본 gpt-image-1), IMAGE_QUALITY(low|medium|high), GEN_SIZE(기본 1536x1024)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '..');
const INDEX = path.join(ROOT, 'index.html');
const OUTDIR = path.join(ROOT, 'assets', 'events');

const args = process.argv.slice(2);
const has = f => args.includes(f);
const val = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const DRY = has('--dry-run'), FORCE = has('--force'), REGISTER_ONLY = has('--register-only');
const ONLY = (val('--only') || '').split(',').map(s => s.trim()).filter(Boolean);

const MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const QUALITY = process.env.IMAGE_QUALITY || 'high';
const SIZE = process.env.GEN_SIZE || '1536x1024';   // 가로형 3:2
const OUT_W = 960, OUT_H = 640;

const COMMON = `A dramatic cinematic historical scene illustration of the Korean Three Kingdoms era, in the style of Koei Romance of the Three Kingdoms event CG art, semi-realistic digital painting, epic atmosphere, dynamic composition, dramatic cinematic lighting, period-accurate lamellar armor and banners, painterly detail, 3:2 landscape, no text, no watermark, no border, do NOT resemble any modern actor or copyrighted artwork`;

/* 이벤트별 장면 묘사(고증·설화 기반) */
const EVT_EN = {
  // 371 근초고왕
  g_intro:    'King Geunchogo of Baekje at the height of his power reviewing his great army, golden Baekje banners, a prosperous fortress capital behind, confident and majestic, warm dawn light',
  g_pyeongyang:'Baekje army storming the stone walls of Pyeongyang fortress at dusk, scaling ladders and arrows, the Goguryeo king Gogugwon struck by an arrow and falling among his guards, fire and chaos',
  g_chiljido: 'a solemn ceremony where Baekje envoys present the famous seven-branched sword (Chiljido) to Wa Yamato envoys, ornate hall, gold and crimson, diplomacy and alliance',
  g_sosurim:  'King Sosurim of Goguryeo proclaiming new state laws and founding a royal academy, Buddhist monks and Confucian scholars present, candlelit hall, scene of reform and revival',
  g_mahan:    'Baekje army subjugating the Mahan chiefdoms across the southern plains, kneeling local lords offering submission, rows of Baekje banners, autumn fields',
  // 400 광개토대왕
  w_intro:    'the young Gwanggaeto the Great enthroned as king of Goguryeo, ornate gold crown over a feathered cap, mighty broad-shouldered presence, golden throne hall, rays of light',
  w_baekje:   'Goguryeo heavy cavalry overwhelming the Baekje army at a river, the Baekje king Asin kneeling in submission before mounted Gwanggaeto, banners and dust',
  w_namjeong: 'Goguryeo heavy cavalry (gaemamusa, armored horse riders) crushing Wa raiders and Gaya forces along the Nakdong River to rescue Silla, spears and broken enemies, year 400',
  w_yodong:   'Goguryeo army storming the Liaodong plain and driving out the Later Yan Xianbei cavalry, a great fortress aflame on the horizon, victorious advance',
  w_buyeo:    'Goguryeo army on the northern steppe receiving the submission of Eastern Buyeo, vast columns of soldiers and banners under a wide sky',
  w_hanseong: 'King Jangsu of Goguryeo leading a vast army assaulting Wiryeseong, the Baekje royal capital falling in flames, the captured Baekje king Gaero, somber and epic',
  // 554 진흥왕
  j_intro:    'Silla King Jinheung and Baekje allies sealing the Na-Je alliance pact in a hall overlooking the Han River, banners of both kingdoms, tense diplomacy',
  j_hangang:  'Silla army seizing the lower Han River region and betraying the Baekje alliance, Silla banners planted by the great river at dawn',
  j_gwansan:  'the Battle of Gwansan fortress, the Baekje king Seong ambushed and slain by Silla soldiers in a narrow valley, somber dramatic dusk, broken Baekje army',
  j_daegaya:  'Silla generals Isabu and Sadaham conquering Daegaya, the last Gaya kingdom, its palace falling, iron-armored Gaya warriors defeated, melancholy',
  j_sunsubi:  'King Jinheung of Silla erecting a tall stone monument (sunsubi) on a windswept mountain peak, surveying his vastly expanded realm, banners and clouds',
  // 645 여당전쟁
  u_decree:   'Tang Emperor Taizong personally leading a vast Tang army crossing the Liao River toward Goguryeo, endless ranks of banners and siege engines, overwhelming might',
  u_war1:     'the Tang army crossing the Liao River and assaulting Goguryeo border fortresses, massive siege with catapults and ladders, smoke over the walls',
  u_ansi:     'the heroic siege of Ansi fortress, commander Yang Manchun and Goguryeo soldiers defending the stone walls against a giant Tang earthwork siege ramp, arrows and defiance',
  u_retreat:  'the Tang army retreating through winter snow after failing to take Ansi fortress, weary defeated columns, Goguryeo defenders victorious on the walls at dawn',
  u_fall:     'Goguryeo Liaodong defenses collapsing as the Tang army advances, fortresses burning on the plain, retreating Goguryeo soldiers, somber and grim',
};
function buildPrompt(id){ return `${COMMON}. Scene: ${EVT_EN[id]}.`; }

async function saveImage(buf, name) {
  fs.mkdirSync(OUTDIR, { recursive: true });
  let sharp = null; try { sharp = (await import('sharp')).default; } catch (_) {}
  if (sharp) { const out = path.join(OUTDIR, `${name}.webp`);
    await sharp(buf).resize(OUT_W, OUT_H, { fit: 'cover' }).webp({ quality: 82 }).toFile(out);
    return path.relative(ROOT, out); }
  const out = path.join(OUTDIR, `${name}.png`); fs.writeFileSync(out, buf);
  console.warn('  ⚠ sharp 미설치 → png 저장(권장: npm i sharp)'); return path.relative(ROOT, out);
}
async function generate(prompt) {
  const key = process.env.OPENAI_API_KEY; if (!key) throw new Error('OPENAI_API_KEY 환경변수가 없습니다.');
  for (let a = 1; a <= 5; a++) {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt, size: SIZE, quality: QUALITY, n: 1 }) });
    if (res.ok) { const j = await res.json(); const b64 = j.data?.[0]?.b64_json;
      if (!b64) throw new Error('이미지 데이터 없음: ' + JSON.stringify(j).slice(0, 200)); return Buffer.from(b64, 'base64'); }
    if (res.status === 429 || res.status >= 500) { const w = 2 ** a; console.warn(`  재시도 ${a} (HTTP ${res.status}) ${w}s`); await new Promise(r => setTimeout(r, w * 1000)); continue; }
    throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  throw new Error('재시도 초과');
}
function registerAll() {
  const files = fs.existsSync(OUTDIR) ? fs.readdirSync(OUTDIR).filter(f => /\.(webp|png|jpg|jpeg)$/i.test(f)) : [];
  const entries = files.map(f => ({ id: f.replace(/\.(webp|png|jpg|jpeg)$/i, ''), p: `assets/events/${f}` })).sort((a, b) => a.id.localeCompare(b.id));
  const lines = entries.map(e => `  ${e.id}:'${e.p}',`).join('\n');
  const block = `const EVENT_IMG={\n${lines}\n};`;
  let html = fs.readFileSync(INDEX, 'utf8');
  const re = /const EVENT_IMG=\{[\s\S]*?\n\};/;
  if (!re.test(html)) throw new Error('index.html에서 EVENT_IMG 블록을 찾지 못했습니다.');
  fs.writeFileSync(INDEX, html.replace(re, block));
  console.log(`EVENT_IMG 등록 완료: ${entries.length}개`);
}
async function main() {
  if (REGISTER_ONLY) { registerAll(); return; }
  let ids = Object.keys(EVT_EN); if (ONLY.length) ids = ids.filter(i => ONLY.includes(i));
  console.log(`대상 이벤트: ${ids.length}개 / 모델 ${MODEL} / ${SIZE} / ${QUALITY}${DRY ? ' (DRY-RUN)' : ''}`);
  let made = 0, skip = 0, fail = 0;
  for (const id of ids) {
    const exists = ['webp', 'png', 'jpg', 'jpeg'].some(e => fs.existsSync(path.join(OUTDIR, `${id}.${e}`)));
    if (exists && !FORCE) { skip++; continue; }
    const prompt = buildPrompt(id);
    if (DRY) { console.log(`- ${id}\n    ${prompt}`); continue; }
    try { process.stdout.write(`生成 ${id} ... `); const buf = await generate(prompt); console.log('✓ ' + await saveImage(buf, id)); made++; }
    catch (e) { console.log('✗ ' + e.message); fail++; }
  }
  if (!DRY) { registerAll(); console.log(`\n완료 — 생성 ${made}, 건너뜀 ${skip}, 실패 ${fail}`); }
}
export { EVT_EN, buildPrompt };
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e); process.exit(1); });
