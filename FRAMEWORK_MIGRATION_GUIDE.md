# 프레임워크 마이그레이션 가이드

## 현재 프로젝트 특성 분석

### 기술 스택
- **Vanilla JavaScript (ES Modules)**
- **Konva.js** - Canvas 기반 렌더링 (복잡한 그래픽 상호작용)
- **Tailwind CSS** - 유틸리티 CSS 프레임워크
- **PptxGenJS** - PPT 생성
- **복잡한 상태 관리** - DataStore (Observer 패턴)
- **Manager 패턴** - 여러 Manager 클래스로 기능 분리

### 프로젝트 특징
1. **Canvas 기반 그래픽 편집기** - 드래그, 선택, 연결 등 복잡한 상호작용
2. **실시간 렌더링** - 노드 추가/수정/삭제 시 즉시 반영
3. **복잡한 상태 관리** - 여러 모드(Configuration/Installation/Network) 전환
4. **클래스 기반 구조** - Manager 패턴으로 기능 분리
5. **직접 DOM 조작** - 이벤트 리스너 직접 등록

---

## 프레임워크 비교 및 추천

### 1. React ⭐⭐⭐⭐⭐ (가장 추천)

#### 장점
- **커뮤니티가 가장 큼** - 문제 해결 자료가 많음
- **Konva.js 통합 우수** - `react-konva` 라이브러리로 완벽한 통합
- **상태 관리 라이브러리 풍부** - Zustand, Redux, Jotai 등
- **TypeScript 지원 우수** - 타입 안정성 확보 가능
- **Vite 빌드 도구** - 빠른 개발 환경
- **재사용 가능한 컴포넌트** - Manager들을 Hook으로 변환 가능

#### 단점
- **학습 곡선** - JSX, Hook 등 학습 필요
- **번들 크기** - 약간 큰 편 (하지만 코드 스플리팅으로 해결 가능)

#### 마이그레이션 난이도
- **중간** - Manager 클래스를 Custom Hook으로 변환
- DataStore는 Context API 또는 Zustand로 변환 가능

#### 예시 구조
```javascript
// Manager → Custom Hook
function useInteractionManager() {
  const [selectedCable, setSelectedCable] = useState(null);
  // ... 기존 로직
  return { selectedCable, handleNodeClick, ... };
}

// Konva 통합
import { Stage, Layer, Group } from 'react-konva';
```

#### 추천 이유
- **react-konva**로 Konva.js와 완벽한 통합
- 현재 Manager 패턴을 Hook 패턴으로 자연스럽게 변환 가능
- 가장 많은 자료와 예제

---

### 2. Vue.js ⭐⭐⭐⭐

#### 장점
- **점진적 도입 가능** - 기존 코드와 함께 사용 가능
- **템플릿 기반** - HTML에 가까워서 직관적
- **Composition API** - React Hook과 유사한 패턴
- **성능 우수** - 가상 DOM 최적화
- **TypeScript 지원** - Vue 3에서 완벽 지원

#### 단점
- **Konva 통합** - `vue-konva`가 있지만 React보다 덜 성숙
- **커뮤니티** - React보다 작음

#### 마이그레이션 난이도
- **중간** - Manager를 Composable로 변환

#### 예시 구조
```javascript
// Manager → Composable
export function useInteractionManager() {
  const selectedCable = ref(null);
  // ... 기존 로직
  return { selectedCable, handleNodeClick, ... };
}
```

---

### 3. Svelte ⭐⭐⭐

#### 장점
- **번들 크기 작음** - 컴파일 타임 최적화
- **직관적인 문법** - 학습 곡선 낮음
- **성능 우수** - 가상 DOM 없이 직접 DOM 조작
- **빌드 결과물 작음** - 최종 번들 크기가 작음

#### 단점
- **Konva 통합** - 공식 라이브러리 부족, 직접 통합 필요
- **커뮤니티 작음** - 자료가 상대적으로 적음
- **TypeScript 지원** - 완벽하지 않음

#### 마이그레이션 난이도
- **높음** - Konva 통합을 직접 구현해야 함

---

### 4. Angular ⭐⭐

#### 장점
- **엔터프라이즈급** - 대규모 프로젝트에 적합
- **완전한 프레임워크** - 라우팅, 상태관리 등 내장

#### 단점
- **과도한 복잡성** - 현재 프로젝트에는 과함
- **학습 곡선 높음** - TypeScript, RxJS 등 학습 필요
- **번들 크기 큼** - 가장 큰 편

#### 마이그레이션 난이도
- **매우 높음** - 구조를 완전히 재작성해야 함

---

## 최종 추천: React + Vite + TypeScript

### 추천 이유

1. **Konva.js 통합**
   - `react-konva` 라이브러리로 완벽한 통합
   - 현재 Visualizer 클래스를 React 컴포넌트로 자연스럽게 변환 가능

2. **상태 관리**
   - 현재 DataStore를 **Zustand** 또는 **Context API**로 변환
   - Manager 클래스를 **Custom Hook**으로 변환

3. **점진적 마이그레이션 가능**
   - 한 번에 다 바꾸지 않고, 컴포넌트 단위로 점진적 마이그레이션 가능

4. **개발 생산성**
   - Hot Module Replacement (HMR)로 빠른 개발
   - TypeScript로 타입 안정성 확보

5. **커뮤니티**
   - 가장 많은 자료와 예제
   - 문제 해결이 쉬움

---

## 마이그레이션 전략

### Phase 1: 빌드 시스템 구축
1. Vite + React + TypeScript 프로젝트 생성
2. 기존 라이브러리 설치 (Konva, PptxGenJS 등)
3. Tailwind CSS 설정

### Phase 2: 핵심 컴포넌트 마이그레이션
1. **DataStore → Zustand Store**
   ```typescript
   import { create } from 'zustand';
   
   interface ProjectState {
     nodes: Record<string, Node>;
     // ...
   }
   
   export const useProjectStore = create<ProjectState>((set) => ({
     nodes: {},
     // ...
   }));
   ```

2. **Visualizer → React Konva Component**
   ```typescript
   import { Stage, Layer, Group } from 'react-konva';
   
   export function CanvasVisualizer() {
     const nodes = useProjectStore((state) => state.nodes);
     // ...
     return (
       <Stage>
         <Layer>
           {/* 노드 렌더링 */}
         </Layer>
       </Stage>
     );
   }
   ```

3. **Manager → Custom Hook**
   ```typescript
   export function useInteractionManager() {
     const selectedCable = useProjectStore((state) => state.selectedCable);
     // 기존 InteractionManager 로직
     return { selectedCable, handleNodeClick, ... };
   }
   ```

### Phase 3: UI 컴포넌트 마이그레이션
1. HTML → JSX 변환
2. 이벤트 핸들러를 React 방식으로 변환
3. Tailwind CSS 클래스는 그대로 유지

### Phase 4: 최적화
1. 코드 스플리팅
2. 메모이제이션 (useMemo, useCallback)
3. 성능 최적화

---

## 마이그레이션 시 주의사항

### 1. Konva.js 통합
- `react-konva` 사용 시 ref를 통해 직접 Konva 인스턴스 접근 가능
- 기존 Konva 코드를 최대한 재사용 가능

### 2. 상태 관리
- 현재 DataStore의 Observer 패턴을 React의 상태 관리로 변환
- Zustand 추천 (가볍고 사용하기 쉬움)

### 3. 이벤트 처리
- 기존 `addEventListener` → React의 `onClick`, `onMouseDown` 등
- 이벤트 위임 패턴을 React 컴포넌트 구조로 변환

### 4. 성능
- Canvas 렌더링은 여전히 Konva가 담당하므로 성능 차이 없음
- React는 UI 상태 관리만 담당

---

## 예상 소요 시간

- **소규모 마이그레이션** (핵심 기능만): 2-3주
- **전체 마이그레이션**: 1-2개월
- **점진적 마이그레이션** (권장): 2-3개월 (기능 추가하면서 점진적으로)

---

## 결론

**React + Vite + TypeScript + Zustand** 조합을 강력 추천합니다.

이유:
1. ✅ Konva.js와의 완벽한 통합 (`react-konva`)
2. ✅ 현재 구조를 자연스럽게 변환 가능 (Manager → Hook)
3. ✅ 가장 많은 자료와 커뮤니티 지원
4. ✅ 점진적 마이그레이션 가능
5. ✅ TypeScript로 타입 안정성 확보

현재 프로젝트의 복잡한 Canvas 상호작용을 고려할 때, React가 가장 적합한 선택입니다.
