# Home Link

> 모던한 런처형 링크 메뉴판 웹앱  
> 앱별 로고, 이름, URL, 소스(Git), 설명, D-Day, 헬스체크, 즐겨찾기, 핀 고정 등을 지원합니다.  
> **서버 없이 실행**되는 클라이언트 저장(localStorage) 기반 앱입니다.

---

## 주요 기능

- **런처 카드**: 카드 클릭 시 설정에 따라 새 창 또는 현재 창에서 링크를 엽니다.
- **즐겨찾기 / 핀 고정**: 중요한 링크를 상단에 고정하고 강조할 수 있습니다.
- **로고 자동 리사이즈**: 다양한 크기의 이미지를 일정한 비율로 자동 조정하여 표시합니다.
- **D-Day 알림**: 인증서나 토큰의 만료일을 추적하여 7일 이내는 붉은색, 30일 이내는 회색으로 표시합니다.
- **헬스체크**: 지정된 URL을 주기적으로 점검하여 상태(Up/Down/Warn)를 표시하고 응답 시간을 보여줍니다.
- **정렬 & 검색**: 이름, 긴급도, 핀/즐겨찾기 가중치 등 다양한 기준으로 링크를 정렬하고 검색할 수 있습니다.
- **설정**: 사이트 로고, 제목, 테마, 정렬 방식, 헬스체크 주기 등을 사용자가 직접 설정할 수 있습니다.
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
git clone https://github.com/<YOUR_ORG>/home-link.git
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

### 4. 프로덕션 빌드

```bash
pnpm build && pnpm start
# 또는
# npm run build && npm start
```

---

## 기술 스택

| 구성요소          | 기술                                        |
| ----------------- | ------------------------------------------- |
| **프레임워크**    | Next.js (App Router)                        |
| **UI**            | React 18 + Tailwind CSS + shadcn/ui         |
| **아이콘**        | lucide-react                                |
| **마크다운 렌더링** | react-markdown                              |
| **상태저장**      | localStorage (클라이언트)                   |

> 로고 이미지는 Base64 Data URL로 변환되어 브라우저의 `localStorage`에 저장됩니다. 별도의 서버나 데이터베이스를 사용하지 않습니다.

---

## 폴더 구조

```
src/
 ├─ app/
 │   ├─ api/
 │   │   └─ health-proxy/
 │   │       └─ route.ts      # CORS 프록시 API
 │   ├─ page.tsx              # 메인 페이지 전체 구현
 │   └─ layout.tsx            # 루트 레이아웃
 ├─ components/
 │   └─ ui/                   # shadcn/ui 컴포넌트
 └─ lib/
     └─ utils.ts              # 유틸리티 함수 (cn 등)
```

---

## 설치 및 설정 상세

### Tailwind CSS 설정

`tailwind.config.ts` 파일에 컨텐츠 경로가 올바르게 지정되어 있는지 확인합니다.

```typescript
// tailwind.config.ts
export default {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: { extend: {} },
  plugins: [require("tailwindcss-animate")],
};
```

`src/app/globals.css` 파일에 Tailwind 지시문이 포함되어야 합니다.

```css
/* src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 추가 라이브러리

`shadcn/ui`와 기타 라이브러리를 사용하기 위해 아래 패키지들이 필요합니다.

```bash
# shadcn/ui 기본 의존성
pnpm add class-variance-authority clsx tailwind-merge tailwindcss-animate

# 아이콘 및 Radix UI 컴포넌트
pnpm add lucide-react @radix-ui/react-dialog @radix-ui/react-dropdown-menu

# 마크다운 렌더링
pnpm add react-markdown
```

> **참고**: `npx shadcn-ui@latest init` 실행 후 필요한 컴포넌트(Card, Button, Input 등)를 추가하여 프로젝트를 구성할 수 있습니다.

---

## 데이터 저장 구조

| 항목              | 저장 위치      | 키                  |
| ----------------- | -------------- | ------------------- |
| **앱 목록**       | `localStorage` | `appLinksV4`        |
| **전체 설정**     | `localStorage` | `homeLinksSettingsV4` |

> **⚠️ 주의**: 데이터는 브라우저 `localStorage`에 저장되므로, 다른 기기나 다른 브라우저와 동기화되지 않습니다. 브라우저 캐시를 삭제하면 데이터가 유실될 수 있으니 **JSON 내보내기 기능으로 주기적인 백업을 권장합니다.**

### 내보내기/불러오기 포맷

`home-links.json` 파일 형식 예시입니다.

```json
{
  "version": 1,
  "items": [
    /* AppLink[] 데이터 */
  ],
  "settings": {
    /* Settings 데이터 */
  }
}
```

---

## 헬스체크 프록시 (선택 사항)

웹사이트의 CORS 정책으로 인해 헬스체크가 실패하는 경우, Next.js의 API Route를 이용해 간단한 프록시를 구현할 수 있습니다.

`src/app/api/health-proxy/route.ts` 파일을 생성하세요.

```typescript
// src/app/api/health-proxy/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  try {
    // HEAD 요청으로 리소스 다운로드 없이 상태만 확인
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    return NextResponse.json({ status: res.status });
  } catch (error) {
    // 네트워크 오류 등 fetch 실패 시
    return NextResponse.json({ status: 500 });
  }
}
```

이후 앱 설정에서 헬스체크 URL을 `/api/health-proxy?url=https://my-service.com/health`와 같이 지정하면 CORS 문제 없이 상태를 점검할 수 있습니다.

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

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

---

## 자주 발생하는 오류

| 증상                                  | 원인 및 해결                                                 |
| ------------------------------------- | ------------------------------------------------------------ |
| **`"use client"` 관련 에러**          | `src/app/page.tsx` 파일 최상단에 `"use client";` 코드를 추가합니다. |
| **`crypto.randomUUID` 함수 없음**     | 구버전 Node.js 또는 브라우저 문제입니다. 최신 버전 사용을 권장합니다. |
| **아이콘 import 오류**                | `lucide-react`, `@radix-ui/*` 등 관련 라이브러리가 제대로 설치되었는지 확인합니다. |
| **불러오기 버튼 반응 없음**           | 파일 입력(input) 로직 문제입니다. 최신 코드로 업데이트하세요.    |

---

## 커스텀 팁

- **테마 수정**: `THEME_STYLES` 상수에서 페이지, 카드, 호버 색상 등을 변경할 수 있습니다.
- **정렬 규칙 확장**: `SortMode` 타입을 확장하고 관련 정렬 로직을 추가하여 새로운 정렬 기준을 만들 수 있습니다.
- **로고 크기 변경**: 카드 내 로고는 `w-14 h-14`, 헤더 로고는 `w-[50px] h-[50px]` 클래스를 수정하여 크기를 조절할 수 있습니다.

---

## 라이선스

이 프로젝트는 사내 또는 개인 용도로 자유롭게 사용할 수 있습니다. 필요 시 MIT 등 원하는 라이선스 파일을 추가하여 사용하세요.

## 기여

버그 리포트나 새로운 기능 제안은 언제나 환영합니다. GitHub Issues를 통해 의견을 남겨주세요.

## 문의

서버 저장소(S3/MinIO) 연동, Mermaid 다이어그램 삽입 등 추가 기능이 필요하시면 Issue로 요청해주세요.