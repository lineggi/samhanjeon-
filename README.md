# 三韓戰 · 삼한전

고대 한반도 삼한 시대를 배경으로 한 웹 기반 전략 시뮬레이션 게임입니다.

## 소개

`삼한전`은 단일 HTML 파일로 동작하는 브라우저 게임입니다. 별도의 빌드 과정이나
서버 없이 `index.html` 하나만 열면 바로 플레이할 수 있습니다.

- 한반도 각 지역(province)을 SVG 지도로 표현
- 지역 선택 및 인접 지역 정보 표시
- 한국어 UI (古풍 명조/궁서체 폰트 기반의 사극 분위기)

## 실행 방법

브라우저에서 `index.html` 파일을 직접 열면 됩니다.

```bash
# 저장소 클론
git clone https://github.com/lineggi/samhanjeon-.git
cd samhanjeon-

# 브라우저로 열기 (macOS)
open index.html

# 또는 간단한 로컬 서버로 실행
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```

## 기술 스택

- HTML / CSS / JavaScript (Vanilla)
- SVG 기반 지도 렌더링
- 웹 폰트: Gugi, Nanum Myeongjo, Gowun Batang, Pretendard

## 프로젝트 구조

```
samhanjeon-/
├── index.html   # 게임 전체 (마크업 · 스타일 · 로직)
└── README.md
```

## 라이선스

별도 명시 전까지 모든 권리는 저작자에게 있습니다.
