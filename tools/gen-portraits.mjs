#!/usr/bin/env node
/*
 * 장수 일러스트 자동 생성기 (OpenAI Images / gpt-image-1)
 *
 * 사용법:
 *   export OPENAI_API_KEY=sk-...            # 필수
 *   npm i sharp                             # 이미지 변환용(권장)
 *   node tools/gen-portraits.mjs            # 없는 것만 전부 생성 + 등록
 *   node tools/gen-portraits.mjs --only 광개토대왕,김유신
 *   node tools/gen-portraits.mjs --force    # 이미 있어도 다시 생성
 *   node tools/gen-portraits.mjs --dry-run  # 호출 없이 대상/프롬프트만 출력
 *   node tools/gen-portraits.mjs --register-only   # 폴더 스캔해 PORTRAITS만 갱신
 *
 * 옵션 환경변수:
 *   OPENAI_IMAGE_MODEL (기본 gpt-image-1)
 *   IMAGE_QUALITY (low|medium|high, 기본 high)
 *   GEN_SIZE (1024x1536 등, 기본 1024x1536)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '..');
const INDEX = path.join(ROOT, 'index.html');
const OUTDIR = path.join(ROOT, 'assets', 'portraits');

const args = process.argv.slice(2);
const has = f => args.includes(f);
const val = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const DRY = has('--dry-run');
const FORCE = has('--force');
const REGISTER_ONLY = has('--register-only');
const ONLY = (val('--only') || '').split(',').map(s => s.trim()).filter(Boolean);

const MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const QUALITY = process.env.IMAGE_QUALITY || 'high';
const SIZE = process.env.GEN_SIZE || '1024x1536'; // 세로형(2:3) → 4:5로 크롭
const OUT_W = 600, OUT_H = 750; // 최종 4:5

/* ---------- 장수 데이터 파싱 (index.html의 gens 배열) ---------- */
function parseGenerals() {
  const html = fs.readFileSync(INDEX, 'utf8');
  const re = /\['([가-힣]+)','([a-z]+)','([a-z]+)',(\d+),(\d+),(\d+)\]/g;
  const map = new Map(); let m;
  while ((m = re.exec(html))) {
    const o = { name: m[1], f: m[2], lead: +m[4], might: +m[5], int: +m[6] };
    const prev = map.get(o.name);
    if (!prev || (o.lead + o.might + o.int) > (prev.lead + prev.might + prev.int)) map.set(o.name, o);
  }
  return [...map.values()];
}

/* ---------- 프롬프트 조립 (PORTRAITS.md와 동일 규칙) ---------- */
const COMMON = `A bust portrait of an ancient Korean Three-Kingdoms-era figure, semi-realistic painted game portrait, Romance-of-the-Three-Kingdoms style, dramatic rim light, dark warm gold background, head-and-shoulders, three-quarter view, fur shoulder mantle, crimson cape, highly detailed, painterly, 4:5 aspect ratio, single character, no text, no watermark`;
const TYPE_EN = {
  '왕': 'wearing a golden crown and royal robe, regal calm dignified expression',
  '태자': 'a young prince with a light golden circlet, noble refined look',
  '책사': 'a scholar wearing a headband and robe, calm wise expression, holding a folding fan or scroll',
  '맹장': 'in heavy lamellar armor with a horned helmet and red plume, fierce intense expression, gripping a spear or glaive',
  '장수': 'in lamellar armor and a plumed helmet, steady confident expression, holding a spear',
};
function archetype(g) {
  const isKing = /왕/.test(g.name) && !/태자/.test(g.name);
  const isPrince = /태자/.test(g.name);
  const scholar = (g.int >= 86 && g.int > g.might + 2) && !isKing;
  const warrior = (g.might >= 86 && g.might >= g.int) || g.might >= 92;
  if (isKing) return '왕';
  if (isPrince) return '태자';
  if (scholar) return '책사';
  if (warrior) return '맹장';
  return '장수';
}
function ageEN(g) {
  const isKing = /왕/.test(g.name) && !/태자/.test(g.name);
  const scholar = (g.int >= 86 && g.int > g.might + 2) && !isKing;
  if (isKing || scholar || g.int >= 92 || g.lead >= 90) return 'a middle-aged to elderly';
  if (/태자|관창|사다함/.test(g.name)) return 'a young';
  return 'a young to middle-aged';
}
const FAC_EN = { goguryeo: 'Goguryeo (deep blue/gold)', baekje: 'Baekje (green/gold)', silla: 'Silla (crimson/gold)', gaya: 'Gaya (purple/gold)', china: 'a Chinese northern/Tang-era dynasty (gray/black with imperial accents)', wa: 'Wa/Yamato (white/red)' };
/* 세력별 고증 참조 — 실제 공개 유물·고분벽화 기반(저작권 무관) */
const FAC_REF = {
  goguryeo: 'historically grounded in 4th-7th century Goguryeo: lamellar scale armor and feathered jeolpung cap as seen in Anak Tomb No.3 and Muyongchong tomb murals, heavy cavalry (gaemamusa) aesthetic',
  baekje: 'historically grounded in Baekje: refined gilt-bronze crown ornaments from the Tomb of King Muryeong, motifs of the Baekje gilt-bronze incense burner, elegant courtly attire',
  silla: 'historically grounded in Silla: ornate gold crown with comma-shaped jade (gogok) from Cheonmachong/Hwangnam Daechong, gold ornaments and belt',
  gaya: 'historically grounded in Gaya: iron plate armor (pan-gap) and iron helmet, ingot-iron warrior aesthetic',
  china: 'historically grounded in Chinese Northern-dynasty to Tang-era cavalry armor (era-appropriate: Yan/Northern Qi/Tang)',
  wa: 'historically grounded in Kofun-period Yamato armor and attire',
};
const NEGATIVE = 'period-accurate ancient costume, do NOT resemble any modern actor, TV drama still, or existing copyrighted artwork; original imagined face';
/* 주요 영웅 맞춤 묘사 — 인물별 나이·기질·외형 특색(고증/설화 기반) */
const NAME_EN = {
  '광개토대왕': 'a vigorous conquering king in his early 30s, broad-shouldered, fierce determined gaze, ornate gold crown over feathered cap and scale armor',
  '장수왕': 'a long-reigning elderly king with a long white beard, serene and authoritative',
  '소수림왕': 'a thoughtful reform-minded king, calm scholarly dignity',
  '연개소문': 'a powerful imperious warlord with a thick black beard, multiple swords at his belt, intense commanding stare',
  '양만춘': 'a weathered veteran fortress commander, battle-scarred yet calm and resolute, plain sturdy lamellar armor',
  '온달': 'a rugged powerful warrior of humble origin, simple armor, honest strong square-jawed face',
  '을지문덕': 'a wise elder strategist-general with a long beard, piercing calm eyes',
  '고연수': 'a stern middle-aged field commander in scale armor',
  '김유신': 'a legendary noble general in his prime, dignified commanding presence, gold-trimmed Silla armor',
  '김춘추': 'a sharp-eyed refined diplomat-statesman, elegant court robe with gold ornaments, shrewd composed expression',
  '진흥왕': 'an ambitious king, ornate gold crown with comma-shaped jade, confident expansionist gaze',
  '이사부': 'a seasoned veteran commander, stern weathered face',
  '거칠부': 'a scholarly veteran statesman-general, calm wise face',
  '사다함': 'a strikingly handsome young hwarang warrior, light ornamented armor, brave noble youthful face',
  '관창': 'a very young hwarang boy-warrior, delicate but brave determined face, light armor',
  '알천': 'a powerful veteran general, broad fierce face',
  '계백': 'a grim resolute last-stand general, weathered determined face set for death, dark lamellar armor',
  '의자왕': 'a dignified but careworn late Baekje king, ornate gilt crown, melancholic regal expression',
  '흑치상지': 'a tall powerful loyal general with dark complexion, fierce steadfast face, heavy armor',
  '근초고왕': 'a powerful conquering king at the height of Baekje, ornate gilt-bronze crown, confident commanding gaze',
  '근구수': 'a bold crown-prince warrior, eager fierce youthful-mature face',
  '성왕': 'a cultured noble king, refined gilt crown, wise dignified yet tragic expression',
  '성충': 'a loyal upright scholar-official, earnest grave face',
  '이세민': 'the Tang Emperor Taizong, imperial commanding presence, gilded armor with imperial yellow accents, sharp authoritative gaze',
  '이세적': 'a shrewd veteran Tang strategist-general, calculating composed face',
  '설인귀': 'a fierce Tang general famed for white armor, bold white-clad warrior, intense face',
  '모용수': 'a fierce Xianbei cavalry warlord, braided hair, fur-trimmed armor, wild intense gaze',
};
function buildPrompt(g) {
  const t = archetype(g);
  const extra = NAME_EN[g.name] ? ` Specifically: ${NAME_EN[g.name]}.` : '';
  return `${COMMON}. ${ageEN(g)} man, ${TYPE_EN[t]}.${extra} Faction: ${FAC_EN[g.f] || g.f}; ${FAC_REF[g.f] || ''}. ${NEGATIVE}.`;
}

/* ---------- 이미지 변환 (sharp 있으면 webp 4:5, 없으면 원본 png) ---------- */
async function saveImage(buf, name) {
  fs.mkdirSync(OUTDIR, { recursive: true });
  let sharp = null;
  try { sharp = (await import('sharp')).default; } catch (_) {}
  if (sharp) {
    const out = path.join(OUTDIR, `${name}.webp`);
    await sharp(buf).resize(OUT_W, OUT_H, { fit: 'cover', position: 'top' }).webp({ quality: 82 }).toFile(out);
    return path.relative(ROOT, out);
  } else {
    const out = path.join(OUTDIR, `${name}.png`);
    fs.writeFileSync(out, buf);
    console.warn('  ⚠ sharp 미설치 → png 원본 저장(권장: npm i sharp). 파일:', path.relative(ROOT, out));
    return path.relative(ROOT, out);
  }
}

/* ---------- OpenAI 이미지 생성 ---------- */
async function generate(prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY 환경변수가 없습니다.');
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt, size: SIZE, quality: QUALITY, n: 1 }),
    });
    if (res.ok) {
      const j = await res.json();
      const b64 = j.data?.[0]?.b64_json;
      if (!b64) throw new Error('응답에 이미지 데이터 없음: ' + JSON.stringify(j).slice(0, 200));
      return Buffer.from(b64, 'base64');
    }
    if (res.status === 429 || res.status >= 500) {
      const wait = 2 ** attempt;
      console.warn(`  재시도 ${attempt} (HTTP ${res.status}) ${wait}s 대기...`);
      await new Promise(r => setTimeout(r, wait * 1000));
      continue;
    }
    throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  throw new Error('재시도 초과');
}

/* ---------- index.html의 PORTRAITS 블록 자동 갱신 ---------- */
function registerAll() {
  const files = fs.existsSync(OUTDIR) ? fs.readdirSync(OUTDIR).filter(f => /\.(webp|png|jpg|jpeg)$/i.test(f)) : [];
  const entries = files
    .map(f => ({ name: f.replace(/\.(webp|png|jpg|jpeg)$/i, ''), p: `assets/portraits/${f}` }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const lines = entries.map(e => `  '${e.name}':'${e.p}',`).join('\n');
  const block =
`const PORTRAITS={
  // 자동 생성: tools/gen-portraits.mjs 가 폴더를 스캔해 갱신합니다.
${lines}
};`;
  let html = fs.readFileSync(INDEX, 'utf8');
  const re = /const PORTRAITS=\{[\s\S]*?\n\};/;
  if (!re.test(html)) throw new Error('index.html에서 PORTRAITS 블록을 찾지 못했습니다.');
  html = html.replace(re, block);
  fs.writeFileSync(INDEX, html);
  console.log(`PORTRAITS 등록 완료: ${entries.length}개`);
}

/* ---------- 메인 ---------- */
async function main() {
  if (REGISTER_ONLY) { registerAll(); return; }
  let gens = parseGenerals();
  if (ONLY.length) gens = gens.filter(g => ONLY.includes(g.name));
  console.log(`대상 장수: ${gens.length}명 / 모델 ${MODEL} / 크기 ${SIZE} / 품질 ${QUALITY}${DRY ? ' (DRY-RUN)' : ''}`);

  let made = 0, skipped = 0, failed = 0;
  for (const g of gens) {
    const exists = ['webp', 'png', 'jpg', 'jpeg'].some(e => fs.existsSync(path.join(OUTDIR, `${g.name}.${e}`)));
    if (exists && !FORCE) { skipped++; continue; }
    const prompt = buildPrompt(g);
    if (DRY) { console.log(`- ${g.name} [${archetype(g)}]\n    ${prompt}`); continue; }
    try {
      process.stdout.write(`生成 ${g.name} ... `);
      const buf = await generate(prompt);
      const rel = await saveImage(buf, g.name);
      console.log('✓ ' + rel);
      made++;
    } catch (e) {
      console.log('✗ ' + e.message);
      failed++;
    }
  }
  if (!DRY) {
    registerAll();
    console.log(`\n완료 — 생성 ${made}, 건너뜀 ${skipped}, 실패 ${failed}`);
  }
}
export { parseGenerals, buildPrompt, archetype, ageEN, COMMON };

// 직접 실행될 때만 메인 동작 (import 시에는 함수만 제공)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e); process.exit(1); });
}
