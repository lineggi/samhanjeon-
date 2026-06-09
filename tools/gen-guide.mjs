#!/usr/bin/env node
/* PORTRAITS.md(장수 프롬프트 가이드)를 gen-portraits.mjs의 실제 프롬프트 규칙으로 재생성.
 * 사용: node tools/gen-guide.mjs  */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseGenerals, buildPrompt, archetype } from './gen-portraits.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FAC = { goguryeo: '고구려', baekje: '백제', silla: '신라', gaya: '가야', china: '중국', wa: '왜' };

const gens = parseGenerals().sort((a, b) => (FAC[a.f] || a.f).localeCompare(FAC[b.f] || b.f, 'ko') || b.might - a.might);

let md = `# 장수 일러스트 생성 가이드

게임 장수 ${gens.length}명의 AI 일러스트 제작용 프롬프트 모음입니다.
(이 파일은 \`node tools/gen-guide.mjs\`로 자동 생성됩니다 — 직접 수정하지 마세요.)

## ⚡ 자동 생성 (OpenAI API)

장수 ${gens.length}명을 한 번에 자동 생성·변환·등록합니다. (네트워크 + OpenAI API 키 필요)

\`\`\`bash
export OPENAI_API_KEY=sk-...      # 본인 키
npm i sharp                       # 4:5 webp 변환용(권장)

node tools/gen-portraits.mjs               # 없는 것만 전부 생성 + PORTRAITS 자동 등록
node tools/gen-portraits.mjs --only 광개토대왕,김유신
node tools/gen-portraits.mjs --force       # 이미 있어도 다시 생성
node tools/gen-portraits.mjs --dry-run     # 호출 없이 대상/프롬프트만 확인
node tools/gen-portraits.mjs --register-only  # 폴더 스캔해 PORTRAITS만 갱신
\`\`\`

옵션 환경변수: \`OPENAI_IMAGE_MODEL\`(기본 \`gpt-image-1\`), \`IMAGE_QUALITY\`(low|medium|high), \`GEN_SIZE\`(기본 1024x1536).
생성물은 \`assets/portraits/이름.webp\`로 저장되고 \`index.html\`의 \`PORTRAITS\`에 자동 등록됩니다.
이미 있는 파일은 건너뛰므로 중간에 끊겨도 다시 실행하면 이어서 진행됩니다.

## 고증 참조 방침

- 고대 인물은 실제 초상이 없어, **드라마/배우 얼굴이 아닌 시대 고증**(공개 유물·고분벽화)을 참조합니다.
- 세력별 참조: 고구려=고분벽화 찰갑·개마무사, 백제=무령왕릉 금제 관식·금동대향로, 신라=금관·곡옥, 가야=판갑·철갑.
- 프롬프트에 "특정 실존 배우/드라마 스틸/저작 미술을 닮지 말 것"을 명시해 초상권·저작권 위험을 피합니다.

## 규격
- 비율 **4:5**(512×640 또는 600×750), 포맷 **webp**, 파일명은 **장수 이름**.

## 장수별 프롬프트 (도구가 실제로 사용하는 문장)

| 세력 | 이름 | 유형 | 통/무/지 | 프롬프트 |
|---|---|---|---|---|
`;
for (const g of gens) {
  md += `| ${FAC[g.f] || g.f} | ${g.name} | ${archetype(g)} | ${g.lead}/${g.might}/${g.int} | ${buildPrompt(g).replace(/\|/g, '\\|')} |\n`;
}
fs.writeFileSync(path.join(ROOT, 'PORTRAITS.md'), md);
console.log('PORTRAITS.md 재생성:', gens.length, '명');
