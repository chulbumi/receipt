# 영수증 관리 시스템 (Receipt Manager) - 개발 계획서

## 프로젝트 개요

법인카드 사용 후 영수증을 촬영하여 AI(Gemini 2.0 Flash Lite)로 내용을 자동 추출하고,
사용 내역을 체계적으로 관리하는 모바일 반응형 웹 애플리케이션.

- **사용자**: 약 40~50명 직원
- **플랫폼**: Android/iOS 모바일 브라우저 (반응형 웹)
- **인프라**: AWS 서버리스 (Lambda, API Gateway, DynamoDB, S3, CloudFront)

---

## 기술 스택

| 구분 | 기술 | 비고 |
|------|------|------|
| **프론트엔드** | React 18 + TypeScript | Vite 빌드 |
| **UI 프레임워크** | Material UI (MUI) v5 | 모바일 퍼스트 |
| **백엔드 API** | FastAPI (Python 3.11) | Lambda + Mangum 어댑터 |
| **인증** | JWT + bcrypt | 로그인 유지(localStorage) |
| **데이터베이스** | DynamoDB | 서버리스 NoSQL |
| **파일 저장소** | S3 | 영수증 이미지 |
| **CDN/호스팅** | S3 + CloudFront | 프론트엔드 정적 호스팅 |
| **AI/OCR** | Google Gemini 2.0 Flash Lite | 영수증 텍스트 추출 |
| **배포** | AWS CLI / 배포 스크립트 | 수동 IaC |

---

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                    모바일 브라우저                         │
│              (React + MUI, 반응형 웹)                     │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS
                       ▼
              ┌─────────────────┐
              │  CloudFront CDN │ ← S3 (정적 호스팅)
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │  API Gateway    │ (REST API)
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │  AWS Lambda     │ (FastAPI + Mangum)
              │                 │
              │  ┌───────────┐  │
              │  │ 인증 미들웨어│  │
              │  │ API 라우터  │  │
              │  │ Gemini 연동 │  │
              │  └───────────┘  │
              └──┬─────┬────┬──┘
                 │     │    │
        ┌────────┘     │    └────────┐
        ▼              ▼             ▼
   ┌─────────┐  ┌───────────┐  ┌──────────┐
   │DynamoDB │  │  S3 Bucket│  │Gemini API│
   │(데이터) │  │ (이미지)  │  │ (AI OCR) │
   └─────────┘  └───────────┘  └──────────┘
```

---

## DynamoDB 테이블 설계

### 1. `receipt_users` - 사용자
| 필드 | 타입 | 설명 |
|------|------|------|
| user_id (PK) | String | 사용자 ID (로그인 ID) |
| name | String | 이름 |
| password_hash | String | bcrypt 해시 |
| role | String | admin / user |
| department | String | 부서 |
| status | String | **active / pending / inactive** (가입 승인 상태) |
| favorite_partners | List[String] | 자주 함께 식사하는 동료 ID 목록 |
| created_at | String | 생성일시 |

### 2. `receipt_records` - 영수증 / 카드 사용 내역
| 필드 | 타입 | 설명 |
|------|------|------|
| record_id (PK) | String | UUID |
| registered_by | String | 등록자 user_id |
| category | String | 중식/석식/음료/접대/주차/교통/택시/철도/구매/기타 |
| approval_number | String | 승인번호 (LLM 추출) |
| store_name | String | 상호명 (LLM 추출) |
| total_amount | Number | 총 결제금액 |
| transaction_date | String | 사용일시 (YYYY-MM-DD HH:mm) |
| order_details | List[Map] | 주문내역 [{item, qty, price}] |
| image_key | String | S3 이미지 키 |
| participants | List[Map] | 식사 참여자 [{user_id, name, amount}] |
| memo | String | 메모 |
| created_at | String | 등록일시 |
| year_month (GSI-PK) | String | YYYY-MM (월별 조회용) |
| registered_by_date (GSI-SK) | String | user_id#YYYY-MM-DD (사용자별 일별 조회) |

### 3. `receipt_cards` - 법인카드 정보
| 필드 | 타입 | 설명 |
|------|------|------|
| card_id (PK) | String | 카드 식별 ID |
| user_id (GSI) | String | 보유자 user_id |
| card_name | String | 카드 별칭 |
| card_last4 | String | 카드 뒷 4자리 |
| monthly_limit | Number | 월 한도 |

---

## 화면 구성

### 사용자 화면
1. **로그인** - ID/PW 입력, "로그인 유지" 체크박스, 회원가입 신청 버튼
2. **회원가입 신청** - 아이디/이름/부서/비밀번호 입력 → pending 상태로 등록
3. **홈 (대시보드)** - 이번달 누적 사용금액, 최근 사용내역, 퀵 액션 버튼
4. **영수증 등록** - 카메라 촬영(핀치 줌), AI 자동 추출, 참여자 지정, 금액 분배
5. **사용 내역** - 리스트/필터 (기간, 카테고리)
6. **달력 보기** - 월별 달력에 일별 사용금액 표시
7. **법인카드 현황** - 보유 카드별 이번달 누적/한도
8. **더보기/설정** - ⭐ 별표 즐겨찾기 동료 관리, 비밀번호 변경, 로그아웃

### 관리자 화면
9. **관리자 대시보드** - 전체 사용 현황 요약
10. **일별/월별 리포트** - 전체 직원 사용 내역 (필터/검색)
11. **사용자별 리포트** - 개인별 사용 금액 집계 (함께 결제해도 인당 금액 확인)
12. **사용자 관리** - 직원 계정 CRUD + **승인 대기(pending) 계정 승인/반려**

---

## 개발 작업 체크리스트

### Phase 1: 프로젝트 초기 설정 및 인프라

- [x] **1.1** 프론트엔드 프로젝트 생성 (Vite + React + TypeScript)
- [x] **1.2** MUI 및 주요 의존성 설치 (react-router, axios, date-fns 등)
- [x] **1.3** 백엔드 프로젝트 생성 (FastAPI + 프로젝트 구조)
- [x] **1.4** AWS S3 버킷 생성 (영수증 이미지 저장용: `receipt-images-493162620368`)
- [x] **1.5** AWS S3 버킷 생성 (프론트엔드 정적 호스팅용: `receipt-frontend-493162620368`)
- [x] **1.6** DynamoDB 테이블 생성 (users, records, cards - PAY_PER_REQUEST)
- [x] **1.7** AWS Lambda + API Gateway 설정 (함수: `receipt-api`)
- [x] **1.8** CloudFront 배포 설정 (Distribution: `E2VTVSTBPIEODN`)
- [x] **1.9** CORS 및 보안 정책 설정 (S3 OAC, 퍼블릭 액세스 차단)

### Phase 2: 인증 시스템

- [x] **2.1** 백엔드: 관리자용 사용자 등록 API (`POST /api/auth/register`) — 즉시 active
- [x] **2.2** 백엔드: 직원 자체 회원가입 API (`POST /api/auth/signup`) — pending 상태 ✅
- [x] **2.3** 백엔드: 로그인 API (`POST /api/auth/login`) — pending/inactive 계정 차단 ✅
- [x] **2.4** 백엔드: 토큰 갱신 API (`POST /api/auth/refresh`) — 계정 상태 재확인 포함
- [x] **2.5** 백엔드: JWT 인증 미들웨어
- [x] **2.6** 프론트: 로그인 화면 (ID/PW, 로그인 유지 체크박스)
- [x] **2.7** 프론트: 회원가입 신청 화면 (로그인 페이지 내 전환) ✅
- [x] **2.8** 프론트: 인증 상태 관리 (Context/localStorage)
- [x] **2.9** 프론트: 라우트 가드 (미인증 → 로그인 리다이렉트)
- [x] **2.10** 초기 관리자 계정 시딩 스크립트 (`admin / Admin1234!`)

### Phase 3: 영수증 촬영 및 AI 추출 (핵심 기능)

- [x] **3.1** 프론트: 카메라 접근 컴포넌트 (MediaDevices API)
- [x] **3.2** 프론트: 핀치 줌 (두 손가락 확대/축소) 구현 (Pointer Events)
- [x] **3.3** 프론트: 이미지 리사이즈/압축 (Canvas API, 최대 1280px, JPEG 75%)
- [x] **3.4** 백엔드: 이미지 업로드 API (`POST /api/receipts/analyze`)
- [x] **3.5** 백엔드: S3 presigned URL 발급 및 직접 업로드
- [x] **3.6** 백엔드: Gemini 2.0 Flash Lite 연동 - 영수증 OCR
- [x] **3.7** 백엔드: LLM 프롬프트 최적화 (승인번호, 상호, 금액, 일시, 주문내역 추출)
- [x] **3.8** 백엔드: 추출 결과 반환 API
- [x] **3.9** 프론트: AI 추출 결과 확인/수정 화면
- [x] **3.10** 프론트: 갤러리에서 이미지 선택 기능 (촬영 외)

### Phase 4: 식사 참여자 지정 및 금액 분배

- [x] **4.1** 백엔드: 사용자 목록 조회 API (`GET /api/users`) — `is_favorite` 포함, 즐겨찾기 우선 정렬 ✅
- [x] **4.2** 백엔드: 즐겨찾기 토글 API (`POST /api/users/me/partners/toggle`) ✅
- [x] **4.3** 백엔드: 즐겨찾기 전체 업데이트 API (`PUT /api/users/me/partners`)
- [x] **4.4** 프론트: 참여자 선택 UI — ⭐ 별표 토글 + 즐겨찾기 섹션 분리 ✅
- [x] **4.5** 프론트: 금액 분배 UI (균등 분할 / 개별 입력)
- [x] **4.6** 프론트: 참여자별 금액 조정 인터페이스

### Phase 5: 영수증(카드 사용내역) 등록 완료

- [x] **5.1** 백엔드: 카드 사용내역 등록 API (`POST /api/records`)
- [x] **5.2** 백엔드: 카테고리 분류 (중식/석식/음료/접대/주차/교통/택시/철도/구매/기타)
- [x] **5.3** 프론트: 등록 폼 (카테고리 선택, 메모, 최종 확인)
- [x] **5.4** 프론트: 등록 완료 후 홈으로 이동

### Phase 6: 사용 내역 조회

- [x] **6.1** 백엔드: 내 사용내역 조회 API (`GET /api/records/me`)
- [x] **6.2** 백엔드: 기간/카테고리 필터 지원
- [x] **6.3** 프론트: 사용내역 리스트 화면
- [x] **6.4** 프론트: 필터 (기간, 카테고리) UI
- [x] **6.5** 프론트: 내역 상세 보기 (영수증 이미지, 참여자, 금액)
- [x] **6.6** 프론트: 내역 수정/삭제

### Phase 7: 달력 보기

- [x] **7.1** 프론트: 월별 달력 컴포넌트 (일별 사용금액 표시)
- [x] **7.2** 백엔드: 월별 일자별 사용금액 집계 API (`GET /api/records/calendar`)
- [x] **7.3** 프론트: 날짜 클릭 시 해당일 사용내역 리스트
- [x] **7.4** 프론트: 월간 합계 표시

### Phase 8: 법인카드 현황

- [x] **8.1** 백엔드: 법인카드 CRUD API (`/api/cards`)
- [x] **8.2** 백엔드: 카드별 월 누적 사용금액 조회 API
- [x] **8.3** 프론트: 법인카드 현황 화면 (카드별 사용금액/한도)
- [x] **8.4** 프론트: 카드 등록/편집

### Phase 9: 관리자 기능

- [x] **9.1** 백엔드: 관리자 권한 미들웨어
- [x] **9.2** 백엔드: 전체 사용내역 조회 API (일별/월별/사용자별)
- [x] **9.3** 백엔드: 사용자별 사용금액 집계 API (함께 결제해도 인당 금액)
- [x] **9.4** 백엔드: 사용자 관리 API (CRUD)
- [x] **9.5** 백엔드: 승인 대기 계정 승인/반려 API (`POST /api/admin/users/{id}/approve|reject`) ✅
- [x] **9.6** 백엔드: 사용자 목록 status 필터 지원 (`GET /api/admin/users?status=pending`) ✅
- [x] **9.7** 프론트: 관리자 대시보드 (전체 사용 현황 요약)
- [x] **9.8** 프론트: 일별/월별 리포트 화면
- [x] **9.9** 프론트: 사용자별 리포트 화면
- [x] **9.10** 프론트: 사용자 관리 화면 — 탭 필터(전체/승인대기/활성/비활성) + 승인/반려 버튼 ✅

### Phase 10: 홈 대시보드 및 네비게이션

- [x] **10.1** 프론트: 하단 네비게이션 바 (홈, 등록, 내역, 달력, 더보기)
- [x] **10.2** 프론트: 홈 대시보드 (이번달 누적금액, 최근 내역, 퀵 액션)
- [x] **10.3** 프론트: 관리자 전용 메뉴 (role 기반 조건부 렌더링)
- [x] **10.4** 프론트: 더보기 → 즐겨찾기 관리 — ⭐ 별표 토글 UI + 검색 ✅

### Phase 11: 배포 및 최적화

- [x] **11.1** 백엔드 Lambda 패키징 및 배포 (`receipt-api`, `PYTHONPATH=/var/task/dependencies`, manylinux 바이너리) ✅
- [x] **11.2** 프론트엔드 빌드 및 S3 + CloudFront 배포 ✅
- [x] **11.3-A** API Gateway Binary Media Type 설정 (`multipart/form-data`) — 이미지 업로드 정상화 ✅
- [ ] **11.3-B** 커스텀 도메인 연결 (선택사항)
- [ ] **11.4** Lambda Cold Start 최적화 (Provisioned Concurrency 검토)
- [ ] **11.5** 이미지 최적화 (S3 저장 시 추가 압축)
- [x] **11.6** 모바일 PWA 설정 (manifest.json, 홈화면 추가)

### Phase 12: 테스트 및 QA

- [ ] **12.1** 백엔드 API 단위 테스트
- [ ] **12.2** Android Chrome 테스트 (카메라, 핀치줌, 영수증 등록 전체 플로우)
- [ ] **12.3** iOS Safari 테스트 (카메라, 핀치줌)
- [ ] **12.4** 다양한 영수증 형식 LLM 추출 정확도 테스트
- [ ] **12.5** 동시 사용자 부하 테스트 (40~50명)

---

## API 엔드포인트 요약

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| POST | `/api/auth/signup` | 직원 자체 회원가입 신청 (→ pending) | public |
| POST | `/api/auth/register` | 관리자 직접 계정 생성 (→ active) | admin |
| POST | `/api/auth/login` | 로그인 (JWT 발급, pending 차단) | public |
| POST | `/api/auth/refresh` | 토큰 갱신 (계정 상태 재확인) | user |
| GET | `/api/auth/me` | 내 정보 조회 | user |
| POST | `/api/auth/change-password` | 비밀번호 변경 | user |
| GET | `/api/users` | 사용자 목록 (is_favorite 포함, 즐겨찾기 정렬) | user |
| POST | `/api/users/me/partners/toggle` | 즐겨찾기 토글 (추가/제거) | user |
| PUT | `/api/users/me/partners` | 즐겨찾기 전체 업데이트 | user |
| GET | `/api/users/me/partners` | 내 즐겨찾기 목록 | user |
| POST | `/api/receipts/analyze` | 영수증 이미지 AI 분석 + S3 업로드 | user |
| GET | `/api/receipts/image-url/{key}` | S3 presigned URL 발급 | user |
| POST | `/api/records` | 카드 사용내역 등록 | user |
| GET | `/api/records/me` | 내 사용내역 조회 | user |
| GET | `/api/records/calendar` | 달력 데이터 조회 | user |
| GET | `/api/records/{id}` | 내역 상세 | user |
| PUT | `/api/records/{id}` | 내역 수정 | user |
| DELETE | `/api/records/{id}` | 내역 삭제 | user |
| GET | `/api/cards` | 내 법인카드 목록 | user |
| POST | `/api/cards` | 법인카드 등록 | user |
| PUT | `/api/cards/{id}` | 법인카드 수정 | user |
| DELETE | `/api/cards/{id}` | 법인카드 삭제 | user |
| GET | `/api/cards/{id}/summary` | 카드 월별 사용 요약 | user |
| GET | `/api/admin/users` | 사용자 목록 (status 필터) | admin |
| POST | `/api/admin/users` | 사용자 생성 (즉시 active) | admin |
| PUT | `/api/admin/users/{id}` | 사용자 편집 (status 변경 포함) | admin |
| POST | `/api/admin/users/{id}/approve` | 가입 승인 (pending → active) | admin |
| POST | `/api/admin/users/{id}/reject` | 가입 반려 (pending → inactive) | admin |
| GET | `/api/admin/records` | 전체 사용내역 (필터) | admin |
| GET | `/api/admin/reports/daily` | 일별 리포트 | admin |
| GET | `/api/admin/reports/monthly` | 월별 리포트 | admin |
| GET | `/api/admin/reports/user/{id}` | 사용자별 리포트 | admin |

---

## 프로젝트 디렉토리 구조

```
receipt/
├── DEVELOPMENT_PLAN.md          # 이 문서
├── .env                         # 환경변수 (git 제외)
├── .env.example                 # 환경변수 예시
├── frontend/                    # React 프론트엔드
│   ├── public/
│   │   ├── manifest.json        # PWA 매니페스트
│   │   └── icons/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api/
│   │   │   └── client.ts        # Axios 인스턴스 + API 클라이언트
│   │   ├── auth/
│   │   │   ├── AuthContext.tsx
│   │   │   ├── LoginPage.tsx    # 로그인 + 회원가입 신청 폼
│   │   │   └── ProtectedRoute.tsx
│   │   ├── components/
│   │   │   ├── BottomNav.tsx
│   │   │   ├── PinchZoomCamera.tsx
│   │   │   └── Layout.tsx
│   │   ├── pages/
│   │   │   ├── HomePage.tsx
│   │   │   ├── ReceiptCapturePage.tsx
│   │   │   ├── ReceiptReviewPage.tsx  # 참여자 선택 ⭐ 별표 UI
│   │   │   ├── RecordListPage.tsx
│   │   │   ├── RecordDetailPage.tsx
│   │   │   ├── CalendarPage.tsx
│   │   │   ├── CardStatusPage.tsx
│   │   │   ├── MorePage.tsx           # 즐겨찾기 ⭐ 별표 관리
│   │   │   └── admin/
│   │   │       ├── AdminDashboard.tsx
│   │   │       ├── AdminRecords.tsx
│   │   │       └── UserManagement.tsx # 승인 대기 탭 + 승인/반려
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── theme/
│   │       └── index.ts
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── backend/                     # FastAPI 백엔드
│   ├── app/
│   │   ├── main.py              # FastAPI 앱 + Mangum 핸들러
│   │   ├── config.py
│   │   ├── auth/
│   │   │   ├── router.py        # 로그인, signup, register, refresh
│   │   │   ├── jwt_handler.py
│   │   │   └── dependencies.py
│   │   ├── receipts/
│   │   │   ├── router.py
│   │   │   ├── gemini_service.py
│   │   │   └── s3_service.py
│   │   ├── records/
│   │   │   └── router.py
│   │   ├── cards/
│   │   │   └── router.py
│   │   ├── admin/
│   │   │   └── router.py        # approve, reject, status 필터
│   │   ├── users/
│   │   │   └── router.py        # toggle favorite
│   │   └── db/
│   │       └── dynamodb.py
│   ├── dependencies/            # Lambda용 패키지 (manylinux 호환)
│   ├── requirements.txt
│   └── seed_admin.py            # 관리자 계정 초기 생성
│
└── infra/                       # 인프라 스크립트
    ├── setup_dynamodb.sh
    ├── setup_s3.sh
    └── deploy.sh
```

---

## Gemini 프롬프트 (영수증 분석)

```
다음 영수증 이미지를 분석하여 아래 JSON 형식으로 정보를 추출해주세요.
추출할 수 없는 필드는 null로 표시합니다.

{
  "approval_number": "승인번호",
  "store_name": "상호명",
  "total_amount": 금액(숫자),
  "transaction_date": "YYYY-MM-DD HH:mm",
  "card_last4": "카드 뒷4자리",
  "order_details": [
    {"item": "메뉴명", "quantity": 수량, "price": 단가}
  ]
}

정확히 JSON만 응답하세요.
```

---

## 카테고리 목록

| 코드 | 표시명 | 설명 |
|------|--------|------|
| LUNCH | 중식 | 점심 식대 |
| DINNER | 석식 | 저녁 식대 |
| BEVERAGE | 음료 | 커피, 음료 등 |
| ENTERTAINMENT | 접대비 | 거래처 접대 |
| PARKING | 주차비 | 주차 요금 |
| TAXI | 택시 | 택시 요금 |
| RAIL | 철도 | KTX, 기차 등 |
| TRANSPORT | 교통 | 버스, 지하철 등 |
| PURCHASE | 구매 | 물품 구매 |
| OTHER | 기타 | 기타 지출 |

---

## 주요 고려사항

1. **이미지 최적화**: 모바일에서 촬영한 원본은 3~5MB 이상. Canvas API로 최대 1280px, JPEG quality 0.7로 압축하여 200~400KB로 줄임
2. **핀치 줌**: CSS `touch-action: none` + JS Pointer Events로 두 손가락 줌 구현
3. **iOS Safari 호환**: `<input type="file" accept="image/*" capture="environment">` 또는 MediaDevices API (HTTPS 필수)
4. **Lambda 패키징**: `PYTHONPATH=/var/task/dependencies` 설정, Pillow/cryptography는 `manylinux2014_x86_64` 바이너리 필수
5. **DynamoDB 쿼리 패턴**: GSI를 활용한 월별/사용자별 조회 최적화
6. **보안**: JWT 토큰, S3 presigned URL (직접 접근 차단), API Gateway 인증

---

## 배포 완료 현황 (2026-02-25 갱신)

| 구분 | 리소스 | 상태 |
|------|--------|------|
| **API** | `https://xx72sektvf.execute-api.ap-northeast-2.amazonaws.com/prod` | ✅ 운영중 |
| **프론트** | `https://d2y9hbvl75uccm.cloudfront.net` | ✅ 배포됨 |
| **Lambda** | `receipt-api` (ap-northeast-2) | ✅ 동작 확인 |
| **DynamoDB** | `receipt_users`, `receipt_records`, `receipt_cards` | ✅ 생성됨 |
| **S3 이미지** | `receipt-images-493162620368` | ✅ 생성됨 |
| **S3 프론트** | `receipt-frontend-493162620368` | ✅ 업로드됨 |

## 초기 계정 정보

| 구분 | 값 |
|------|-----|
| **관리자 아이디** | `admin` |
| **관리자 비밀번호** | `Admin1234!` |
| **비고** | 로그인 후 비밀번호 변경 필수 |

## 주요 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-02-24 | Phase 1~11 초기 배포 완료, 로그인 동작 확인 |
| 2026-02-25 | 회원가입 승인 흐름(pending/active/inactive), ⭐ 즐겨찾기 별표 UI, 관리자 승인 대기 탭 구현 및 재배포 |
| 2026-02-25 | **API Gateway Binary Media Type 수정** (`multipart/form-data` 등록) → Gemini 영수증 분석 전체 파이프라인 정상 동작 확인 |
| 2026-02-25 | 실제 직원 계정 등록 및 승인 완료 (`cbkim@gaias.co.kr` 등) |

## 현재 등록 사용자

| 아이디 | 이름 | 부서 | 상태 |
|--------|------|------|------|
| admin | 시스템관리자 | 관리팀 | active |
| cbkim@gaias.co.kr | 김철범 | 연구소 | active |

> 직원 추가 시: 앱에서 "회원가입 신청" → 관리자 로그인 → 사용자 관리 → 승인

## 다음 작업 (우선순위 순)

1. **모바일 기기 테스트** (Phase 12) — **현재 단계**
   - Android Chrome: 카메라 촬영, 핀치줌, 영수증 등록 전체 플로우
   - iOS Safari: 동일 테스트
   - 다양한 영수증 형식으로 Gemini OCR 정확도 확인

2. **필요 시 추가 직원 계정 등록**:
   - 직원이 직접: `https://d2y9hbvl75uccm.cloudfront.net` → 회원가입 신청 → 관리자 승인
   - 관리자가 직접: 관리자 로그인 → 사용자 관리 → 사용자 추가

3. **선택사항**:
   - 커스텀 도메인 연결 (11.3)
   - Lambda Provisioned Concurrency — cold start 개선 (11.4)

> 각 Phase 완료 시 이 문서의 체크박스를 ✅로 업데이트하며 진행 상황을 추적합니다.
