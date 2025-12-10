<<<<<<< HEAD
# 하드웨어 구성 서비스 개발 가이드 (AI 코딩 지원용 - Final Ver.2)

## I. 개요 및 개발 환경 설정
본 프로젝트는 하드웨어 구성부터 전기/네트워크 요청사항까지, 현장 설치에 필요한 모든 문서를 웹에서 시각적으로 작성하고 단일 PPT 파일로 자동 생성하는 올인원 서비스입니다.

- **핵심 UX 원칙**: 별도의 회원가입/로그인 절차 없음. (접속 즉시 시작)
- **대상 툴**: Cursor, Anti-Gravity 등 AI 코딩 보조 도구
- **언어/프레임워크**: HTML, JavaScript (ES Module), Tailwind CSS, Konva.js, PptxGenJS, Cropper.js
- **데이터베이스**: Google Firestore (Firebase) - 익명 인증 사용

### 1. 주요 라이브러리 및 모듈 정의

| 모듈 | 역할 | 위치 |
| :--- | :--- | :--- |
| **App Core** | 전체 상태 관리, 통합 Export, 로컬 파일 I/O | `App` |
| **Auth Manager** | (Modified) 별도 UI 없는 Silent Anonymous Login 처리 | `AuthManager` |
| **View Manager** | 5가지 뷰 모드 전환 및 초기 배치 전략 관리 | `ViewManager` |
| **Request Manager** | 전기/네트워크 요청 마커 생성 및 관리 | `RequestManager` |
| **Image Manager** | 이미지 검색/선택/캐싱 | `ImageManager` |
| **BOM Manager** | 수량 집계, 공급처 분류, 리스트 UIBOMManager | `BOMManager` |
| **Background Manager** | 도면 업로드/크롭 (Guide/Request 뷰 공유) | `BackgroundManager` |
| **Visualizer** | 캔버스 렌더링 (모드별 좌표 및 스타일 분기) | `render()` |

## II. 데이터 구조 (Firestore & Local)
`projectData`는 프로젝트의 모든 정보를 담는 단일 진실 공급원(SSOT)입니다.

### 핵심 JSON 구조
```json
{
  "meta": {
    "mode": "LOGICAL", // 'LOGICAL' | 'PHYSICAL' | 'REQUEST' ...
    "floorPlanImage": "...", // Base64 도면 데이터
    "bomMetadata": { ... }
  },
  "nodes": {
    "node-1": {
      "id": "node-1",
      "type": "Router",
      // 좌표계 분리 (중요)
      "logicalPos": { "col": 0, "row": 0 }, 
      "physicalPos": { "x": 100, "y": 100 }, // 초기값 null 가능
      "connections": {
         "PortA": {
           "targetId": "node-2",
           "cableType": "UTP",
           // 경로 데이터 분리 (중요)
           // - logicalPoints: 자동 레이아웃에 의해 계산됨 (저장 불필요 가능)
           // - physicalPoints: 사용자가 드래그한 핸들 좌표 (반드시 저장)
           "physicalPoints": [100, 100, 150, 200, ...], 
           "isOnSite": true
         }
      }
    }
  },
  "requests": { ... } // 전기/네트워크 마커
}
```

## III. 상세 기능 명세: 뷰 모드 및 인터랙션

### 1. 뷰 모드 전환 및 초기 배치 (View Switching)
- **Guide Mode 진입 시 (Initial Placement Strategy)**:
    - `physicalPos`가 `null`인 노드들을 식별합니다.
    - **(Updated)** 상단 그리드 배치가 아니라, **Logical Mode(구성도)에서의 계산된 렌더링 좌표(x, y)**를 그대로 `physicalPos`의 초기값으로 복사합니다.
    - 이를 통해 사용자는 구성도에서 보던 익숙한 배치 상태에서 도면 작업을 시작할 수 있습니다.

### 2. 연결선 렌더링 분기 (Dual Path Logic)
- **LOGICAL Mode**: LayoutEngine이 계산한 직각 경로(Auto-routing)를 사용합니다.
- **PHYSICAL Mode**: `connection.physicalPoints`가 있으면 이를 사용하고, 없으면 시작점/끝점 사이의 기본 경로를 생성합니다. (핸들 드래그 시 `physicalPoints` 업데이트)
- **목적**: 구성도의 깔끔한 자동 정렬 선과 도면 위의 복잡한 배선 경로가 서로 간섭하지 않도록 데이터를 분리합니다.

## IV. 상세 기능 명세: 전기 및 네트워크 요청 (Request View)

### 1. UI 및 인터랙션 (Click-to-Add)
- **Mode**: Request 뷰에서는 노드 이동/편집이 비활성화되고 마커 추가만 가능합니다.
- **Conflict Handling**: 기존 마커를 클릭하면 수정 모드(라벨 변경/삭제)로 진입하고, 빈 공간 클릭 시 신규 추가됩니다.

### 2. 시각화 (Visualizer)
- **Markers**: Power(Red) / Network(Blue) 정사각형(30px).
- 라벨은 박스 외부(상단/우측)에 배치하여 가독성 확보.

## V ~ VII. (기존 상세 기능 명세 유지: BOM, 갤러리 등)

## VIII. 상세 기능 명세: 통합 PPT Export (All-in-One)
"전체 내보내기" 버튼 클릭 시 다음 로직을 수행합니다.

### 1. Slide 1: System Configuration
- 논리 좌표 및 자동 정렬된 연결선 사용.

### 2. Slide 2 & 3: Cable Guide & Request
- **배경 이미지 처리 (Aspect Ratio)**:
    - 업로드된 `floorPlanImage`를 슬라이드에 삽입할 때, 슬라이드 크기(10x5.625 inch)에 맞추되 **비율을 유지(contain)**하며 중앙 정렬해야 합니다.
    - `pptx.addImage({ data: img, x: 'center', y: 'center', w: '95%', h: '95%', sizing: { type: 'contain' } })`
- **좌표 변환**:
    - 웹 캔버스의 도면 위치/크기와 PPT 슬라이드의 도면 위치/크기 비율(`scaleRatio`)을 계산하여 노드와 마커 좌표를 변환해야 정확한 위치에 표시됩니다.

### 3. Slide 4: Hardware List (BOM)
- Local/Company 테이블 분리 생성.

### 4. Slide 5+: Hardware Image Gallery
- 4열 그리드, 페이지 분할 적용.

## IX. 상세 기능 명세: 프로젝트 로컬 저장 (JSON)
- **파일 최적화**: `floorPlanImage`가 매우 클 경우 JSON 파일이 무거워질 수 있으므로, 저장 시 경고 문구를 띄우거나 이미지를 제외하고 저장하는 옵션을 제공하는 것을 고려합니다. (기본은 포함)

## X. AI 코딩 지침 (구현 순서)
AI에게 다음 순서로 코딩을 요청하십시오.

1.  **Step 1: 인증 및 기본 구조**
    - Firebase `signInAnonymously`를 앱 시작 시 자동 실행하도록 구현 (로그인 화면 없음).
    - 데이터 구조(좌표계 분리 등) 정의.
2.  **Step 2: 뷰 매니저 및 초기 배치**
    - 물리 뷰 진입 시 `logicalPos`의 렌더링 좌표를 `physicalPos`로 복사하는 로직 구현.
3.  **Step 3: 렌더러 분기 처리**
    - 모드에 따라 선을 그리는 소스 데이터(`points`)를 다르게 참조하도록 `render()` 함수 수정.
4.  **Step 4: Request 및 통합 Export**
    - PPT 생성 시 배경 이미지 비율 유지(`sizing: contain`) 및 좌표 스케일링 로직 정밀 구현.
=======
# 하드웨어 구성 서비스 개발 가이드 (AI 코딩 지원용 - Final Ver.2)

## I. 개요 및 개발 환경 설정
본 프로젝트는 하드웨어 구성부터 전기/네트워크 요청사항까지, 현장 설치에 필요한 모든 문서를 웹에서 시각적으로 작성하고 단일 PPT 파일로 자동 생성하는 올인원 서비스입니다.

- **핵심 UX 원칙**: 별도의 회원가입/로그인 절차 없음. (접속 즉시 시작)
- **대상 툴**: Cursor, Anti-Gravity 등 AI 코딩 보조 도구
- **언어/프레임워크**: HTML, JavaScript (ES Module), Tailwind CSS, Konva.js, PptxGenJS, Cropper.js
- **데이터베이스**: Google Firestore (Firebase) - 익명 인증 사용

### 1. 주요 라이브러리 및 모듈 정의

| 모듈 | 역할 | 위치 |
| :--- | :--- | :--- |
| **App Core** | 전체 상태 관리, 통합 Export, 로컬 파일 I/O | `App` |
| **Auth Manager** | (Modified) 별도 UI 없는 Silent Anonymous Login 처리 | `AuthManager` |
| **View Manager** | 5가지 뷰 모드 전환 및 초기 배치 전략 관리 | `ViewManager` |
| **Request Manager** | 전기/네트워크 요청 마커 생성 및 관리 | `RequestManager` |
| **Image Manager** | 이미지 검색/선택/캐싱 | `ImageManager` |
| **BOM Manager** | 수량 집계, 공급처 분류, 리스트 UIBOMManager | `BOMManager` |
| **Background Manager** | 도면 업로드/크롭 (Guide/Request 뷰 공유) | `BackgroundManager` |
| **Visualizer** | 캔버스 렌더링 (모드별 좌표 및 스타일 분기) | `render()` |

## II. 데이터 구조 (Firestore & Local)
`projectData`는 프로젝트의 모든 정보를 담는 단일 진실 공급원(SSOT)입니다.

### 핵심 JSON 구조
```json
{
  "meta": {
    "mode": "LOGICAL", // 'LOGICAL' | 'PHYSICAL' | 'REQUEST' ...
    "floorPlanImage": "...", // Base64 도면 데이터
    "bomMetadata": { ... }
  },
  "nodes": {
    "node-1": {
      "id": "node-1",
      "type": "Router",
      // 좌표계 분리 (중요)
      "logicalPos": { "col": 0, "row": 0 }, 
      "physicalPos": { "x": 100, "y": 100 }, // 초기값 null 가능
      "connections": {
         "PortA": {
           "targetId": "node-2",
           "cableType": "UTP",
           // 경로 데이터 분리 (중요)
           // - logicalPoints: 자동 레이아웃에 의해 계산됨 (저장 불필요 가능)
           // - physicalPoints: 사용자가 드래그한 핸들 좌표 (반드시 저장)
           "physicalPoints": [100, 100, 150, 200, ...], 
           "isOnSite": true
         }
      }
    }
  },
  "requests": { ... } // 전기/네트워크 마커
}
```

## III. 상세 기능 명세: 뷰 모드 및 인터랙션

### 1. 뷰 모드 전환 및 초기 배치 (View Switching)
- **Guide Mode 진입 시 (Initial Placement Strategy)**:
    - `physicalPos`가 `null`인 노드들을 식별합니다.
    - **(Updated)** 상단 그리드 배치가 아니라, **Logical Mode(구성도)에서의 계산된 렌더링 좌표(x, y)**를 그대로 `physicalPos`의 초기값으로 복사합니다.
    - 이를 통해 사용자는 구성도에서 보던 익숙한 배치 상태에서 도면 작업을 시작할 수 있습니다.

### 2. 연결선 렌더링 분기 (Dual Path Logic)
- **LOGICAL Mode**: LayoutEngine이 계산한 직각 경로(Auto-routing)를 사용합니다.
- **PHYSICAL Mode**: `connection.physicalPoints`가 있으면 이를 사용하고, 없으면 시작점/끝점 사이의 기본 경로를 생성합니다. (핸들 드래그 시 `physicalPoints` 업데이트)
- **목적**: 구성도의 깔끔한 자동 정렬 선과 도면 위의 복잡한 배선 경로가 서로 간섭하지 않도록 데이터를 분리합니다.

## IV. 상세 기능 명세: 전기 및 네트워크 요청 (Request View)

### 1. UI 및 인터랙션 (Click-to-Add)
- **Mode**: Request 뷰에서는 노드 이동/편집이 비활성화되고 마커 추가만 가능합니다.
- **Conflict Handling**: 기존 마커를 클릭하면 수정 모드(라벨 변경/삭제)로 진입하고, 빈 공간 클릭 시 신규 추가됩니다.

### 2. 시각화 (Visualizer)
- **Markers**: Power(Red) / Network(Blue) 정사각형(30px).
- 라벨은 박스 외부(상단/우측)에 배치하여 가독성 확보.

## V ~ VII. (기존 상세 기능 명세 유지: BOM, 갤러리 등)

## VIII. 상세 기능 명세: 통합 PPT Export (All-in-One)
"전체 내보내기" 버튼 클릭 시 다음 로직을 수행합니다.

### 1. Slide 1: System Configuration
- 논리 좌표 및 자동 정렬된 연결선 사용.

### 2. Slide 2 & 3: Cable Guide & Request
- **배경 이미지 처리 (Aspect Ratio)**:
    - 업로드된 `floorPlanImage`를 슬라이드에 삽입할 때, 슬라이드 크기(10x5.625 inch)에 맞추되 **비율을 유지(contain)**하며 중앙 정렬해야 합니다.
    - `pptx.addImage({ data: img, x: 'center', y: 'center', w: '95%', h: '95%', sizing: { type: 'contain' } })`
- **좌표 변환**:
    - 웹 캔버스의 도면 위치/크기와 PPT 슬라이드의 도면 위치/크기 비율(`scaleRatio`)을 계산하여 노드와 마커 좌표를 변환해야 정확한 위치에 표시됩니다.

### 3. Slide 4: Hardware List (BOM)
- Local/Company 테이블 분리 생성.

### 4. Slide 5+: Hardware Image Gallery
- 4열 그리드, 페이지 분할 적용.

## IX. 상세 기능 명세: 프로젝트 로컬 저장 (JSON)
- **파일 최적화**: `floorPlanImage`가 매우 클 경우 JSON 파일이 무거워질 수 있으므로, 저장 시 경고 문구를 띄우거나 이미지를 제외하고 저장하는 옵션을 제공하는 것을 고려합니다. (기본은 포함)

## X. AI 코딩 지침 (구현 순서)
AI에게 다음 순서로 코딩을 요청하십시오.

1.  **Step 1: 인증 및 기본 구조**
    - Firebase `signInAnonymously`를 앱 시작 시 자동 실행하도록 구현 (로그인 화면 없음).
    - 데이터 구조(좌표계 분리 등) 정의.
2.  **Step 2: 뷰 매니저 및 초기 배치**
    - 물리 뷰 진입 시 `logicalPos`의 렌더링 좌표를 `physicalPos`로 복사하는 로직 구현.
3.  **Step 3: 렌더러 분기 처리**
    - 모드에 따라 선을 그리는 소스 데이터(`points`)를 다르게 참조하도록 `render()` 함수 수정.
4.  **Step 4: Request 및 통합 Export**
    - PPT 생성 시 배경 이미지 비율 유지(`sizing: contain`) 및 좌표 스케일링 로직 정밀 구현.
>>>>>>> 69958a1430fa59ef7d54047e968a915e3f18feb4
