import React, { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  PART_IDS, CATEGORY_IDS, CATEGORY_LABELS, LOG_CATEGORIES,
  loadAllMaterials, loadAllLogs, loadMaterialHistory,
  saveMaterialItem, deleteMaterialItem, saveMaterialLog, deleteMaterialLog,
  seedMaterials, seedMaterialLogs,
} from './firebaseMaterial.js';
import { materialData, materialLogData } from './data/materialData.js';

const PART_LABELS = { CEC: 'CEC', UHDE: 'UHDE', AKCC: 'AKCC', AGC: 'AGC' };
const LOG_COLORS = { 정비: '#3B82C4', 반입: '#1A7F52', 반출: '#B65E12' };

const inputStyle = { width: '100%', border: '1px solid #DEDEE4', borderRadius: 9, padding: '11px 13px', fontSize: 14, outline: 'none', background: '#fff', boxSizing: 'border-box' };
const cardStyle = { background: '#fff', border: '1px solid #E9E9EE', borderRadius: 16 };

function FieldLabel({ children }) {
  return <div style={{ fontSize: 12.5, fontWeight: 700, color: '#7C7C86', marginBottom: 7 }}>{children}</div>;
}

export default function MaterialPage({ user, onRequireIdentity, showToast }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [subView, setSubView] = useState('status'); // 'status' | 'log'
  const [materials, setMaterials] = useState({});   // part -> items[]
  const [logs, setLogs] = useState([]);
  const [history, setHistory] = useState([]);

  const [itemEditor, setItemEditor] = useState(null); // { part, id, orig, draft }
  const [logEditor, setLogEditor] = useState(null);   // { id, orig, draft }
  const [historyTarget, setHistoryTarget] = useState(null); // { type, id, label }
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => { refreshAll(); }, []);

  async function refreshAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const [m, l, h] = await Promise.all([loadAllMaterials(), loadAllLogs(), loadMaterialHistory()]);
      setMaterials(m);
      setLogs(l);
      setHistory(h);
    } catch (err) {
      console.error(err);
      setLoadError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  const totalItems = Object.values(materials).reduce((s, arr) => s + arr.length, 0);
  const isEmpty = !loading && !loadError && totalItems === 0 && logs.length === 0;

  async function runSeed() {
    if (!user) { onRequireIdentity(); return; }
    if (seeding) return;
    setSeeding(true);
    try {
      await seedMaterials(materialData, user);
      await seedMaterialLogs(materialLogData, user);
      showToast('초기 데이터 업로드가 완료되었습니다');
      await refreshAll();
    } catch (err) {
      console.error(err);
      showToast('초기 업로드 실패: ' + (err.message || err));
    } finally {
      setSeeding(false);
    }
  }

  // ---- 자재 항목 편집 ----
  function openNewItem(part, category) {
    if (!user) { onRequireIdentity(); return; }
    setItemEditor({ part, id: null, orig: null, draft: { category, type: '', quantity: '' } });
  }
  function openEditItem(part, row) {
    if (!user) { onRequireIdentity(); return; }
    setItemEditor({ part, id: row.id, orig: row, draft: { category: row.category, type: row.type, quantity: row.quantity } });
  }
  function closeItemEditor() { setItemEditor(null); }

  async function saveItemEditor() {
    if (!itemEditor || saving) return;
    setSaving(true);
    try {
      const { part, id, orig, draft } = itemEditor;
      const { id: newId, entries } = await saveMaterialItem(part, id, orig, draft, user);
      if (entries.length === 0) {
        showToast('변경된 항목이 없습니다');
      } else {
        setMaterials((m) => {
          const arr = m[part] || [];
          const exists = arr.some((r) => r.id === newId);
          const nextArr = exists
            ? arr.map((r) => (r.id === newId ? { ...r, ...draft } : r))
            : [...arr, { id: newId, ...draft, order: Date.now() }];
          return { ...m, [part]: nextArr };
        });
        setHistory((h) => [...entries, ...h]);
        showToast(id ? '수정되고 이력에 기록되었습니다' : '새 항목이 추가되었습니다');
      }
      closeItemEditor();
    } catch (err) {
      console.error(err);
      showToast('저장 실패: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(part, row) {
    if (!user) { onRequireIdentity(); return; }
    if (!window.confirm(`'${row.type || '(종류 없음)'}' 항목을 삭제할까요?`)) return;
    try {
      await deleteMaterialItem(part, row.id, row, user);
      setMaterials((m) => ({ ...m, [part]: (m[part] || []).filter((r) => r.id !== row.id) }));
      showToast('삭제되었습니다');
    } catch (err) {
      console.error(err);
      showToast('삭제 실패: ' + (err.message || err));
    }
  }

  // ---- 로그 편집 ----
  function openNewLog(category) {
    if (!user) { onRequireIdentity(); return; }
    setLogEditor({ id: null, orig: null, draft: { category, content: '' } });
  }
  function openEditLog(row) {
    if (!user) { onRequireIdentity(); return; }
    setLogEditor({ id: row.id, orig: row, draft: { category: row.category, content: row.content } });
  }
  function closeLogEditor() { setLogEditor(null); }

  async function saveLogEditor() {
    if (!logEditor || saving) return;
    setSaving(true);
    try {
      const { id, orig, draft } = logEditor;
      const { id: newId, entries } = await saveMaterialLog(id, orig, draft, user);
      if (entries.length === 0) {
        showToast('변경된 내용이 없습니다');
      } else {
        setLogs((ls) => {
          const exists = ls.some((r) => r.id === newId);
          return exists
            ? ls.map((r) => (r.id === newId ? { ...r, ...draft } : r))
            : [{ id: newId, ...draft, order: Date.now() }, ...ls];
        });
        setHistory((h) => [...entries, ...h]);
        showToast(id ? '수정되고 이력에 기록되었습니다' : '새 로그가 추가되었습니다');
      }
      closeLogEditor();
    } catch (err) {
      console.error(err);
      showToast('저장 실패: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  }

  async function removeLog(row) {
    if (!user) { onRequireIdentity(); return; }
    if (!window.confirm('이 로그를 삭제할까요?')) return;
    try {
      await deleteMaterialLog(row.id, row, user);
      setLogs((ls) => ls.filter((r) => r.id !== row.id));
      showToast('삭제되었습니다');
    } catch (err) {
      console.error(err);
      showToast('삭제 실패: ' + (err.message || err));
    }
  }

  // ---- 엑셀 ----
  function doDownload() {
    const wb = XLSX.utils.book_new();
    const materialRows = [];
    PART_IDS.forEach((part) => {
      (materials[part] || []).forEach((r) => {
        materialRows.push({
          PART: part, 카테고리: CATEGORY_LABELS[r.category] || r.category,
          종류: r.type, 수량: r.quantity, ID: r.id,
        });
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(materialRows), '자재현황');

    const logRows = logs.map((r) => ({ 구분: r.category, 내용: r.content, ID: r.id }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(logRows), '정비반입반출');

    XLSX.writeFile(wb, `PART별자재현황_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('엑셀 파일이 다운로드되었습니다');
  }

  function triggerUpload() {
    if (!user) { onRequireIdentity(); return; }
    fileInputRef.current?.click();
  }

  async function handleUploadFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    showToast('엑셀 파일을 읽는 중...');
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });

      if (wb.SheetNames.includes('자재현황')) {
        const json = XLSX.utils.sheet_to_json(wb.Sheets['자재현황']);
        const catByLabel = Object.fromEntries(CATEGORY_IDS.map((c) => [CATEGORY_LABELS[c], c]));
        for (const row of json) {
          const part = String(row['PART'] || '').trim();
          if (!PART_IDS.includes(part)) continue;
          const category = catByLabel[String(row['카테고리'] || '').trim()] || row['카테고리'];
          const id = row['ID'] ? String(row['ID']) : null;
          const orig = id ? (materials[part] || []).find((r) => r.id === id) : null;
          const draft = { category, type: String(row['종류'] ?? ''), quantity: String(row['수량'] ?? '') };
          await saveMaterialItem(part, id, orig, draft, user);
        }
      }
      if (wb.SheetNames.includes('정비반입반출')) {
        const json = XLSX.utils.sheet_to_json(wb.Sheets['정비반입반출']);
        for (const row of json) {
          const category = String(row['구분'] || '').trim();
          if (!LOG_CATEGORIES.includes(category)) continue;
          const id = row['ID'] ? String(row['ID']) : null;
          const orig = id ? logs.find((r) => r.id === id) : null;
          const draft = { category, content: String(row['내용'] ?? '') };
          await saveMaterialLog(id, orig, draft, user);
        }
      }
      showToast('엑셀 업로드 및 반영이 완료되었습니다');
      await refreshAll();
    } catch (err) {
      console.error(err);
      showToast('업로드 실패: ' + (err.message || err));
    }
  }

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#8A8A92' }}>자재 데이터를 불러오는 중...</div>;
  if (loadError) return (
    <div style={{ padding: 60, textAlign: 'center', color: '#DA3633' }}>
      데이터 로드 실패: {loadError}
      <div><button onClick={refreshAll} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, border: '1px solid #ccc', cursor: 'pointer' }}>다시 시도</button></div>
    </div>
  );

  const itemHistory = historyTarget?.type === 'item'
    ? history.filter((h) => h.targetType === 'item' && h.itemId === historyTarget.id)
    : [];
  const logHistory = historyTarget?.type === 'log'
    ? history.filter((h) => h.targetType === 'log' && h.logId === historyTarget.id)
    : [];

  return (
    <div>
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleUploadFile} />

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800, letterSpacing: '-.02em', color: '#1B1B1F' }}>PART별 주요자재 현황</h1>
        <div style={{ fontSize: 14, color: '#9A9AA2', fontWeight: 600 }}>전해조 · MEMBRANE · FRAME G/K · HOSE · IN·OUT G/K</div>
        <div style={{ flex: 1 }} />
        <div onClick={triggerUpload} style={{ background: '#fff', border: '1px solid #DEDEE4', color: '#4A4A52', fontSize: 13.5, fontWeight: 700, padding: '9px 16px', borderRadius: 9, cursor: 'pointer' }}>엑셀 업로드</div>
        <div onClick={doDownload} style={{ background: '#18181B', color: '#fff', fontSize: 13.5, fontWeight: 700, padding: '9px 16px', borderRadius: 9, cursor: 'pointer' }}>엑셀 다운로드</div>
      </div>

      {isEmpty && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#FFF6EC', border: '1px solid #F4DFC7', borderRadius: 12, padding: '14px 18px', marginBottom: 22 }}>
          <div style={{ fontSize: 13.5, color: '#8A6A50', fontWeight: 600 }}>아직 데이터가 없습니다. 엑셀 원본으로 초기 데이터를 업로드할까요? (최초 1회만 사용)</div>
          <div style={{ flex: 1 }} />
          <div onClick={runSeed} style={{ background: '#E5620E', color: '#fff', fontSize: 13, fontWeight: 700, padding: '9px 18px', borderRadius: 9, cursor: seeding ? 'default' : 'pointer', opacity: seeding ? 0.6 : 1 }}>{seeding ? '업로드 중...' : '초기 데이터 업로드'}</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
        {[{ key: 'status', label: '자재현황' }, { key: 'log', label: '정비·반입·반출' }].map((t) => (
          <div key={t.key} onClick={() => setSubView(t.key)}
            style={{ padding: '9px 18px', borderRadius: 999, fontSize: 14, fontWeight: 700, cursor: 'pointer', background: subView === t.key ? '#18181B' : '#fff', color: subView === t.key ? '#fff' : '#4A4A52', border: '1px solid #E9E9EE' }}>
            {t.label}
          </div>
        ))}
      </div>

      {subView === 'status' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {PART_IDS.map((part) => (
            <div key={part} style={{ ...cardStyle, padding: '22px 24px' }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#1B1B1F', marginBottom: 16 }}>{PART_LABELS[part]}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16 }}>
                {CATEGORY_IDS.map((cat) => {
                  const rows = (materials[part] || []).filter((r) => r.category === cat);
                  return (
                    <div key={cat} style={{ border: '1px solid #EEEEF2', borderRadius: 12, padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#7C7C86' }}>{CATEGORY_LABELS[cat]}</div>
                        <div style={{ flex: 1 }} />
                        <div onClick={() => openNewItem(part, cat)} style={{ fontSize: 12, fontWeight: 700, color: '#E5620E', cursor: 'pointer' }}>+ 추가</div>
                      </div>
                      {rows.length === 0 && <div style={{ fontSize: 12.5, color: '#B4B4BC', padding: '6px 2px' }}>항목 없음</div>}
                      {rows.map((r) => (
                        <div key={r.id} style={{ padding: '9px 2px', borderTop: '1px solid #F2F2F5' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#1B1B1F', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{r.type || '(종류 없음)'}</div>
                              <div style={{ fontSize: 12.5, color: '#5A5A62', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 2 }}>{r.quantity}</div>
                              {r.updatedBy && <div style={{ fontSize: 11, color: '#B4B4BC', marginTop: 4 }}>최근 수정 · {r.updatedBy}</div>}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                              <span onClick={() => openEditItem(part, r)} style={{ fontSize: 11.5, color: '#7C7C86', cursor: 'pointer' }}>편집</span>
                              <span onClick={() => setHistoryTarget({ type: 'item', id: r.id, label: `${PART_LABELS[part]} · ${CATEGORY_LABELS[cat]} · ${r.type || ''}` })} style={{ fontSize: 11.5, color: '#7C7C86', cursor: 'pointer' }}>이력</span>
                              <span onClick={() => removeItem(part, r)} style={{ fontSize: 11.5, color: '#DA3633', cursor: 'pointer' }}>삭제</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {subView === 'log' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {LOG_CATEGORIES.map((cat) => {
            const rows = logs.filter((r) => r.category === cat);
            return (
              <div key={cat} style={{ ...cardStyle, padding: '18px 18px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: LOG_COLORS[cat] }} />
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#1B1B1F', marginLeft: 8 }}>{cat}</div>
                  <div style={{ flex: 1 }} />
                  <div onClick={() => openNewLog(cat)} style={{ fontSize: 12, fontWeight: 700, color: '#E5620E', cursor: 'pointer' }}>+ 추가</div>
                </div>
                {rows.length === 0 && <div style={{ fontSize: 12.5, color: '#B4B4BC', padding: '4px 2px 18px' }}>기록 없음</div>}
                {rows.map((r) => (
                  <div key={r.id} style={{ border: '1px solid #EEEEF2', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                    <div style={{ fontSize: 13, color: '#26262B', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.55 }}>{r.content}</div>
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
                      <div style={{ fontSize: 11, color: '#B4B4BC' }}>{r.updatedBy ? `${r.updatedBy}` : ''}</div>
                      <div style={{ flex: 1 }} />
                      <span onClick={() => openEditLog(r)} style={{ fontSize: 11.5, color: '#7C7C86', cursor: 'pointer', marginRight: 10 }}>편집</span>
                      <span onClick={() => setHistoryTarget({ type: 'log', id: r.id, label: `${cat} 로그` })} style={{ fontSize: 11.5, color: '#7C7C86', cursor: 'pointer', marginRight: 10 }}>이력</span>
                      <span onClick={() => removeLog(r)} style={{ fontSize: 11.5, color: '#DA3633', cursor: 'pointer' }}>삭제</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* 자재 항목 편집 드로어 */}
      {itemEditor && (
        <>
          <div onClick={closeItemEditor} style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,28,.42)', zIndex: 60 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, height: '100%', width: 420, maxWidth: '100%', background: '#fff', zIndex: 61, display: 'flex', flexDirection: 'column', boxShadow: '-10px 0 30px rgba(0,0,0,.12)' }}>
            <div style={{ padding: '24px 28px', borderBottom: '1px solid #EEEEF2' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#E5620E' }}>{PART_LABELS[itemEditor.part]} · {CATEGORY_LABELS[itemEditor.draft.category]}</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#1B1B1F', marginTop: 4 }}>{itemEditor.id ? '자재 항목 수정' : '자재 항목 추가'}</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <FieldLabel>종류</FieldLabel>
                <textarea rows={2} value={itemEditor.draft.type} onChange={(e) => setItemEditor((s) => ({ ...s, draft: { ...s.draft, type: e.target.value } }))} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div>
                <FieldLabel>수량</FieldLabel>
                <textarea rows={3} value={itemEditor.draft.quantity} onChange={(e) => setItemEditor((s) => ({ ...s, draft: { ...s.draft, quantity: e.target.value } }))} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ padding: '18px 28px', borderTop: '1px solid #EEEEF2', display: 'flex', gap: 10 }}>
              <div onClick={closeItemEditor} style={{ flex: 1, textAlign: 'center', border: '1px solid #DEDEE4', color: '#4A4A52', fontSize: 14, fontWeight: 700, padding: 12, borderRadius: 10, cursor: 'pointer' }}>취소</div>
              <div onClick={saveItemEditor} style={{ flex: 2, textAlign: 'center', background: saving ? '#F0A876' : '#E5620E', color: '#fff', fontSize: 14, fontWeight: 700, padding: 12, borderRadius: 10, cursor: saving ? 'default' : 'pointer' }}>{saving ? '저장 중...' : '저장'}</div>
            </div>
          </div>
        </>
      )}

      {/* 로그 편집 드로어 */}
      {logEditor && (
        <>
          <div onClick={closeLogEditor} style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,28,.42)', zIndex: 60 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, height: '100%', width: 420, maxWidth: '100%', background: '#fff', zIndex: 61, display: 'flex', flexDirection: 'column', boxShadow: '-10px 0 30px rgba(0,0,0,.12)' }}>
            <div style={{ padding: '24px 28px', borderBottom: '1px solid #EEEEF2' }}>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#1B1B1F' }}>{logEditor.id ? '로그 수정' : '로그 추가'}</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <FieldLabel>구분</FieldLabel>
                <select value={logEditor.draft.category} onChange={(e) => setLogEditor((s) => ({ ...s, draft: { ...s.draft, category: e.target.value } }))} style={inputStyle}>
                  {LOG_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>내용 (날짜는 텍스트에 직접 포함해 입력하세요, 예: ...4/30)</FieldLabel>
                <textarea rows={6} value={logEditor.draft.content} onChange={(e) => setLogEditor((s) => ({ ...s, draft: { ...s.draft, content: e.target.value } }))} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ padding: '18px 28px', borderTop: '1px solid #EEEEF2', display: 'flex', gap: 10 }}>
              <div onClick={closeLogEditor} style={{ flex: 1, textAlign: 'center', border: '1px solid #DEDEE4', color: '#4A4A52', fontSize: 14, fontWeight: 700, padding: 12, borderRadius: 10, cursor: 'pointer' }}>취소</div>
              <div onClick={saveLogEditor} style={{ flex: 2, textAlign: 'center', background: saving ? '#F0A876' : '#E5620E', color: '#fff', fontSize: 14, fontWeight: 700, padding: 12, borderRadius: 10, cursor: saving ? 'default' : 'pointer' }}>{saving ? '저장 중...' : '저장'}</div>
            </div>
          </div>
        </>
      )}

      {/* 이력 모달 */}
      {historyTarget && (
        <div onClick={() => setHistoryTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,28,.42)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, width: 560, maxWidth: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '24px 28px', borderBottom: '1px solid #EEEEF2' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#E5620E' }}>{historyTarget.label}</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#1B1B1F', marginTop: 4 }}>변경 이력</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '22px 28px' }}>
              {(historyTarget.type === 'item' ? itemHistory : logHistory).length === 0 && (
                <div style={{ padding: 36, textAlign: 'center', color: '#A6A6AE', fontSize: 14 }}>수정 이력이 없습니다.</div>
              )}
              {(historyTarget.type === 'item' ? itemHistory : logHistory).map((e, i) => (
                <div key={e.id || i} style={{ display: 'flex', gap: 14, paddingBottom: 18 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#E5620E', marginTop: 4 }} />
                    <div style={{ flex: 1, width: 2, background: '#EEEEF2', marginTop: 4 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#5A5A62', background: '#F0F0F3', padding: '2px 9px', borderRadius: 6 }}>{e.fieldLabel}</span>
                      <span style={{ fontSize: 12, color: '#9A9AA2' }}>{e.editedAt?.toDate ? e.editedAt.toDate().toLocaleString() : (e.editedAt || '')}</span>
                    </div>
                    <div style={{ fontSize: 13.5, marginTop: 7, whiteSpace: 'pre-wrap' }}>
                      <span style={{ color: '#B4B4BC', textDecoration: e.fieldChanged === 'delete' ? 'none' : 'line-through' }}>{e.oldValue}</span>{' '}
                      {e.fieldChanged !== 'delete' && <><span style={{ color: '#C6C6CC' }}>→</span> <span style={{ color: '#1A7F52', fontWeight: 700 }}>{e.newValue}</span></>}
                    </div>
                    <div style={{ fontSize: 12, color: '#9A9AA2', marginTop: 5 }}>수정자 · {e.editedBy}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '16px 28px', borderTop: '1px solid #EEEEF2', textAlign: 'right' }}>
              <div onClick={() => setHistoryTarget(null)} style={{ display: 'inline-block', background: '#18181B', color: '#fff', fontSize: 14, fontWeight: 700, padding: '10px 22px', borderRadius: 10, cursor: 'pointer' }}>닫기</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
