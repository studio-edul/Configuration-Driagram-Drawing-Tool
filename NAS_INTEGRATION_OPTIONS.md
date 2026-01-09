# NAS 서버 구현 방식 비교: 옵션 A vs 옵션 C

## 옵션 A: Synology DSM API (FileStation) 직접 사용

### 개요
브라우저에서 직접 Synology의 공식 FileStation API를 호출하여 파일을 저장/불러오는 방식

### 장점
1. **공식 API**: Synology에서 공식 제공하는 안정적인 API
2. **기능 풍부**: 파일 업로드, 다운로드, 목록 조회, 폴더 생성 등 다양한 기능 제공
3. **추가 서버 불필요**: 백엔드 서버를 별도로 구축할 필요 없음
4. **유지보수 간단**: 서버 관리 부담 없음

### 단점
1. **CORS 문제**: 브라우저에서 직접 API 호출 시 CORS(Cross-Origin Resource Sharing) 차단 가능
   - 해결 방법:
     - NAS에서 CORS 허용 설정 (가능한 경우)
     - 브라우저 확장 프로그램 사용 (개발용)
     - 프록시 서버 사용 (옵션 C와 유사)
2. **보안 고려사항**: 인증 정보를 클라이언트에 저장해야 함
   - 세션 토큰을 브라우저에 저장
   - HTTPS 사용 필수 권장

### 구현 예시 구조
```
브라우저 (클라이언트)
    ↓ HTTP 요청
Synology NAS API
    ↓ 응답
브라우저 (클라이언트)
```

### 필요한 작업
- NASManager.js에서 직접 API 호출
- 세션 기반 인증 구현
- CORS 해결 방법 결정

---

## 옵션 C: 백엔드 프록시 서버 사용

### 개요
중간에 프록시 서버를 두고, 브라우저는 프록시 서버에 요청을 보내고, 프록시 서버가 NAS API를 호출하는 방식

### 장점
1. **CORS 문제 해결**: 프록시 서버가 중간에서 요청을 처리하므로 CORS 문제 없음
2. **보안 강화**: NAS 인증 정보를 서버에만 저장 (클라이언트에 노출 안 됨)
3. **유연한 구현**: 서버에서 추가 로직 구현 가능 (인증, 로깅, 캐싱 등)
4. **에러 처리 용이**: 서버에서 통합된 에러 처리 가능

### 단점
1. **추가 서버 필요**: 별도의 서버 구축 및 배포 필요
2. **유지보수 부담**: 서버 관리 및 모니터링 필요
3. **비용**: 서버 호스팅 비용 발생 가능 (Vercel은 무료 플랜 제공)

### 구현 예시 구조
```
브라우저 (클라이언트)
    ↓ HTTP 요청
프록시 서버 (Vercel/Node.js)
    ↓ HTTP 요청
Synology NAS API
    ↓ 응답
프록시 서버
    ↓ 응답
브라우저 (클라이언트)
```

---

## 옵션 C 구현 플랫폼 비교

### 1. Node.js (Express) - 전통적인 방법

#### 장점
- 완전한 제어 가능
- 복잡한 로직 구현 용이
- 파일 시스템 직접 접근 가능

#### 단점
- 서버 구축 및 관리 필요
- 배포 환경 구성 필요 (VPS, 클라우드 등)
- 24/7 운영 필요 시 비용 발생

#### 예시 구조
```
프로젝트/
├── client/          # 기존 프론트엔드 코드
└── server/          # 새로 추가
    ├── index.js     # Express 서버
    ├── routes/
    │   └── nas.js   # NAS API 프록시 라우트
    └── package.json
```

---

### 2. Vercel Serverless Functions - 추천 ⭐

#### 장점
- **무료 플랜 제공**: 개인 프로젝트에 충분
- **서버 관리 불필요**: Vercel이 자동으로 관리
- **자동 스케일링**: 트래픽에 따라 자동 확장
- **간단한 배포**: Git 푸시만으로 배포
- **빠른 응답**: 전 세계 CDN 활용

#### 단점
- **Cold Start**: 첫 요청 시 약간의 지연 가능 (보통 100-500ms)
- **실행 시간 제한**: 무료 플랜은 10초 제한 (Hobby 플랜은 60초)
- **파일 크기 제한**: 요청/응답 크기 제한 (4.5MB)

#### 구현 구조
```
프로젝트/
├── src/                    # 기존 프론트엔드 코드
├── api/                    # Vercel Serverless Functions
│   └── nas/
│       ├── upload.js      # 프로젝트 업로드
│       ├── download.js    # 프로젝트 다운로드
│       └── list.js        # 프로젝트 목록
└── vercel.json            # Vercel 설정
```

#### 예시 코드 (Vercel Serverless Function)
```javascript
// api/nas/upload.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // NAS API 호출
  const nasResponse = await fetch('https://your-nas.com/webapi/...', {
    method: 'POST',
    headers: {
      'Cookie': `id=${sessionId}`,
      // ...
    },
    body: req.body
  });

  const data = await nasResponse.json();
  return res.status(200).json(data);
}
```

#### Vercel 사용 시 주의사항
- **환경변수**: NAS 인증 정보는 Vercel 환경변수로 저장
- **타임아웃**: 함수 실행 시간이 짧아야 함 (대용량 파일 처리 시 주의)
- **비용**: 무료 플랜으로 시작 가능, 필요 시 업그레이드

---

### 3. 기타 플랫폼 옵션

#### Netlify Functions
- Vercel과 유사한 서버리스 함수 제공
- 무료 플랜 제공

#### AWS Lambda
- 더 많은 기능과 제어 가능
- 설정이 복잡할 수 있음

#### Railway / Render
- 전통적인 서버 방식
- 간단한 배포 가능

---

## 추천 방안

### 시나리오별 추천

#### 1. 빠른 프로토타입 / 개인 프로젝트
**→ 옵션 C (Vercel Serverless Functions) 추천**
- 설정이 간단하고 무료로 시작 가능
- 서버 관리 부담 없음
- CORS 문제 자동 해결

#### 2. CORS 설정이 가능한 경우
**→ 옵션 A 추천**
- 가장 간단한 구조
- 추가 서버 불필요
- NAS에서 CORS 허용 설정 가능 시

#### 3. 복잡한 로직이 필요한 경우
**→ 옵션 C (Node.js Express) 추천**
- 완전한 제어 필요 시
- 파일 처리, 캐싱 등 복잡한 로직 필요 시

---

## 최종 추천: 옵션 C (Vercel Serverless Functions)

### 추천 이유
1. **간단한 설정**: 몇 개의 함수 파일만 추가하면 됨
2. **무료 시작**: 개인 프로젝트에 충분한 무료 플랜
3. **CORS 자동 해결**: 프록시 역할로 CORS 문제 없음
4. **보안**: NAS 인증 정보를 서버에만 저장
5. **유지보수**: 서버 관리 불필요, Vercel이 자동 처리

### 구현 난이도
- **옵션 A**: ⭐⭐⭐ (CORS 해결 필요)
- **옵션 C (Vercel)**: ⭐⭐ (간단한 함수 작성)
- **옵션 C (Node.js)**: ⭐⭐⭐⭐ (서버 구축 및 배포 필요)

---

## 다음 단계

1. **옵션 C (Vercel) 선택 시**:
   - [ ] Vercel 계정 생성
   - [ ] 프로젝트에 `api/` 폴더 생성
   - [ ] Serverless Functions 작성
   - [ ] 환경변수 설정 (NAS 인증 정보)
   - [ ] 배포 및 테스트

2. **옵션 A 선택 시**:
   - [ ] NAS CORS 설정 확인
   - [ ] NASManager.js 구현
   - [ ] 브라우저에서 직접 테스트
