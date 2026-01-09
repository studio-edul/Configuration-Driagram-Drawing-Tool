# 자동 저장 기능 구현 계획

## 문제점
현재 새로고침하면 작업 중이던 모든 내용이 사라지는 문제가 있습니다.

## 해결 방법
**백엔드 불필요** - 브라우저의 LocalStorage를 사용하여 클라이언트 측에서 해결

## 구현 방식

### 1. LocalStorage 기반 자동 저장
- DataStore의 `notify()` 메서드가 호출될 때마다 자동으로 LocalStorage에 저장
- 디바운싱 적용 (너무 자주 저장하지 않도록, 예: 1초마다 최대 1회)
- 페이지 로드 시 LocalStorage에서 자동 복원

### 2. 저장 데이터 구조
현재 `exportProject()`에서 사용하는 것과 동일한 구조 사용:
```javascript
{
  version: '1.0.2',
  savedAt: new Date().toISOString(),
  meta: { ... },
  nodes: { ... },
  networkNodes: { ... },
  configurationConnections: { ... },
  installationConnections: { ... },
  networkConnections: { ... },
  requests: { ... }
}
```

### 3. 구현 위치
- `DataStore.js`에 자동 저장/복원 로직 추가
- 또는 `ProjectManager.js`에 자동 저장 기능 추가

## 구현 단계

### Phase 1: DataStore에 자동 저장 기능 추가
- [ ] `DataStore.js`에 `saveToLocalStorage()` 메서드 추가
- [ ] `DataStore.js`에 `loadFromLocalStorage()` 메서드 추가
- [ ] `notify()` 메서드에서 디바운싱된 자동 저장 호출
- [ ] 생성자에서 LocalStorage 데이터 자동 로드

### Phase 2: 사용자 경험 개선
- [ ] 저장 상태 표시 (예: "자동 저장됨" 메시지)
- [ ] 저장 실패 시 에러 처리
- [ ] LocalStorage 용량 제한 고려 (일반적으로 5-10MB)

### Phase 3: 선택적 기능
- [ ] "자동 저장 비활성화" 옵션
- [ ] "저장된 데이터 삭제" 기능
- [ ] 여러 프로젝트 관리 (LocalStorage에 여러 프로젝트 저장)

## 장점
1. **백엔드 불필요**: 서버 없이 클라이언트에서만 동작
2. **즉시 적용**: 사용자가 아무것도 하지 않아도 자동 저장
3. **오프라인 동작**: 인터넷 연결 없이도 작동
4. **간단한 구현**: 기존 코드에 최소한의 수정만 필요

## 주의사항
1. **LocalStorage 용량 제한**: 약 5-10MB (대용량 이미지 포함 시 주의)
2. **브라우저별 차이**: 모든 브라우저에서 지원되지만 용량 제한이 다를 수 있음
3. **보안**: LocalStorage는 클라이언트에 저장되므로 민감한 정보는 저장하지 않기
4. **데이터 손실**: 브라우저 데이터 삭제 시 손실 가능 (NAS 저장과 병행 권장)

## NAS 저장과의 관계
- **LocalStorage**: 임시 자동 저장 (새로고침 방지)
- **NAS 저장**: 영구 저장 (프로젝트 백업 및 공유)

두 가지를 함께 사용하면:
- 작업 중: LocalStorage에 자동 저장 (새로고침 방지)
- 완료 후: NAS에 수동 저장 (영구 보관)
