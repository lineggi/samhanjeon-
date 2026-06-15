#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
삼한전 이벤트 이미지 생성기 (gpt-image-1, 레퍼런스 참조)

각 이벤트마다 인물 초상화 + 세력 갑옷 레퍼런스를 함께 첨부(images.edit)해
얼굴·복식을 게임과 통일한 이벤트 일러스트를 만든 뒤, 960x640 webp로 변환해
assets/events/<id>.webp 로 저장한다. EVENT_IMG 매핑(index.html)은 이미 21개가
연결돼 있으므로 파일만 교체되면 즉시 게임에 반영된다.

사용법 (레포 루트에서):
    pip install openai pillow
    set OPENAI_API_KEY=sk-...        (Windows)   /  export OPENAI_API_KEY=sk-...  (mac/linux)
    python scripts/gen_events.py                  # 이미 있는 파일은 건너뜀
    python scripts/gen_events.py --force          # 전부 다시 생성
    python scripts/gen_events.py --only g_intro u_ansi   # 특정 이벤트만
    python scripts/gen_events.py --keep-raw       # 원본 PNG도 assets/_raw_events/ 에 보관

옵션:
    --model    기본 gpt-image-1
    --size     기본 1536x1024 (생성 크기)
    --quality  기본 medium  (low|medium|high|auto)
    --width    기본 960     (저장 webp 가로, 3:2로 리사이즈)
    --wq       기본 82      (webp 품질)
"""
import argparse, base64, io, os, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EVENTS_DIR = ROOT / "assets" / "events"
RAW_DIR = ROOT / "assets" / "_raw_events"
P = lambda *a: str(ROOT.joinpath(*a))   # 레포 기준 경로 헬퍼

COMMON = (
    "Use the attached images as the exact reference for the characters' faces and for the "
    "armor/costume and banner style — keep the same facial features, hairstyle, crown/helmet, "
    "and clothing as in the references. Then create a single illustration: painterly cinematic "
    "historical scene, Korean Three Kingdoms era, dramatic chiaroscuro lighting, muted earthy "
    "palette with gold and crimson accents, semi-realistic game key-art, 3:2 landscape, "
    "atmospheric haze. No text, no letters, no watermark, no modern objects. SCENE: "
)

# (id, refs[], scene)
EVENTS = [
    ("g_intro", ["assets/portraits/baekje/근초고왕.webp", "assets/refs/baekje/백제갑옷.png"],
     "A Baekje king (the man in the reference) in gilt-bronze crown and ornate scale armor stands on a "
     "hilltop palace terrace at golden dawn, overlooking a fertile river plain with thatched villages and "
     "ships on the sea horizon, purple royal banners in the wind, hand resting on his sword toward the north."),
    ("g_pyeongyang", ["assets/portraits/baekje/근구수왕.webp", "assets/portraits/goguryeo/고국원왕.webp"],
     "Night siege of a Goguryeo mountain fortress. Baekje troops in scale armor storm the gate under purple "
     "banners; in the foreground the Goguryeo king (reference face) in brown lamellar reels backward struck "
     "by an arrow in the chest, his green banner falling. Fire, arrows, embers. Tragic decisive moment."),
    ("g_chiljido", ["assets/refs/baekje/칠지도.png", "assets/portraits/wa/오토모.webp"],
     "A diplomatic hall: a Baekje envoy in purple robes presents the iron Seven-Branched Sword (a straight "
     "blade with three branching prongs on each side, per reference) on a lacquer tray to a seated Wa "
     "chieftain (reference face) in simple short armor. Teal banners, incense smoke, warm lamplight."),
    ("g_sosurim", ["assets/portraits/goguryeo/소수림왕.webp", "assets/refs/goguryeo/고구려 갑옷03.png"],
     "The Goguryeo king (reference face) in dark lamellar and a feather-cap receives a saffron-robed Buddhist "
     "monk in a new temple hall, scholars unrolling bamboo law-code scrolls, a bronze Buddha glowing in "
     "candlelight. Green banners. Rebuilding, enlightenment, quiet resolve."),
    ("g_mahan", ["assets/portraits/baekje/근초고왕.webp"],
     "Baekje cavalry and infantry in scale armor march south through humid green wetlands and reed fields, "
     "receiving the submission of kneeling Mahan village chiefs, purple banners, rice paddies, low golden light."),

    ("w_intro", ["assets/portraits/goguryeo/광개토대왕.webp", "assets/refs/goguryeo/고구려 갑옷03.png"],
     "The young Goguryeo king (reference face, age 18) crowned, in gleaming brown lamellar and a plumed "
     "feather-cap, raising a sword skyward; massed cataphract cavalry and green banners behind him under a "
     "vast dawn sky. Youthful conquering ambition."),
    ("w_baekje", ["assets/portraits/goguryeo/광개토대왕.webp", "assets/portraits/baekje/아신왕.webp"],
     "By a wide river after battle: the defeated Baekje king (reference face) in dented scale armor kneels in "
     "the mud in surrender before the towering Goguryeo king (reference) on an armored warhorse; captured "
     "purple banners trail in the dirt, victorious green banners rise, ash in the air."),
    ("w_namjeong", ["assets/portraits/goguryeo/광개토대왕.webp", "assets/refs/gaya/가야갑옷02.png"],
     "Goguryeo heavy cataphracts (gaema musa, full iron horse-and-rider armor) charge through a river ford, "
     "routing lightly-armored Wa warriors with curved swords and crimson iron-plate-armored Gaya troops; "
     "spray of water, broken teal and crimson banners, dawn light."),
    ("w_yodong", ["assets/portraits/goguryeo/광개토대왕.webp"],
     "Goguryeo army assaults a great Liaodong plains fortress at dusk: brown-lamellar troops scale walls with "
     "ladders while cataphracts ride down fleeing Later-Yan Chinese soldiers in red; vast flat horizon, smoke "
     "pillars, green banners planted on the ramparts."),
    ("w_buyeo", ["assets/portraits/goguryeo/광개토대왕.webp"],
     "A Goguryeo column marches across a frozen northern snowfield toward a palisaded Buyeo settlement; breath "
     "fogs in the cold air, green banners stiff with frost, the king on horseback surveying distant captured "
     "forts. Pale blue winter light."),
    ("w_hanseong", ["assets/portraits/goguryeo/고거련.webp"],
     "A Baekje royal capital burns at night; the Goguryeo king Jangsu (reference face) in imperial lamellar "
     "watches from a ridge as his army storms the walls; in the foreground a captured Baekje king is led away "
     "in chains under green banners. Heavy smoke, collapsing gate, tragic grandeur."),

    ("j_intro", ["assets/portraits/silla/진흥왕.webp", "assets/portraits/baekje/성왕.webp"],
     "Two allied kings — the Silla king (reference) in a radiant gold crown and the Baekje king (reference) in "
     "a gilt-bronze crown — clasp arms before a battle map table, gold and purple banners side by side, a "
     "flicker of hidden ambition in the Silla king's eyes. Warm war-tent lamplight."),
    ("j_hangang", ["assets/portraits/silla/진흥왕.webp", "assets/portraits/baekje/성왕.webp"],
     "Silla cavalry in gilt armor under gold banners launch a surprise dawn attack to seize fortresses along "
     "the lower Han River, planting a new gold banner on a captured wall; in the distance the Baekje king "
     "(reference) watches trembling with rage, his purple banner cut down."),
    ("j_gwansan", ["assets/portraits/baekje/성왕.webp", "assets/portraits/silla/김무력.webp"],
     "Ambush at Gwansan fortress: the Baekje king (reference face) is dragged from his horse by Silla soldiers "
     "ambushing from wooded hills, Silla general Kim Muryeok (reference) looking on under gold banners; purple "
     "banners collapse as troops break in panic. Dusk, dust, decisive tragedy."),
    ("j_daegaya", ["assets/portraits/silla/이사부.webp", "assets/portraits/silla/사다함.webp", "assets/portraits/gaya/도설지왕.webp"],
     "The fall of Daegaya: Silla general Isabu (reference) and a young hwarang warrior (reference, floral "
     "feather-cap) breach a crimson-bannered Gaya fortress defended by iron-plate-armored soldiers; a Gaya "
     "court musician clutches a gayageum amid the ruin, gold banners rising over crimson. Elegiac dusk."),
    ("j_sunsubi", ["assets/portraits/silla/진흥왕.webp"],
     "The Silla king (reference) in a gold crown stands atop a windswept mountain peak beside a newly erected "
     "blank stone monument, gazing over a vast realm reaching to distant northern plains, gold banners, eagles, "
     "sweeping clouds. Triumphant dawn."),

    ("u_decree", ["assets/portraits/china/이세민.webp", "assets/portraits/goguryeo/연개소문.webp"],
     "Emperor Tang Taizong (reference face) in Tang bright-armor with round breastplate discs raises his hand "
     "before an endless host crossing the Liao River, countless red dragon banners to the horizon; in the "
     "distant atmosphere a grim Goguryeo dictator Yeon Gaesomun (reference) in black lamellar with twin swords. "
     "Epic scale, dust, war-drums."),
    ("u_war1", ["assets/portraits/china/이세적.webp"],
     "Tang army in red banners and bright-armor storms a Goguryeo wall-fortress with siege ladders and "
     "battering rams; brown-lamellar Goguryeo defenders hurl stones from the ramparts; a long stone "
     "Thousand-li Wall snakes across the hills behind. Smoke, chaos, desperate defense."),
    ("u_ansi", ["assets/portraits/goguryeo/양만춘.webp"],
     "The siege of Ansi fortress: the Goguryeo commander Yang Manchun (reference face) in brown lamellar stands "
     "defiant atop an unbroken stone wall under green banners, a massive Tang-built earthen siege ramp looming "
     "beside the wall, a red sea of Tang troops below, arrows flying. Heroic, indomitable."),
    ("u_retreat", ["assets/portraits/china/이세민.webp", "assets/portraits/goguryeo/양만춘.webp"],
     "Winter retreat: the Tang army trudges away in a snowstorm across the frozen Liao plain, red banners "
     "drooping, supply wagons stuck; the emperor (reference) looks back bitterly at the distant green-bannered "
     "Ansi fortress that never fell. Cold blue light, falling snow."),
    ("u_fall", ["assets/portraits/china/이세적.webp"],
     "Dark fate: Ansi fortress falls, its green banners burning, the Liaodong defensive line collapses; a vast "
     "Tang army in red pours southward through a shattered gate at blood-red sunset, Goguryeo survivors "
     "fleeing. Ominous, candle-in-the-wind peril, heavy crimson sky."),
]


def to_webp(png_bytes: bytes, out_path: Path, width: int, wq: int):
    from PIL import Image
    im = Image.open(io.BytesIO(png_bytes)).convert("RGB")
    h = round(width * 2 / 3)                       # 3:2
    im = im.resize((width, h), Image.LANCZOS)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    im.save(out_path, "WEBP", quality=wq, method=6)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="gpt-image-1")
    ap.add_argument("--size", default="1536x1024")
    ap.add_argument("--quality", default="medium")
    ap.add_argument("--width", type=int, default=960)
    ap.add_argument("--wq", type=int, default=82)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--keep-raw", action="store_true")
    ap.add_argument("--only", nargs="*", default=None)
    args = ap.parse_args()

    if not os.environ.get("OPENAI_API_KEY"):
        sys.exit("OPENAI_API_KEY 환경변수를 설정하세요.")
    try:
        from openai import OpenAI
    except ImportError:
        sys.exit("pip install openai pillow 가 필요합니다.")
    client = OpenAI()

    targets = [e for e in EVENTS if (args.only is None or e[0] in args.only)]
    print(f"대상 이벤트: {len(targets)}개 / 모델 {args.model} / {args.size} / {args.quality}")
    made = skipped = failed = 0

    for eid, refs, scene in targets:
        out = EVENTS_DIR / f"{eid}.webp"
        if out.exists() and not args.force:
            print(f"건너뜀 {eid} (이미 존재)")
            skipped += 1
            continue
        print(f"생성 {eid} ... ", end="", flush=True)

        # 존재하는 레퍼런스만 첨부
        files, missing = [], []
        for r in refs:
            rp = ROOT / r
            (files if rp.exists() else missing).append(rp if rp.exists() else r)
        prompt = COMMON + scene
        try:
            t0 = time.time()
            if files:
                handles = [open(f, "rb") for f in files]
                try:
                    resp = client.images.edit(model=args.model, image=handles,
                                               prompt=prompt, size=args.size, quality=args.quality)
                finally:
                    for h in handles:
                        h.close()
            else:   # 레퍼런스가 하나도 없으면 일반 생성
                resp = client.images.generate(model=args.model, prompt=prompt,
                                               size=args.size, quality=args.quality)
            png = base64.b64decode(resp.data[0].b64_json)
            if args.keep_raw:
                (RAW_DIR).mkdir(parents=True, exist_ok=True)
                (RAW_DIR / f"{eid}.png").write_bytes(png)
            to_webp(png, out, args.width, args.wq)
            kb = out.stat().st_size // 1024
            warn = f"  ⚠ ref 누락: {', '.join(map(str, missing))}" if missing else ""
            print(f"✓ {out.relative_to(ROOT)} ({kb}KB, {time.time()-t0:.0f}s){warn}")
            made += 1
        except Exception as ex:
            print(f"✗ 실패: {ex}")
            failed += 1

    # EVENT_IMG 매핑 검증
    idx = (ROOT / "index.html").read_text(encoding="utf-8")
    registered = sum(1 for e in EVENTS if f"{e[0]}:'assets/events/{e[0]}.webp'" in idx.replace(" ", ""))
    print(f"EVENT_IMG 등록 확인: {registered}/{len(EVENTS)}개")
    print(f"완료 — 생성 {made}, 건너뜀 {skipped}, 실패 {failed}")


if __name__ == "__main__":
    main()
