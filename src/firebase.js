import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, doc, getDocs, getDoc, query, orderBy,
  runTransaction, serverTimestamp, writeBatch, increment, setDoc,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export const GROUP_IDS = ['EL-500A', 'EL-500B', 'EL-500C', 'EL-500D', 'EL-500E'];

const FIELD_LABELS = {
  electrodeNo: '전극 No.', installDate: '설치일자', type: 'Type',
  membraneCode: "MEMB'", membraneInstallDate: '멤브레인 설치일',
  membraneNo: "MEM' NO", ioType: 'I/O 구분',
};

// ---- 읽기: 5개 그룹의 전극 데이터 전체 로드 ----
export async function loadAllElectrodes() {
  const data = {};
  for (const g of GROUP_IDS) {
    const snap = await getDocs(collection(db, 'cellGroups', g, 'electrodes'));
    data[g] = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => a.no - b.no);
  }
  return data;
}

// ---- 읽기: 전체 수정 이력 (최신순) ----
export async function loadAllHistory() {
  const q = query(collection(db, 'editHistory'), orderBy('historyNo', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---- 저장: 변경 필드 diff 후 electrode 문서 update + editHistory 기록을 트랜잭션으로 처리 ----
// orig, draft: 편집 전/후 전극 객체. user: { name, code }
export async function saveElectrodeWithHistory(groupId, electrodeId, orig, draft, user) {
  const fields = ['electrodeNo', 'installDate', 'type', 'membraneCode', 'membraneInstallDate', 'membraneNo', 'ioType'];
  const changed = fields.filter((f) => String(orig[f]) !== String(draft[f]));
  if (changed.length === 0) return [];

  const electrodeRef = doc(db, 'cellGroups', groupId, 'electrodes', electrodeId);
  const counterRef = doc(db, 'counters', 'historyCounter');
  const editedBy = `${user.name} (${user.code})`;

  const historyRefs = changed.map(() => doc(collection(db, 'editHistory')));

  const result = await runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef);
    let counter = counterSnap.exists() ? (counterSnap.data().value || 0) : 0;

    const entries = [];
    changed.forEach((f, i) => {
      counter += 1;
      const entry = {
        historyNo: counter,
        groupId,
        electrodeId,
        electrodeNo: draft.electrodeNo,
        fieldChanged: f,
        fieldLabel: FIELD_LABELS[f] || f,
        oldValue: String(orig[f]),
        newValue: String(draft[f]),
        editedBy,
        editedAt: serverTimestamp(),
      };
      tx.set(historyRefs[i], entry);
      entries.push({ ...entry, editedAt: new Date().toISOString() });
    });

    tx.set(counterRef, { value: counter }, { merge: true });
    tx.set(electrodeRef, {
      ...draft,
      updatedAt: serverTimestamp(),
      updatedBy: editedBy,
    }, { merge: true });

    return entries;
  });

  return result;
}

// ---- 최초 1회 시딩: electrodeData.js의 790개 레코드를 Firestore에 업로드 ----
// writeBatch는 최대 500건 제한이 있어 그룹 단위(158건)로 나눠서 처리합니다.
export async function seedElectrodes(electrodeData) {
  for (const groupId of GROUP_IDS) {
    const rows = electrodeData[groupId] || [];
    const batch = writeBatch(db);
    rows.forEach((row) => {
      const { id, ...fields } = row;
      const ref = doc(db, 'cellGroups', groupId, 'electrodes', id);
      batch.set(ref, fields);
    });
    await batch.commit();
    console.log(`${groupId}: ${rows.length}건 시딩 완료`);
  }
}
