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
 *   레퍼런스 기반 생성: assets/refs/<세력>/ 에 이미지를 넣으면 그 갑옷·복식을 참조(edits)해 생성.
 *   세력별 의상 기준 문서: FACTION_COSTUME.md
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
const REFDIR = path.join(ROOT, 'assets', 'refs');   // 세력별 레퍼런스 이미지(assets/refs/<세력>/)

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
/* 특정 인물 나이 보정(역사 반영) — NAME_EN이 없는 인물에 적용. 형용구만(뒤에 'man'이 붙음) */
const AGE_EN = {
  '전지왕': 'a youthful, late-twenties',
  '근구수': 'a vigorous, young',
  '월광태자': 'a young',
};
function ageEN(g) {
  if (AGE_EN[g.name]) return AGE_EN[g.name];
  if (/관창|사다함/.test(g.name)) return 'a teenage';
  return 'a young';   // 전원 청년 기본
}
/* 개별 묘사의 노년·백발·노련 표현을 청년화 */
function youthify(s) {
  return s
    .replace(/\bmiddle-aged to elderly\b/gi, 'young')
    .replace(/\belderly\b/gi, 'young').replace(/\ban elder\b/gi, 'a young').replace(/\belder\b/gi, 'young')
    .replace(/\baging\b/gi, 'young').replace(/\baged\b/gi, 'young').replace(/\bmiddle-aged\b/gi, 'young')
    .replace(/\bveteran\b/gi, '').replace(/\bweathered\b/gi, 'smooth youthful').replace(/\bbattle-scarred\b/gi, 'youthful')
    .replace(/\bseasoned\b/gi, 'spirited').replace(/\bcareworn\b/gi, 'resolute')
    .replace(/\blong white beard\b/gi, 'a clean youthful face').replace(/\bwhite beard\b/gi, 'a short beard')
    .replace(/\blong beard\b/gi, 'a short beard').replace(/\b(grey|gray)-bearded\b/gi, 'youthful')
    .replace(/\bwrinkl\w*/gi, 'smooth');
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
/* 장군·관리용 의상(투구·갑옷 — 절대 왕관 없음) */
const FAC_STYLE = {
  goguryeo: 'Costume: authentic Goguryeo lamellar armor EXACTLY like the reference set — a suit of many small vertical iron/steel plates laced tightly together with visible deep-red cords, polished silver-grey metal with crimson-red lacing and trim, broad lamellar shoulder guards and a lamellar skirt, round gilded lion-mask bosses on the chest and a gold lion-head belt buckle; head is EITHER a pointed iron WAR HELMET with a gilded wing-and-lion crest and a tall red-and-black horsehair plume plus a lamellar neck-and-cheek guard, OR a bare warrior head with hair tied in a topknot (NEVER a royal crown); a deep crimson cloak fastened with gold lion clasps; steel-grey and crimson color scheme with a few gold accents, NEVER blue',
  baekje: 'Costume: Baekje officer attire — iron lamellar scale armor (chal-gap, similar to Goguryeo) worn over jade-green and gold silk, an iron war helmet or a cloth headband, gilt-bronze fittings (NO royal crown); a green or gold silk sash rather than a red cape; warm jade-green to gold gradient background',
  silla: 'Costume: Silla officer armor — an iron vertical-plate cuirass (jongjang pan-gap) or iron lamellar with gold-trimmed fittings, an iron war helmet, and a gold belt (NO royal crown); a crimson-and-gold cape; rich warm gold to deep amber gradient background',
  gaya: 'Costume: Gaya ironwork — a vertical-plate iron cuirass (jongjang pan-gap) of large riveted iron plates and an iron war helmet (vertical-plate jongjang pan-ju or a brimmed chayang-ju), plain leather lacing, muted purple or natural cloth accents, little or no cape (NO royal crown); an armored warhorse (ma-gap) for cavalry; cool slate-grey to steel gradient background',
  wa: 'Costume: Kofun-period Yamato armor — riveted iron keiko cuirass, a visored shokakutsuki war helmet with a neck guard, white-and-red cord lacing, a plain white mantle (NO royal crown); pale stone-grey to soft white gradient background',
};
/* 왕·태자(군주)용 의상 — 관·곤룡포 */
const ROYAL_STYLE = {
  goguryeo: 'Costume: Goguryeo royal regalia — a tall gold crown with a feathered jeolpung cap and openwork ornaments worn over silk royal robes, lamellar armor with crimson-red lacing beneath, a deep crimson royal cloak; gold-and-crimson, NEVER blue',
  baekje: 'Costume: Baekje royal regalia — gilt-bronze openwork crown ornaments (flame-and-honeysuckle motif, incense-burner style) worn over fine jade-green and gold silk royal robes, refined and cultured; gold-and-jade',
  silla: 'Costume: Silla royal regalia — a gold openwork crown with branching chulja-form uprights hung with comma-shaped jade gogok, a gold belt with pendants, worn over crimson-and-gold royal robes; warm gold to amber background',
  gaya: 'Costume: Gaya royal regalia — a gold-and-iron circlet crown over fine robes with iron-kingdom motifs, restrained and dignified',
  wa: 'Costume: Yamato royal regalia — a jeweled circlet or cap with magatama beads worn over fine white-and-red robes',
};
/* 책사(전략가·문관)용 의상 — 도포·관모·부채/두루마리, 갑옷·왕관 아님 */
const SCHOLAR_STYLE = {
  goguryeo: "Costume: a Goguryeo scholar-strategist — a fine dark silk robe with crimson-and-gold trim and a scholar's headband or soft official cap, at most light lamellar shoulder pieces, holding a folding fan or a bamboo scroll, wise and composed (NO heavy armor, NO crown)",
  baekje: "Costume: a Baekje scholar-official — refined jade-green and gold silk robes and a scholar's cap, holding a folding fan or a bamboo scroll, elegant and learned (NO heavy armor, NO crown)",
  silla: "Costume: a Silla scholar-strategist — gold-trimmed silk robes and a scholar's headband, holding a folding fan or a scroll, composed and shrewd (NO heavy armor, NO crown)",
  gaya: "Costume: a Gaya elder-strategist — plain dark robes with muted accents and a soft cap, holding a bamboo scroll (NO heavy armor, NO crown)",
  wa: "Costume: a Yamato court strategist — white-and-red robes and a soft cap, holding a scroll (NO heavy armor, NO crown)",
};
/* 직접 업로드할 인물 — 자동 생성에서 제외 */
const SKIP = ['광개토대왕', '고거련', '양만춘', '연개소문'];
/* 이름에 '왕'이 없지만 군주(왕/마립간) — 왕 의상 적용 */
const ROYAL_NAMES = new Set(['눌지', '실성', '근구수']);
function isRoyalG(g) { return (/왕/.test(g.name) && !/태자/.test(g.name)) || /태자/.test(g.name) || ROYAL_NAMES.has(g.name); }
/* 역사 장면 배경 — 단색 배경 대신 그 인물의 사실/설화를 반영한 배경(고구려 우선) */
const FAC_SCENE = {
  goguryeo: 'a Goguryeo stone fortress rampart or a war-banner-filled battlefield under a dramatic sky',
  baekje: 'a refined Baekje palace court or a riverside fortress with golden banners',
  silla: 'a Silla fortress or a gold-bannered battlefield under a clear sky',
  gaya: 'an iron-kingdom Gaya fortress or a forge-lit battlefield with iron banners',
  china: 'a vast imperial Chinese battlefield with massed banners and siege works',
  wa: 'a Yamato seashore with warships and Wa banners',
};
const SCENE_EN = {
  '온달': "on a windswept battlefield beside his own upright wooden war-coffin, shouting toward the coffin with grief and resolve, war banners behind — depicting the legend that Ondal's coffin would not move from the battlefield",
  '소수림왕': 'fighting on the ramparts of a Goguryeo stone fortress, sword raised amid defenders and war banners',
  '고국원왕': 'on the embattled ramparts of Pyeongyang fortress at dusk, an arrow striking him, grave and defiant amid fire and smoke',
  '고연수': 'leading the Goguryeo relief host on the open field before Ansi fortress, a vast army and banners arrayed behind',
  '고혜진': 'on the field before Ansi fortress with the Goguryeo army arrayed behind under a grey sky',
  '고무': 'a veteran commander standing atop a Liaodong fortress wall, surveying the coming battle',
  '모두루': 'guarding a lonely northern frontier fortress on the Buyeo border, banners snapping in the cold wind',
  '양원왕': 'on the walls of the royal capital directing the defense, banners and soldiers behind',
  '고흘': 'on a Goguryeo fortress rampart amid the clamor of battle',
  // 백제
  '근초고왕': 'King Geunchogo at the height of Baekje power, reviewing a great army with golden Baekje banners, majestic and commanding, before a prosperous fortress capital',
  '근구수': 'crown-prince Geungusu leading Baekje troops to a fierce victory over Goguryeo by a northern river, bold and eager',
  '전지왕': "King Jeonji, once a hostage prince in Wa, returning by ship across the sea to claim the Baekje throne after his father's death, standing at the ship's prow with Baekje banners and the sea behind",
  '아신왕': 'King Asin of Baekje, hard-pressed but defiant on his ramparts as Goguryeo heavy cavalry presses the attack, tense and grim',
  '성왕': 'cultured King Seong of Baekje planning the move to the new capital Sabi, dignified and refined, with palace and the Geum river behind, a faint air of coming tragedy',
  '위덕왕': 'King Wideok of Baekje, hardened and grave after the war with Silla, standing resolute among war banners',
  '의자왕': 'King Uija in his Sabi palace at the twilight of Baekje, once brilliant now careworn and melancholic, fading lamplight',
  '계백': 'General Gyebaek making his last stand at Hwangsanbeol with his five thousand decisive-death warriors against the vast Silla host, grim and resolute, broken banners',
  '흑치상지': 'General Heukchi Sangji raising the Baekje restoration army from Imjon fortress, tall and defiant, rallying soldiers',
  '성충': 'the loyal official Seongchung gravely remonstrating, gaunt from imprisonment yet earnest, candle and scroll',
  '고흥': 'the scholar Goheung compiling the Seogi, the Baekje national history, with brush and bamboo scrolls in a quiet study',
  '윤충': 'General Yunchung storming Daeya fortress to seize it from Silla, fierce amid the assault',
  '막고해': 'a seasoned Baekje general counseling restraint after victory (knowing-contentment), composed and wise on the field',
  '진무': 'General Jinmu leading a hard campaign against Goguryeo across a northern river, determined',
  // 신라
  '내물왕': 'King Naemul, first of the Kim Maripgan line, receiving Goguryeo aid to drive off Wa raiders, dignified',
  '눌지': 'King Nulji of Silla consolidating the realm, grave after the loss of his brothers held hostage abroad',
  '실성': 'King Silseong of early Silla on his throne, wary and stern',
  '박제상': 'the loyal Bak Jesang defiant before his Wa captors, refusing to betray Silla, on a windswept shore before his martyrdom',
  '김무력': 'General Kim Muryeok victorious at Gwansan fortress where the Baekje King Seong fell, planting Silla banners',
  '진흥왕': 'King Jinheung erecting a tall stone sunsubi monument on a windswept peak, surveying his vastly expanded realm',
  '이사부': 'General Isabu subduing the island of Usanguk, fearsome wooden lions mounted on his warships at sea',
  '거칠부': 'the scholar-general Geochilbu compiling the Silla national history with brush and scrolls',
  '사다함': 'the young hwarang Sadaham first to break through the gates of Daegaya, brave and noble',
  '김인문': 'prince Kim Inmun as a refined envoy at the Tang court, composed diplomat',
  '죽지': 'General Jukji of Silla on campaign amid banners',
  '김유신': 'General Kim Yusin rallying the Silla army at Hwangsanbeol, commanding and resolute',
  '관창': 'the boy-hwarang Gwanchang charging alone into the Baekje camp at Hwangsanbeol, brave unto death',
  '알천': 'the veteran general Alcheon, powerful and stern, leader of the Hwabaek council',
  // 가야
  '거질미왕': 'King Geojilmi of Geumgwan Gaya in his iron kingdom, surrounded by ironwork and forges',
  '하지왕': 'King Haji of Daegaya dispatching an envoy to Southern Qi across the sea, dignified',
  '이시품왕': 'King Isipum of Geumgwan Gaya facing the overwhelming Goguryeo southern campaign, grim',
  '우륵': 'the master musician Ureuk playing the gayageum he created, composing in melancholy as Gaya wanes',
  '도설지왕': 'the last King Doseolji of Daegaya as his kingdom falls to Silla, somber and dignified',
  '월광태자': 'crown prince Wolgwang of Daegaya, melancholy heir of a fading kingdom',
  // 중국
  '모용수': 'the warlord Murong Chui founding Later Yan, fierce Xianbei heavy cavalry charging behind',
  '모용평': 'the Former Yan regent Murong Ping at court, shrewd and proud',
  '모용희': 'the Later Yan emperor Murong Xi, imperious and volatile, before his palace',
  '모용성': 'the Later Yan emperor Murong Sheng on campaign, hard-faced',
  '풍발': 'Feng Ba founding Northern Yan, steady and resolute',
  '고양': 'Gao Yang founding the Northern Qi dynasty, enthroned in imperial black and gold',
  '곡율광': 'the Northern Qi general Hulu Guang, a master archer, drawing his great bow on the battlefield',
  '장량': 'the Tang general Zhang Liang leading the naval crossing of the sea to assault Liaodong',
  '이도종': 'the Tang prince-general Li Daozong directing the Goguryeo campaign from horseback',
  '이세민': 'Emperor Taizong of Tang personally leading the vast Tang host across the Liao river against Goguryeo, imperial and commanding',
  '이세적': 'the Tang general Li Shiji directing the great siege of a Goguryeo fortress, calculating',
  '설인귀': 'the Tang general Xue Rengui in white armor storming the ramparts, drawing his bow, fearless',
  // 왜
  '오토모': 'a Wa Otomo clan warrior-chieftain leading armored warriors aboard ships off the coast',
  '사데히코': 'Otomo no Sadehiko leading the Wa expedition across the sea toward the Korean peninsula',
  '소가': 'the powerful Soga clan noble dominating the Yamato court, shrewd and composed',
  '오노': 'a Wa Yamato general arrayed for battle with keiko-armored troops',
  '고토쿠': 'Emperor Kotoku of Yamato proclaiming the Taika reforms before his assembled court',
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
const NO_WEAPON_POSE = ['standing in a confident commanding pose with arms crossed', 'in a calm dignified stance with hands clasped behind the back', 'arms relaxed at his sides in a steady commanding stance', 'in a composed dignified bust pose, empty-handed'];
function buildPrompt(g) {
  const t = archetype(g);
  const royal = isRoyalG(g);
  const scholar = (t === '책사') && !royal;
  const named = NAME_EN[g.name];
  let subj = named || `${ageEN(g)} man, ${TYPE_EN[t]}`;   // 영웅별 고증 묘사가 있으면 그것이 주 묘사
  // 표정·수염 다양화: 개별 묘사가 없는 비왕 장수에만 부여(전원 동일 표정 방지)
  if (!named && !royal) subj += `, ${pick(FACE_VAR, g, 7)}, ${pick(MOOD_VAR, g, 13)}`;
  // 무기: 필수 아님 — 책사·왕 제외, 약 60%만 무기, 나머지는 무기 없는 자세
  const hasWeapon = /\b(sword|swords|spear|glaive|saber|bow|halberd|dao|fan|scroll|axe|blade|polearm|broadsword|weapon)\b/i.test(subj);
  if (!hasWeapon && !royal && !scholar) {
    if (NAMED_WEAPON[g.name]) subj += `, ${NAMED_WEAPON[g.name]}`;
    else if (pick([0, 1, 2, 3, 4], g, 23) < 2) subj += `, gripping ${weaponFor(g)}`;   // 약 40%만 무기
    else subj += `, ${pick(NO_WEAPON_POSE, g, 31)}`;
  }
  const style = g.f === 'china' ? chinaStyle(g)
    : royal ? (ROYAL_STYLE[g.f] || FAC_STYLE[g.f] || '')
    : scholar ? (SCHOLAR_STYLE[g.f] || FAC_STYLE[g.f] || '')
    : (FAC_STYLE[g.f] || '');
  // 신분 명시(왕/책사/장군 구분)
  const rank = g.f === 'china' ? '' : royal
    ? ' This figure is a KING/monarch: an era-appropriate gold or gilt-bronze crown and Three-Kingdoms-period silk robes, regal and dignified — NOT a later Goryeo/Joseon Chinese-style dragon robe (gonryongpo), no dragon emblems.'
    : scholar
    ? ' This figure is a civil strategist/advisor, NOT a king and NOT a heavy-armored soldier: scholarly robes and a soft cap, holding a fan or scroll, no crown.'
    : ' This figure is a military general/officer, NOT a king: a war helmet (or warrior topknot) and battle armor, absolutely no royal crown.';
  const scene = SCENE_EN[g.name] || FAC_SCENE[g.f] || null;   // 전 세력 역사 장면 반영
  const sceneClause = scene ? ` Place the figure in the foreground against this historical background scene instead of a plain gradient: ${youthify(scene)}; keep the character as the clear main focus.` : '';
  subj = youthify(subj);   // 전원 청년화(노년·백발 표현 제거)
  const YOUTH = ' Render the character as a YOUNG man in his twenties to early thirties (cheongnyeon), handsome and vigorous with smooth youthful skin and a firm jaw; absolutely not elderly, no white/grey hair, no white beard, no heavy wrinkles.';
  return `${COMMON}. Subject: ${subj}. ${style}.${rank}${sceneClause}${YOUTH} Faction: ${FAC_NAME[g.f] || g.f}; ${FAC_REF[g.f] || ''}. ${NEGATIVE}.`;
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
/* 세력별 레퍼런스 이미지(최대 4장) — assets/refs/<세력>/ */
function refsFor(fac) {
  const d = path.join(REFDIR, fac);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter(f => /\.(png|jpe?g|webp)$/i.test(f)).slice(0, 4).map(f => path.join(d, f));
}
async function postImages(url, body, headers) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY 환경변수가 없습니다.');
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${key}`, ...headers }, body });
    if (res.ok) {
      const j = await res.json();
      const b64 = j.data?.[0]?.b64_json;
      if (!b64) throw new Error('응답에 이미지 데이터 없음: ' + JSON.stringify(j).slice(0, 200));
      return Buffer.from(b64, 'base64');
    }
    if (res.status === 429 || res.status >= 500) { const w = 2 ** attempt; console.warn(`  재시도 ${attempt} (HTTP ${res.status}) ${w}s 대기...`); await new Promise(r => setTimeout(r, w * 1000)); continue; }
    throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  throw new Error('재시도 초과');
}
/* 텍스트 프롬프트 생성 (generations) */
function generate(prompt) {
  return postImages('https://api.openai.com/v1/images/generations',
    JSON.stringify({ model: MODEL, prompt, size: SIZE, quality: QUALITY, n: 1 }),
    { 'Content-Type': 'application/json' });
}
/* 레퍼런스 이미지 기반 생성 (edits) — 레퍼런스의 갑옷·복식을 참조 */
async function generateWithRefs(prompt, refs) {
  const mime = f => f.toLowerCase().endsWith('.png') ? 'image/png' : f.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  const fd = new FormData();
  fd.append('model', MODEL);
  fd.append('prompt', prompt + ' Match the armor, helmet, weapon style and overall costume design shown in the provided reference image(s); keep period accuracy.');
  fd.append('size', SIZE);
  fd.append('quality', QUALITY);
  for (const rp of refs) fd.append('image[]', new Blob([fs.readFileSync(rp)], { type: mime(rp) }), path.basename(rp));
  return postImages('https://api.openai.com/v1/images/edits', fd, {});   // multipart 경계는 fetch가 설정
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
  else gens = gens.filter(g => !SKIP.includes(g.name));   // 업로드 예정 인물은 자동 생성 제외(단, --only 지정 시 허용)
  console.log(`대상 장수: ${gens.length}명 / 모델 ${MODEL} / 크기 ${SIZE} / 품질 ${QUALITY}${DRY ? ' (DRY-RUN)' : ''}`);

  let made = 0, skipped = 0, failed = 0;
  for (const g of gens) {
    const exists = findExisting(g.name);
    if (exists && !FORCE) { skipped++; continue; }
    const prompt = buildPrompt(g);
    const refs = refsFor(g.f);
    if (DRY) { console.log(`- ${g.name} [${archetype(g)}]${refs.length ? ` (레퍼런스 ${refs.length}장 기반)` : ''}\n    ${prompt}`); continue; }
    try {
      process.stdout.write(`生成 ${g.name}${refs.length ? `(ref:${refs.length})` : ''} ... `);
      const buf = refs.length ? await generateWithRefs(prompt, refs) : await generate(prompt);
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
