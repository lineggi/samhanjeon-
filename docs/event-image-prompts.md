# 삼한전 이벤트 이미지 생성 프롬프트 팩 (21종)

이벤트 webp(`assets/events/*.webp`)를 세력 갑옷 레퍼런스 + 영웅 초상화 톤에 맞춰 재생성하기 위한 프롬프트 모음.
외부 이미지 생성 툴(ChatGPT/Midjourney/SD 등)에 **공통 스타일 + 개별 프롬프트**를 함께 넣어 생성한 뒤,
원본 PNG를 `assets/_raw_events/<id>.png`로 두면 가공 스크립트로 960×640 webp(~50KB)로 변환·교체한다.

---

## 0. 공통 스타일 (모든 프롬프트 앞에 붙일 것)

```
Painterly cinematic historical illustration, Korean Three Kingdoms era (4th–7th century AD).
Dramatic chiaroscuro lighting, muted earthy palette (deep browns, ochre, slate) with gold (#c9a227)
and crimson accents. Semi-realistic game key-art style, matching a dark parchment-and-ink UI.
3:2 landscape, 960×640. Atmospheric depth, dust and haze. Historically accurate East-Asian
lamellar armor and banners per faction. NO text, NO letters, NO watermark, NO modern objects.
```

**네거티브(공통):** `text, letters, hangul, chinese characters, watermark, signature, modern clothing, japanese samurai of edo period, chinese ming/qing armor, blurry, lowres, extra limbs`

### 세력별 갑옷·상징 가이드 (레퍼런스 경로)
| 세력 | 갑옷·상징 키워드 | 레퍼런스 |
|---|---|---|
| 고구려 | 갈색 철 찰갑(lamellar), 개마무사 중장기병, 조우관(깃털관), 원추형 투구, **녹색** 깃발 | `assets/refs/goguryeo/고구려 갑옷03.png`, `20260614162659.png` |
| 백제 | 정교한 찰갑·비늘갑, 금동관(왕), 칠지도, **보라/자주** 깃발 | `assets/refs/baekje/백제갑옷.png`, `백제 02.png`, `칠지도.png` |
| 신라 | 금관, 곡옥, 화랑(꽃·깃 장식 소년 무사), **금/노랑** 깃발 | `assets/refs/silla/신라갑옷.png` |
| 가야 | 철판갑(plate armor)·마갑, **진홍** | `assets/refs/gaya/가야갑옷.png`, `가야갑옷02.png` |
| 중국(당) | 당 명광개(가슴 원형 護心鏡), 대군, **붉은** 깃발 | (ref 없음 — 초상화 `china/이세민·이세적`로 톤 참조) |
| 왜 | 단갑(短甲)·삼각판갑, 곡도, **청록** | (ref 없음 — 초상화 `wa/*`로 톤 참조) |

> 인물 일관성: 각 이벤트의 "등장 인물"에 적은 초상화 파일(`assets/portraits/<세력>/<이름>.webp`)을
> 캐릭터 레퍼런스 이미지로 함께 첨부하면 얼굴·복식이 게임과 통일된다.

---

## 1. 371 근초고왕 (백제) — `g_*`

### g_intro — 백제의 전성, 근초고왕
- **등장:** 근초고왕(`baekje/근초고왕`) · **갑옷ref:** 백제
```
A Baekje king (Geunchogo) in gilt-bronze crown and ornate scale armor stands on a hilltop
palace terrace at golden dawn, overlooking a fertile river plain dotted with thatched villages
and sailing ships on the sea horizon. Purple royal banners snap in the wind. Mood: peak of
prosperity, ambition, a sword hand resting toward the north.
```

### g_pyeongyang — 평양성 공격, 고국원왕 전사
- **등장:** 근초고왕·근구수왕(`baekje/근구수왕`)·고국원왕(`goguryeo/고국원왕`)
```
Night siege of a Goguryeo mountain fortress (Pyeongyang). Baekje troops in scale armor storm
the gate under purple banners; in the foreground a Goguryeo king in brown lamellar armor reels
backward, struck in the chest by an arrow, his green banner falling. Fire, arrows arc across a
dark sky, embers. Tragic, decisive moment.
```

### g_chiljido — 칠지도와 왜의 동맹
- **등장:** 백제 사신 + 왜(`wa/오토모`) · **소품ref:** `칠지도.png`
```
A solemn diplomatic hall. A Baekje envoy in purple robes presents the iron Seven-Branched Sword
(Chiljido) — a straight blade with three branching prongs on each side — on a lacquer tray to
a seated Wa (Japanese) chieftain in simple short armor. Teal Wa banners, warm lamplight, incense
smoke. Theme: alliance across the sea.
```

### g_sosurim — 고구려의 중흥, 소수림왕
- **등장:** 소수림왕(`goguryeo/소수림왕`)
```
A Goguryeo king (Sosurim) in dark lamellar and a feather-cap receives a Buddhist monk in saffron
robes inside a new temple hall; scholars unroll bamboo law-code scrolls nearby. A bronze Buddha
statue glows in candlelight. Green Goguryeo banners. Mood: rebuilding, enlightenment, quiet resolve.
```

### g_mahan — 마한 평정
- **등장:** 근초고왕
```
Baekje cavalry and infantry in scale armor march south through humid green wetlands and reed
fields, receiving the submission of kneeling Mahan village chiefs. Purple banners, low golden
light, rice paddies. Theme: southern unification, consolidation.
```

---

## 2. 400 광개토대왕 (고구려) — `w_*`

### w_intro — 광개토대왕 즉위
- **등장:** 광개토대왕(`goguryeo/광개토대왕`)
```
A young Goguryeo king (Gwanggaeto, age 18) is crowned, standing tall in gleaming brown lamellar
armor and a plumed feather-cap, raising a sword skyward. Massed cataphract cavalry and green
"Yeongnak"-era banners stretch behind him under a vast dawn sky. Mood: youthful conquering ambition.
```

### w_baekje — 백제 정벌, 아신왕의 굴복
- **등장:** 광개토대왕 · 아신왕(`baekje/아신왕`)
```
After battle by a wide river (Han). A defeated Baekje king (Asin) in dented scale armor kneels
in the mud, head bowed in surrender, before a towering Goguryeo king on an armored warhorse.
Captured purple banners trail in the dirt; victorious green banners rise. Overcast, somber, ash
in the air.
```

### w_namjeong — 경자년 남정, 신라 구원
- **등장:** 광개토대왕(개마무사) · 가야 · 왜병
```
Goguryeo heavy cataphracts (gaema musa) in full brown horse-and-rider iron armor charge through
a river ford (Nakdong), routing a coalition of lightly-armored Wa warriors with curved swords and
crimson-armored Gaya troops. Spray of water, broken teal and crimson banners, dawn light. Theme:
overwhelming rescue and victory.
```

### w_yodong — 요동 정벌, 후연을 몰아내다
- **등장:** 광개토대왕 · 후연(중국 톤)
```
Goguryeo army assaults a great Liaodong plains fortress at dusk; brown-lamellar troops scale walls
with ladders while cataphracts ride down fleeing Later-Yan (Chinese) soldiers in red. Vast flat
horizon, smoke pillars, green banners planted on the ramparts. Mood: seizing the frontier.
```

### w_buyeo — 동부여 복속
- **등장:** 광개토대왕
```
Goguryeo column marches across a cold northern snowfield toward a palisaded Buyeo settlement;
breath fogs in frozen air, green banners stiff with frost, the king on horseback surveying 64
captured forts in the distance. Pale blue winter light. Theme: the empire at its widest.
```

### w_hanseong — 장수왕의 남하, 위례성 함락
- **등장:** 장수왕(`goguryeo/고거련`) · (개로왕: 초상 없음, 백제 왕)
```
A Baekje royal capital (Wiryeseong) burns at night; Goguryeo king Jangsu in imperial lamellar
watches from a ridge as his army storms the walls. In the foreground a captured Baekje king is
led away in chains under green banners. Heavy smoke, collapsing gate, tragic grandeur.
```

---

## 3. 554 진흥왕 (신라) — `j_*`

### j_intro — 나제동맹과 진흥왕
- **등장:** 진흥왕(`silla/진흥왕`) · 성왕(`baekje/성왕`)
```
Two allied kings — a Silla king in a radiant gold crown (Jinheung) and a Baekje king in a
gilt-bronze crown (Seong) — clasp arms before a battle map table, gold and purple banners side by
side. Behind the Silla king's eyes, a flicker of hidden ambition. Warm war-tent lamplight, maps,
a contested river marked. Theme: alliance with a coming betrayal.
```

### j_hangang — 한강 쟁탈, 신라의 배신
- **등장:** 진흥왕 · 성왕
```
Silla cavalry in gilt armor under gold banners launch a surprise dawn attack to seize fortresses
along the lower Han River, planting a new "Sinju" gold banner on a captured wall. In the distance
a Baekje king (Seong) watches, trembling with rage, his purple banner cut down. Theme: broken oath,
seizure.
```

### j_gwansan — 관산성 전투, 성왕 전사
- **등장:** 성왕(`baekje/성왕`) · 김무력(`silla/김무력`)
```
Ambush at Gwansan fortress, 554. A Baekje king (Seong) is dragged from his horse by Silla
soldiers in an ambush from wooded hills; Silla general Kim Muryeok looks on under gold banners.
Baekje purple banners collapse as 30,000 troops break in panic. Dusk, dust, decisive tragedy.
```

### j_daegaya — 대가야 정복
- **등장:** 이사부(`silla/이사부`)·사다함(`silla/사다함`)·가야(`gaya/도설지왕`,`gaya/우륵`)
```
The fall of Daegaya, 562. Silla general Isabu and a young hwarang warrior Sadaham (in floral
feather-cap) breach a crimson-bannered Gaya fortress with iron-plate-armored defenders. A Gaya
court musician clutches a gayageum amid the ruin. Last embers of a 500-year confederacy, gold
banners rising over crimson. Elegiac.
```

### j_sunsubi — 진흥왕 순수비
- **등장:** 진흥왕
```
A Silla king (Jinheung) in gold crown stands atop a windswept mountain peak (Bukhansan) beside a
newly erected stone monument (sunsubi), gazing over a vast realm reaching from the Han River to
distant northern plains. Gold banners, eagles, sweeping clouds, triumphant dawn. Theme: supremacy
of Silla.
```

---

## 4. 645 여당전쟁 — `u_*`

### u_decree — 당 태종의 친정
- **등장:** 이세민(`china/이세민`) · 연개소문(`goguryeo/연개소문`)
```
Emperor Tang Taizong (Li Shimin) in Tang bright-armor (mingguang, round breastplate discs) raises
his hand before an endless host crossing the Liao River, countless red dragon banners to the
horizon. Inset mood / split atmosphere: in distant Pyeongyang, the grim Goguryeo dictator
Yeon Gaesomun in black lamellar with twin swords vows resistance. Epic scale, war drums, dust.
```

### u_war1 — 제1차 여당전쟁 발발
- **등장:** 당(이세적 `china/이세적`) · 고구려 수비군
```
Tang army in red banners and bright-armor storms a Goguryeo wall-fortress (Yodong) with siege
ladders and battering rams; brown-lamellar Goguryeo defenders hurl stones from the ramparts.
The Cheolli Jangseong (Thousand-li Wall) snakes across hills in the background. Smoke, chaos,
desperate defense.
```

### u_ansi — 안시성 공방전, 양만춘의 분전
- **등장:** 양만춘(`goguryeo/양만춘`)
```
The siege of Ansi fortress. Goguryeo commander Yang Manchun in brown lamellar stands defiant atop
an unbroken stone wall under green banners, as a massive Tang-built earthen siege ramp (tosan)
looms beside the wall. Below, a red sea of Tang troops. Arrows, banners high, the wall holds.
Heroic, indomitable.
```

### u_retreat — 당군의 회군, 안시성의 승리
- **등장:** 양만춘 (승) / 이세민 (퇴각)
```
Winter retreat. The Tang army trudges away in a snowstorm across the frozen Liao plain, red
banners drooping, supply wagons stuck; Emperor Taizong looks back bitterly at the distant
green-bannered Ansi fortress that never fell. Cold blue light, falling snow. Theme: Goguryeo
victory through endurance.
```

### u_fall — 요동 함락, 당의 진격 (안시성 함락 분기)
- **등장:** 당 대군 / 고구려 위기
```
Dark alternate fate: Ansi fortress falls, its green banners burning, the Liaodong defensive line
collapses. A vast Tang army in red pours southward through a shattered gate at blood-red sunset,
Goguryeo survivors fleeing. Ominous, "candle in the wind" peril. Heavy crimson sky.
```

---

## 5. 생성 후 가공 (원본 → 게임 에셋)

1. 생성한 원본을 `assets/_raw_events/<id>.png` 로 저장 (id = `g_intro` 등 위 제목의 코드).
2. 변환 (ImageMagick / sharp):
   ```bash
   # 960x640 3:2 크롭 + webp ~q80 (장당 40~60KB 목표)
   for f in assets/_raw_events/*.png; do
     id=$(basename "$f" .png)
     cwebp -q 80 -resize 960 0 "$f" -o "assets/events/$id.webp"
   done
   ```
3. `EVENT_IMG` 매핑은 이미 21개 모두 연결돼 있으므로 파일만 교체하면 즉시 반영.
4. 누락/실패 시 `onerror`로 SVG 폴백(`eventArt`)이 떠서 깨지지 않음.

> 중국·왜는 갑옷 ref가 없으니, 먼저 `china/이세민`·`wa/오토모` 초상화 톤으로 갑옷 ref 1~2장을
> 만들어 두면 u_*·w_namjeong 등의 통일감이 좋아진다.
