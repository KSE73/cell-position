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

const ITEM_FIELD_LABELS = { type: '종류', subType: '규격', quantity: '수량', unit: '단위', note: '비고' };

// 로그 구분이 자재 수량에 미치는 효과: 정비=차감, 반입=증가, 반출=변동없음
function stockEffect(category, qty) {
  const n = Number(qty) || 0;
  if (category === '정비') return -n;
  if (category === '반입') return n;
  return 0;
}

export function materialItemLabel(part, item) {
  const cat = CATEGORY_LABELS[item.category] || item.category;
  const spec = item.subType ? ` (${item.subType})` : '';
  return `${part} · ${cat} · ${item.type || '(종류 없음)'}${spec}`;
}

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
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.order ?? 0) - (a.order ?? 0));
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

// ---- 저장: 자재 항목 신규/수정 (직접 편집. 로그로 인한 자동 증감은 saveMaterialLog가 처리) ----
export async function saveMaterialItem(part, itemId, orig, draft, user) {
  const fields = ['type', 'subType', 'quantity', 'unit', 'note'];
  const isNew = !orig;
  const changed = isNew
    ? fields.filter((f) => draft[f] !== undefined && draft[f] !== '')
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
      subType: draft.subType ?? '',
      quantity: Number(draft.quantity) || 0,
      unit: draft.unit ?? '',
      note: draft.note ?? '',
      order: draft.order ?? orig?.order ?? Date.now(),
      updatedAt: serverTimestamp(),
      updatedBy: editedBy,
    }, { merge: true });
    return list;
  });

  return { id: itemRef.id, entries };
}

// ---- 삭제: 자재 항목 ----
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
      oldValue: `${orig.type ?? ''} ${orig.subType ? '(' + orig.subType + ')' : ''} / ${orig.quantity ?? 0}${orig.unit ?? ''}`,
      newValue: '',
      editedBy,
      editedAt: serverTimestamp(),
    });
    tx.delete(itemRef);
  });
}

// ---- 저장: 정비/반입/반출 로그 신규/수정 ----
// draft: { category, date, refPart, refItemId, quantity, description, note }
// 정비=자재 수량 차감, 반입=증가, 반출=변동없음. 참조 자재가 바뀌면 이전 항목은 원복하고 새 항목에 반영합니다.
export async function saveMaterialLog(logId, orig, draft, user) {
  const isNew = !orig;
  const editedBy = `${user.name} (${user.code})`;
  const logRef = logId ? doc(db, 'materialLogs', logId) : doc(collection(db, 'materialLogs'));

  const oldRef = orig ? doc(db, 'materialParts', orig.refPart, 'items', orig.refItemId) : null;
  const newRef = draft.refPart && draft.refItemId ? doc(db, 'materialParts', draft.refPart, 'items', draft.refItemId) : null;
  const samePath = oldRef && newRef && oldRef.path === newRef.path;

  const oldEffect = orig ? stockEffect(orig.category, orig.quantity) : 0;
  const newEffect = stockEffect(draft.category, draft.quantity);

  const historyRefs = [doc(collection(db, 'materialEditHistory'))]; // 로그 자체 변경 이력
  if (oldEffect !== 0 && !samePath) historyRefs.push(doc(collection(db, 'materialEditHistory')));
  if (newEffect !== 0) historyRefs.push(doc(collection(db, 'materialEditHistory')));

  const entries = await runTransaction(db, async (tx) => {
    // 모든 읽기를 먼저 수행 (Firestore 트랜잭션 규칙)
    const oldItemSnap = oldRef ? await tx.get(oldRef) : null;
    const newItemSnap = (newRef && !samePath) ? await tx.get(newRef) : null;
    const sameItemSnap = samePath ? await tx.get(newRef) : null;

    const nos = await nextHistoryNos(tx, historyRefs.length);
    let nIdx = 0;
    const list = [];

    // 1) 로그 내용 이력
    const logEntry = {
      historyNo: nos[nIdx++],
      targetType: 'log',
      logId: logRef.id,
      category: draft.category,
      fieldChanged: isNew ? 'create' : 'content',
      fieldLabel: isNew ? '생성' : '내용 수정',
      oldValue: isNew ? '' : `${orig.date || ''} ${orig.quantity || 0} / ${orig.description || ''}`,
      newValue: `${draft.date || ''} ${draft.quantity || 0} / ${draft.description || ''}`,
      editedBy,
      editedAt: serverTimestamp(),
    };
    tx.set(historyRefs[0], logEntry);
    list.push({ ...logEntry, editedAt: new Date().toISOString() });

    // 2) 자재 수량 반영
    if (samePath) {
      const cur = sameItemSnap.exists() ? (Number(sameItemSnap.data().quantity) || 0) : 0;
      const nextQty = cur - oldEffect + newEffect;
      if (nextQty !== cur) {
        const hEntry = {
          historyNo: nos[nIdx++],
          targetType: 'item',
          part: draft.refPart,
          itemId: draft.refItemId,
          category: newItemSnap?.data()?.category,
          fieldChanged: 'quantity',
          fieldLabel: '수량 (로그 반영)',
          oldValue: String(cur),
          newValue: String(nextQty),
          editedBy,
          editedAt: serverTimestamp(),
        };
        tx.set(historyRefs[nIdx - 1], hEntry);
        list.push({ ...hEntry, editedAt: new Date().toISOString() });
        tx.set(newRef, { quantity: nextQty, updatedAt: serverTimestamp(), updatedBy: editedBy }, { merge: true });
      }
    } else {
      if (oldRef && oldEffect !== 0) {
        const cur = oldItemSnap.exists() ? (Number(oldItemSnap.data().quantity) || 0) : 0;
        const nextQty = cur - oldEffect;
        const hEntry = {
          historyNo: nos[nIdx++],
          targetType: 'item',
          part: orig.refPart,
          itemId: orig.refItemId,
          category: oldItemSnap?.data()?.category,
          fieldChanged: 'quantity',
          fieldLabel: '수량 (로그 취소 반영)',
          oldValue: String(cur),
          newValue: String(nextQty),
          editedBy,
          editedAt: serverTimestamp(),
        };
        tx.set(historyRefs[nIdx - 1], hEntry);
        list.push({ ...hEntry, editedAt: new Date().toISOString() });
        tx.set(oldRef, { quantity: nextQty, updatedAt: serverTimestamp(), updatedBy: editedBy }, { merge: true });
      }
      if (newRef && newEffect !== 0) {
        const cur = newItemSnap.exists() ? (Number(newItemSnap.data().quantity) || 0) : 0;
        const nextQty = cur + newEffect;
        const hEntry = {
          historyNo: nos[nIdx++],
          targetType: 'item',
          part: draft.refPart,
          itemId: draft.refItemId,
          category: newItemSnap?.data()?.category,
          fieldChanged: 'quantity',
          fieldLabel: '수량 (로그 반영)',
          oldValue: String(cur),
          newValue: String(nextQty),
          editedBy,
          editedAt: serverTimestamp(),
        };
        tx.set(historyRefs[nIdx - 1], hEntry);
        list.push({ ...hEntry, editedAt: new Date().toISOString() });
        tx.set(newRef, { quantity: nextQty, updatedAt: serverTimestamp(), updatedBy: editedBy }, { merge: true });
      }
    }

    // 3) 로그 문서 저장
    tx.set(logRef, {
      category: draft.category,
      date: draft.date ?? '',
      refPart: draft.refPart ?? '',
      refItemId: draft.refItemId ?? '',
      refLabel: draft.refLabel ?? '',
      quantity: Number(draft.quantity) || 0,
      description: draft.description ?? '',
      note: draft.note ?? '',
      order: draft.order ?? orig?.order ?? Date.now(),
      updatedAt: serverTimestamp(),
      updatedBy: editedBy,
    }, { merge: true });

    return list;
  });

  return { id: logRef.id, entries };
}

// ---- 삭제: 로그 항목 (자재 수량 원복 포함) ----
export async function deleteMaterialLog(logId, orig, user) {
  const editedBy = `${user.name} (${user.code})`;
  const logRef = doc(db, 'materialLogs', logId);
  const itemRef = orig.refPart && orig.refItemId ? doc(db, 'materialParts', orig.refPart, 'items', orig.refItemId) : null;
  const effect = stockEffect(orig.category, orig.quantity);

  const historyRefs = [doc(collection(db, 'materialEditHistory'))];
  if (itemRef && effect !== 0) historyRefs.push(doc(collection(db, 'materialEditHistory')));

  await runTransaction(db, async (tx) => {
    const itemSnap = itemRef ? await tx.get(itemRef) : null;
    const nos = await nextHistoryNos(tx, historyRefs.length);
    let nIdx = 0;

    tx.set(historyRefs[nIdx++], {
      historyNo: nos[0],
      targetType: 'log',
      logId,
      category: orig.category,
      fieldChanged: 'delete',
      fieldLabel: '삭제',
      oldValue: `${orig.date || ''} ${orig.refLabel || ''} ${orig.quantity || 0}`,
      newValue: '',
      editedBy,
      editedAt: serverTimestamp(),
    });

    if (itemRef && effect !== 0) {
      const cur = itemSnap.exists() ? (Number(itemSnap.data().quantity) || 0) : 0;
      const nextQty = cur - effect;
      tx.set(historyRefs[nIdx], {
        historyNo: nos[nIdx],
        targetType: 'item',
        part: orig.refPart,
        itemId: orig.refItemId,
        category: itemSnap?.data()?.category,
        fieldChanged: 'quantity',
        fieldLabel: '수량 (로그 삭제 반영)',
        oldValue: String(cur),
        newValue: String(nextQty),
        editedBy,
        editedAt: serverTimestamp(),
      });
      tx.set(itemRef, { quantity: nextQty, updatedAt: serverTimestamp(), updatedBy: editedBy }, { merge: true });
    }

    tx.delete(logRef);
  });
}

// ---- 최초 1회(또는 재설치) 시딩: materialData.js를 Firestore에 업로드 ----
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
        batch.set(ref, {
          category, type: it.type || '', subType: it.subType || '',
          quantity: 0, unit: it.unit || '', note: '', order, updatedBy,
        });
      });
    });
    await batch.commit();
  }
}

// ---- 전체 초기화: materialParts/materialLogs의 모든 문서를 삭제 (되돌릴 수 없음) ----
export async function wipeAllMaterialData() {
  for (const part of PART_IDS) {
    const snap = await getDocs(collection(db, 'materialParts', part, 'items'));
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 450) {
      const batch = writeBatch(db);
      docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
  const logSnap = await getDocs(collection(db, 'materialLogs'));
  const logDocs = logSnap.docs;
  for (let i = 0; i < logDocs.length; i += 450) {
    const batch = writeBatch(db);
    logDocs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}
