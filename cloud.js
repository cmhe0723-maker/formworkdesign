// =====================================================================
// 雲端專案（Supabase）：登入、儲存、開啟、刪除
// 資料表結構見 supabase/schema.sql；連續梁分頁數值以 SI 單位儲存。
// =====================================================================
(function () {
  'use strict';

    const BUCKET = 'attachments';

  const TXT = {
    cloud:      ['☁ 雲端', '☁ Cloud'],
    cloudTitle: ['雲端專案', 'Cloud projects'],
    menuOpen:   ['☁ 雲端專案…', '☁ Cloud projects…'],
    menuSave:   ['☁ 儲存到雲端', '☁ Save to cloud'],
    signedAs:   ['已登入：', 'Signed in as '],
    needLogin:  ['請先登入。', 'Please sign in first.'],
    allProj:    ['所有使用者的專案（管理員）', 'All users\' projects (admin)'],
    owner:      ['建立者：', 'Owner: '],
    save:       ['儲存目前專案', 'Save current project'],
    saveAs:     ['另存為新專案', 'Save as new project'],
    open:       ['開啟', 'Open'],
    del:        ['刪除', 'Delete'],
    close:      ['關閉', 'Close'],
    empty:      ['雲端還沒有專案。', 'No cloud projects yet.'],
    loading:    ['讀取中…', 'Loading…'],
    saving:     ['儲存中…', 'Saving…'],
    saved:      ['已儲存到雲端：{f}', 'Saved to cloud: {f}'],
    opened:     ['已從雲端開啟：{f}', 'Opened from cloud: {f}'],
    deleted:    ['已刪除：{f}', 'Deleted: {f}'],
    confirmDel: ['確定刪除雲端專案「{f}」？此動作無法復原。', 'Delete cloud project "{f}"? This cannot be undone.'],
    askName:    ['專案名稱', 'Project name'],
    untitled:   ['未命名專案', 'Untitled project'],
    current:    ['（目前）', ' (current)'],
    noLib:      ['無法載入雲端元件，請確認網路連線。', 'Could not load the cloud library. Check your connection.'],
    err:        ['雲端錯誤：{e}', 'Cloud error: {e}'],
  };
  const tr = (k, v) => {
    const lang = (typeof S !== 'undefined' && S && S.lang) || 'zh';
    let s = TXT[k][lang === 'zh' ? 0 : 1];
    if (v) for (const n in v) s = s.replace('{' + n + '}', v[n]);
    return s;
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const notify = (m, bad) => (typeof toast === 'function' ? toast(m, bad) : alert(m));

  // 共用 auth.js 建立的連線與登入狀態
  const sb = window.formworkSB;
  if (!sb) {
    console.warn('formworkSB not available');
    window.addEventListener('load', () => addHeaderButton(() => notify(tr('noLib'), true)));
    return;
  }
  let USER = null, IS_ADMIN = false;
  const syncAuth = () => { const a = window.formworkAuth || {}; USER = a.user || null; IS_ADMIN = !!a.isAdmin; };
  syncAuth();
  document.addEventListener('fw-auth', syncAuth);

  const must = r => { if (r.error) throw r.error; return r.data; };
  const num = v => (v === '' || v == null || !isFinite(+v) ? null : +v);
  const int = v => (num(v) == null ? null : Math.round(+v));
  const und = v => (v == null ? undefined : v);

  // ---------------- 欄位對應：網頁物件 ↔ 資料表 ----------------
  // [網頁鍵, 欄位, 型別]  型別：n 數值、i 整數、t 文字、b 布林
  const SPAN_MAP = [
    ['L', 'length_m', 'n'], ['mat', 'material', 't'], ['E', 'e_gpa', 'n'], ['sec', 'section', 't'],
    ['b', 'rect_b_mm', 'n'], ['h', 'rect_h_mm', 'n'], ['D', 'circle_d_mm', 'n'],
    ['Do', 'pipe_do_mm', 'n'], ['t', 'pipe_t_mm', 'n'],
    ['H', 'h_h_mm', 'n'], ['B', 'h_b_mm', 'n'], ['tw', 'h_tw_mm', 'n'], ['tf', 'h_tf_mm', 'n'],
    ['rH', 'rhs_h_mm', 'n'], ['rB', 'rhs_b_mm', 'n'], ['rt', 'rhs_t_mm', 'n'],
    ['Ic', 'ic_e6_mm4', 'n'], ['catId', 'catalog_id', 't'], ['splice', 'splice', 'b'],
    ['grade', 'grade', 't'], ['Fy', 'fy_mpa', 'n'], ['Lb', 'lb_m', 'n'], ['Cb', 'cb', 'n'],
    ['fc', 'fc_mpa', 'n'], ['fyr', 'fyr_mpa', 'n'],
    ['nb', 'bot_bars_n', 'i'], ['db', 'bot_bar_size', 't'], ['nt', 'top_bars_n', 'i'], ['dt', 'top_bar_size', 't'],
    ['cov', 'cover_mm', 'n'], ['ds', 'stirrup_size', 't'], ['legs', 'stirrup_legs', 'i'], ['sv', 'stirrup_s_mm', 'n'],
    ['Fb', 'wood_fb_mpa', 'n'], ['Fv', 'wood_fv_mpa', 'n'],
  ];
  const COL_FIELDS = [
    ['Fy', 'fy'], ['E', 'e'], ['hd', 'h_d'], ['hbf', 'h_bf'], ['htw', 'h_tw'], ['htf', 'h_tf'],
    ['bH', 'box_h'], ['bB', 'box_b'], ['bt', 'box_t'], ['pD', 'pipe_d'], ['pt', 'pipe_t'],
    ['cA', 'custom_a'], ['cIx', 'custom_ix'], ['cIy', 'custom_iy'],
    ['L', 'length_x'], ['Ly', 'length_y'], ['Kx', 'kx'], ['Ky', 'ky'], ['PD', 'p_dead'], ['PL', 'p_live'],
  ];
  const COL_TEXT = [['pj', 'project_name'], ['mb', 'member_name'], ['dz', 'designer'], ['dt', 'design_date']];
  const COL_SELECTS = [['code', 'design_code'], ['method', 'design_method'], ['grade', 'grade'], ['secType', 'section_type'], ['shape', 'shape'], ['bc', 'boundary'], ['kb', 'k_basis']];
  const COL_UNITS = [['uf', 'unit_force'], ['ul', 'unit_length'], ['ud', 'unit_dim'], ['us', 'unit_stress']];
  const COMBO_SETS = ['ASD', 'LRFD', 'TW-ASD', 'TW-LRFD'];
  const CASES_ = ['D', 'L', 'Lr', 'W', 'E'];
  const CASE_COL = { D: 'f_d', L: 'f_l', Lr: 'f_lr', W: 'f_w', E: 'f_e' };

  // 分頁編號：網頁 0 面板、1 貫材、2 次墊條、3 主墊條；
  // 資料庫沿用舊編號 0 面板、1 次墊條、2 主墊條，貫材為 3（舊專案不受影響）
  const DB_IDX = [0, 3, 1, 2];   // 網頁 → 資料庫
  const APP_IDX = [0, 2, 3, 1];  // 資料庫 → 網頁

  const conv = (v, ty) => ty === 'n' ? num(v) : ty === 'i' ? int(v) : ty === 'b' ? !!v : (v == null ? null : String(v));

  function columnState() {
    try { if (typeof COLW !== 'undefined' && COLW && COLW.collectState) return COLW.collectState(); } catch (e) { }
    return PROJ.column || null;
  }

  function projectRow(name) {
    const u = S.u || {}, r = S.rep || {};
    return {
      file_name: name,
      active_tab: DB_IDX[Math.min(3, Math.max(0, PROJ.active || 0))],
      design_code: S.code === 'AISC' ? 'AISC' : 'TW',
      design_method: S.method === 'LRFD' ? 'LRFD' : 'ASD',
      lang: ['zh', 'en', 'th', 'id'].includes(S.lang) ? S.lang : 'zh',
      unit_force: u.F || 'kN', unit_length: u.L || 'm', unit_dim: u.d || 'mm', unit_stress: u.s || 'MPa',
      report_name: r.name || '', report_item: r.item || '', report_no: r.no || '', report_designer: r.designer || '',
      report_date: /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') ? r.date : null,
      report_paper: r.paper || 'A4',
      report_include: r.inc || { inputs: true, diag: true, res: true, design: true, details: true },
      report_tabs_include: Array.isArray(r.tabsInc) ? r.tabsInc.map(Boolean) : [true, true, true, true, true],
    };
  }

  function tabRow(projectId, t, i) {
    const dl = t.dl || {}, sl = t.slab || {};
    return {
      project_id: projectId, tab_index: DB_IDX[i],
      in_use: t.use !== false,
      tie_on: !!(t.tie && t.tie.on), tie_rod: (t.tie && t.tie.rod) || null, tie_nut: (t.tie && t.tie.nut) || null,
      view: t.view || 'env', flip_m: !!t.flipM, both_we: t.bothWE !== false,
      defl_l_ratio_live: num(dl.L) ?? 360, defl_l_ratio_total: num(dl.T) ?? 240,
      defl_mode: ['ratio', 'abs', 'both'].includes(dl.mode) ? dl.mode : 'ratio', defl_abs_mm: num(dl.abs) ?? 3,
      slab_on: !!sl.on, slab_t_mm: num(sl.t) ?? 250, slab_gc_knm3: num(sl.gc) ?? 23.536, slab_sd_knm2: num(sl.sd) ?? 0,
      slab_ll_knm2: num(sl.ll) ?? 2.452, slab_s_m: num(sl.s) ?? 1, slab_no_d: !!sl.noD, slab_no_l: !!sl.noL,
    };
  }

  function childRows(tabId, t) {
    const out = { spans: [], supports: [], point_loads: [], distributed_loads: [], moment_loads: [], load_combinations: [] };
    (t.spans || []).forEach((s, idx) => { const r = { tab_id: tabId, idx }; SPAN_MAP.forEach(([k, c, ty]) => r[c] = conv(s[k], ty)); out.spans.push(r); });
    (t.supports || []).forEach((s, idx) => out.supports.push({ tab_id: tabId, idx, type: s.type, spring_k: num(s.k), settlement_mm: num(s.settle) }));
    const lc = c => (CASES_.includes(c) ? c : 'D');
    (t.points || []).forEach((p, idx) => out.point_loads.push({ tab_id: tabId, idx, x_m: num(p.x) ?? 0, p_kn: num(p.P) ?? 0, load_case: lc(p.c) }));
    (t.dists || []).forEach((p, idx) => out.distributed_loads.push({ tab_id: tabId, idx, x1_m: num(p.x1) ?? 0, x2_m: num(p.x2) ?? 0, w1_kn_m: num(p.w1) ?? 0, w2_kn_m: num(p.w2) ?? 0, load_case: lc(p.c), is_generated: !!p.gen }));
    (t.moments || []).forEach((p, idx) => out.moment_loads.push({ tab_id: tabId, idx, x_m: num(p.x) ?? 0, m_knm: num(p.M) ?? 0, load_case: lc(p.c) }));
    const combos = t.combos || {};
    COMBO_SETS.forEach(set => (combos[set] || []).forEach((f, idx) => {
      const r = { tab_id: tabId, combo_set: set, idx };
      CASES_.forEach(c => r[CASE_COL[c]] = num(f[c]) ?? 0);
      out.load_combinations.push(r);
    }));
    return out;
  }

  function columnRow(projectId, o) {
    if (!o || o.app !== 'steel-column-design') return null;
    const r = { project_id: projectId, version: o.version || 1, lang: o.lang || 'zh', include_self_weight: o.selfwt !== false };
    const f = o.fields || {}, se = o.selects || {}, un = o.units || {};
    COL_FIELDS.forEach(([k, c]) => r[c] = num(f[k]));
    COL_TEXT.forEach(([k, c]) => r[c] = f[k] == null ? null : String(f[k]));
    COL_SELECTS.forEach(([k, c]) => r[c] = se[k] == null ? null : String(se[k]));
    COL_UNITS.forEach(([k, c]) => r[c] = un[k] == null ? null : String(un[k]));
    return r;
  }

  function columnState2Obj(r) {
    if (!r) return null;
    const o = { app: 'steel-column-design', version: r.version || 1, saved: r.updated_at, lang: r.lang || 'zh', units: {}, selects: {}, fields: {}, selfwt: r.include_self_weight !== false };
    COL_FIELDS.forEach(([k, c]) => o.fields[k] = r[c] == null ? '' : String(r[c]));
    COL_TEXT.forEach(([k, c]) => o.fields[k] = r[c] == null ? '' : r[c]);
    COL_SELECTS.forEach(([k, c]) => { if (r[c] != null) o.selects[k] = r[c]; });
    COL_UNITS.forEach(([k, c]) => { if (r[c] != null) o.units[k] = r[c]; });
    return o;
  }

  // ---------------- 附件：data URL ↔ Blob ----------------
  function dataUrlToBlob(d) {
    const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(d || '');
    if (!m) return new Blob([]);
    if (!m[2]) return new Blob([decodeURIComponent(m[3])], { type: m[1] });
    const bin = atob(m[3]), a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return new Blob([a], { type: m[1] });
  }
  const blobToDataUrl = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
  const safeKey = s => String(s).replace(/[^A-Za-z0-9_-]/g, '_');

  async function listFolder(folder) {
    const r = await sb.storage.from(BUCKET).list(folder, { limit: 1000 });
    return r.error ? [] : (r.data || []).map(x => x.name);
  }

  // ---------------- 儲存 ----------------
  async function cloudSave(asNew) {
    if (!USER) { notify(tr('needLogin'), true); return false; }
    let name = (PROJ.fileName || (S.rep && S.rep.name) || '').trim();
    if (!name || asNew) {
      const n = prompt(tr('askName'), name || tr('untitled'));
      if (n == null) return false;
      name = n.trim() || tr('untitled');
    }
    notify(tr('saving'));
    try {
      const prow = projectRow(name);
      let id = asNew ? null : PROJ.cloudId || null;
      if (id) {
        const upd = must(await sb.from('projects').update(prow).eq('id', id).select('id'));
        if (!upd.length) id = null;
      }
      if (!id) id = must(await sb.from('projects').insert(prow).select('id').single()).id;

      // 重建子資料（刪除分頁會連帶刪除跨、支承、載重、組合）
      must(await sb.from('beam_tabs').delete().eq('project_id', id));
      must(await sb.from('column_designs').delete().eq('project_id', id));
      const tabs = must(await sb.from('beam_tabs').insert(PROJ.tabs.map((t, i) => tabRow(id, t, i))).select('id,tab_index'));
      const all = { spans: [], supports: [], point_loads: [], distributed_loads: [], moment_loads: [], load_combinations: [] };
      tabs.forEach(tb => { const c = childRows(tb.id, PROJ.tabs[APP_IDX[tb.tab_index]]); for (const k in all) all[k].push(...c[k]); });
      for (const k in all) if (all[k].length) must(await sb.from(k).insert(all[k]));
      const col = columnRow(id, columnState());
      if (col) must(await sb.from('column_designs').insert(col));

      // 附件：檔案存 Storage，只上傳尚未存在的檔案
      const folder = `${USER.id}/${id}`;
      const atts = PROJ.attachments || [];
      const have = new Set(await listFolder(folder));
      const want = new Set();
      for (const at of atts) {
        const key = safeKey(at.id);
        want.add(key);
        if (!have.has(key)) must(await sb.storage.from(BUCKET).upload(`${folder}/${key}`, await dataUrlToBlob(at.data).arrayBuffer(), { contentType: at.mime || 'application/octet-stream', upsert: true }));
      }
      const stale = [...have].filter(k => !want.has(k)).map(k => `${folder}/${k}`);
      if (stale.length) await sb.storage.from(BUCKET).remove(stale);
      must(await sb.from('attachments').delete().eq('project_id', id));
      if (atts.length) must(await sb.from('attachments').insert(atts.map((at, idx) => ({
        project_id: id, idx, name: at.name || 'file', title: at.title || '', kind: at.kind === 'pdf' ? 'pdf' : 'image',
        mime: at.mime || null, size_bytes: int(at.size), storage_path: `${folder}/${safeKey(at.id)}`, include: at.inc !== false, pages: int(at.pages),
      }))));

      PROJ.cloudId = id; PROJ.fileName = name;
      if (typeof DIRTY !== 'undefined') DIRTY = false;
      if (typeof updTitle === 'function') updTitle();
      if (typeof save === 'function') save();
      notify(tr('saved', { f: name }));
      return true;
    } catch (e) {
      notify(tr('err', { e: e.message || e }), true);
      return false;
    }
  }

  // ---------------- 開啟 ----------------
  async function cloudOpen(id) {
    notify(tr('loading'));
    try {
      const p = must(await sb.from('projects').select('*').eq('id', id).single());
      const tabs = must(await sb.from('beam_tabs').select('*').eq('project_id', id).order('tab_index'));
      const ids = tabs.map(t => t.id);
      const get = async tbl => (ids.length ? must(await sb.from(tbl).select('*').in('tab_id', ids).order('idx')) : []);
      const [spans, sups, pts, dists, moms, combos] = await Promise.all(['spans', 'supports', 'point_loads', 'distributed_loads', 'moment_loads', 'load_combinations'].map(get));
      const colR = must(await sb.from('column_designs').select('*').eq('project_id', id).maybeSingle());
      const attR = must(await sb.from('attachments').select('*').eq('project_id', id).order('idx'));

      const by = (arr, tid) => arr.filter(r => r.tab_id === tid);
      const byIdx = {};
      tabs.forEach(t => { byIdx[t.tab_index] = buildTab(t); });
      function buildTab(t) {
        const combosObj = {};
        COMBO_SETS.forEach(set => {
          combosObj[set] = by(combos, t.id).filter(c => c.combo_set === set).sort((a, b) => a.idx - b.idx).map(c => {
            const f = {}; CASES_.forEach(k => { const v = num(c[CASE_COL[k]]); if (v) f[k] = v; }); return f;
          });
        });
        return {
          code: p.design_code, method: p.design_method,
          view: t.view, flipM: t.flip_m, bothWE: t.both_we,
          dl: { L: num(t.defl_l_ratio_live), T: num(t.defl_l_ratio_total), mode: t.defl_mode, abs: num(t.defl_abs_mm) },
          slab: { on: t.slab_on, t: num(t.slab_t_mm), gc: num(t.slab_gc_knm3), sd: num(t.slab_sd_knm2), ll: num(t.slab_ll_knm2), s: num(t.slab_s_m), ...(t.slab_no_d ? { noD: true } : {}), ...(t.slab_no_l ? { noL: true } : {}) },
          spans: by(spans, t.id).map(r => {
            const s = {};
            SPAN_MAP.forEach(([k, c, ty]) => { const v = r[c]; if (v != null) s[k] = ty === 'n' || ty === 'i' ? +v : v; });
            return s;
          }),
          supports: by(sups, t.id).map(r => { const s = { type: r.type }; if (r.spring_k != null) s.k = +r.spring_k; if (r.settlement_mm != null) s.settle = +r.settlement_mm; return s; }),
          points: by(pts, t.id).map(r => ({ x: +r.x_m, P: +r.p_kn, c: r.load_case })),
          dists: by(dists, t.id).map(r => { const d = { x1: +r.x1_m, x2: +r.x2_m, w1: +r.w1_kn_m, w2: +r.w2_kn_m, c: r.load_case }; if (r.is_generated) d.gen = true; return d; }),
          moments: by(moms, t.id).map(r => ({ x: +r.x_m, M: +r.m_knm, c: r.load_case })),
          combos: combosObj,
          use: t.in_use !== false,
          ...(t.tie_rod || t.tie_on ? { tie: { on: !!t.tie_on, ...(t.tie_rod ? { rod: t.tie_rod } : {}), ...(t.tie_nut ? { nut: t.tie_nut } : {}) } } : {}),
        };
      }
      // 有貫材（資料庫編號 3）就排成四頁；舊專案維持三頁，開啟時由網頁自動插入貫材頁
      const outTabs = byIdx[3] ? [byIdx[0], byIdx[3], byIdx[1], byIdx[2]] : [byIdx[0], byIdx[1], byIdx[2]];
      const outActive = byIdx[3] ? (APP_IDX[p.active_tab] ?? 0) : p.active_tab;

      const atts = [];
      for (const a of attR) {
        const d = await sb.storage.from(BUCKET).download(a.storage_path);
        if (d.error) continue;
        atts.push({ id: a.storage_path.split('/').pop(), name: a.name, title: a.title, kind: a.kind, mime: a.mime || d.data.type, size: a.size_bytes, data: await blobToDataUrl(d.data), inc: a.include, pages: und(a.pages) });
      }

      const rep = {
        name: p.report_name, item: p.report_item, no: p.report_no, designer: p.report_designer,
        date: p.report_date || '', paper: p.report_paper, inc: p.report_include, tabsInc: p.report_tabs_include,
      };
      const obj = {
        app: 'continuous-beam', format: 2,
        project: {
          active: outActive, u: { F: p.unit_force, L: p.unit_length, d: p.unit_dim, s: p.unit_stress },
          rep, code: p.design_code, method: p.design_method,
          tabs: outTabs, column: columnState2Obj(colR), attachments: atts,
        },
      };
      // 交給網頁原本的「開啟檔案」流程，沿用其驗證與正規化
      const file = new File([JSON.stringify(obj)], (p.file_name || 'project') + '.json', { type: 'application/json' });
      const before = PROJ;
      await $('fileIn').onchange({ target: { files: [file], value: '' } });
      if (PROJ === before) return; // 開啟失敗（原流程已顯示錯誤訊息）
      PROJ.cloudId = id; PROJ.fileName = p.file_name;
      if (typeof updTitle === 'function') updTitle();
      if (typeof save === 'function') save();
      notify(tr('opened', { f: p.file_name }));
    } catch (e) {
      notify(tr('err', { e: e.message || e }), true);
    }
  }

  // ---------------- 刪除 ----------------
  async function cloudDelete(id, name, ownerId) {
    if (!IS_ADMIN) return false;
    if (!confirm(tr('confirmDel', { f: name }))) return false;
    try {
      const folder = `${ownerId}/${id}`;
      const rows = must(await sb.from('attachments').select('storage_path').eq('project_id', id));
      const paths = new Set(rows.map(r => r.storage_path));
      (await listFolder(folder)).forEach(f => paths.add(`${folder}/${f}`));
      if (paths.size) await sb.storage.from(BUCKET).remove([...paths]);
      const del = must(await sb.from('projects').delete().eq('id', id).select('id'));
      if (!del.length) throw new Error('permission denied');
      if (PROJ.cloudId === id) { delete PROJ.cloudId; if (typeof save === 'function') save(); }
      notify(tr('deleted', { f: name }));
      return true;
    } catch (e) {
      notify(tr('err', { e: e.message || e }), true);
      return false;
    }
  }

  // ---------------- 對話框 ----------------
  function openDialog() {
    if (typeof closeMenu === 'function') closeMenu();
    const old = document.getElementById('cloudOvl'); if (old) old.remove();
    const ov = document.createElement('div'); ov.className = 'ovl'; ov.id = 'cloudOvl';
    const bx = document.createElement('div'); bx.className = 'dlg';
    ov.append(bx); document.body.append(ov);
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    const close = () => ov.remove();
    const render = async () => {
      syncAuth();
      if (!USER) {
        bx.innerHTML = `<h3>${esc(tr('cloudTitle'))}</h3><div class="note">${esc(tr('needLogin'))}</div>
          <div style="display:flex;justify-content:flex-end;margin-top:14px"><button id="cClose">${esc(tr('close'))}</button></div>`;
        bx.querySelector('#cClose').onclick = close;
        return;
      }
      bx.innerHTML = `<h3>${esc(tr('cloudTitle'))}</h3>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
          <span class="note" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(tr('signedAs'))}${esc(USER.email)}${IS_ADMIN ? ' · ' + esc(tr('allProj')) : ''}</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          <button id="cSave" class="pri">${esc(tr('save'))}</button>
          <button id="cSaveAs">${esc(tr('saveAs'))}</button>
        </div>
        <div id="cList" class="note">${esc(tr('loading'))}</div>
        <div style="display:flex;justify-content:flex-end;margin-top:14px"><button id="cClose">${esc(tr('close'))}</button></div>`;
      bx.querySelector('#cClose').onclick = close;
      bx.querySelector('#cSave').onclick = async () => { if (await cloudSave(false)) render(); };
      bx.querySelector('#cSaveAs').onclick = async () => { if (await cloudSave(true)) render(); };
      const list = bx.querySelector('#cList');
      const r = await sb.from('projects').select('id,file_name,updated_at,owner_id,owner_email').order('updated_at', { ascending: false });
      if (r.error) { list.textContent = tr('err', { e: r.error.message }); return; }
      if (!r.data.length) { list.textContent = tr('empty'); return; }
      list.innerHTML = '';
      list.style.display = 'grid'; list.style.gap = '6px';
      r.data.forEach(p => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:8px;align-items:center;border:1px solid var(--line);border-radius:8px;padding:6px 8px';
        const when = new Date(p.updated_at).toLocaleString();
        row.innerHTML = `<div style="flex:1;min-width:0"><div style="color:var(--ink);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.file_name || tr('untitled'))}${PROJ.cloudId === p.id ? esc(tr('current')) : ''}</div><div style="font-size:11.5px">${esc(when)}${IS_ADMIN && p.owner_id !== USER.id ? ' · ' + esc(tr('owner')) + esc(p.owner_email || '') : ''}</div></div>`;
        const bo = document.createElement('button'); bo.textContent = tr('open');
        bo.onclick = () => { const go = () => { close(); cloudOpen(p.id); }; typeof guard === 'function' ? guard(go) : go(); };
        row.append(bo);
        if (IS_ADMIN) {  // 只有管理員能刪除（資料庫權限也有相同限制）
          const bd = document.createElement('button'); bd.textContent = tr('del');
          bd.onclick = async () => { if (await cloudDelete(p.id, p.file_name, p.owner_id)) render(); };
          row.append(bd);
        }
        list.append(row);
      });
    };
    render();
  }

  // ---------------- 介面掛載 ----------------
  function addHeaderButton(onclick) {
    const fw = document.querySelector('header .right .fwrap');
    if (!fw || document.getElementById('cloudBtn')) return;
    const b = document.createElement('button'); b.id = 'cloudBtn';
    b.textContent = tr('cloud');
    b.onclick = onclick;
    fw.parentNode.insertBefore(b, fw);
  }
  addHeaderButton(openDialog);

  if (typeof buildFileMenu === 'function') {
    const _build = buildFileMenu;
    buildFileMenu = function () {
      _build();
      const m = document.getElementById('fileMenu'); if (!m) return;
      const b = document.getElementById('cloudBtn'); if (b) b.textContent = tr('cloud');
      const sep = document.createElement('div'); sep.className = 'msep';
      const mk = (lab, fn) => { const x = document.createElement('button'); x.className = 'mi'; x.innerHTML = `<span>${esc(lab)}</span>`; x.onclick = () => { closeMenu(); fn(); }; return x; };
      const note = m.querySelector('.mnote');
      const items = [sep, mk(tr('menuOpen'), openDialog), mk(tr('menuSave'), () => cloudSave(false))];
      items.forEach(x => (note ? m.insertBefore(x, note) : m.append(x)));
    };
  }

  window.formworkCloud = { client: sb, save: cloudSave, open: cloudOpen, dialog: openDialog };
})();
