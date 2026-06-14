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
const COMMON = `A bust portrait of an ancient Korean Three-Kingdoms-era figure in the style of Koei's Romance of the Three Kingdoms general portraits, semi-realistic digital painting, head, shoulders and armored upper chest, three-quarter view, dramatic rim lighting, warm amber-to-dark-gold gradient background, lamellar plate armor with leather straps and metal studs, fur shoulder mantle and a flowing crimson cape, in a commanding heroic pose, highly detailed painterly brushwork, 4:5 aspect ratio, single character, no text, no watermark, no border`;
const TYPE_EN = {
  '왕': 'wearing a golden crown and royal robe, regal calm dignified expression, one hand resting on a sheathed sword',
  '태자': 'a young prince with a light golden circlet, noble refined look',
  '책사': 'a scholar wearing a headband and robe, calm wise expression, holding a folding fan or a bamboo scroll',
  '맹장': 'in heavy lamellar armor with a horned helmet and red plume, fierce intense expression',
  '장수': 'in lamellar armor and a plumed helmet, steady confident expression',
};
/* 무기 다양화: 묘사에 무기가 없으면 인물명 기반 결정론적으로 배정(전원 창 방지) */
const WEAPONS = [
  'a long straight double-edged sword',
  'a curved single-edged saber',
  'a long-handled glaive (woldo)',
  'a heavy halberd (geuk)',
  'a recurve bow with a quiver of arrows',
  'a long war spear',
  'a ring-pommel broadsword (hwandudaedo)',
  'a long-handled crescent-blade polearm',
];
const NAMED_WEAPON = {
  '양만춘': 'drawing a powerful recurve bow',
  '설인귀': 'wielding a long halberd',
  '온달': 'shouldering a massive iron sword',
  '계백': 'gripping a long curved glaive',
  '김유신': 'holding a long straight sword',
  '흑치상지': 'gripping a long-handled glaive',
  '관창': 'holding a slender light sword',
  '사다함': 'holding a slender sword',
  '을지문덕': 'one hand resting on a sheathed sword',
  '모용수': 'gripping a cavalry saber',
  '이세민': 'holding a recurve bow',
};
function weaponFor(g) { let h = 0; for (const c of g.name) h = (h * 31 + c.charCodeAt(0)) >>> 0; return WEAPONS[h % WEAPONS.length]; }
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
const FAC_EN = { goguryeo: 'Goguryeo (polished silver-steel iron armor with deep crimson-red cloth accents and gold trim)', baekje: 'Baekje (green/gold)', silla: 'Silla (crimson/gold)', gaya: 'Gaya (purple/gold)', china: 'a Chinese northern/Tang-era dynasty (gray/black with imperial accents)', wa: 'Wa/Yamato (white/red)' };
/* 세력별 고증 참조 — 실제 공개 유물·고분벽화 기반(저작권 무관) */
const FAC_REF = {
  goguryeo: 'historically grounded in a real Goguryeo gaemamusa (heavy cavalry) armor reconstruction: a full suit of polished silvery iron lamellar made of hundreds of small overlapping rectangular steel scales laced together with cords, deep red cloth lining and trim at the collar, sleeves and hem, broad lamellar shoulder guards and a knee-length skirt of iron scales, exactly like the displayed museum reconstruction of Goguryeo warrior armor, as also seen in Anak Tomb No.3 and Muyongchong tomb murals',
  baekje: 'historically grounded in Baekje: refined gilt-bronze crown ornaments from the Tomb of King Muryeong, motifs of the Baekje gilt-bronze incense burner, elegant courtly attire',
  silla: 'historically grounded in Silla: ornate gold crown with comma-shaped jade (gogok) from Cheonmachong/Hwangnam Daechong, gold ornaments and belt',
  gaya: 'historically grounded in Gaya: iron plate armor (pan-gap) and iron helmet, ingot-iron warrior aesthetic',
  china: 'historically grounded in Chinese Northern-dynasty to Tang-era cavalry armor (era-appropriate: Yan/Northern Qi/Tang)',
  wa: 'historically grounded in Kofun-period Yamato armor and attire',
};
const NEGATIVE = 'period-accurate ancient costume, do NOT resemble any modern actor, TV drama still, or existing copyrighted artwork; original imagined face';
/* 세력별 갑옷 강제 지정 — 정의된 세력만 적용(나머지는 COMMON 그대로) */
const FAC_ARMOR = {
  goguryeo: 'CRITICAL armor styling for every Goguryeo character — render the armor exactly like the iconic Goguryeo gaemamusa reconstruction: a full suit of polished silvery iron lamellar made of hundreds of small overlapping rectangular steel scales laced with visible cords, with deep crimson-red cloth trim and lining at the collar, sleeve openings and hem, broad lamellar shoulder guards and a knee-length skirt of iron scales; a tall pointed segmented iron helmet crowned with an upright bright-red horsehair plume and fitted with lamellar neck-guard and cheek-flaps; the overall color scheme is steel-grey metallic iron with crimson-red accents and a few gold rivets — the armor is iron and silver, never blue',
};
/* 주요 영웅 맞춤 묘사 — 인물별 나이·기질·외형 특색(고증/설화 기반) */
const NAME_EN = {
  // 고구려
  '광개토대왕': 'a Goguryeo conquering king in his early 30s, broad-shouldered, fierce determined gaze, ornate gold crown over a pointed iron helmet with an upright red plume, a full suit of silvery iron lamellar scale armor with deep red trim and a crimson cape',
  '고국원왕': 'a careworn middle-aged Goguryeo king, grave resolute bearded face, gold crown and lamellar armor',
  '소수림왕': 'a middle-aged scholarly Goguryeo king, calm reform-minded dignity, gold crown and royal robe',
  '장수왕': 'an elderly long-reigning Goguryeo king with a long white beard, serene authoritative gaze, gold crown and royal robe',
  '연개소문': 'a powerful imperious Goguryeo warlord in his prime, thick black beard, five swords at his belt, intense commanding stare, heavy lamellar armor',
  '양만춘': 'a weathered veteran Goguryeo fortress commander, battle-scarred calm resolute face, sturdy lamellar armor and a plumed helmet',
  '온달': 'a rugged powerful Goguryeo warrior of humble origin, honest strong square-jawed face, simple lamellar armor',
  '을지문덕': 'a wise elder Goguryeo strategist-general with a long beard, piercing calm eyes, a scholar-general robe over lamellar armor',
  '고연수': 'a stern middle-aged Goguryeo field commander, scale armor and a plumed helmet',
  '고무': 'a stalwart Goguryeo veteran general, broad weathered face, lamellar armor and a plumed helmet',
  '모두루': 'a loyal Goguryeo frontier general, stern bearded face, scale armor',
  // 신라
  '김유신': 'a dignified Silla general in his prime of Gaya royal descent, commanding presence, gold-trimmed lamellar armor and a plumed helmet',
  '김춘추': 'a sharp-eyed refined Silla statesman-diplomat, the future King Muyeol, elegant court robe with gold ornaments, shrewd composed expression',
  '진흥왕': 'an ambitious Silla king, ornate gold crown with comma-shaped jade gogok, confident expansionist gaze, royal robe',
  '내물왕': 'an early Silla king (Maripgan) in a royal robe with early gold ornaments, steady dignified bearded face',
  '눌지': 'a resolute early Silla king, firm face, royal robe with gold ornaments',
  '박제상': 'a loyal devoted Silla official, earnest solemn face, plain court robe',
  '이사부': 'a seasoned veteran Silla commander, stern weathered face, scale armor and a plumed helmet',
  '거칠부': 'a scholarly veteran Silla statesman-general, calm wise bearded face, court robe over light armor',
  '사다함': 'a strikingly handsome young Silla hwarang warrior, brave noble youthful face, light ornamented armor with a floral hwarang crest',
  '관창': 'a very young Silla hwarang boy-warrior, delicate but brave determined face, light armor',
  '알천': 'a powerful veteran Silla general, broad fierce bearded face, lamellar armor',
  '죽지': 'a capable Silla field general, steady confident face, lamellar armor and a plumed helmet',
  '김인문': 'a refined Silla prince-general, intelligent composed face, gold-trimmed armor',
  // 백제
  '근초고왕': 'a powerful conquering Baekje king at the height of Baekje power, ornate gilt-bronze crown ornaments, confident commanding gaze, royal robe',
  '근구수': 'a bold Baekje crown-prince warrior, eager fierce face, lamellar armor and a plumed helmet',
  '아신왕': 'a proud but hard-pressed Baekje king, tense determined face, gilt-bronze crown and royal robe',
  '성왕': 'a cultured noble Baekje king, refined gilt-bronze crown, wise dignified yet tragic expression, royal robe',
  '위덕왕': 'a stern Baekje king hardened by war, grave face, gilt crown and royal robe',
  '의자왕': 'a dignified but careworn late Baekje king, ornate gilt-bronze crown, melancholic regal expression, royal robe',
  '계백': 'a grim resolute Baekje last-stand general, weathered face set for death, dark lamellar armor and a horned helmet',
  '흑치상지': 'a tall powerful loyal Baekje general with a dark complexion, fierce steadfast face, heavy lamellar armor',
  '성충': 'a loyal upright Baekje scholar-official, earnest grave bearded face, court robe',
  '윤충': 'a fierce Baekje field general, hard determined face, lamellar armor and a helmet',
  // 중국(전연/후연/북제/당)
  '이세민': 'Tang Emperor Taizong in his prime, imperial commanding presence, gilded lamellar armor with imperial-yellow accents, sharp authoritative gaze',
  '이세적': 'a shrewd veteran Tang general-strategist, calculating composed bearded face, Tang lamellar armor',
  '설인귀': 'a fierce Tang general famed for white armor, bold intense face, white lamellar armor and helmet',
  '모용수': 'a fierce Xianbei Former-Yan cavalry warlord, braided hair, fur-trimmed lamellar armor, wild intense gaze',
  '모용성': 'a Xianbei royal general, proud hard face, fur-trimmed lamellar armor',
  // 왜
  '오토모': 'a Wa Yamato Kofun-era chieftain-warrior, stern face, keiko lamellar armor and a visored helmet',
  '소가': 'a powerful Wa Yamato noble-general, composed shrewd face, Kofun-era armor',
};
function buildPrompt(g) {
  const t = archetype(g);
  let subj = NAME_EN[g.name] || `${ageEN(g)} man, ${TYPE_EN[t]}`;   // 영웅별 고증 묘사가 있으면 그것이 주 묘사(나이·복식 충돌 제거)
  // 무기 다양화: 이미 무기 언급이 없고 왕이 아니면 무기 부여(책사는 지정된 경우만)
  const hasWeapon = /\b(sword|swords|spear|glaive|saber|bow|halberd|dao|fan|scroll|axe|blade|polearm|broadsword|weapon)\b/i.test(subj);
  if (!hasWeapon && t !== '왕') {
    const w = NAMED_WEAPON[g.name] || (t === '책사' ? null : `gripping ${weaponFor(g)}`);
    if (w) subj += `, ${w}`;
  }
  return `${COMMON}. ${subj}. Faction: ${FAC_EN[g.f] || g.f}; ${FAC_REF[g.f] || ''}. ${FAC_ARMOR[g.f] ? FAC_ARMOR[g.f] + '. ' : ''}${NEGATIVE}.`;
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
