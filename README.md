# TS 공사관리

인테리어 현장별 공정과 기물·마감재 스펙을 관리하는 브라우저 앱입니다.

## 기능

- 여러 현장 대시보드와 공정 타임라인·목록
- 현장별 기물·마감재 스펙 관리
- PDF·엑셀·CSV 가져오기, JSON 백업·복원
- Firebase Cloud Firestore 실시간 공동 저장

## 처음 시작

첫 방문 시 배포 파일에 포함된 `seed/initial-data.json`으로 Firestore를 자동 초기화합니다. 현재 현장 자료는 `workspaces/ts-construction-shared` 문서에 저장되고 접속자 화면에 실시간 반영됩니다.

별도 로그인은 없습니다. 배포 URL과 Firestore 데이터에 접근할 수 있는 사람은 누구나 자료를 읽고 수정할 수 있습니다. Firebase, GitHub, Vercel 배포 절차와 보안 범위는 [DEPLOYMENT.md](DEPLOYMENT.md)를 참고하세요.
