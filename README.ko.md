# Weave Incremental Reading

[中文](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/README.md#中文文档) | [English](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/README.md#english) | [日本語](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/README.ja.md) | [한국어](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/README.ko.md) | [繁體中文](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/README.zh-TW.md) | [Русский](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/README.ru.md)

<div align="center">

**「나중에 읽기」를 실제로 이어갈 수 있는 읽기 큐로**

Standalone incremental reading for Obsidian — topics, reading points, calendar scheduling, and source resume

</div>

---
![QQ_1784229108205](https://github.com/user-attachments/assets/05b583f0-6485-45a9-9665-b7e4aa95f5ab)
![QQ_1784229164256](https://github.com/user-attachments/assets/649226dd-db4c-4529-95dd-a412898dfe1a)
![QQ20260717-031452-HD](https://github.com/user-attachments/assets/72411a43-638c-4ce8-80ff-8cf5fadbc8ae)

## 한국어 문서

**Weave Incremental Reading**(플러그인 ID: `weave-incremental-reading`)은 Obsidian용 **독립형** 점진적 읽기 플러그인입니다.

Markdown, 콘텐츠 블록 링크, PDF([PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus)와 함께), Canvas, 웹 페이지, EPUB 등에 흩어진 자료를 일정 수립·이어 읽기·원문으로 돌아갈 수 있는 **읽기 포인트 큐**로 정리하고, **주제**와 **캘린더**로 장기적으로 진행합니다——「저장했으니 읽은 것」에서 멈추지 않게 합니다.

이 플러그인은 단독으로 사용할 수 있으며 Weave 메인 플러그인에 **의존하지 않습니다**. Vault 내 EPUB 읽기나 기억 덱 카드 제작이 필요할 때만 시리즈의 다른 플러그인을 설치하세요.

---

### 세 가지 핵심 개념

| 개념 | 설명 |
|------|------|
| **읽기 포인트** | 출처 추적이 있는 하나의 읽기 작업. 큐에서 원문으로 한 번에 돌아가 이어서 읽을 수 있습니다. |
| **주제(IRDeck)** | 읽기 포인트의 컨테이너. Vault에 `.irdeck` 파일로 저장되며, 주제나 계획별로 그룹화합니다. |
| **점진적 읽기 캘린더** | 플러그인 메인 화면. 날짜별로 대기·예정·연체된 읽기 포인트를 보고 일일 리듬을 관리합니다. |

---

### 핵심 기능

- **점진적 읽기 캘린더** — 월간 히트맵과 당일 큐; 부하·우선순위·연체 항목 확인; 연속 읽기 등 보조 작업
- **통합 「링크 추가」** — 웹, 위키링크, 블록 참조, PDF++ 위치, Canvas 노드, EPUB 위치 등을 붙여넣고 이름·주제·첫 일정일을 한 번에 설정
- **주제와 읽기 포인트 관리** — 우선순위, 일시 중지, 보관; `.irdeck`을 열어 주제 보기와 캘린더 전환
- **스케줄링과 이어 읽기** — 가공 흐름 / 읽기 목록 등 전략, 일일 상한과 시간 예산; 완료 후 다음 출현 자동 배치
- **자료 가져오기** — Markdown에서 일괄 분할 가져오기; 프리미엄은 폴더 구독, PDF / EPUB 챕터 일괄 가져오기
- **출처로 돌아가기** — Markdown, PDF++, Canvas, 웹, EPUB 등에서 안정적인 이어 읽기 위치 유지

---

### 빠른 시작

1. 플러그인을 설치하고 활성화(아래 [설치](#설치와-업데이트) 참조)
2. **점진적 읽기 캘린더** 열기(왼쪽 리본 캘린더 아이콘, 또는 명령 팔레트 「점진적 읽기 캘린더 열기」)
3. 캘린더 상단 **「+」/ 링크 추가** 클릭: 출처 붙여넣기 → 이름 수정 → 주제 선택 → 첫 읽기일 지정 → 저장
4. 캘린더에서 오늘 항목을 열고 원문에서 이어 읽기; 진행을 표시하면 다음 출현 시간이 정해집니다

일상 주 경로는 **링크 추가**를 권장합니다. 선택 영역 명령과 우클릭 메뉴도 사용할 수 있습니다.

---

### 설치와 업데이트

#### Release에서 설치(현재 권장)

1. 이 저장소 [Releases](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/releases)에서 최신 버전 첨부 파일을 다운로드
2. Vault에 다음 디렉터리를 만듭니다:

   ```text
   .obsidian/plugins/weave-incremental-reading/
   ```

3. 같은 Release의 `main.js`, `manifest.json`, `styles.css`를 해당 디렉터리에 넣습니다
4. **설정 → 커뮤니티 플러그인**에서 **Weave Incremental Reading**을 활성화합니다

#### BRAT로 버전 추적

[BRAT](https://github.com/TfTHacker/obsidian42-brat)를 사용하면 이 저장소를 추가하고 **Weave Incremental Reading**을 선택해 업데이트를 확인할 수 있습니다.

#### Obsidian 커뮤니티 플러그인 디렉터리

플러그인이 커뮤니티 디렉터리에 등록되어 있으면 **설정 → 커뮤니티 플러그인**에서 **Weave Incremental Reading**을 검색해 설치·업데이트할 수 있습니다.

#### 시스템 요구 사항

| 항목 | 요구 사항 |
|------|------|
| Obsidian | **≥ 1.8.7**(`manifest.json`의 `minAppVersion` 기준) |
| 플랫폼 | 데스크톱과 모바일 |

---

### Weave 시리즈와의 관계

Weave는 Obsidian용 지식 워크플로 플러그인 모음으로, **읽기 → 기록 → 일정 → 복습**을 중심으로 장기 학습을 돕습니다. 이 플러그인은 **점진적 읽기 큐와 캘린더 일정**을 담당하며, 다른 구성원과 역할을 나누고 조합해 사용할 수 있습니다.

| 플러그인 | 주요 역할 |
|------|----------|
| **Weave Incremental Reading**(이 플러그인) | 읽기 포인트, 주제, 캘린더 스케줄링, 이어 읽기와 출처 복귀 |
| **Weave 메인 플러그인** | 기억 덱, 문제 은행, 발췌 카드 제작, FSRS 복습 등 |
| **Weave EPUB Reader** | Vault 내 EPUB 읽기, 발췌, 챕터 위치 지정 |

조합 방법:

- **점진적 읽기 큐만** — 이 플러그인만 설치
- **EPUB을 읽고 챕터로 돌아가기** — 이 플러그인 + Weave EPUB Reader
- **카드 제작과 복습도** — 이 플러그인 + Weave 메인 플러그인
- **완전한 루프(읽기 → 기록 → 일정 → 복습)** — 세 가지 모두

외부 협업(Weave 시리즈 외): **PDF++**로 PDF 선택/위치 링크를 만든 뒤 「링크 추가」로 큐에 넣을 수 있습니다.

---

### 무료 기능과 프리미엄 기능

현재 버전: **점진적 읽기 캘린더와 Markdown 읽기 포인트 주 흐름은 무료**이며, 일상적인 점진적 읽기에 충분합니다.

| 무료 | 프리미엄(활성화 필요) |
|------|----------------|
| 캘린더와 Markdown 읽기 포인트 | PDF / EPUB 챕터 읽기 포인트 일괄 가져오기 |
| 주제와 읽기 포인트 관리(우선순위, 일시 중지, 보관) | 스케줄링 전략 사용자 지정, 교차 학습 설정 |
| 기본 스케줄링, 오늘 대기, 이어 읽기 복귀 | 폴더 구독 자동 동기화 |
| 링크 추가로 읽기 포인트 생성(MD, 블록 링크, PDF++ 등) | 통계 분석, 읽기 타이머, 캘린더 배경 월 등 |
| Markdown 분할 가져오기, 데이터 관리 도구 | 읽기 포인트 연결 노트 등 추가 기능 |

미활성화 시에도 프리미엄 진입점에 안내가 표시되며, 기본 읽기 흐름은 영향을 받지 않습니다.

**Weave 메인 플러그인**이 설치·활성화되어 있으면 이 플러그인은 해당 라이선스를 상속할 수 있어 중복 활성화가 필요 없습니다. 단독 활성화: **설정 → Weave Incremental Reading → 라이선스**.

---

### 데이터와 개인정보

- 읽기 포인트, 주제, 스케줄, 설정은 **기본으로 로컬 Vault에 저장**
- 플러그인은 노트 내용을 **능동적으로 업로드하지 않음**
- 크로스 플러그인 협업(EPUB 복귀, 라이선스 검증 등)은 해당 기능을 실제로 사용할 때만 발생
- 플러그인 제거 시 생성된 `.irdeck`과 읽기 포인트 데이터는 **자동 삭제되지 않음**; 데이터 관리 도구 또는 수동으로 삭제하세요

---

### 작성자

**Rabbit (zhuzhige)** — [GitHub](https://github.com/zhuzhige123)

- 이메일: tutaoyuan8@outlook.com
- 문제와 제안: [Issues](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/issues)
- 라이선스: [GPL-3.0-or-later](LICENSE)

---

<div align="center">

**읽기 큐를 진짜 움직이게——즐겨찾기 더미에 두지 마세요.**

</div>
