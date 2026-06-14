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
 *   node tools/gen-portraits.mjs --organize        # 기존 평면 이미지를 세력별 폴더로 이동 + 재등록
 *   (생성 시에도 assets/portraits/<세력>/ 하위 폴더에 자동 분류 저장)
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
const ORGANIZE = has('--organize');   // 기존 평면 파일을 세력별 폴더로 이동
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
const COMMON = `A bust portrait of an ancient East-Asian Three-Kingdoms-era figure in the style of Koei's Romance of the Three Kingdoms general portraits, semi-realistic digital painting, head, shoulders and upper chest, three-quarter view, dramatic rim lighting, in a commanding heroic pose, highly detailed painterly brushwork, 4:5 aspect ratio, single character, no text, no watermark, no border`;
const TYPE_EN = {
  '왕': 'wearing a golden crown and royal robe, regal calm dignified expression, one hand resting on a sheathed sword',
  '태자': 'a young prince with a light golden circlet',
  '책사': 'a scholar wearing a headband and robe, holding a folding fan or a bamboo scroll',
  '맹장': 'in heavy lamellar armor with a horned helmet and red plume',
  '장수': 'in lamellar armor and a plumed helmet',
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
/* 세력별 의상·망토·배경 — 전원 동일(빨간 망토/호박 배경) 방지, 세력 정체성 부여 */
const FAC_NAME = {
  goguryeo: 'Goguryeo', baekje: 'Baekje', silla: 'Silla', gaya: 'Gaya',
  china: 'a Chinese dynasty (Former Yan / Later Yan / Northern Qi / Tang)', wa: 'Wa / Yamato Japan',
};
const FAC_STYLE = {
  goguryeo: 'Costume: authentic Goguryeo lamellar armor EXACTLY like the reference set — a suit of many small vertical iron/steel plates laced tightly together with visible deep-red cords, polished silver-grey metal with crimson-red lacing and trim, broad lamellar shoulder guards and a lamellar skirt, round gilded lion-mask bosses on the chest and a gold lion-head belt buckle; head is EITHER a pointed iron helmet with a gilded wing-and-lion crest and a tall red-and-black horsehair plume plus a lamellar neck-and-cheek guard, OR a bare warrior head with hair tied in a topknot; a deep crimson cloak fastened with gold lion clasps; steel-grey and crimson color scheme with a few gold accents, NEVER blue; dark amber-to-charcoal gradient background',
  baekje: 'Costume: elegant Baekje attire — gilt-bronze ornamented scale armor over refined silk robes in jade-green and gold, delicate gilt-bronze cap or crown ornaments with openwork flame motifs (Baekje incense-burner style), a soft green or gold silk sash instead of a red cape; warm jade-green to gold gradient background',
  silla: 'Costume: ornate Silla regalia — gilded armor heavy with gold ornaments and comma-shaped jade gogok beads, a gold openwork crown or gold-trimmed cap, a crimson-and-gold cape; rich warm gold to deep amber gradient background',
  gaya: 'Costume: utilitarian Gaya ironwork — dark riveted iron plate armor (pan-gap) and a riveted iron helmet, plain leather straps, muted purple or natural cloth accents, little or no cape; cool slate-grey to steel gradient background',
  wa: 'Costume: Kofun-period Yamato armor — riveted iron keiko cuirass, a visored shokakutsuki helmet with a neck guard, white-and-red cord lacing, a plain white mantle; pale stone-grey to soft white gradient background',
};
/* 중국은 인물(시대)별로 의상이 크게 다름 — 한국 세력과 확연히 구분 */
function chinaStyle(g) {
  if (/^모용|^풍발/.test(g.name)) return 'Costume: a Xianbei Former/Later Yan steppe warlord — fur-trimmed lamellar armor, braided hair under a fur-rimmed cap or a pointed nomadic helmet, leather and fur garments, distinctly non-Korean nomadic look; cold dark steppe-blue to charcoal gradient background';
  if (/^고양|^곡율광/.test(g.name)) return 'Costume: a Northern Qi era general — heavy northern lamellar armor with rounded pauldrons and a tall ridged helmet, sober dark robes; dark slate and bronze gradient background';
  return 'Costume: a Tang-dynasty general — gilded Mingguang plate armor with two large round polished mirror discs on the chest, beast-head shoulder pauldrons, wide-sleeved court robes, a Tang helmet with an upturned wing crest, distinctly Chinese imperial look; deep black, vermilion and gold, dark crimson gradient background';
}
/* 표정·수염 다양화(인물명 결정론적) — 묘사가 이미 있으면 건너뜀 */
const FACE_VAR = ['with a thick full beard', 'with a long flowing beard', 'with a short pointed beard', 'with a stern mustache and goatee', 'clean-shaven with sharp angular features', 'with a weathered battle-scarred face', 'with a braided beard', 'with a broad rugged face'];
const MOOD_VAR = ['a fierce battle-hardened glare', 'a calm composed gaze', 'a proud confident look', 'a grim resolute expression', 'a shrewd watchful gaze', 'a bold defiant stare', 'a stern commanding frown', 'an intense piercing stare'];
function pick(arr, g, salt) { let h = salt >>> 0; for (const c of g.name) h = (h * 31 + c.charCodeAt(0)) >>> 0; return arr[h % arr.length]; }
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
  const named = NAME_EN[g.name];
  let subj = named || `${ageEN(g)} man, ${TYPE_EN[t]}`;   // 영웅별 고증 묘사가 있으면 그것이 주 묘사
  // 표정·수염 다양화: 개별 묘사가 없는 비왕 장수에만 부여(전원 동일 표정 방지)
  if (!named && t !== '왕') subj += `, ${pick(FACE_VAR, g, 7)}, ${pick(MOOD_VAR, g, 13)}`;
  // 무기 다양화: 무기 언급이 없고 왕이 아니면 부여(책사는 지정된 경우만)
  const hasWeapon = /\b(sword|swords|spear|glaive|saber|bow|halberd|dao|fan|scroll|axe|blade|polearm|broadsword|weapon)\b/i.test(subj);
  if (!hasWeapon && t !== '왕') {
    const w = NAMED_WEAPON[g.name] || (t === '책사' ? null : `gripping ${weaponFor(g)}`);
    if (w) subj += `, ${w}`;
  }
  const style = g.f === 'china' ? chinaStyle(g) : (FAC_STYLE[g.f] || '');
  return `${COMMON}. Subject: ${subj}. ${style}. Faction: ${FAC_NAME[g.f] || g.f}; ${FAC_REF[g.f] || ''}. ${NEGATIVE}.`;
}

/* ---------- 세력 폴더 분류 유틸 ---------- */
function facOf(name) {   // 인물 → 세력 폴더명(goguryeo/baekje/...)
  if (!facOf._m) { facOf._m = {}; parseGenerals().forEach(g => { facOf._m[g.name] = g.f; }); }
  return facOf._m[name] || '_misc';
}
function walkImages(dir) {   // 하위폴더 포함 이미지 재귀 수집
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkImages(fp));
    else if (/\.(webp|png|jpg|jpeg)$/i.test(ent.name)) out.push(fp);
  }
  return out;
}
function findExisting(name) {   // 세력폴더·평면 어디에 있든 기존 파일 탐지
  for (const dir of [path.join(OUTDIR, facOf(name)), OUTDIR])
    for (const e of ['webp', 'png', 'jpg', 'jpeg']) {
      const fp = path.join(dir, `${name}.${e}`);
      if (fs.existsSync(fp)) return fp;
    }
  return null;
}

/* ---------- 이미지 변환 (sharp 있으면 webp 4:5, 없으면 원본 png) — 세력 폴더에 저장 ---------- */
async function saveImage(buf, name) {
  const dir = path.join(OUTDIR, facOf(name));
  fs.mkdirSync(dir, { recursive: true });
  let sharp = null;
  try { sharp = (await import('sharp')).default; } catch (_) {}
  if (sharp) {
    const out = path.join(dir, `${name}.webp`);
    await sharp(buf).resize(OUT_W, OUT_H, { fit: 'cover', position: 'top' }).webp({ quality: 82 }).toFile(out);
    return path.relative(ROOT, out);
  } else {
    const out = path.join(dir, `${name}.png`);
    fs.writeFileSync(out, buf);
    console.warn('  ⚠ sharp 미설치 → png 원본 저장(권장: npm i sharp). 파일:', path.relative(ROOT, out));
    return path.relative(ROOT, out);
  }
}
/* 기존 평면 파일을 세력별 폴더로 이동 */
function organize() {
  const items = fs.existsSync(OUTDIR) ? fs.readdirSync(OUTDIR, { withFileTypes: true }) : [];
  let moved = 0;
  for (const ent of items) {
    if (!ent.isFile() || !/\.(webp|png|jpg|jpeg)$/i.test(ent.name)) continue;
    const name = ent.name.replace(/\.(webp|png|jpg|jpeg)$/i, '');
    const fac = facOf(name);
    if (fac === '_misc') { console.warn('  ? 세력 불명 → 유지:', ent.name); continue; }
    const dir = path.join(OUTDIR, fac);
    fs.mkdirSync(dir, { recursive: true });
    fs.renameSync(path.join(OUTDIR, ent.name), path.join(dir, ent.name));
    console.log(`  ${ent.name} → ${fac}/`);
    moved++;
  }
  console.log(`세력별 정리 완료: ${moved}개 이동`);
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
  const files = walkImages(OUTDIR);   // 세력 하위폴더까지 재귀 스캔
  const seen = {};
  files.forEach(fp => {
    const name = path.basename(fp).replace(/\.(webp|png|jpg|jpeg)$/i, '');
    const p = path.relative(ROOT, fp).split(path.sep).join('/');
    if (!seen[name] || /\.webp$/i.test(p)) seen[name] = { name, p };   // 같은 이름이면 webp 우선
  });
  const entries = Object.values(seen).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
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
  if (ORGANIZE) { organize(); registerAll(); return; }
  if (REGISTER_ONLY) { registerAll(); return; }
  let gens = parseGenerals();
  if (ONLY.length) gens = gens.filter(g => ONLY.includes(g.name));
  console.log(`대상 장수: ${gens.length}명 / 모델 ${MODEL} / 크기 ${SIZE} / 품질 ${QUALITY}${DRY ? ' (DRY-RUN)' : ''}`);

  let made = 0, skipped = 0, failed = 0;
  for (const g of gens) {
    const exists = findExisting(g.name);
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
