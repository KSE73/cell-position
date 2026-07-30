import { db } from './firebase.js';
import {
  collection, doc, getDocs, query, orderBy,
  runTransaction, serverTimestamp, writeBatch,
} from 'firebase/firestore';

export const PART_IDS = ['CEC', 'UHDE', 'AKCC', 'AGC'];
export const CATEGORY_IDS = ['전해조', 'MEMBRANE', 'FRAME_GK', 'HOSE', 'IN_OUT_GK'];
export const CATEGORY_LABELS = {
  전해조: '전해조', MEMBRANE: 'MEMBRANE', FRAME_GK: 'FRAME G/K', HOSE: 'HOSE', IN_OUT_GK: 'IN·OUT G/K',
};
export const LOG_CATEGORIES = ['정비', '반입', '반출'];

const ITEM_FIELD_LABELS = { type: '종류', quantity: '수량' };

// ---- 읽기: 4개 PART의 자재 항목 전체 로드 ----
export async function loadAllMaterials() {
  const data = {};
  for (const part of PART_IDS) {
    const snap = await getDocs(collection(db, 'materialParts', part, 'items'));
    data[part] = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  return data;
}

// ---- 읽기: 정비/반입/반출 로그 전체 로드 ----
export async function loadAllLogs() {
  const snap = await getDocs(collection(db, 'materialLogs'));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

// ---- 읽기: 자재/로그 전체 수정 이력 (최신순) ----
export async function loadMaterialHistory() {
  const q = query(collection(db, 'materialEditHistory'), orderBy('historyNo', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function nextHistoryNos(tx, count) {
  const counterRef = doc(db, 'counters', 'materialHistoryCounter');
  const counterSnap = await tx.get(counterRef);
  let counter = counterSnap.exists() ? (counterSnap.data().value || 0) : 0;
  const nos = [];
  for (let i = 0; i < count; i += 1) { counter += 1; nos.push(counter); }
  tx.set(counterRef, { value: counter }, { merge: true });
  return nos;
}

// ---- 저장: 자재 항목 신규/수정 + editHistory 트랜잭션 기록 ----
// orig=null 이면 신규 항목. draft: { category, type, quantity, order }. user: { name, code }
export async function saveMaterialItem(part, itemId, orig, draft, user) {
  const fields = ['type', 'quantity'];
  const isNew = !orig;
  const changed = isNew
    ? fields.filter((f) => draft[f])
    : fields.filter((f) => String(orig[f] ?? '') !== String(draft[f] ?? ''));
  if (!isNew && changed.length === 0) return { id: itemId, entries: [] };

  const itemRef = itemId
    ? doc(db, 'materialParts', part, 'items', itemId)
    : doc(collection(db, 'materialParts', part, 'items'));
  const editedBy = `${user.name} (${user.code})`;
  const historyRefs = changed.map(() => doc(collection(db, 'materialEditHistory')));

  const entries = await runTransaction(db, async (tx) => {
    const nos = await nextHistoryNos(tx, historyRefs.length);
    const list = [];
    changed.forEach((f, i) => {
      const entry = {
        historyNo: nos[i],
        targetType: 'item',
        part,
        itemId: itemRef.id,
        category: draft.category,
        fieldChanged: f,
        fieldLabel: ITEM_FIELD_LABELS[f] || f,
        oldValue: isNew ? '' : String(orig[f] ?? ''),
        newValue: String(draft[f] ?? ''),
        editedBy,
        editedAt: serverTimestamp(),
      };
      tx.set(historyRefs[i], entry);
      list.push({ ...entry, editedAt: new Date().toISOString() });
    });
    tx.set(itemRef, {
      category: draft.category,
      type: draft.type ?? '',
      quantity: draft.quantity ?? '',
      order: draft.order ?? orig?.order ?? Date.now(),
      updatedAt: serverTimestamp(),
      updatedBy: editedBy,
    }, { merge: true });
    return list;
  });

  return { id: itemRef.id, entries };
}

// ---- 삭제: 자재 항목 (삭제도 이력에 남김) ----
export async function deleteMaterialItem(part, itemId, orig, user) {
  const editedBy = `${user.name} (${user.code})`;
  const itemRef = doc(db, 'materialParts', part, 'items', itemId);
  const historyRef = doc(collection(db, 'materialEditHistory'));
  await runTransaction(db, async (tx) => {
    const nos = await nextHistoryNos(tx, 1);
    tx.set(historyRef, {
      historyNo: nos[0],
      targetType: 'item',
      part,
      itemId,
      category: orig.category,
      fieldChanged: 'delete',
      fieldLabel: '삭제',
      oldValue: `${orig.type ?? ''} / ${orig.quantity ?? ''}`,
      newValue: '',
      editedBy,
      editedAt: serverTimestamp(),
    });
    tx.delete(itemRef);
  });
}

// ---- 저장: 정비/반입/반출 로그 신규/수정 ----
export async function saveMaterialLog(logId, orig, draft, user) {
  const isNew = !orig;
  const noChange = !isNew
    && String(orig.content ?? '') === String(draft.content ?? '')
    && orig.category === draft.category;
  if (noChange) return { id: logId, entries: [] };

  const editedBy = `${user.name} (${user.code})`;
  const logRef = logId ? doc(db, 'materialLogs', logId) : doc(collection(db, 'materialLogs'));
  const historyRef = doc(collection(db, 'materialEditHistory'));

  const entries = await runTransaction(db, async (tx) => {
    const nos = await nextHistoryNos(tx, 1);
    const entry = {
      historyNo: nos[0],
      targetType: 'log',
      logId: logRef.id,
      category: draft.category,
      fieldChanged: 'content',
      fieldLabel: '내용',
      oldValue: isNew ? '' : String(orig.content ?? ''),
      newValue: String(draft.content ?? ''),
      editedBy,
      editedAt: serverTimestamp(),
    };
    tx.set(historyRef, entry);
    tx.set(logRef, {
      category: draft.category,
      content: draft.content ?? '',
      order: draft.order ?? orig?.order ?? Date.now(),
      updatedAt: serverTimestamp(),
      updatedBy: editedBy,
    }, { merge: true });
    return [{ ...entry, editedAt: new Date().toISOString() }];
  });

  return { id: logRef.id, entries };
}

// ---- 삭제: 로그 항목 ----
export async function deleteMaterialLog(logId, orig, user) {
  const editedBy = `${user.name} (${user.code})`;
  const logRef = doc(db, 'materialLogs', logId);
  const historyRef = doc(collection(db, 'materialEditHistory'));
  await runTransaction(db, async (tx) => {
    const nos = await nextHistoryNos(tx, 1);
    tx.set(historyRef, {
      historyNo: nos[0],
      targetType: 'log',
      logId,
      category: orig.category,
      fieldChanged: 'delete',
      fieldLabel: '삭제',
      oldValue: orig.content ?? '',
      newValue: '',
      editedBy,
      editedAt: serverTimestamp(),
    });
    tx.delete(logRef);
  });
}

// ---- 최초 1회 시딩: materialData.js를 Firestore에 업로드 ----
export async function seedMaterials(materialData, user) {
  const updatedBy = `${user.name} (${user.code})`;
  for (const part of PART_IDS) {
    const categories = materialData[part] || {};
    const batch = writeBatch(db);
    let order = 0;
    Object.entries(categories).forEach(([category, items]) => {
      items.forEach((it) => {
        order += 1;
        const ref = doc(collection(db, 'materialParts', part, 'items'));
        batch.set(ref, { category, type: it.type || '', quantity: it.quantity || '', order, updatedBy });
      });
    });
    await batch.commit();
  }
}

// ---- 최초 1회 시딩: materialLogData.js를 Firestore에 업로드 ----
export async function seedMaterialLogs(logData, user) {
  const updatedBy = `${user.name} (${user.code})`;
  const batch = writeBatch(db);
  let order = 0;
  Object.entries(logData).forEach(([category, entries]) => {
    entries.forEach((content) => {
      order += 1;
      const ref = doc(collection(db, 'materialLogs'));
      batch.set(ref, { category, content, order, updatedBy });
    });
  });
  await batch.commit();
}
