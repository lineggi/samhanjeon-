# 장수 일러스트 생성 가이드

게임 장수 54명의 AI 일러스트 제작용 프롬프트 모음입니다.

## 공통 규격
- 비율 **4:5**, 권장 크기 512×640 또는 600×750
- 포맷 **webp**(권장) 또는 png/jpg
- 저장 위치 `assets/portraits/` , 파일명은 **장수 이름** (예: `광개토대왕.webp`)
- 이미지 추가 후 index.html의 `PORTRAITS` 객체에 한 줄 등록:
  ```js
  '광개토대왕':'assets/portraits/광개토대왕.webp',
  ```

## 공통 스타일 프롬프트 (앞에 붙이기)
```
A bust portrait of an ancient Korean Three-Kingdoms-era figure,
semi-realistic painted game portrait, ROTK-style, dramatic rim light,
dark warm gold background, head-and-shoulders, three-quarter view,
fur shoulder mantle, crimson cape, highly detailed, 4:5 aspect ratio.
```

## 장수별 프롬프트

| 세력 | 이름 | 유형 | 능력(통/무/지) | 개별 프롬프트(공통 뒤에 추가) |
|---|---|---|---|---|
| 백제 | 계백 | 맹장 | 85/95/74 | 청년~중년 man, heavy lamellar armor, horned helmet with red plume, fierce expression, holding a spear/glaive |
| 백제 | 흑치상지 | 맹장 | 90/92/80 | 중년~노년 man, heavy lamellar armor, horned helmet with red plume, fierce expression, holding a spear/glaive |
| 백제 | 근구수 | 맹장 | 88/90/80 | 청년~중년 man, heavy lamellar armor, horned helmet with red plume, fierce expression, holding a spear/glaive |
| 백제 | 근초고왕 | 왕 | 92/86/90 | 중년~노년 man, golden crown, royal robe, regal calm expression |
| 백제 | 위덕왕 | 왕 | 84/86/78 | 중년~노년 man, golden crown, royal robe, regal calm expression |
| 백제 | 막고해 | 장수 | 82/84/78 | 청년~중년 man, lamellar armor, helmet with plume, steady confident expression, holding a spear |
| 백제 | 아신왕 | 왕 | 80/82/78 | 중년~노년 man, golden crown, royal robe, regal calm expression |
| 백제 | 진무 | 장수 | 83/82/74 | 청년~중년 man, lamellar armor, helmet with plume, steady confident expression, holding a spear |
| 백제 | 의자왕 | 왕 | 84/80/82 | 중년~노년 man, golden crown, royal robe, regal calm expression |
| 백제 | 성왕 | 왕 | 86/76/90 | 중년~노년 man, golden crown, royal robe, regal calm expression |
| 백제 | 연회 | 장수 | 78/76/74 | 청년~중년 man, lamellar armor, helmet with plume, steady confident expression, holding a spear |
| 백제 | 성충 | 책사 | 82/74/88 | 중년~노년 man, scholar headband and robe, calm wise expression, holding a folding fan or scroll |
| 백제 | 해충 | 장수 | 75/70/82 | 청년~중년 man, lamellar armor, helmet with plume, steady confident expression, holding a spear |
| 중국 | 설인귀 | 맹장 | 86/94/76 | 청년~중년 man, heavy lamellar armor, horned helmet with red plume, fierce expression, holding a spear/glaive |
| 중국 | 모용수 | 맹장 | 88/90/82 | 청년~중년 man, heavy lamellar armor, horned helmet with red plume, fierce expression, holding a spear/glaive |
| 중국 | 이세민 | 장수 | 93/90/92 | 중년~노년 man, lamellar armor, helmet with plume, steady confident expression, holding a spear |
| 중국 | 이세적 | 맹장 | 88/90/84 | 청년~중년 man, heavy lamellar armor, horned helmet with red plume, fierce expression, holding a spear/glaive |
| 중국 | 곡율광 | 맹장 | 82/88/72 | 청년~중년 man, heavy lamellar armor, horned helmet with red plume, fierce expression, holding a spear/glaive |
| 중국 | 모용성 | 장수 | 83/85/72 | 청년~중년 man, lamellar armor, helmet with plume, steady confident expression, holding a spear |
| 중국 | 고양 | 장수 | 84/82/80 | 청년~중년 man, lamellar armor, helmet with plume, steady confident expression, holding a spear |
| 중국 | 풍발 | 장수 | 78/80/74 | 청년~중년 man, lamellar armor, helmet with plume, steady confident expression, holding a spear |
| 중국 | 모용평 | 장수 | 76/74/78 | 청년~중년 man, lamellar armor, helmet with plume, steady confident expression, holding a spear |
| 가야 | 하지왕 | 왕 | 76/82/70 | 중년~노년 man, golden crown, royal robe, regal calm expression |
| 가야 | 도설지왕 | 왕 | 78/80/72 | 중년~노년 man, golden crown, royal robe, regal calm expression |
| 가야 | 거질미왕 | 왕 | 76/78/72 | 중년~노년 man, golden crown, royal robe, regal calm expression |
| 가야 | 이시품왕 | 왕 | 78/78/76 | 중년~노년 man, golden crown, royal robe, regal calm expression |
| 가야 | 월광태자 | 태자 | 74/76/70 | 청년 man, young prince, light golden circlet, noble look |
| 고구려 | 온달 | 맹장 | 84/93/68 | 청년~중년 man, heavy lamellar armor, horned helmet with red plume, fierce expression, holding a spear/glaive |
| 고구려 | 광개토대왕 | 왕 | 97/92/88 | 중년~노년 man, golden crown, royal robe, regal calm expression |
| 고구려 | 연개소문 | 맹장 | 93/92/86 | 중년~노년 man, heavy lamellar armor, horned helmet with red plume, fierce expression, holding a spear/glaive |
| 고구려 | 양만춘 | 맹장 | 90/88/88 | 중년~노년 man, heavy lamellar armor, horned helmet with red plume, fierce expression, holding a spear/glaive |
| 고구려 | 고무 | 맹장 | 80/86/70 | 청년~중년 man, heavy lamellar armor, horned helmet with red plume, fierce expression, holding a spear/glaive |
| 고구려 | 고흘 | 장수 | 80/82/72 | 청년~중년 man, lamellar armor, helmet with plume, steady confident expression, holding a spear |
| 고구려 | 고혜진 | 장수 | 80/82/74 | 청년~중년 man, lamellar armor, helmet with plume, steady confident expression, holding a spear |
| 고구려 | 고국원왕 | 왕 | 80/80/76 | 중년~노년 man, golden crown, royal robe, regal calm expression |
| 고구려 | 모두루 | 장수 | 82/80/72 | 청년~중년 man, lamellar armor, helmet with plume, steady confident expression, holding a spear |
| 고구려 | 고연수 | 장수 | 82/80/76 | 청년~중년 man, lamellar armor, helmet with plume, steady confident expression, holding a spear |
| 고구려 | 양원왕 | 왕 | 82/78/80 | 중년~노년 man, golden crown, royal robe, regal calm expression |
| 고구려 | 장수왕 | 왕 | 88/74/90 | 중년~노년 man, golden crown, royal robe, regal calm expression |
| 신라 | 김유신 | 맹장 | 95/92/90 | 중년~노년 man, heavy lamellar armor, horned helmet with red plume, fierce expression, holding a spear/glaive |
| 신라 | 사다함 | 맹장 | 80/88/72 | 청년 man, heavy lamellar armor, horned helmet with red plume, fierce expression, holding a spear/glaive |
| 신라 | 알천 | 맹장 | 86/88/78 | 청년~중년 man, heavy lamellar armor, horned helmet with red plume, fierce expression, holding a spear/glaive |
| 신라 | 관창 | 맹장 | 72/86/60 | 청년 man, heavy lamellar armor, horned helmet with red plume, fierce expression, holding a spear/glaive |
| 신라 | 이사부 | 장수 | 92/85/84 | 중년~노년 man, lamellar armor, helmet with plume, steady confident expression, holding a spear |
| 신라 | 진흥왕 | 왕 | 90/78/90 | 중년~노년 man, golden crown, royal robe, regal calm expression |
| 신라 | 실성 | 장수 | 76/74/74 | 청년~중년 man, lamellar armor, helmet with plume, steady confident expression, holding a spear |
| 신라 | 거칠부 | 책사 | 85/72/90 | 중년~노년 man, scholar headband and robe, calm wise expression, holding a folding fan or scroll |
| 신라 | 김춘추 | 책사 | 84/70/94 | 중년~노년 man, scholar headband and robe, calm wise expression, holding a folding fan or scroll |
| 신라 | 내물왕 | 왕 | 78/66/82 | 중년~노년 man, golden crown, royal robe, regal calm expression |
| 왜 | 오토모 | 장수 | 77/82/66 | 청년~중년 man, lamellar armor, helmet with plume, steady confident expression, holding a spear |
| 왜 | 오노 | 장수 | 76/82/66 | 청년~중년 man, lamellar armor, helmet with plume, steady confident expression, holding a spear |
| 왜 | 사데히코 | 장수 | 75/80/64 | 청년~중년 man, lamellar armor, helmet with plume, steady confident expression, holding a spear |
| 왜 | 소가 | 장수 | 76/80/70 | 청년~중년 man, lamellar armor, helmet with plume, steady confident expression, holding a spear |
| 왜 | 고토쿠 | 장수 | 74/68/78 | 청년~중년 man, lamellar armor, helmet with plume, steady confident expression, holding a spear |
