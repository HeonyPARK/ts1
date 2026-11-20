# GitHub · Firebase · Vercel 배포 안내

## 접속 방식

앱에는 로그인이나 비밀번호 화면이 없습니다. Firestore 규칙도 지정된 공유 문서를 공개 읽기·쓰기로 설정하므로, 배포 URL을 열 수 있는 누구나 전체 현장 자료를 보고 수정할 수 있습니다. 앱에 입력하는 가격·업체·현장 정보는 공개 자료로 취급하세요. 공개 쓰기는 원치 않는 변경이나 사용량 증가도 허용합니다.

## 1. Firebase Firestore 설정

Firebase 프로젝트 `ts01-9afc3`을 사용합니다. `index.html`의 웹 앱 설정은 Firebase Console에서 이 프로젝트에 등록된 웹 앱의 최신 설정과 일치해야 합니다. Firebase 공식 문서는 모듈 SDK의 `gstatic` CDN import 형식을 안내하고 있으며, 현재 앱은 공식 Firebase SDK 13.4.0을 사용합니다. [Firebase 웹 SDK 설정](https://firebase.google.com/docs/web/setup)

Firebase SDK 추가 화면에서 `npm install firebase`를 실행하거나 `firebase/app` import 예시를 복사할 필요는 없습니다. 현재 프로젝트는 빌드 도구 없이 `firebase-client.js`에서 공식 CDN 모듈을 불러옵니다. 화면에서 제공하는 `firebaseConfig` 값만 `index.html`에 맞춰 두면 됩니다. 앱은 Analytics를 사용하지 않아 선택 항목인 `measurementId`는 생략했습니다.

1. Firebase Console에서 `ts01-9afc3` 프로젝트를 열고 **Firestore Database**를 만듭니다.
2. 데이터베이스의 **Rules** 탭에서 아래 규칙을 배포합니다. `firestore.rules` 파일에도 같은 규칙이 있습니다.

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /workspaces/ts-construction-shared {
      allow read, create, update: if true;
      allow delete: if false;
    }
  }
}
```

규칙은 공유 문서 하나만 허용하고 문서 삭제는 막지만, 누구나 읽고 덮어쓸 수 있습니다. Firestore는 각 클라이언트 요청에 보안 규칙을 적용합니다. [Firestore 규칙 구조](https://firebase.google.com/docs/firestore/security/rules-structure)

규칙을 Firebase CLI로 배포할 수도 있습니다. 프로젝트 루트에서 다음을 실행합니다.

```powershell
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

`firebase.json`과 `.firebaserc`에는 규칙 경로와 Firebase 프로젝트 ID가 설정되어 있습니다.

## 2. GitHub에 코드 올리기

1. `github.zip`을 압축 해제합니다.
2. 압축 안의 파일과 폴더를 새 GitHub 저장소의 최상위에 올립니다. ZIP 자체는 올릴 필요가 없습니다.
3. 실제 현장 자료가 들어 있으므로 앱 코드 저장소는 비공개로 두는 것을 권장합니다. `seed/initial-data.json`은 2026-11-20 백업에서 복사한 초기 자료입니다.

## 3. Vercel에 배포하기

1. Vercel에서 **Add New → Project**를 선택하고 GitHub 저장소를 Import합니다.
2. 프로젝트 루트는 저장소 최상위로 둡니다. 기본 정적 배포 설정으로 배포하면 됩니다.
3. Firebase 웹 설정은 코드에 포함되어 있어 Firebase 연결에 별도 Vercel 환경 변수가 필요하지 않습니다.
4. 배포 URL을 처음 열면 Vercel에 포함된 `seed/initial-data.json`에서 3개 현장 자료를 읽어 Firestore를 자동 초기화합니다. 초기 파일을 읽지 못하면 화면에서 백업 JSON을 직접 선택할 수 있습니다. 이미 초기화된 뒤에는 왼쪽 아래 **JSON 백업 반영**으로 전체 자료를 교체할 수 있습니다.

Firestore 문서에는 1 MiB 크기 제한이 있습니다. 현재 백업은 약 46 KB이며, 앱은 안전 여유를 두고 공유 데이터가 900 KiB를 넘으면 저장을 거부합니다. 자료가 커지면 현장별 문서로 분리해야 합니다. [Firestore 사용량과 제한](https://firebase.google.com/docs/firestore/quotas)

## 4. JSON 백업과 GitHub 자동 저장

**데이터 백업** 버튼은 JSON 파일을 다운로드합니다. GitHub에 자동 커밋하려면 Vercel 프로젝트 환경 변수에 아래 값을 선택적으로 설정합니다.

| 변수 | 값 |
| --- | --- |
| `GITHUB_BACKUP_TOKEN` | 백업 저장소의 Contents 읽기·쓰기만 허용한 Fine-grained token |
| `GITHUB_REPOSITORY` | `owner/repository` 형식의 별도 비공개 데이터 저장소 |
| `GITHUB_BRANCH` | 백업 브랜치, 기본값 `main` |
| `GITHUB_BACKUP_PATH` | 파일 경로, 기본값 `data/shared-data.json` |

이 백업 API에도 로그인 보호가 없습니다. 자동 커밋을 켜면 방문자가 고정 JSON 백업 파일을 덮어쓸 수 있습니다. 사용하지 않으려면 `GITHUB_BACKUP_*` 변수를 설정하지 마세요. JSON 다운로드와 Firestore에 JSON을 반영하는 기능은 계속 사용할 수 있습니다.

## 파일 안내

- `firebase-client.js`: Firestore 읽기·트랜잭션 쓰기·실시간 구독
- `firestore.rules`: 공유 문서에 대한 공개 규칙
- `firebase.json`, `.firebaserc`: Firebase CLI 설정
- `seed/initial-data.json`: 최초 DB 반영에 사용할 최신 백업
- `api/backup.js`: 환경 변수 설정 시 GitHub 백업 저장

Firestore 실시간 변경은 공식 `onSnapshot` 리스너를 사용하고, 동시 수정은 트랜잭션과 revision 값으로 충돌을 감지합니다. [실시간 업데이트](https://firebase.google.com/docs/firestore/query-data/listen), [트랜잭션](https://firebase.google.com/docs/firestore/manage-data/transactions)
