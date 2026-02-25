# 영수증 관리 시스템 — 백엔드 API 명세서

> 다른 프로젝트에서 이 시스템의 사용자 정보(DynamoDB `receipt_users` 테이블)를 공유하거나,
> 이 API와 연동하려는 개발자를 위한 기술 문서입니다.

---

## 목차

1. [시스템 아키텍처](#1-시스템-아키텍처)
2. [AWS 리소스 현황](#2-aws-리소스-현황)
3. [환경변수 설정](#3-환경변수-설정)
4. [인증 방식 (JWT)](#4-인증-방식-jwt)
5. [DynamoDB 테이블 스키마](#5-dynamodb-테이블-스키마)
6. [전체 API 엔드포인트 목록](#6-전체-api-엔드포인트-목록)
7. [API 상세 명세](#7-api-상세-명세)
8. [다른 프로젝트에서 사용자 정보 공유하기](#8-다른-프로젝트에서-사용자-정보-공유하기)
9. [로컬 개발 실행](#9-로컬-개발-실행)
10. [Lambda 배포 절차](#10-lambda-배포-절차)

---

## 1. 시스템 아키텍처

```
[모바일/웹 클라이언트]
        │ HTTPS
        ▼
[AWS API Gateway] ─── /api/* ───►  [AWS Lambda]
  (REST API)                         ├── FastAPI (Python 3.11)
  binary: multipart/form-data        ├── Mangum (WSGI→Lambda 어댑터)
                                     └── app.main.handler
                                              │
                   ┌──────────────────────────┤
                   ▼            ▼             ▼
          [DynamoDB]        [S3 버킷]    [Google Gemini API]
       receipt_users        영수증 이미지    multimodal LLM
       receipt_records      저장            영수증 텍스트 추출
       receipt_cards
```

### 핵심 라이브러리

| 라이브러리 | 버전 | 역할 |
|---|---|---|
| FastAPI | 0.115.x | REST API 프레임워크 |
| Mangum | 0.17.x | Lambda ↔ ASGI 어댑터 |
| Boto3 | 1.35.x | AWS SDK (DynamoDB, S3) |
| python-jose | 3.3.x | JWT 토큰 생성/검증 |
| passlib[bcrypt] | 1.7.x | 비밀번호 해싱 (bcrypt) |
| google-generativeai | 0.8.x | Gemini API 클라이언트 |
| Pillow | 12.1.x | 이미지 압축 (manylinux2014) |

---

## 2. AWS 리소스 현황

| 리소스 | 이름/ID | 비고 |
|---|---|---|
| Lambda 함수 | `receipt-api` | Runtime: Python 3.11, Memory: 512MB, Timeout: 60s |
| Lambda 핸들러 | `app.main.handler` | |
| IAM Role | `receipt-lambda-role` | DynamoDB, S3 접근 권한 포함 |
| API Gateway | `receipt-api` (ID: xx72sektvf) | 리전: ap-northeast-2 |
| API Gateway 설정 | binaryMediaTypes: `multipart/form-data` | 이미지 업로드 필수 설정 |
| S3 (이미지) | `receipt-images-493162620368` | 영수증 이미지 저장, Lambda zip도 여기 |
| S3 (프론트엔드) | `receipt-frontend-493162620368` | React SPA 정적 파일 |
| DynamoDB | `receipt_users` | 사용자 정보 |
| DynamoDB | `receipt_records` | 영수증/지출 내역 |
| DynamoDB | `receipt_cards` | 법인카드 정보 |
| DynamoDB | `presence_status` | 직원 실시간 재실 상태 (TTL 24h) |
| DynamoDB | `attendance_logs` | 출퇴근 기록 |
| DynamoDB | `office_locations` | 사무실 위치/Wi-Fi 설정 |
| AWS 리전 | `ap-northeast-2` | 서울 |

---

## 3. 환경변수 설정

Lambda 환경변수 또는 로컬 `.env` 파일로 설정합니다.

```env
# AWS
AWS_REGION=ap-northeast-2
AWS_ACCOUNT_ID=493162620368

# S3
S3_IMAGES_BUCKET=receipt-images-493162620368
S3_FRONTEND_BUCKET=receipt-frontend-493162620368

# DynamoDB 테이블명
DYNAMODB_USERS_TABLE=receipt_users
DYNAMODB_RECORDS_TABLE=receipt_records
DYNAMODB_CARDS_TABLE=receipt_cards
DYNAMODB_PRESENCE_TABLE=presence_status
DYNAMODB_ATTENDANCE_TABLE=attendance_logs
DYNAMODB_OFFICES_TABLE=office_locations

# JWT
JWT_SECRET_KEY=<openssl rand -hex 32 으로 생성>
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24        # Access Token 유효시간
JWT_REFRESH_EXPIRATION_DAYS=30 # Refresh Token 유효시간

# Gemini AI
GEMINI_API_KEY=<Google AI Studio에서 발급>
GEMINI_MODEL=gemini-2.0-flash-lite

# 초기 관리자 계정
ADMIN_USER_ID=admin
ADMIN_PASSWORD=<강력한 비밀번호>
ADMIN_NAME=시스템관리자
```

---

## 4. 인증 방식 (JWT)

### 토큰 흐름

```
클라이언트                         서버
   │                                │
   │  POST /api/auth/login          │
   │  { user_id, password }  ──────►│
   │                                │  DynamoDB에서 user 조회
   │                                │  bcrypt 비밀번호 검증
   │                                │  status == "active" 확인
   │◄─────────────────────────────  │
   │  { access_token,               │
   │    refresh_token,              │
   │    user: {...} }               │
   │                                │
   │  Authorization: Bearer <token> │
   │  GET /api/records/me   ───────►│
   │                                │  JWT 서명 검증
   │                                │  sub(user_id) 추출 → DynamoDB 조회
   │◄─────────────────────────────  │
   │  { records: [...] }            │
```

### JWT Payload 구조

```json
// Access Token
{
  "sub": "user001",      // user_id
  "exp": 1234567890,     // 만료 시각 (UTC Unix timestamp)
  "type": "access"
}

// Refresh Token
{
  "sub": "user001",
  "exp": 1234567890,
  "type": "refresh"
}
```

### 인증 헤더

모든 인증 필요 API는 다음 헤더 필요:

```
Authorization: Bearer <access_token>
```

### 권한 체계

| role | 접근 가능 API |
|---|---|
| `user` | `/api/auth/*`, `/api/users/*`, `/api/records/*`, `/api/receipts/*`, `/api/cards/*`, `/api/categories` |
| `admin` | 위 전체 + `/api/admin/*` |

---

## 5. DynamoDB 테이블 스키마

### `receipt_users` — 사용자 테이블

> **다른 프로젝트와 공유하는 핵심 테이블**

**Primary Key:** `user_id` (String, HASH)

| 필드 | 타입 | 설명 |
|---|---|---|
| `user_id` | String | 로그인 ID (PK). 중복 불가 |
| `name` | String | 표시 이름 |
| `password_hash` | String | bcrypt 해시 (60자 내외) |
| `role` | String | `"user"` \| `"admin"` |
| `department` | String | 부서명 (옵션) |
| `status` | String | `"active"` \| `"pending"` \| `"inactive"` |
| `favorite_partners` | List\<String\> | 즐겨찾기 user_id 목록 |
| `created_at` | String | ISO 8601 UTC 타임스탬프 |

**예시 레코드:**

```json
{
  "user_id": "hong123",
  "name": "홍길동",
  "password_hash": "$2b$12$abc...xyz",
  "role": "user",
  "department": "영업팀",
  "status": "active",
  "favorite_partners": ["kim456", "lee789"],
  "created_at": "2025-01-15T03:22:10.123456+00:00"
}
```

---

### `receipt_records` — 지출 내역 테이블

**Primary Key:** `record_id` (String, HASH)

**Global Secondary Indexes:**

| GSI 이름 | PK | SK | 용도 |
|---|---|---|---|
| `year_month-registered_by_date-index` | `year_month` (S) | `registered_by_date` (S) | 월별 내역 조회 |
| `registered_by-transaction_date-index` | `registered_by` (S) | `transaction_date` (S) | 사용자별 내역 조회 |

| 필드 | 타입 | 설명 |
|---|---|---|
| `record_id` | String | UUID (PK) |
| `registered_by` | String | 등록자 user_id |
| `registered_by_name` | String | 등록자 이름 |
| `year_month` | String | `"YYYY-MM"` (GSI용) |
| `registered_by_date` | String | `"{user_id}#{YYYY-MM-DD}"` (GSI용) |
| `category` | String | categories.json의 id 값 |
| `store_name` | String | 상호명 |
| `total_amount` | Number | 총 결제금액 |
| `transaction_date` | String | `"YYYY-MM-DD HH:mm"` KST |
| `approval_number` | String | 카드 승인번호 |
| `card_last4` | String | 카드 뒷 4자리 |
| `order_details` | List | `[{item, quantity, price}]` |
| `participants` | List | `[{user_id, name, amount}]` |
| `image_key` | String | S3 오브젝트 키 |
| `memo` | String | 메모 |
| `created_at` | String | ISO 8601 UTC |

---

### `receipt_cards` — 법인카드 테이블

**Primary Key:** `card_id` (String, HASH)

**Global Secondary Index:** `user_id-index` (user_id HASH)

| 필드 | 타입 | 설명 |
|---|---|---|
| `card_id` | String | UUID (PK) |
| `user_id` | String | 소유자 user_id |
| `card_name` | String | 카드 별칭 |
| `card_last4` | String | 카드 뒷 4자리 |
| `monthly_limit` | Number | 월 한도 (0이면 한도 없음) |
| `is_primary` | Boolean | 주 사용 카드 여부 |
| `created_at` | String | ISO 8601 UTC |

---

### `presence_status` — 실시간 재실 상태 테이블

> **직원 동선 파악 앱용 테이블**

**Primary Key:** `user_id` (String, HASH)

**TTL:** `ttl` 필드 (24시간 미업데이트 시 자동 삭제)

| 필드 | 타입 | 설명 |
|---|---|---|
| `user_id` | String | PK, `receipt_users`와 동일 |
| `status` | String | `IN_OFFICE` / `IN_BUILDING` / `OUT_OF_OFFICE` / `ON_LEAVE` / `OFF_DUTY` |
| `office_id` | String | 현재 위치한 사무실 ID (nullable) |
| `office_name` | String | 사무실 이름 (비정규화, 조회 편의) |
| `detection_method` | String | `wifi` / `gps` / `manual` |
| `manual_note` | String | 수동 설정 시 메모 (예: "오후 반차") |
| `last_updated` | String | ISO 8601 UTC |
| `ttl` | Number | Unix timestamp (24시간 후 자동 만료) |

**상태 코드 설명:**

| 상태 | 코드 | 감지 방식 |
|---|---|---|
| 사무실 내 | `IN_OFFICE` | Wi-Fi SSID 매칭 |
| 건물 내 | `IN_BUILDING` | GPS 지오펜스 내 + Wi-Fi 미접속 |
| 외근 | `OUT_OF_OFFICE` | 지오펜스 외부 또는 수동 설정 |
| 휴가 | `ON_LEAVE` | 수동 설정만 |
| 퇴근 | `OFF_DUTY` | 지오펜스 이탈 또는 수동 설정 |

---

### `attendance_logs` — 출퇴근 기록 테이블

**Primary Key:** `user_id` (String, HASH) + `date` (String, RANGE)

**Global Secondary Index:**

| GSI 이름 | PK | SK | 용도 |
|---|---|---|---|
| `date-user_id-index` | `date` (S) | `user_id` (S) | 특정 일자 전체 출퇴근 현황 조회 |

| 필드 | 타입 | 설명 |
|---|---|---|
| `user_id` | String | PK |
| `date` | String | `YYYY-MM-DD` (SK) |
| `check_in` | String | 최초 출근 시각 ISO 8601 KST |
| `check_out` | String | 마지막 퇴근 시각 ISO 8601 KST |
| `check_in_method` | String | `wifi` / `gps` / `manual` |
| `check_out_method` | String | `wifi` / `gps` / `manual` |
| `office_id` | String | 출근한 사무실 ID |
| `status_history` | List | `[{status, timestamp, method}]` 당일 상태 변경 이력 |
| `created_at` | String | ISO 8601 UTC |

---

### `office_locations` — 사무실 위치 테이블

**Primary Key:** `office_id` (String, HASH)

| 필드 | 타입 | 설명 |
|---|---|---|
| `office_id` | String | PK (예: `HQ`, `BRANCH_GANGNAM`) |
| `name` | String | 사무실 이름 (예: "본사", "강남지점") |
| `address` | String | 주소 |
| `latitude` | Number | 위도 |
| `longitude` | Number | 경도 |
| `radius_meters` | Number | 지오펜스 반경 (미터) |
| `wifi_ssids` | List\<String\> | 해당 사무실 Wi-Fi SSID 목록 |
| `is_active` | Boolean | 활성 여부 |
| `created_at` | String | ISO 8601 UTC |

**예시 레코드:**

```json
{
  "office_id": "HQ",
  "name": "본사",
  "address": "서울시 강남구 테헤란로 123",
  "latitude": 37.5065,
  "longitude": 127.0536,
  "radius_meters": 200,
  "wifi_ssids": ["COMPANY_5G", "COMPANY_2.4G", "GUEST_WIFI"],
  "is_active": true,
  "created_at": "2025-01-01T00:00:00+00:00"
}
```

---

## 6. 전체 API 엔드포인트 목록

**Base URL:** `https://xx72sektvf.execute-api.ap-northeast-2.amazonaws.com/prod`

| 메서드 | 경로 | 인증 | 권한 | 설명 |
|---|---|---|---|---|
| GET | `/api/health` | ✗ | - | 헬스체크 |
| GET | `/api/categories` | ✗ | - | 카테고리 목록 |
| POST | `/api/auth/login` | ✗ | - | 로그인 |
| POST | `/api/auth/signup` | ✗ | - | 자체 회원가입 (pending) |
| POST | `/api/auth/refresh` | ✓ refresh | - | Access Token 갱신 |
| GET | `/api/auth/me` | ✓ | user | 내 정보 조회 |
| POST | `/api/auth/change-password` | ✓ | user | 비밀번호 변경 |
| POST | `/api/auth/register` | ✓ | admin | 관리자 계정 생성 |
| GET | `/api/users` | ✓ | user | 활성 사용자 목록 |
| GET | `/api/users/me/partners` | ✓ | user | 내 즐겨찾기 목록 |
| PUT | `/api/users/me/partners` | ✓ | user | 즐겨찾기 일괄 업데이트 |
| POST | `/api/users/me/partners/toggle` | ✓ | user | 즐겨찾기 토글 |
| POST | `/api/receipts/analyze` | ✓ | user | 영수증 이미지 AI 분석 |
| GET | `/api/receipts/image-url/{key}` | ✓ | user | 이미지 Presigned URL |
| POST | `/api/records` | ✓ | user | 지출 내역 등록 |
| GET | `/api/records/me` | ✓ | user | 내 지출 내역 목록 |
| GET | `/api/records/calendar` | ✓ | user | 달력용 일별 집계 |
| GET | `/api/records/{id}` | ✓ | user | 지출 내역 상세 |
| PUT | `/api/records/{id}` | ✓ | user | 지출 내역 수정 |
| DELETE | `/api/records/{id}` | ✓ | user | 지출 내역 삭제 |
| GET | `/api/cards` | ✓ | user | 내 카드 목록 |
| POST | `/api/cards` | ✓ | user | 카드 등록 |
| PUT | `/api/cards/{id}` | ✓ | user | 카드 수정 |
| DELETE | `/api/cards/{id}` | ✓ | user | 카드 삭제 |
| POST | `/api/cards/{id}/set-primary` | ✓ | user | 주 카드 설정 |
| GET | `/api/cards/{id}/summary` | ✓ | user | 카드 월별 사용 현황 |
| GET | `/api/admin/users` | ✓ | admin | 전체 사용자 목록 |
| POST | `/api/admin/users` | ✓ | admin | 사용자 생성 |
| PUT | `/api/admin/users/{id}` | ✓ | admin | 사용자 정보 수정 |
| POST | `/api/admin/users/{id}/approve` | ✓ | admin | 가입 승인 |
| POST | `/api/admin/users/{id}/reject` | ✓ | admin | 가입 반려 |
| GET | `/api/admin/records` | ✓ | admin | 전체 지출 내역 |
| GET | `/api/admin/reports/daily` | ✓ | admin | 일별 집계 보고서 |
| GET | `/api/admin/reports/monthly` | ✓ | admin | 월별 집계 보고서 |
| GET | `/api/admin/reports/users-summary` | ✓ | admin | 직원별 식대 집계 |
| GET | `/api/admin/reports/user/{id}` | ✓ | admin | 특정 사용자 보고서 |
| PUT | `/api/presence/update` | ✓ | user | 재실 상태 업데이트 (Wi-Fi/GPS) |
| PUT | `/api/presence/manual` | ✓ | user | 수동 상태 변경 (휴가, 외근 등) |
| GET | `/api/presence/me` | ✓ | user | 내 현재 상태 조회 |
| GET | `/api/presence/all` | ✓ | user | 전 직원 현재 상태 일람 |
| GET | `/api/presence/offices` | ✓ | user | 사무실 목록 (지오펜스/Wi-Fi 설정) |
| GET | `/api/attendance/me` | ✓ | user | 내 출퇴근 기록 |
| GET | `/api/attendance/today` | ✓ | user | 오늘 출퇴근 상태 |
| GET | `/api/admin/presence/dashboard` | ✓ | admin | 전 직원 상태 대시보드 |
| GET | `/api/admin/presence/attendance` | ✓ | admin | 특정 일자 전체 출퇴근 기록 |
| POST | `/api/admin/presence/offices` | ✓ | admin | 사무실 등록 |
| PUT | `/api/admin/presence/offices/{id}` | ✓ | admin | 사무실 정보 수정 |
| DELETE | `/api/admin/presence/offices/{id}` | ✓ | admin | 사무실 삭제 |

---

## 7. API 상세 명세

### 인증

#### `POST /api/auth/login`

```json
// Request
{
  "user_id": "hong123",
  "password": "mypassword"
}

// Response 200
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "user_id": "hong123",
    "name": "홍길동",
    "role": "user",
    "department": "영업팀"
  }
}

// Response 401: 아이디/비밀번호 불일치
// Response 403: pending(승인 대기) 또는 inactive(비활성) 상태
```

#### `POST /api/auth/signup` — 자체 회원가입

```json
// Request
{
  "user_id": "newuser",
  "password": "password123",
  "name": "김신입",
  "department": "개발팀"   // 선택
}

// Response 201
{ "message": "가입 신청이 완료되었습니다. 관리자 승인 후 로그인 가능합니다." }

// Response 400: 이미 존재하는 user_id
```

> 가입 후 status = `"pending"` → 관리자 승인 전까지 로그인 불가

#### `POST /api/auth/refresh`

```
// Request Header
Authorization: Bearer <refresh_token>

// Response 200
{ "access_token": "eyJ...", "token_type": "bearer" }
```

---

### 사용자

#### `GET /api/users`

활성(`active`) 사용자 목록. 로그인한 사용자의 즐겨찾기 여부 포함.

```json
// Response 200
{
  "users": [
    {
      "user_id": "hong123",
      "name": "홍길동",
      "department": "영업팀",
      "is_favorite": true
    }
  ]
}
```

---

### 지출 내역

#### `POST /api/records`

```json
// Request
{
  "category": "LUNCH",
  "store_name": "한우리식당",
  "total_amount": 45000,
  "transaction_date": "2025-02-24 12:30",   // KST, YYYY-MM-DD HH:mm
  "approval_number": "12345678",             // 선택
  "card_last4": "1234",                      // 선택
  "order_details": [
    { "item": "삼겹살", "quantity": 3, "price": 15000 }
  ],
  "participants": [
    { "user_id": "hong123", "name": "홍길동", "amount": 22500 },
    { "user_id": "kim456",  "name": "김철수",  "amount": 22500 }
  ],
  "image_key": "receipts/2025/02/24/hong123/uuid.jpg",  // 선택
  "memo": "팀 점심"                                        // 선택
}

// Response 201
{ "message": "등록되었습니다.", "record_id": "uuid" }
```

#### `GET /api/records/me`

```
Query Parameters:
  year_month  (선택) YYYY-MM
  category    (선택) 카테고리 ID
  limit       (선택, 기본 100)

// Response 200
{
  "records": [ { ...record 객체... } ],
  "count": 5
}
```

---

### 영수증 분석

#### `POST /api/receipts/analyze`

```
Content-Type: multipart/form-data
Body: file=<이미지 파일>

// Response 200
{
  "image_key": "receipts/2025/02/24/user/uuid.jpg",
  "image_url": "https://s3.presigned.url...",
  "extracted": {
    "approval_number": "12345678",
    "store_name": "스타벅스",
    "total_amount": 8500,
    "transaction_date": "2025-02-24 13:15",
    "card_last4": "1234",
    "receipt_type": "RECEIPT",   // RECEIPT|KIOSK|TABLET|SCREEN|UNKNOWN
    "order_details": [
      { "item": "아메리카노", "quantity": 1, "price": 4500 }
    ]
  },
  "compressed_size_kb": 245.3,
  "original_size_kb": 1820.5
}
```

> **주의:** API Gateway에 `binaryMediaTypes: ["multipart/form-data"]` 설정 필수

---

### 관리자

#### `GET /api/admin/users`

```
Query Parameters:
  status  (선택) pending | active | inactive

// Response 200
{
  "users": [
    {
      "user_id": "hong123",
      "name": "홍길동",
      "department": "영업팀",
      "role": "user",
      "status": "active",
      "created_at": "2025-01-15T03:22:10+00:00"
    }
  ],
  "count": 1
}
```

#### `POST /api/admin/users/{user_id}/approve`

```json
// Response 200
{ "message": "hong123 계정이 승인되었습니다." }
```

#### `GET /api/admin/reports/users-summary`

```
Query: year_month=2025-02

// Response 200
{
  "year_month": "2025-02",
  "total": 580000,
  "users": [
    {
      "user_id": "hong123",
      "name": "홍길동",
      "department": "영업팀",
      "amount": 185000,
      "count": 8
    }
  ]
}
```

> `participants` 배열 기준 개인 부담액 집계. participants 없으면 등록자 전액 부담.

---

### 재실 상태 (Presence)

#### `PUT /api/presence/update`

앱에서 주기적으로 호출하여 Wi-Fi/GPS 기반 상태를 업데이트합니다.

```json
// Request
{
  "status": "IN_OFFICE",          // IN_OFFICE | IN_BUILDING | OUT_OF_OFFICE | OFF_DUTY
  "office_id": "HQ",              // 선택, 사무실 ID
  "detection_method": "wifi",     // wifi | gps | manual
  "wifi_ssid": "COMPANY_5G"       // 선택, Wi-Fi SSID (office_id 자동 매칭에 사용)
}

// Response 200
{
  "message": "상태가 업데이트되었습니다.",
  "presence": {
    "user_id": "hong123",
    "status": "IN_OFFICE",
    "office_id": "HQ",
    "office_name": "본사",
    "detection_method": "wifi",
    "last_updated": "2025-02-25T01:00:00+00:00",
    "ttl": 1740448800
  }
}
```

> Wi-Fi SSID를 전송하면 `office_locations` 테이블에서 매칭되는 사무실을 자동으로 찾아 `office_id`를 설정합니다.

#### `PUT /api/presence/manual`

사용자가 직접 상태를 변경합니다 (휴가, 외근 등).

```json
// Request
{
  "status": "ON_LEAVE",           // IN_OFFICE | IN_BUILDING | OUT_OF_OFFICE | ON_LEAVE | OFF_DUTY
  "manual_note": "오후 반차"       // 선택, 메모 (최대 200자)
}

// Response 200
{
  "message": "상태가 업데이트되었습니다.",
  "presence": {
    "user_id": "hong123",
    "status": "ON_LEAVE",
    "detection_method": "manual",
    "manual_note": "오후 반차",
    "last_updated": "2025-02-25T01:00:00+00:00",
    "ttl": 1740448800
  }
}
```

#### `GET /api/presence/me`

```json
// Response 200
{
  "user_id": "hong123",
  "name": "홍길동",
  "department": "영업팀",
  "status": "IN_OFFICE",
  "office_id": "HQ",
  "office_name": "본사",
  "detection_method": "wifi",
  "manual_note": null,
  "last_updated": "2025-02-25T01:00:00+00:00"
}
```

#### `GET /api/presence/all`

```json
// Response 200
{
  "users": [
    {
      "user_id": "hong123",
      "name": "홍길동",
      "department": "영업팀",
      "status": "IN_OFFICE",
      "office_id": "HQ",
      "office_name": "본사",
      "detection_method": "wifi",
      "manual_note": null,
      "last_updated": "2025-02-25T01:00:00+00:00"
    }
  ],
  "count": 1
}
```

#### `GET /api/presence/offices`

앱 초기화 시 사무실 목록과 지오펜스/Wi-Fi 설정을 가져옵니다.

```json
// Response 200
{
  "offices": [
    {
      "office_id": "HQ",
      "name": "본사",
      "address": "서울시 강남구 테헤란로 123",
      "latitude": "37.5065",
      "longitude": "127.0536",
      "radius_meters": 200,
      "wifi_ssids": ["COMPANY_5G", "COMPANY_2.4G"],
      "is_active": true
    }
  ]
}
```

---

### 출퇴근 기록 (Attendance)

#### `GET /api/attendance/me`

```
Query Parameters:
  start_date  (선택) YYYY-MM-DD
  end_date    (선택) YYYY-MM-DD
  (미지정 시 이번 달 기록 반환)

// Response 200
{
  "records": [
    {
      "user_id": "hong123",
      "date": "2025-02-25",
      "check_in": "2025-02-25T09:01:23+09:00",
      "check_out": "2025-02-25T18:15:30+09:00",
      "check_in_method": "wifi",
      "check_out_method": "gps",
      "office_id": "HQ",
      "status_history": [
        {"status": "IN_OFFICE", "timestamp": "2025-02-25T09:01:23+09:00", "method": "wifi"},
        {"status": "OUT_OF_OFFICE", "timestamp": "2025-02-25T13:00:00+09:00", "method": "gps"},
        {"status": "IN_OFFICE", "timestamp": "2025-02-25T14:30:00+09:00", "method": "wifi"},
        {"status": "OFF_DUTY", "timestamp": "2025-02-25T18:15:30+09:00", "method": "gps"}
      ]
    }
  ],
  "count": 1
}
```

#### `GET /api/attendance/today`

```json
// Response 200
{
  "date": "2025-02-25",
  "checked_in": true,
  "check_in": "2025-02-25T09:01:23+09:00",
  "check_out": null,
  "check_in_method": "wifi",
  "check_out_method": null,
  "office_id": "HQ",
  "status_history": [
    {"status": "IN_OFFICE", "timestamp": "2025-02-25T09:01:23+09:00", "method": "wifi"}
  ]
}
```

---

### 관리자 — 재실 상태

#### `GET /api/admin/presence/dashboard`

전 직원 상태를 부서별로 그룹핑하여 반환합니다.

```json
// Response 200
{
  "total_users": 15,
  "status_summary": {
    "IN_OFFICE": 8,
    "IN_BUILDING": 2,
    "OUT_OF_OFFICE": 1,
    "ON_LEAVE": 1,
    "OFF_DUTY": 3
  },
  "by_department": {
    "영업팀": [
      {
        "user_id": "hong123",
        "name": "홍길동",
        "status": "IN_OFFICE",
        "office_id": "HQ",
        "office_name": "본사",
        "detection_method": "wifi",
        "manual_note": null,
        "last_updated": "2025-02-25T01:00:00+00:00"
      }
    ],
    "개발팀": [...]
  }
}
```

#### `GET /api/admin/presence/attendance`

```
Query Parameters:
  date  (선택) YYYY-MM-DD (기본: 오늘)

// Response 200
{
  "date": "2025-02-25",
  "checked_in": [
    {
      "user_id": "hong123",
      "name": "홍길동",
      "department": "영업팀",
      "check_in": "2025-02-25T09:01:23+09:00",
      "check_out": null,
      "check_in_method": "wifi",
      "office_id": "HQ"
    }
  ],
  "checked_in_count": 12,
  "absent": [
    {
      "user_id": "lee789",
      "name": "이영희",
      "department": "인사팀",
      "check_in": null,
      "check_out": null
    }
  ],
  "absent_count": 3
}
```

#### `POST /api/admin/presence/offices`

```json
// Request
{
  "office_id": "BRANCH_GANGNAM",
  "name": "강남지점",
  "address": "서울시 강남구 역삼동 123-4",
  "latitude": 37.4979,
  "longitude": 127.0276,
  "radius_meters": 150,
  "wifi_ssids": ["GANGNAM_5G", "GANGNAM_2.4G"]
}

// Response 201
{ "message": "사무실이 등록되었습니다.", "office_id": "BRANCH_GANGNAM" }

// Response 400: 이미 존재하는 office_id
```

#### `PUT /api/admin/presence/offices/{office_id}`

```json
// Request (부분 업데이트 가능)
{
  "name": "강남지점 (신사옥)",
  "wifi_ssids": ["GANGNAM_NEW_5G", "GANGNAM_NEW_2.4G"],
  "radius_meters": 200
}

// Response 200
{ "message": "사무실 정보가 수정되었습니다." }
```

#### `DELETE /api/admin/presence/offices/{office_id}`

```json
// Response 200 (soft delete: is_active=false로 변경)
{ "message": "사무실이 삭제되었습니다." }
```

---

## 8. 다른 프로젝트에서 사용자 정보 공유하기

### 방법 1. DynamoDB 테이블 직접 공유 (권장)

두 프로젝트가 같은 AWS 계정이라면 `receipt_users` 테이블을 직접 공유합니다.

**다른 프로젝트 Lambda의 환경변수에 추가:**

```env
DYNAMODB_USERS_TABLE=receipt_users
AWS_REGION=ap-northeast-2
```

**DynamoDB 조회 예시 (Python):**

```python
import boto3

dynamodb = boto3.resource("dynamodb", region_name="ap-northeast-2")
table = dynamodb.Table("receipt_users")

# 사용자 조회
user = table.get_item(Key={"user_id": "hong123"}).get("Item")
# → { user_id, name, role, department, status, ... }

# 활성 사용자 전체 목록 (Scan)
resp = table.scan(
    FilterExpression=boto3.dynamodb.conditions.Attr("status").eq("active")
)
users = resp["Items"]
```

**주의사항:**
- `status == "active"` 인 사용자만 사용 가능 (pending/inactive 제외)
- 비밀번호는 `password_hash` 필드에 bcrypt로 저장 — 직접 비교 불가
- IAM Role에 `receipt_users` 테이블의 `dynamodb:GetItem`, `dynamodb:Scan` 권한 필요

**필요한 IAM 정책:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:Scan",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:ap-northeast-2:493162620368:table/receipt_users"
    }
  ]
}
```

---

### 방법 2. 이 시스템의 JWT를 다른 프로젝트에서 검증

두 프로젝트가 **같은 `JWT_SECRET_KEY`** 를 공유하면, 이 시스템에서 발급한 토큰을 다른 프로젝트에서 그대로 검증할 수 있습니다.

**다른 프로젝트에서 검증 (Python):**

```python
from jose import jwt, JWTError

JWT_SECRET_KEY = "이 시스템과 동일한 시크릿 키"
JWT_ALGORITHM = "HS256"

def verify_token(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload  # { "sub": "user_id", "exp": ..., "type": "access" }
    except JWTError:
        return None

# 사용 예
payload = verify_token(request.headers["Authorization"].replace("Bearer ", ""))
if payload:
    user_id = payload["sub"]
```

**다른 프로젝트에서 검증 (Node.js):**

```javascript
const jwt = require('jsonwebtoken');

const JWT_SECRET = '이 시스템과 동일한 시크릿 키';

function verifyToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type !== 'access') return null;
    return payload; // { sub: 'user_id', exp: ..., type: 'access' }
  } catch {
    return null;
  }
}
```

---

### 방법 3. 사용자 추가/수정 API 호출

다른 프로젝트에서 관리자 권한으로 사용자를 추가하거나 상태를 변경합니다.

```bash
# 관리자 로그인으로 토큰 획득
TOKEN=$(curl -s -X POST \
  https://xx72sektvf.execute-api.ap-northeast-2.amazonaws.com/prod/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"user_id":"admin","password":"<관리자비밀번호>"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 사용자 생성 (즉시 활성)
curl -X POST \
  https://xx72sektvf.execute-api.ap-northeast-2.amazonaws.com/prod/api/auth/register \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "newuser",
    "password": "password123",
    "name": "신규사용자",
    "department": "개발팀",
    "role": "user"
  }'

# 가입 승인
curl -X POST \
  https://xx72sektvf.execute-api.ap-northeast-2.amazonaws.com/prod/api/admin/users/newuser/approve \
  -H "Authorization: Bearer $TOKEN"
```

---

### 방법 4. 사용자 정보 직접 삽입 (DynamoDB CLI)

다른 프로젝트의 기존 사용자를 이 시스템으로 이전할 때 사용합니다.

```bash
# 비밀번호 해시 생성 (Python)
python3 -c "from passlib.context import CryptContext; \
  ctx = CryptContext(schemes=['bcrypt']); \
  print(ctx.hash('임시비밀번호1234'))"

# DynamoDB에 사용자 직접 삽입
aws dynamodb put-item \
  --table-name receipt_users \
  --item '{
    "user_id":           {"S": "newuser"},
    "name":              {"S": "홍길동"},
    "password_hash":     {"S": "$2b$12$생성된해시값..."},
    "role":              {"S": "user"},
    "department":        {"S": "영업팀"},
    "status":            {"S": "active"},
    "favorite_partners": {"L": []},
    "created_at":        {"S": "2025-02-24T00:00:00+00:00"}
  }'
```

---

## 9. 로컬 개발 실행

```bash
# 1. 의존성 설치
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2. 환경변수 설정
cp .env.example .env
# .env 파일 편집

# 3. AWS 자격증명 설정 (로컬 DynamoDB/S3 접근)
aws configure

# 4. 서버 실행
uvicorn app.main:app --reload --port 8000

# 5. API 문서 확인
open http://localhost:8000/api/docs
```

---

## 10. Lambda 배포 절차

```bash
# 1. 의존성 패키징 (manylinux2014 호환 필수)
cd backend
pip install -r requirements.txt \
  --platform manylinux2014_x86_64 \
  --python-version 311 \
  --only-binary=:all: \
  -t ./dependencies/

# 2. categories.json 복사 (zip 루트에 포함)
cp ../categories.json ./categories.json

# 3. zip 생성
zip -r /tmp/receipt-api.zip app/ dependencies/ categories.json \
  -x "*.pyc" -x "__pycache__/*"

# 4. S3 업로드 (Lambda 50MB 제한 우회)
aws s3 cp /tmp/receipt-api.zip \
  s3://receipt-images-493162620368/lambda/receipt-api.zip

# 5. Lambda 코드 업데이트
aws lambda update-function-code \
  --function-name receipt-api \
  --s3-bucket receipt-images-493162620368 \
  --s3-key lambda/receipt-api.zip

# 6. 정리
rm ./categories.json
```

**Lambda 환경변수 설정:**

```bash
aws lambda update-function-configuration \
  --function-name receipt-api \
  --environment Variables="{
    PYTHONPATH=/var/task/dependencies,
    JWT_SECRET_KEY=시크릿키,
    GEMINI_API_KEY=제미나이키,
    DYNAMODB_USERS_TABLE=receipt_users,
    DYNAMODB_RECORDS_TABLE=receipt_records,
    DYNAMODB_CARDS_TABLE=receipt_cards,
    DYNAMODB_PRESENCE_TABLE=presence_status,
    DYNAMODB_ATTENDANCE_TABLE=attendance_logs,
    DYNAMODB_OFFICES_TABLE=office_locations,
    S3_IMAGES_BUCKET=receipt-images-493162620368,
    AWS_REGION=ap-northeast-2
  }"
```

> **중요:** `PYTHONPATH=/var/task/dependencies` 설정 필수. 없으면 의존성 import 오류 발생.

---

## 부록: 카테고리 설정 (categories.json)

카테고리는 프로젝트 루트의 `categories.json`으로 관리합니다. 파일 편집 후 Lambda 재배포하면 적용됩니다. (프론트엔드는 `/api/categories` API로 동적 로드하므로 재빌드 불필요)

```json
[
  {
    "id": "LUNCH",          // DB 저장값, API 파라미터
    "label": "중식",         // 화면 표시명
    "icon": "🍱",            // 이모지
    "description": "점심 식사",
    "is_meal": true          // true이면 참여자/금액분배 UI 표시
  }
]
```
