import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  GROUP_IDS, loadAllElectrodes, loadAllHistory, saveElectrodeWithHistory,
} from './firebase.js';

const GROUP_DOTS = { 'EL-500A': '#E5620E', 'EL-500B': '#2FA36B', 'EL-500C': '#3B82C4', 'EL-500D': '#A855C4', 'EL-500E': '#E8A317' };
const FIELD_LABELS = { electrodeNo: '전극 No.', installDate: '설치일자', type: 'Type', membraneCode: "MEMB'", membraneInstallDate: '멤브레인 설치일', membraneNo: "MEM' NO", ioType: 'I/O 구분' };
const TYPE_COLORS = { F: { c: '#B65E12', bg: '#FBF0E6' }, Ni: { c: '#3B6FA0', bg: '#EAF1F8' } };

// 교체 주기: 전극 96개월(8년), 멤브레인 32개월. 주기 2개월 전부터 '검토'.
function months(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return (new Date() - d) / (1000 * 60 * 60 * 24 * 30);
}
function statusEl(m) {
  if (m == null) return { label: '-', color: '#9A9AA2' };
  if (m >= 96) return { label: '교체필요', color: '#DA3633' };
  if (m >= 94) return { label: '검토', color: '#B76E00' };
  return { label: '정상', color: '#1A7F52' };
}
function statusMemb(m) {
  if (m == null) return { label: '-', color: '#9A9AA2' };
  if (m >= 32) return { label: '교체필요', color: '#DA3633' };
  if (m >= 30) return { label: '검토', color: '#B76E00' };
  return { label: '정상', color: '#1A7F52' };
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [view, setView] = useState('board');
  const [activeGroup, setActiveGroup] = useState('EL-500A');
  const [data, setData] = useState({});
  const [history, setHistory] = useState({}); // electrodeId -> [entries]
  const [globalHistory, setGlobalHistory] = useState([]);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('전체');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [sortKey, setSortKey] = useState('no');
  const [sortDir, setSortDir] = useState('asc');

  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [historyModalId, setHistoryModalId] = useState(null);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [idName, setIdName] = useState('');
  const [idCode, setIdCode] = useState('');
  const [user, setUser] = useState(null);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const toastT = useRef(null);
  const fileInputRef = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    if (toastT.current) clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(null), 2600);
  };

  // ---- 초기 로드 ----
  useEffect(() => {
    try {
      const raw = localStorage.getItem('cp_user');
      if (raw) setUser(JSON.parse(raw));
    } catch (e) {}
    refreshAll();
  }, []);

  async function refreshAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const [d, h] = await Promise.all([loadAllElectrodes(), loadAllHistory()]);
      setData(d);
      const byElectrode = {};
      h.forEach((entry) => {
        (byElectrode[entry.electrodeId] = byElectrode[entry.electrodeId] || []).push(entry);
      });
      setHistory(byElectrode);
      setGlobalHistory(h);
    } catch (err) {
      console.error(err);
      setLoadError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  const groupRows = data[activeGroup] || [];

  // ---- summary cards ----
  const usages = groupRows.map((r) => months(r.installDate)).filter((m) => m != null);
  const membUsages = groupRows.map((r) => months(r.membraneInstallDate)).filter((m) => m != null);
  const avg = usages.length ? usages.reduce((a, b) => a + b, 0) / usages.length : 0;
  const cardElReview = usages.filter((m) => m >= 94).length;
  const cardMembReview = membUsages.filter((m) => m >= 30).length;
  const cardF = groupRows.filter((r) => r.type === 'F').length;

  // ---- filter + sort ----
  const q = search.trim().toLowerCase();
  let rows = groupRows.filter((r) => {
    if (typeFilter !== '전체' && r.type !== typeFilter) return false;
    if (statusFilter !== '전체') {
      const st = statusEl(months(r.installDate)).label;
      if (st !== statusFilter) return false;
    }
    if (q && !((r.electrodeNo || '').toLowerCase().includes(q) || (r.membraneCode || '').toLowerCase().includes(q) || (r.membraneNo || '').toLowerCase().includes(q))) return false;
    return true;
  });
  const dir = sortDir === 'asc' ? 1 : -1;
  rows = rows.slice().sort((a, b) => {
    let av, bv;
    if (sortKey === 'no') { av = a.no; bv = b.no; }
    else if (sortKey === 'installDate') { av = a.installDate; bv = b.installDate; }
    else if (sortKey === 'usage') { av = months(a.installDate) || 0; bv = months(b.installDate) || 0; }
    else { av = a.no; bv = b.no; }
    return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
  });

  function toggleSort(key) {
    setSortDir((d) => (sortKey === key && d === 'asc' ? 'desc' : 'asc'));
    setSortKey(key);
  }
  const ind = (k) => (sortKey === k ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  // ---- editing ----
  function openEdit(row) {
    if (!user) { setIdentityOpen(true); return; }
    setEditingId(row.id);
    setDraft({ ...row });
  }
  function closeDrawer() { setEditingId(null); setDraft(null); }
  function setDraftField(field, val) { setDraft((d) => ({ ...d, [field]: val })); }

  async function saveDrawer() {
    if (!draft || !editingId || saving) return;
    const orig = groupRows.find((r) => r.id === editingId);
    setSaving(true);
    try {
      const entries = await saveElectrodeWithHistory(activeGroup, editingId, orig, draft, user);
      if (entries.length === 0) {
        showToast('변경된 항목이 없습니다');
      } else {
        setData((d) => ({ ...d, [activeGroup]: d[activeGroup].map((r) => (r.id === editingId ? { ...draft } : r)) }));
        setHistory((h) => ({ ...h, [editingId]: [...(h[editingId] || []), ...entries] }));
        setGlobalHistory((g) => [...entries, ...g]);
        showToast(`${entries.length}개 항목이 저장되고 이력에 기록되었습니다`);
      }
      closeDrawer();
    } catch (err) {
      console.error(err);
      showToast('저장 실패: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  }

  // ---- identity ----
  function saveIdentity() {
    const name = idName.trim(), code = idCode.trim();
    if (!name || !code) { showToast('이름과 사번을 모두 입력하세요'); return; }
    const u = { name, code };
    try { localStorage.setItem('cp_user', JSON.stringify(u)); } catch (e) {}
    setUser(u);
    setIdentityOpen(false);
    showToast(`${name}님 등록 완료 · 편집이 가능합니다`);
  }

  // ---- excel ----
  function doDownload() {
    const wb = XLSX.utils.book_new();
    GROUP_IDS.forEach((g) => {
      const sheetRows = (data[g] || []).map((r) => ({
        'No.': r.no, '전극 No.': r.electrodeNo, '전극 설치일자': r.installDate,
        Type: r.type, "MEMB'": r.membraneCode, '멤브레인 설치일자': r.membraneInstallDate,
        "MEM' NO": r.membraneNo, 'I/O': r.ioType,
      }));
      const ws = XLSX.utils.json_to_sheet(sheetRows);
      XLSX.utils.book_append_sheet(wb, ws, g);
    });
    XLSX.writeFile(wb, `전극관리_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('엑셀 파일이 다운로드되었습니다');
  }

  function triggerUpload() {
    if (!user) { setIdentityOpen(true); return; }
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
      // 시트명 = 그룹ID, 시트 내 '전극 No.' 로 기존 행을 매칭해 필드를 갱신
      for (const groupId of wb.SheetNames) {
        if (!GROUP_IDS.includes(groupId)) continue;
        const ws = wb.Sheets[groupId];
        const json = XLSX.utils.sheet_to_json(ws);
        const existing = data[groupId] || [];
        for (const row of json) {
          const orig = existing.find((r) => r.no === row['No.'] || r.electrodeNo === row['전극 No.']);
          if (!orig) continue;
          const draftRow = {
            ...orig,
            electrodeNo: String(row['전극 No.'] ?? orig.electrodeNo),
            installDate: String(row['전극 설치일자'] ?? orig.installDate),
            type: String(row['Type'] ?? orig.type),
            membraneCode: String(row["MEMB'"] ?? orig.membraneCode),
            membraneInstallDate: String(row['멤브레인 설치일자'] ?? orig.membraneInstallDate),
            membraneNo: String(row["MEM' NO"] ?? orig.membraneNo),
            ioType: String(row['I/O'] ?? orig.ioType),
          };
          await saveElectrodeWithHistory(groupId, orig.id, orig, draftRow, user);
        }
      }
      showToast('엑셀 업로드 및 반영이 완료되었습니다');
      await refreshAll();
    } catch (err) {
      console.error(err);
      showToast('업로드 실패: ' + (err.message || err));
    }
  }

  // ---- history modal ----
  const hmRow = historyModalId ? (groupRows.find((r) => r.id === historyModalId) || GROUP_IDS.map((g) => data[g] || []).flat().find((r) => r.id === historyModalId)) : null;
  const hmEntries = historyModalId ? (history[historyModalId] || []).slice().reverse() : [];

  if (loading) return <CenterMsg text="전극 데이터를 불러오는 중..." />;
  if (loadError) return <CenterMsg text={`데이터 로드 실패: ${loadError}`} error onRetry={refreshAll} />;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Pretendard', system-ui, sans-serif", background: '#F3F3F5', color: '#26262B' }}>
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleUploadFile} />

      {/* TOP NAV */}
      <header style={{ height: 66, background: '#18181B', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 40, position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#F97316,#E5620E)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(229,98,14,.45)' }}>
            <div style={{ width: 13, height: 13, background: '#fff', transform: 'rotate(45deg)', borderRadius: 2 }} />
          </div>
          <div style={{ color: '#fff', fontSize: 19, fontWeight: 800, letterSpacing: '-.02em' }}>CellPosition</div>
        </div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {[{ key: 'board', label: '전극관리' }, { key: 'dashboard', label: '대시보드' }, { key: 'history', label: '이력조회' }, { key: 'excel', label: '엑셀 연동' }].map((n) => {
            const active = (n.key === 'board' && view === 'board') || (n.key === 'history' && view === 'history') || (n.key === 'dashboard' && view === 'board');
            return (
              <div key={n.key} onClick={() => (n.key === 'history' ? setView('history') : n.key === 'excel' ? doDownload() : setView('board'))}
                style={{ padding: '9px 16px', borderRadius: 999, fontSize: 14.5, fontWeight: 700, cursor: 'pointer', color: active ? '#18181B' : '#C4C4CC', background: active ? '#fff' : 'transparent', whiteSpace: 'nowrap' }}>
                {n.label}
              </div>
            );
          })}
        </nav>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ color: '#B4B4BC', fontSize: 13.5, fontWeight: 600 }}>{user ? `${user.name} · ${user.code}` : '게스트 (읽기전용)'}</div>
          <div onClick={() => setIdentityOpen(true)} style={{ width: 34, height: 34, borderRadius: '50%', background: user ? '#E5620E' : '#6B6B74', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
            {user ? user.name.slice(0, 1) : 'G'}
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, alignItems: 'stretch' }}>
        {/* SIDEBAR */}
        <aside style={{ width: 262, flexShrink: 0, background: '#fff', borderRight: '1px solid #E9E9EE', padding: '26px 18px 40px', position: 'sticky', top: 66, height: 'calc(100vh - 66px)', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px 20px' }}>
            <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.02em', color: '#1B1B1F' }}>전극 관리</div>
            <div style={{ fontSize: 15 }}>🏭</div>
          </div>
          <div onClick={() => setView('board')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 10, cursor: 'pointer', marginBottom: 4, background: view === 'board' ? '#FBF2EA' : 'transparent' }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: '#E5620E' }} />
            <div style={{ fontSize: 14.5, fontWeight: 700, color: view === 'board' ? '#C34E06' : '#4A4A52' }}>요약 대시보드</div>
          </div>
          <div style={{ padding: '18px 10px 8px', fontSize: 12, fontWeight: 700, color: '#A6A6AE', letterSpacing: '.04em' }}>CELL 그룹</div>
          {GROUP_IDS.map((g) => {
            const active = view === 'board' && activeGroup === g;
            return (
              <div key={g} onClick={() => { setView('board'); setActiveGroup(g); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', marginBottom: 2, background: active ? '#FBF2EA' : 'transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: GROUP_DOTS[g] }} />
                  <div style={{ fontSize: 14, fontWeight: active ? 800 : 600, color: active ? '#C34E06' : '#4A4A52' }}>{g}</div>
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#B4B4BC', background: active ? '#F6E2D2' : '#F2F2F5', padding: '1px 8px', borderRadius: 999 }}>{(data[g] || []).length}</div>
              </div>
            );
          })}
          <div style={{ padding: '20px 10px 8px', fontSize: 12, fontWeight: 700, color: '#A6A6AE', letterSpacing: '.04em' }}>이력 / 관리</div>
          <div onClick={() => setView('history')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', marginBottom: 2, background: view === 'history' ? '#F2F2F5' : 'transparent' }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: '#7C7C86' }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: view === 'history' ? '#1B1B1F' : '#4A4A52' }}>전체 수정 이력</div>
          </div>
          <div onClick={triggerUpload} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer' }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: '#7C7C86' }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: '#4A4A52' }}>엑셀 업로드</div>
          </div>
          <div onClick={doDownload} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer' }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: '#7C7C86' }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: '#4A4A52' }}>엑셀 다운로드</div>
          </div>
          <div style={{ marginTop: 26, padding: 14, borderRadius: 12, background: '#FBF4EE', border: '1px solid #F4E2D2' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#B65E12', marginBottom: 6 }}>교체 주기 기준</div>
            <div style={{ fontSize: 12.5, color: '#8A6A50', lineHeight: 1.6 }}>전극 <b>8년(96개월)</b> · 멤브레인 <b>32개월</b><br />주기 <b>2개월 전</b>부터 교체 검토 알림</div>
          </div>
        </aside>

        {/* MAIN */}
        <main style={{ flex: 1, minWidth: 0, padding: '30px 36px 60px', overflowX: 'hidden' }}>
          {!user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#FFF6EC', border: '1px solid #F4DFC7', borderRadius: 12, padding: '14px 18px', marginBottom: 22 }}>
              <div style={{ fontSize: 13.5, color: '#8A6A50', fontWeight: 600 }}>읽기 전용 모드입니다. 데이터를 편집하려면 이름과 사번을 등록하세요.</div>
              <div style={{ flex: 1 }} />
              <div onClick={() => setIdentityOpen(true)} style={{ background: '#E5620E', color: '#fff', fontSize: 13, fontWeight: 700, padding: '9px 18px', borderRadius: 9, cursor: 'pointer' }}>사용자 등록</div>
            </div>
          )}

          {view === 'board' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
                <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800, letterSpacing: '-.02em', color: '#1B1B1F' }}>{activeGroup}</h1>
                <div style={{ fontSize: 14, color: '#9A9AA2', fontWeight: 600 }}>AKCC CELL POSITION · CA-4</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
                <Card label="총 전극 수" value={groupRows.length} unit="개" sub={`F ${cardF} · Ni ${groupRows.length - cardF}`} />
                <Card label="평균 사용기간" value={avg.toFixed(1)} unit="개월" sub="전극 기준 평균" />
                <Card label="전극 교체 검토" value={cardElReview} unit="개" sub="주기 8년(96개월) · 2개월 전 알림" valueColor="#DA3633" />
                <Card label="멤브레인 교체 검토" value={cardMembReview} unit="개" sub="주기 32개월 · 2개월 전 알림" valueColor="#C2410C" />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #E9E9EE', borderRadius: 999, padding: '8px 8px 8px 12px', marginBottom: 20, boxShadow: '0 2px 8px rgba(20,20,30,.04)' }}>
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ border: 'none', background: 'transparent', fontSize: 14, fontWeight: 600, color: '#4A4A52', padding: '8px 10px', cursor: 'pointer', outline: 'none' }}>
                  <option value="전체">Type 전체</option>
                  <option value="F">Type F</option>
                  <option value="Ni">Type Ni</option>
                </select>
                <div style={{ width: 1, height: 20, background: '#E9E9EE' }} />
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ border: 'none', background: 'transparent', fontSize: 14, fontWeight: 600, color: '#4A4A52', padding: '8px 10px', cursor: 'pointer', outline: 'none' }}>
                  <option value="전체">전극상태 전체</option>
                  <option value="정상">정상</option>
                  <option value="검토">검토</option>
                  <option value="교체필요">교체필요</option>
                </select>
                <div style={{ width: 1, height: 20, background: '#E9E9EE' }} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="전극 No. / 멤브레인 코드 검색" style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 14.5, padding: '8px 6px', outline: 'none', color: '#26262B' }} />
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#E5620E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><circle cx="11" cy="11" r="7"></circle><line x1="16.5" y1="16.5" x2="21" y2="21"></line></svg>
                </div>
              </div>

              <div style={{ background: '#fff', border: '1px solid #E9E9EE', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '18px 22px 0' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#1B1B1F', paddingBottom: 14, borderBottom: '2.5px solid #E5620E' }}>전극 목록</div>
                  <div style={{ fontSize: 13, color: '#9A9AA2', fontWeight: 600, marginLeft: 12, paddingBottom: 14 }}>{rows.length}건</div>
                  <div style={{ flex: 1 }} />
                  <div style={{ display: 'flex', gap: 8, paddingBottom: 12 }}>
                    <div onClick={triggerUpload} style={{ border: '1px solid #E2E2E8', color: '#4A4A52', fontSize: 13, fontWeight: 700, padding: '8px 15px', borderRadius: 9, cursor: 'pointer' }}>엑셀 업로드</div>
                    <div onClick={doDownload} style={{ border: '1px solid #E2E2E8', color: '#4A4A52', fontSize: 13, fontWeight: 700, padding: '8px 15px', borderRadius: 9, cursor: 'pointer' }}>엑셀 다운로드</div>
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1180 }}>
                    <thead>
                      <tr style={{ background: '#F7F7F9' }}>
                        <Th onClick={() => toggleSort('no')}>No.{ind('no')}</Th>
                        <Th>전극 No.</Th>
                        <Th onClick={() => toggleSort('installDate')}>전극 설치일자{ind('installDate')}</Th>
                        <Th onClick={() => toggleSort('usage')}>사용기간(전극){ind('usage')}</Th>
                        <Th>Type</Th>
                        <Th>MEMB'</Th>
                        <Th>멤브레인 설치일자</Th>
                        <Th>사용기간(멤브레인)</Th>
                        <Th>MEM' NO</Th>
                        <Th>I/O</Th>
                        <Th align="right">관리</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => {
                        const m = months(r.installDate), mm = months(r.membraneInstallDate);
                        const st = statusEl(m), mst = statusMemb(mm);
                        const tc = TYPE_COLORS[r.type] || { c: '#5A5A62', bg: '#F0F0F3' };
                        const bg = i % 2 === 0 ? '#fff' : '#FBFBFC';
                        return (
                          <tr key={r.id} style={{ background: bg, borderTop: '1px solid #F0F0F3' }}>
                            <td style={tdStyle}>{r.no}</td>
                            <td style={{ ...tdStyle, color: '#1B1B1F', fontWeight: 700, whiteSpace: 'nowrap' }}>{r.electrodeNo}</td>
                            <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{r.installDate}</td>
                            <td style={{ padding: '11px 16px', whiteSpace: 'nowrap' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 700, color: st.color }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: st.color }} />{m == null ? '-' : m.toFixed(1) + '개월'}
                                <span style={{ fontSize: 11, fontWeight: 700, color: st.color, opacity: 0.85 }}>{st.label}</span>
                              </span>
                            </td>
                            <td style={{ padding: '11px 16px' }}><span style={{ fontSize: 12.5, fontWeight: 700, color: tc.c, background: tc.bg, padding: '2px 9px', borderRadius: 6 }}>{r.type}</span></td>
                            <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{r.membraneCode}</td>
                            <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{r.membraneInstallDate || '-'}</td>
                            <td style={{ padding: '11px 16px', whiteSpace: 'nowrap' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 700, color: mst.color }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: mst.color }} />{mm == null ? '-' : mm.toFixed(1) + '개월'}
                                <span style={{ fontSize: 11, fontWeight: 700, color: mst.color, opacity: 0.85 }}>{mst.label}</span>
                              </span>
                            </td>
                            <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{r.membraneNo}</td>
                            <td style={{ padding: '11px 16px', fontSize: 13, color: '#7C7C86' }}>{r.ioType}</td>
                            <td style={{ padding: '9px 20px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <span onClick={() => setHistoryModalId(r.id)} style={{ fontSize: 12.5, fontWeight: 700, color: '#7C7C86', cursor: 'pointer', marginRight: 12 }}>이력</span>
                              <span onClick={() => openEdit(r)} style={{ fontSize: 12.5, fontWeight: 700, color: '#E5620E', cursor: 'pointer' }}>편집</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {rows.length === 0 && <div style={{ padding: 60, textAlign: 'center', color: '#A6A6AE', fontSize: 14 }}>조건에 맞는 전극이 없습니다.</div>}
              </div>
            </div>
          )}

          {view === 'history' && (
            <div>
              <h1 style={{ margin: '0 0 6px', fontSize: 25, fontWeight: 800, letterSpacing: '-.02em', color: '#1B1B1F' }}>전체 수정 이력</h1>
              <div style={{ fontSize: 14, color: '#9A9AA2', fontWeight: 600, marginBottom: 22 }}>모든 편집 건이 시간순으로 기록됩니다 · 이력은 삭제할 수 없습니다</div>
              <div style={{ background: '#fff', border: '1px solid #E9E9EE', borderRadius: 16, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                  <thead>
                    <tr style={{ background: '#F7F7F9' }}>
                      <Th>No.</Th><Th>그룹</Th><Th>전극 No.</Th><Th>변경 필드</Th><Th>변경 전 → 후</Th><Th>수정자</Th><Th>수정 일시</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {globalHistory.map((h, i) => (
                      <tr key={h.id || i} style={{ background: i % 2 === 0 ? '#fff' : '#FBFBFC', borderTop: '1px solid #F0F0F3' }}>
                        <td style={tdStyle}>{h.historyNo}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{h.groupId}</td>
                        <td style={{ ...tdStyle, color: '#1B1B1F', fontWeight: 700 }}>{h.electrodeNo}</td>
                        <td style={{ padding: '12px 16px' }}><span style={{ fontSize: 12, fontWeight: 700, color: '#5A5A62', background: '#F0F0F3', padding: '2px 9px', borderRadius: 6 }}>{h.fieldLabel || FIELD_LABELS[h.fieldChanged] || h.fieldChanged}</span></td>
                        <td style={{ padding: '12px 16px', fontSize: 13 }}><span style={{ color: '#B4B4BC', textDecoration: 'line-through' }}>{h.oldValue}</span> <span style={{ color: '#C6C6CC' }}>→</span> <span style={{ color: '#1A7F52', fontWeight: 700 }}>{h.newValue}</span></td>
                        <td style={tdStyle}>{h.editedBy}</td>
                        <td style={tdStyle}>{h.editedAt?.toDate ? h.editedAt.toDate().toLocaleString() : (h.editedAt || '')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {globalHistory.length === 0 && <div style={{ padding: 60, textAlign: 'center', color: '#A6A6AE', fontSize: 14 }}>아직 수정 이력이 없습니다. 전극을 편집하면 여기에 기록됩니다.</div>}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* EDIT DRAWER */}
      {editingId && draft && (
        <>
          <div onClick={closeDrawer} style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,28,.42)', zIndex: 60 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 440, maxWidth: '92vw', background: '#fff', zIndex: 61, boxShadow: '-8px 0 40px rgba(20,20,30,.18)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '24px 28px', borderBottom: '1px solid #EEEEF2' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#E5620E' }}>{activeGroup}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#1B1B1F', marginTop: 4 }}>전극 편집 · No.{draft.no}</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              <Field label="전극 No."><input value={draft.electrodeNo} onChange={(e) => setDraftField('electrodeNo', e.target.value)} style={inputStyle} /></Field>
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <FieldLabel>설치일자</FieldLabel>
                  <input type="date" value={draft.installDate} onChange={(e) => setDraftField('installDate', e.target.value)} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <FieldLabel>사용기간 (자동계산)</FieldLabel>
                  <div style={readOnlyBoxStyle(statusEl(months(draft.installDate)).color)}>{months(draft.installDate) == null ? '-' : months(draft.installDate).toFixed(1) + '개월'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <FieldLabel>Type</FieldLabel>
                  <select value={draft.type} onChange={(e) => setDraftField('type', e.target.value)} style={inputStyle}>
                    <option value="F">F</option><option value="Ni">Ni</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <FieldLabel>I/O 구분</FieldLabel>
                  <select value={draft.ioType} onChange={(e) => setDraftField('ioType', e.target.value)} style={inputStyle}>
                    <option value="국산">국산</option><option value="수입">수입</option>
                  </select>
                </div>
              </div>
              <div style={{ height: 1, background: '#EEEEF2', margin: '2px 0' }} />
              <Field label="MEMB' (멤브레인 코드)"><input value={draft.membraneCode} onChange={(e) => setDraftField('membraneCode', e.target.value)} style={inputStyle} /></Field>
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <FieldLabel>멤브레인 설치/교체일자</FieldLabel>
                  <input type="date" value={draft.membraneInstallDate} onChange={(e) => setDraftField('membraneInstallDate', e.target.value)} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <FieldLabel>사용기간 (자동계산)</FieldLabel>
                  <div style={readOnlyBoxStyle(statusMemb(months(draft.membraneInstallDate)).color)}>{months(draft.membraneInstallDate) == null ? '-' : months(draft.membraneInstallDate).toFixed(1) + '개월'}</div>
                </div>
              </div>
              <Field label="MEM' NO"><input value={draft.membraneNo} onChange={(e) => setDraftField('membraneNo', e.target.value)} style={inputStyle} /></Field>
            </div>
            <div style={{ padding: '18px 28px', borderTop: '1px solid #EEEEF2', display: 'flex', gap: 10 }}>
              <div onClick={closeDrawer} style={{ flex: 1, textAlign: 'center', border: '1px solid #DEDEE4', color: '#4A4A52', fontSize: 14, fontWeight: 700, padding: 12, borderRadius: 10, cursor: 'pointer' }}>취소</div>
              <div onClick={saveDrawer} style={{ flex: 2, textAlign: 'center', background: saving ? '#F0A876' : '#E5620E', color: '#fff', fontSize: 14, fontWeight: 700, padding: 12, borderRadius: 10, cursor: saving ? 'default' : 'pointer' }}>{saving ? '저장 중...' : '변경사항 저장'}</div>
            </div>
          </div>
        </>
      )}

      {/* HISTORY MODAL */}
      {historyModalId && (
        <div onClick={() => setHistoryModalId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,28,.42)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, width: 560, maxWidth: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '24px 28px', borderBottom: '1px solid #EEEEF2' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#E5620E' }}>{hmRow?.groupId}</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#1B1B1F', marginTop: 4 }}>{hmRow?.electrodeNo} · 변경 이력</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '22px 28px' }}>
              {hmEntries.length === 0 && <div style={{ padding: 36, textAlign: 'center', color: '#A6A6AE', fontSize: 14 }}>이 전극의 수정 이력이 없습니다.</div>}
              {hmEntries.map((e, i) => (
                <div key={e.id || i} style={{ display: 'flex', gap: 14, paddingBottom: 18 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#E5620E', marginTop: 4 }} />
                    <div style={{ flex: 1, width: 2, background: '#EEEEF2', marginTop: 4 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#5A5A62', background: '#F0F0F3', padding: '2px 9px', borderRadius: 6 }}>{e.fieldLabel || FIELD_LABELS[e.fieldChanged] || e.fieldChanged}</span>
                      <span style={{ fontSize: 12, color: '#9A9AA2' }}>{e.editedAt?.toDate ? e.editedAt.toDate().toLocaleString() : (e.editedAt || '')}</span>
                    </div>
                    <div style={{ fontSize: 13.5, marginTop: 7 }}><span style={{ color: '#B4B4BC', textDecoration: 'line-through' }}>{e.oldValue}</span> <span style={{ color: '#C6C6CC' }}>→</span> <span style={{ color: '#1A7F52', fontWeight: 700 }}>{e.newValue}</span></div>
                    <div style={{ fontSize: 12, color: '#9A9AA2', marginTop: 5 }}>수정자 · {e.editedBy}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '16px 28px', borderTop: '1px solid #EEEEF2', textAlign: 'right' }}>
              <div onClick={() => setHistoryModalId(null)} style={{ display: 'inline-block', background: '#18181B', color: '#fff', fontSize: 14, fontWeight: 700, padding: '10px 22px', borderRadius: 10, cursor: 'pointer' }}>닫기</div>
            </div>
          </div>
        </div>
      )}

      {/* IDENTITY MODAL */}
      {identityOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,28,.5)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 18, width: 420, maxWidth: '100%', padding: '30px 30px 26px' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#F97316,#E5620E)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <div style={{ width: 15, height: 15, background: '#fff', transform: 'rotate(45deg)', borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1B1B1F' }}>사용자 등록</div>
            <div style={{ fontSize: 13.5, color: '#8A8A92', marginTop: 6, lineHeight: 1.5 }}>수정 이력 추적을 위해 이름과 사번을 입력하세요. 이 정보는 브라우저에 저장되며 모든 편집 건에 자동 기록됩니다.</div>
            <div style={{ marginTop: 20 }}>
              <FieldLabel>이름</FieldLabel>
              <input value={idName} onChange={(e) => setIdName(e.target.value)} placeholder="홍길동" style={inputStyle} />
            </div>
            <div style={{ marginTop: 14 }}>
              <FieldLabel>사번 / 고유 코드</FieldLabel>
              <input value={idCode} onChange={(e) => setIdCode(e.target.value)} placeholder="예: H12345" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <div onClick={() => setIdentityOpen(false)} style={{ flex: 1, textAlign: 'center', border: '1px solid #DEDEE4', color: '#4A4A52', fontSize: 14, fontWeight: 700, padding: 12, borderRadius: 10, cursor: 'pointer' }}>나중에</div>
              <div onClick={saveIdentity} style={{ flex: 2, textAlign: 'center', background: '#E5620E', color: '#fff', fontSize: 14, fontWeight: 700, padding: 12, borderRadius: 10, cursor: 'pointer' }}>등록하고 시작</div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: '#18181B', color: '#fff', fontSize: 14, fontWeight: 600, padding: '13px 24px', borderRadius: 12, zIndex: 80, boxShadow: '0 8px 30px rgba(20,20,30,.3)' }}>{toast}</div>
      )}
    </div>
  );
}

function CenterMsg({ text, error, onRetry }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: 'sans-serif', color: error ? '#DA3633' : '#4A4A52' }}>
      <div>{text}</div>
      {onRetry && <button onClick={onRetry} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #ccc', cursor: 'pointer' }}>다시 시도</button>}
    </div>
  );
}
function Card({ label, value, unit, sub, valueColor = '#1B1B1F' }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E9E9EE', borderRadius: 16, padding: '20px 22px' }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#9A9AA2' }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: valueColor, marginTop: 8, letterSpacing: '-.02em' }}>{value}<span style={{ fontSize: 15, fontWeight: 600, color: '#B4B4BC' }}>{unit}</span></div>
      <div style={{ fontSize: 12.5, color: '#9A9AA2', marginTop: 6 }}>{sub}</div>
    </div>
  );
}
function Th({ children, onClick, align }) {
  return <th onClick={onClick} style={{ textAlign: align || 'left', padding: '13px 16px', fontSize: 12.5, fontWeight: 700, color: '#8A8A92', cursor: onClick ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>{children}</th>;
}
function FieldLabel({ children }) {
  return <div style={{ fontSize: 12.5, fontWeight: 700, color: '#7C7C86', marginBottom: 7 }}>{children}</div>;
}
function Field({ label, children }) {
  return <div><FieldLabel>{label}</FieldLabel>{children}</div>;
}
const tdStyle = { padding: '11px 16px', fontSize: 13.5, color: '#4A4A52' };
const inputStyle = { width: '100%', border: '1px solid #DEDEE4', borderRadius: 9, padding: '11px 13px', fontSize: 14, outline: 'none', background: '#fff', boxSizing: 'border-box' };
function readOnlyBoxStyle(color) {
  return { background: '#F7F7F9', border: '1px solid #EEEEF2', borderRadius: 9, padding: '11px 13px', fontSize: 14, fontWeight: 700, color };
}
