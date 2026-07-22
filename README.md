# 전극 관리 웹앱 (CellPosition)

React + Vite + Firebase(Firestore)로 재구성한 전극 관리 시스템입니다.
GitHub Pages로 배포되고, 브라우저에서 Firebase Web SDK로 Firestore에 직접 read/write 합니다 (별도 서버 없음).

## 0. 폴더 구성
```
electrode-app/
  src/
    App.jsx           # 전체 UI + 로직
    firebase.js        # Firestore 초기화 및 데이터 함수
    data/electrodeData.js  # 최초 시딩용 원본 790개 레코드
  scripts/seed.mjs     # 1회성 Firestore 시딩 스크립트
  .github/workflows/deploy.yml  # GitHub Pages 자동 배포
  firestore.rules      # Firestore 보안 규칙 원본
```

## 1. 로컬에서 실행해보기
```bash
npm install
cp .env.example .env   # 아래 2단계에서 발급받은 값을 채워 넣기
npm run dev
```

## 2. Firebase 프로젝트 만들기
1. https://console.firebase.google.com 접속 → "프로젝트 추가"
2. 프로젝트 생성 후, "웹 앱 추가"(</> 아이콘) 클릭 → 앱 등록
3. 나오는 `firebaseConfig` 값을 복사해서 `.env` 파일에 채워넣기
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```
4. 왼쪽 메뉴 "빌드 > Firestore Database" → 데이터베이스 만들기 (프로덕션 모드 권장, 리전은 asia-northeast3 등 가까운 곳)

## 3. 보안 규칙 적용
Firebase 콘솔 → Firestore Database → "규칙" 탭에 `firestore.rules` 파일 내용을 그대로 붙여넣고 게시.

## 4. 최초 데이터 시딩 (790개 레코드 업로드)

**방법 A — GitHub Actions에서 버튼 클릭 (터미널 필요 없음, 추천)**
1. 먼저 5, 6단계(GitHub push + Secrets 등록)를 끝내세요.
2. 저장소 상단 "Actions" 탭 → 왼쪽 목록에서 "Seed Firestore (1회성 초기 데이터 업로드)" 선택
3. 오른쪽 "Run workflow" 버튼 클릭 → 다시 "Run workflow" 확인
4. 초록 체크가 뜨면 완료. 로그를 열어보면 그룹별 업로드 건수가 보입니다.

**방법 B — 로컬 터미널에서 직접**
`.env`가 채워진 상태에서:
```bash
npm run seed
```
그룹당(EL-500A~E) 158건씩, 총 790건이 `cellGroups/{groupId}/electrodes/{id}` 경로에 업로드됩니다.

두 방법 모두 이미 존재하는 문서 id로 다시 실행해도 덮어쓰기만 되므로 여러 번 실행해도 안전합니다.

## 5. GitHub 저장소에 올리기
```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/<your-id>/<repo-name>.git
git push -u origin main
```

## 6. GitHub Pages 배포 설정
1. 저장소 Settings → Pages → "Build and deployment" → Source를 **GitHub Actions**로 설정
2. Settings → Secrets and variables → Actions → "New repository secret" 으로 아래 6개를 등록 (2단계에서 받은 값과 동일)
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
3. `main` 브랜치에 push하면 `.github/workflows/deploy.yml`이 자동으로 빌드 + 배포합니다.
4. 몇 분 후 `https://<your-id>.github.io/<repo-name>/` 에서 접속 가능합니다.

## 7. 데이터 흐름 요약
- **읽기**: 앱 로드 시 `cellGroups/{g}/electrodes`를 5개 그룹 모두 읽어 옴 + `editHistory` 전체를 최신순으로 읽어 옴
- **편집 저장**: `saveElectrodeWithHistory()` — 변경된 필드만 골라 Firestore 트랜잭션으로 (a) 전극 문서 update, (b) 카운터 증가, (c) `editHistory`에 필드별 이력 생성 — 이 세 가지를 원자적으로 처리
- **사용자 식별**: 이름+사번을 `localStorage`에 저장 (Firebase Auth 미사용, 추후 확장 가능)
- **엑셀 업/다운로드**: SheetJS(xlsx)로 그룹별 시트 생성/파싱. 업로드 시 "No." 또는 "전극 No."로 기존 행을 찾아 매칭 후 동일한 트랜잭션 저장 로직 재사용

## 8. 알아두면 좋은 점
- 원본 디자인 프로토타입(`전극관리시스템_dc__2_.html`)은 특수 템플릿 문법(`<x-dc>`, `sc-for`, `support.js`)을 쓰는 프리뷰 전용 포맷이라 그대로 배포할 수 없어서, 이번에 화면/기능은 그대로 유지한 채 순수 React 컴포넌트로 다시 작성했습니다.
- 사용기간은 저장하지 않고 매번 `(오늘 − 설치일자) / 30`으로 클라이언트에서 계산합니다 (원본 로직과 동일).
- 교체 주기: 전극 96개월(8년), 멤브레인 32개월, 주기 2개월 전부터 "검토" 표시.
