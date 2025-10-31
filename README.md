# Home Link

> 모던한 런처형 링크 메뉴판 웹앱  
> Next.js 기반으로 재구성되어, 기존 클라이언트 앱의 장점은 유지하면서 **사용자별 개인화 기능과 중앙 관리**를 지원하는 방향으로 발전하고 있습니다.  
> 앱별 로고, 이름, URL, 소스(Git), 설명, D-Day, 헬스체크, 즐겨찾기, 핀 고정 등을 지원합니다.

---

## 주요 기능

- **런처 카드**: 카드 클릭 시 설정에 따라 새 창 또는 현재 창에서 링크를 엽니다.
- **즐겨찾기 / 핀 고정**: 중요한 링크를 상단에 고정하고 강조할 수 있습니다.
- **로고 자동 리사이즈**: 다양한 크기의 이미지를 일정한 비율로 자동 조정하여 표시합니다.
- **D-Day 알림**: 인증서나 토큰의 만료일을 추적하여 7일 이내는 붉은색, 30일 이내는 회색으로 표시합니다.
- **헬스체크**: 지정된 URL을 주기적으로 점검하여 상태(Up/Down/Warn)를 표시하고 응답 시간을 보여줍니다.
- **정렬 & 검색**: 이름, 긴급도, 핀/즐겨찾기 가중치 등 다양한 기준으로 링크를 정렬하고 검색할 수 있습니다.
- **설정**: 사이트 로고, 제목, 테마, 정렬 방식, 헬스체크 주기 등을 사용자가 직접 설정할 수 있습니다.
- **다중 사용자 지원**: 관리자(admin)는 공통 링크와 전역 설정을 관리하고, 일반 사용자는 자신만의 링크와 설정을 가질 수 있습니다.
- **내보내기 / 불러오기**: 모든 설정과 링크 목록을 JSON 파일로 내보내거나 불러와 쉽게 백업하고 이관할 수 있습니다.

---

## 빠른 시작

### 1. 필수 설치

- **Node.js**: v20 이상 권장 (v18도 가능)
- **패키지 매니저**: `pnpm` 또는 `npm`

```bash
# pnpm 설치 (권장)
npm i -g pnpm
```

### 2. 프로젝트 설치

```bash
git clone https://github.com/rareram/home-link.git
cd home-link

# 의존성 설치 (pnpm 권장)
pnpm install
# 또는 npm 사용 시
# npm install
```

### 3. 개발 서버 실행

```bash
pnpm dev
# 또는
npm run dev
```

> 브라우저에서 `http://localhost:3000` 주소로 접속하세요.

### 4. 프로덕션 빌드 및 실행

#### 기본 실행

```bash
pnpm build && pnpm start
# 또는
# npm run build && npm start
```

#### 안정적인 운영을 위한 실행 (PM2 사용 권장)

`pm2`는 Node.js 애플리케이션을 위한 프로덕션 프로세스 매니저입니다. 예기치 않은 오류로 프로세스가 종료되어도 자동으로 재시작하여 서비스 안정성을 높여줍니다.

```bash
# 1. pm2 전역 설치
pnpm i -g pm2

# 2. 애플리케이션 빌드
pnpm build

# 3. pm2로 애플리케이션 시작
# 'home-link'라는 이름으로 Next.js 프로덕션 서버(npm start)를 실행합니다.
pm2 start npm --name "home-link" -- start
```

**주요 `pm2` 명령어:**

```bash
# 실행 중인 프로세스 목록 확인
pm2 list

# 로그 확인
pm2 logs home-link

# 프로세스 재시작
pm2 restart home-link

# 프로세스 중지
pm2 stop home-link

# 서버 부팅 시 자동 시작 스크립트 생성
pm2 startup
```

---

## 향후 개발 로드맵

이 프로젝트는 개인 및 팀의 생산성 향상을 위해 아래와 같은 기능들을 목표로 발전하고 있습니다.

-   ✅ **사용자별 개인 링크**: 공통으로 관리되는 링크 외에, 각 사용자별로 자신만의 북마크를 추가하고 관리하는 기능을 구현합니다. **(구현 완료: 이제 각 사용자는 관리자가 설정한 공통 링크와 더불어 자신만의 링크를 추가, 수정, 삭제할 수 있습니다.)**
-   ✅ **역할 기반 접근 제어 (RBAC)**: `admin`과 `user` 역할을 분리합니다.
    -   **Admin**: 모든 공통 링크와 시스템 전체 설정을 관리합니다.
    -   **User**: 자신의 개인 링크만 관리하며, 민감한 설정에는 접근이 제한됩니다. **(구현 완료: 관리자만 전역 설정을 변경할 수 있으며, 일반 사용자는 자신만의 설정을 가질 수 있습니다.)**
-   **✅ OpenLDAP / OAuth SSO 연동**: 중앙 인증 시스템(IdP)과 연동하여 안전하고 편리한 통합 로그인을 제공합니다. 이를 통해 여러 사내 서비스의 접근 권한을 중앙에서 관리할 수 있게 됩니다.

---

## 기술 스택

| 구성요소 | 기술 |
| --- | --- |
| **프레임워크** | Next.js (App Router) |
| **UI** | React 18 + Tailwind CSS + shadcn/ui |
| **아이콘** | lucide-react |
| **서버** | Next.js API Routes |
| **데이터 저장** | JSON 파일 (초기), 향후 데이터베이스 연동 가능 |

---

## 데이터 저장 구조

| 항목 | 저장 위치 | 설명 |
| --- | --- | --- |
| **전역 설정** | `data/home-links.json` | 웹앱의 전반적인 동작을 제어하는 설정으로, 관리자(admin)만 수정할 수 있습니다. |
| **공통 링크** | `data/home-links.json` | 모든 사용자에게 공유되는 링크 목록입니다. |
| **사용자별 링크 및 설정** | `data/home-links.json` | 각 사용자(admin 포함)가 추가한 고유 링크와 개인화된 설정(전역 설정 오버라이드)이 저장됩니다. |

> **⚠️ 주의**: 초기 버전에서는 파일 시스템을 직접 사용하지만, 사용자 인증 기능이 추가되면서 데이터 구조는 변경될 예정입니다.

---

## Docker 배포 예시

프로젝트를 Docker 컨테이너로 배포하기 위한 `Dockerfile` 예시입니다.

```dockerfile
# 1. Builder Stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json pnpm-lock.yaml* ./
RUN npm i -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# 2. Runner Stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# PM2 설치
RUN npm i -g pm2

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
# CMD ["node", "server.js"]
# PM2로 앱 실행
CMD ["pm2-runtime", "start", "server.js", "--name", "home-link"]
```

---

## 라이선스

이 프로젝트는 사내 또는 개인 용도로 자유롭게 사용할 수 있습니다. 필요 시 MIT 등 원하는 라이선스 파일을 추가하여 사용하세요.

## 기여

버그 리포트나 새로운 기능 제안은 언제나 환영합니다. GitHub Issues를 통해 의견을 남겨주세요.
