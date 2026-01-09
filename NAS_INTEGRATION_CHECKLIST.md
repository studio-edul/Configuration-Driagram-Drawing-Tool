# 시놀로지 NAS 연동 개발 체크리스트

## 📋 사전 준비 사항

### 1. NAS 접속 정보 수집
- [ ] NAS IP 주소 또는 도메인 확인
  - 예: `192.168.1.100` 또는 `nas.example.com`
- [ ] 포트 번호 확인
  - HTTP: 기본 `5000`
  - HTTPS: 기본 `5001`
- [ ] 사용자 계정 정보
  - 계정 ID: `_________________`
  - 비밀번호: `_________________`
- [ ] 프로토콜 선택
  - [ ] HTTP
  - [ ] HTTPS (권장)

### 2. NAS 설정 확인
- [ ] FileStation 패키지 설치 및 활성화 여부 확인
- [ ] API 접근 권한 확인
  - 제어판 > 터미널 및 SNMP > SSH 서비스 활성화 여부
  - Web API 활성화 여부
- [ ] 저장 폴더 생성
  - 경로: `_________________`
  - 예: `/volume1/projects/` 또는 `/web/projects/`
- [ ] 폴더 권한 설정
  - 읽기 권한: `_________________`
  - 쓰기 권한: `_________________`

### 3. 네트워크 설정 확인
- [ ] 방화벽 규칙 확인
  - 특정 IP만 허용하는지 확인
  - 필요 시 허용 IP 추가
- [ ] CORS 설정 확인 (옵션 A 사용 시)
  - NAS에서 CORS 허용 설정 가능 여부 확인
  - 불가능 시 프록시 서버 필요

---

## 🔧 구현 방식 선택

### 옵션 A: Synology DSM API (FileStation)
- [ ] 선택 여부: `□`
- [ ] 장점: 공식 API, 안정적, 기능 풍부
- [ ] 단점: CORS 이슈 가능성, 브라우저에서 직접 호출 시 제한
- [ ] 필요한 작업:
  - [ ] API 엔드포인트 확인 (`/webapi/FileStation/...`)
  - [ ] 세션 기반 인증 구현
  - [ ] CORS 해결 방법 결정 (프록시 또는 NAS 설정)

### 옵션 C: 백엔드 프록시 서버
- [ ] 선택 여부: `□`
- [ ] 장점: CORS 우회, 보안 강화, 유연한 구현
- [ ] 단점: 추가 서버 필요, 배포 및 유지보수 필요
- [ ] 플랫폼 선택:
  - [ ] Node.js (Express)
  - [ ] Vercel Serverless Functions
  - [ ] 기타: `_________________`
- [ ] 필요한 작업:
  - [ ] 프록시 서버 구축
  - [ ] NAS API 호출 로직 구현
  - [ ] 인증 정보 관리 방법 결정

---

## 📁 파일 구조 계획

### 새로 생성할 파일
- [ ] `src/config/nas-config.js` - NAS 설정 파일
- [ ] `src/managers/NASManager.js` - NAS API 클라이언트
- [ ] (옵션 C 선택 시) `server/` 디렉토리 및 관련 파일

### 수정할 파일
- [ ] `src/managers/ProjectManager.js` - 저장/불러오기 로직 추가
- [ ] `index.html` - UI 버튼 추가 (NAS에서 불러오기)

---

## 🚀 개발 단계별 체크리스트

### Phase 1: NAS 연결 설정 및 인증 모듈
- [ ] `src/config/nas-config.js` 생성
  - [ ] NAS 접속 정보 저장 구조 설계
  - [ ] 환경변수 또는 설정 파일 방식 결정
- [ ] `src/managers/NASManager.js` 생성
  - [ ] 인증 기능 구현 (DSM API 세션 로그인)
  - [ ] 연결 테스트 기능 구현
  - [ ] 에러 처리 로직 추가

### Phase 2: 프로젝트 저장 기능 구현
- [ ] `ProjectManager.js` 수정
  - [ ] `saveProjectToNAS(projectData)` 메서드 추가
  - [ ] `exportProject()` 수정 (로컬 다운로드 + NAS 업로드)
  - [ ] 저장 성공/실패 피드백 추가
- [ ] 저장 데이터 구조 확인
  - [ ] `hardwareList` 포함 확인
  - [ ] `hardwareListMetadata` 포함 확인
  - [ ] 모든 필수 데이터 포함 여부 검증

### Phase 3: 프로젝트 불러오기 기능 구현
- [ ] `ProjectManager.js` 수정
  - [ ] `listProjectsFromNAS()` 메서드 추가
  - [ ] `loadProjectFromNAS(projectId)` 메서드 추가
  - [ ] 기존 `importProject()` 로직 재사용
- [ ] UI 수정 (`index.html`)
  - [ ] "NAS에서 불러오기" 버튼 추가
  - [ ] 프로젝트 목록 표시 모달 추가
  - [ ] 프로젝트 선택 UI 구현

### Phase 4: 에러 처리 및 사용자 경험 개선
- [ ] 에러 처리
  - [ ] 네트워크 오류 처리
  - [ ] 인증 실패 처리
  - [ ] 파일 저장/불러오기 실패 처리
- [ ] UI/UX 개선
  - [ ] 로딩 인디케이터 추가
  - [ ] 성공/실패 메시지 표시
  - [ ] 자동 저장 옵션 (선택사항)

---

## 🔒 보안 고려사항

- [ ] 인증 정보 보안
  - [ ] NAS 계정 정보 하드코딩 금지
  - [ ] 설정 파일 `.gitignore` 추가
  - [ ] 환경변수 사용 또는 사용자 입력 방식 결정
- [ ] 파일명 충돌 방지
  - [ ] 동일 프로젝트명 저장 시 처리 방법 결정
  - [ ] 타임스탬프 기반 고유 파일명 생성
- [ ] 네트워크 보안
  - [ ] HTTPS 사용 여부 확인
  - [ ] 인증 토큰 만료 처리

---

## 🧪 테스트 체크리스트

- [ ] NAS 연결 테스트
- [ ] 프로젝트 저장 테스트
- [ ] 프로젝트 불러오기 테스트
- [ ] 하드웨어 리스트 포함 여부 확인
- [ ] 하드웨어 리스트 메타데이터 포함 여부 확인
- [ ] 에러 상황 테스트 (네트워크 오류, 인증 실패 등)
- [ ] 오프라인 상황 대응 테스트

---

## 📝 참고 정보

### Synology DSM API 엔드포인트
- 로그인: `POST /webapi/auth.cgi`
- 파일 업로드: `POST /webapi/FileStation/upload.cgi`
- 파일 다운로드: `GET /webapi/FileStation/download.cgi`
- 파일 목록: `GET /webapi/FileStation/list.cgi`
- 파일 생성: `POST /webapi/FileStation/create_folder.cgi`

### API 문서 참조
- 공식 문서: https://global.download.synology.com/download/Document/Software/DeveloperGuide/Package/FileStation/All/enu/Synology_File_Station_API_Guide.pdf

---

## 📅 개발 일정 (예상)

- Phase 1: NAS 연결 및 인증 모듈 - `____일`
- Phase 2: 프로젝트 저장 기능 - `____일`
- Phase 3: 프로젝트 불러오기 기능 - `____일`
- Phase 4: 에러 처리 및 UX 개선 - `____일`

**총 예상 기간**: `____일`

---

## 💡 추가 고려사항

- [ ] 자동 저장 기능 (선택사항)
- [ ] 프로젝트 버전 관리 (선택사항)
- [ ] 프로젝트 삭제 기능 (선택사항)
- [ ] 프로젝트 이름 변경 기능 (선택사항)
- [ ] 프로젝트 검색 기능 (선택사항)
