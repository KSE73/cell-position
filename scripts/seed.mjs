// 최초 1회 데이터 시딩 스크립트
// 사용법: 프로젝트 루트에 .env 파일을 만들고 Firebase config를 채운 뒤
//   npm run seed
// 를 실행하세요. (실행 후 다시 실행하면 같은 id로 덮어쓰기 되므로 여러 번 돌려도 안전합니다)

import 'dotenv/config';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, writeBatch } from 'firebase/firestore';
import { ELECTRODE_DATA } from '../src/data/electrodeData.js';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.projectId) {
  console.error('오류: .env 파일에 VITE_FIREBASE_* 값이 채워져 있는지 확인하세요.');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  const groupIds = Object.keys(ELECTRODE_DATA);
  let total = 0;
  for (const groupId of groupIds) {
    const rows = ELECTRODE_DATA[groupId];
    // writeBatch는 최대 500건 제한 -> 그룹당 158건이므로 그대로 배치 처리 가능
    const batch = writeBatch(db);
    rows.forEach((row) => {
      const { id, ...fields } = row;
      const ref = doc(db, 'cellGroups', groupId, 'electrodes', id);
      batch.set(ref, { ...fields, updatedBy: '초기 데이터 시딩' });
    });
    await batch.commit();
    total += rows.length;
    console.log(`✔ ${groupId}: ${rows.length}건 업로드 완료`);
  }
  console.log(`\n전체 ${total}건 시딩 완료.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('시딩 실패:', err);
  process.exit(1);
});
