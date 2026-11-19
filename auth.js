// =====================================================================
// 登入閘門（Supabase Auth）
// - 未登入時只顯示登入畫面，計算程式隱藏
// - 只允許 @sucoot.com 信箱；帳號由管理員建立，網頁不提供註冊
// - 忘記密碼：寄送重設密碼信，回到網站後設定新密碼
// - 登入狀態保留在瀏覽器；閒置 12 小時自動登出
// 需在 cloud.js 之前載入；cloud.js 共用此處建立的 Supabase 連線。
// =====================================================================
(function () {
  'use strict';

  const SUPABASE_URL = 'https://htmcplckxtntrjiqumgo.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_zgD1afHGIGqzQvHjrbp1yA_EkoQvj3h';
  const DOMAIN = '@sucoot.com';
  const IDLE_MS = 12 * 60 * 60 * 1000;
  const LAST_KEY = 'fw-last-active';
  const SITE = location.origin + location.pathname;

  const TXT = {
    title:      ['模板支撐系統結構分析設計程式', 'Formwork & Shoring Design'],
    signInHint: ['使用實固公司帳號（@sucoot.com）登入', 'Sign in with your Sucoot account (@sucoot.com)'],
    adminNote:  ['帳號由系統管理員建立，需要帳號或無法登入請洽管理員。', 'Accounts are created by the system administrator. Contact them if you need an account or cannot sign in.'],
    lbSlab:     ['樓版混凝土', 'Slab concrete'],
    lbPanel:    ['面板', 'Panel'],
    lbWaler:    ['貫材(選用)', 'Waler (optional)'],
    lbJoist:    ['次墊條', 'Secondary joist'],
    lbBearer:   ['主墊條', 'Primary bearer'],
    lbShore:    ['圓盤系統支撐架', 'Ring system shoring'],
    tbName:     ['圖名', 'Title'],
    tbDraw:     ['模板支撐系統斷面示意', 'Formwork and shoring section'],
    tbOrg:      ['單位', 'By'],
    tbOrgV:     ['實固股份有限公司', 'Sucoot Co., Ltd.'],
    email:      ['電子郵件', 'Email'],
    password:   ['密碼', 'Password'],
    signIn:     ['登入', 'Sign in'],
    signingIn:  ['登入中…', 'Signing in…'],
    forgot:     ['忘記密碼？', 'Forgot password?'],
    back:       ['返回登入', 'Back to sign in'],
    sendReset:  ['寄送重設密碼信', 'Send reset email'],
    resetHint:  ['輸入帳號信箱，我們會寄送重設密碼的連結。', 'Enter your email and we will send a password reset link.'],
    resetSent:  ['若此信箱有帳號，稍後會收到重設密碼信，請點信中連結。', 'If this email has an account, a reset link is on its way.'],
    newPwTitle: ['設定新密碼', 'Set a new password'],
    newPw:      ['新密碼（至少 8 碼）', 'New password (min. 8 characters)'],
    newPw2:     ['再輸入一次', 'Confirm password'],
    savePw:     ['儲存新密碼', 'Save password'],
    pwShort:    ['密碼至少需要 8 碼。', 'Password must be at least 8 characters.'],
    pwMismatch: ['兩次輸入的密碼不一致。', 'Passwords do not match.'],
    pwSaved:    ['密碼已更新。', 'Password updated.'],
    badDomain:  ['只允許 @sucoot.com 的信箱登入。', 'Only @sucoot.com accounts can sign in.'],
    badLogin:   ['帳號或密碼錯誤，或帳號已停用。', 'Wrong email or password, or the account is disabled.'],
    idleOut:    ['閒置超過 12 小時，已自動登出，請重新登入。', 'Signed out after 12 hours of inactivity. Please sign in again.'],
    noLib:      ['無法載入登入元件，請確認網路連線後重新整理。', 'Could not load the sign-in library. Check your connection and reload.'],
    signOut:    ['登出', 'Sign out'],
    admin:      ['管理員', 'Admin'],
    linkBad:    ['連結已失效或已使用過，請重新申請。', 'This link is invalid or has expired. Please request a new one.'],
  };
  const lang = () => { try { return (typeof S !== 'undefined' && S && S.lang) || 'zh'; } catch (e) { return 'zh'; } };
  const tr = k => TXT[k][lang() === 'zh' ? 0 : 1];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const okDomain = e => typeof e === 'string' && e.trim().toLowerCase().endsWith(DOMAIN);
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
  const lsDel = k => { try { localStorage.removeItem(k); } catch (e) { } };

  // ---------------- 樣式：未登入時隱藏整個程式 ----------------
  const css = document.createElement('style');
  css.textContent = `
html:not(.fw-authed) body > *:not(#authGate){display:none!important}
html.fw-authed #authGate{display:none!important}
#authGate{--ag-navy:#1F4E79;--ag-navy2:#163C5E;--ag-paper:#E8EEF2;--ag-ink:#1B2733;--ag-muted:#4A5866;--ag-line:#B9C4CC;--ag-amber:#D9A01E;--ag-concrete:#8E979D;--ag-err:#B3261E;--ag-ok:#1E6B3A;
  position:fixed;inset:0;z-index:100;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(360px,1fr);background:#fff;color:var(--ag-ink);overflow:auto;
  font-family:"Noto Sans TC","Noto Sans",system-ui,sans-serif}
#authGate .ag-art{position:relative;display:grid;place-items:center;padding:40px 32px;min-height:100%;box-sizing:border-box;
  background-color:var(--ag-paper);
  background-image:linear-gradient(#CBD6DE 1px,transparent 1px),linear-gradient(90deg,#CBD6DE 1px,transparent 1px),linear-gradient(#DCE4EA 1px,transparent 1px),linear-gradient(90deg,#DCE4EA 1px,transparent 1px);
  background-size:60px 60px,60px 60px,12px 12px,12px 12px;background-position:-1px -1px}
#authGate .ag-draw{width:min(720px,94%);height:auto;display:block;overflow:visible}
#authGate .ag-draw text{font-family:"Noto Sans TC","Noto Sans",system-ui,sans-serif;fill:var(--ag-ink)}
#authGate .ag-pane{display:flex;align-items:center;padding:56px clamp(28px,5vw,64px);box-sizing:border-box}
#authGate .ag-form{width:100%;max-width:360px}
#authGate .ag-title{margin:0 0 10px;font-size:clamp(23px,2.3vw,28px);line-height:1.3;font-weight:700;letter-spacing:.01em}
#authGate .ag-title span{display:inline-block}
#authGate .ag-sub{margin:0 0 28px;font-size:14.5px;line-height:1.6;color:var(--ag-muted);text-wrap:pretty}
#authGate .ag-field{display:block;margin:0 0 16px;font-size:13.5px;font-weight:500;color:var(--ag-ink)}
#authGate .ag-field input{display:block;width:100%;box-sizing:border-box;margin-top:6px;height:44px;padding:0 12px;font:inherit;font-size:15px;font-weight:400;color:var(--ag-ink);
  background:#fff;border:1.5px solid var(--ag-line);border-radius:4px;transition:border-color .12s}
#authGate .ag-field input::placeholder{color:#8C99A4}
#authGate .ag-field input:focus{outline:none;border-color:var(--ag-navy);box-shadow:0 0 0 3px rgba(31,78,121,.18)}
#authGate .ag-btn{display:block;width:100%;height:46px;margin-top:6px;font:inherit;font-size:15px;font-weight:700;letter-spacing:.04em;color:#fff;background:var(--ag-navy);border:0;border-radius:4px;cursor:pointer}
#authGate .ag-btn:hover{background:var(--ag-navy2)}
#authGate .ag-btn:disabled{opacity:.7;cursor:progress}
#authGate .ag-btn:focus-visible,#authGate .ag-link:focus-visible{outline:2px solid var(--ag-navy);outline-offset:3px}
#authGate .ag-msg{min-height:1.5em;margin:2px 0 8px;font-size:13.5px;line-height:1.5;color:var(--ag-err)}
#authGate .ag-msg.ok{color:var(--ag-ok)}
#authGate .ag-link{background:none;border:0;padding:2px 0;font:inherit;font-size:14px;color:var(--ag-navy);text-decoration:underline;text-underline-offset:3px;cursor:pointer}
#authGate .ag-foot{margin-top:16px}
#authGate .ag-note{margin:28px 0 0;padding-top:16px;border-top:1px solid #E1E7EB;font-size:13px;line-height:1.6;color:var(--ag-muted);text-wrap:pretty}
/* 載入時：構件依施工順序由下往上組立（地面 → 支撐 → 主墊條 → 次墊條 → 貫材 → 面板 → 樓版），只播放一次 */
#authGate .ag-l{animation:ag-in .42s ease-out both}
#authGate .ag-l1{animation-delay:.05s}#authGate .ag-l2{animation-delay:.2s}#authGate .ag-l3{animation-delay:.35s}#authGate .ag-l4{animation-delay:.5s}
#authGate .ag-l5{animation-delay:.65s}#authGate .ag-l6{animation-delay:.8s}#authGate .ag-l7{animation-delay:.95s}#authGate .ag-l8{animation-delay:1.2s}
@keyframes ag-in{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){#authGate .ag-l{animation:none}}
@media (max-width:860px){
  #authGate{grid-template-columns:1fr;grid-template-rows:auto 1fr}
  #authGate .ag-art{min-height:0;padding:20px 16px 12px}
  #authGate .ag-draw{width:auto;max-width:100%;max-height:250px}
  #authGate .ag-tb{display:none}
  #authGate .ag-pane{align-items:flex-start;padding:28px 20px 40px}
}
#authUser{display:flex;align-items:center;gap:6px;font-size:12.5px;color:inherit;opacity:.9;max-width:260px}
#authUser .au-mail{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#authUser .au-role{font-size:11px;padding:1px 6px;border-radius:8px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);white-space:nowrap}`;
  document.head.appendChild(css);

  // ---------------- 登入畫面 ----------------
  const gate = document.createElement('div');
  gate.id = 'authGate';
  const mount = () => { if (!gate.isConnected) document.body.appendChild(gate); };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  // 模板支撐系統斷面示意（由上而下：樓版、面板、貫材、次墊條、主墊條、支撐）
  function artSVG() {
    // ===== 比例：1 m = 100 單位（1 單位 = 10 mm）；地面 y = 520 =====
    // 支撐架依實固 Ring System Scaffold 型錄第 15、18、19、20 頁之規格與比例繪製：
    //   底板 140×140×t6、底座螺桿 Ø48.2（外露取 300）、手輪、基座套管 L200 Ø60.2（中央一圓盤）、
    //   立桿 V61300 L3000 Ø60.2（圓盤間距 500）、U 型頂座螺桿 Ø48.2（外露取 250）、U 型頂座 170×150×H50×t6。
    //   圓盤外徑約 124、厚約 9，橫桿／斜撐管徑約 48.6（依第 18 頁圖面比例）。
    //   層高 1.5 m 兩層、架寬 1.5 m 兩格；斜撐同向。主墊條為 H150×75×5×7 斷面。
    //   鋼板、腹板等極薄部位略加粗以便辨識。
    const K = 0.1, G = 520, Y = mm => G - mm * K, W = mm => mm * K;
    const INK = '#1B2733', MIN = 1.1;                       // 極薄部位的最小繪製厚度
    const props = [110, 260, 410];                          // 立桿中心：間距 1.5 m
    const walers = []; for (let x = 75; x <= 450; x += 30) walers.push(x);   // 貫材 60×60 @300（示意）
    const RING0 = 406, RINGS = [];                          // 基座套管中央圓盤 406 mm，之後每 500 mm
    for (let r = RING0; r <= 3406; r += 500) RINGS.push(r);
    const LIFTS = [406, 1906, 3406];                        // 橫桿與斜撐：每 1.5 m 一層
    const TOPB = 3762;                                      // U 型頂座底板頂面（主墊條底面）
    const HB = { d: 150, b: 75, tw: 5, tf: 7 };             // H150×75×5×7
    const yTop = Y(TOPB + HB.d);                            // 主墊條頂面
    const rect = (x, y, w, h, fill, sw) => `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="${fill}"${sw ? ` stroke="${INK}" stroke-width="${sw}"` : ''}/>`;
    const tube = (x, y1mm, y2mm, dmm) => rect(x - W(dmm) / 2, Y(y2mm), W(dmm), W(y2mm - y1mm), '#fff', 0.8);
    const ring = (x, r) => rect(x - W(124) / 2, Y(r) - MIN / 2, W(124), MIN, INK);
    const shore = x => {
      let g = '';
      g += rect(x - W(140) / 2, Y(6) - (MIN - W(6)), W(140), MIN, INK);           // 底板 140×140×t6
      g += rect(x - W(48.2) / 2, Y(306), W(48.2), W(300), INK);                  // 底座螺桿（外露 300）
      g += rect(x - W(120) / 2, Y(285), W(120), W(25), INK);                     // 手輪
      g += tube(x, 306, 506, 60.2);                                              // 基座套管 L200
      g += tube(x, 506, 3506, 60.2);                                             // 立桿 L3000
      RINGS.forEach(r => g += ring(x, r));                                       // 圓盤 @500
      g += rect(x - W(48.2) / 2, Y(3756), W(48.2), W(250), INK);                 // 頂座螺桿（外露 250）
      g += rect(x - W(120) / 2, Y(3555), W(120), W(25), INK);                    // 手輪
      g += `<path d="M${x - W(85)},${Y(3806)} V${Y(3756)} H${x + W(85)} V${Y(3806)}" fill="none" stroke="${INK}" stroke-width="${MIN}"/>`;   // U 型頂座 170×H50
      return `<g>${g}</g>`;
    };
    // H150×75×5×7 斷面（腹板、翼板以最小厚度繪製）
    const hbeam = x => {
      const b = W(HB.b) / 2, tw = Math.max(W(HB.tw), 1.1) / 2, tf = Math.max(W(HB.tf), 1.5), y0 = Y(TOPB), y1 = Y(TOPB + HB.d);
      const pts = [[x - b, y0], [x + b, y0], [x + b, y0 - tf], [x + tw, y0 - tf], [x + tw, y1 + tf], [x + b, y1 + tf], [x + b, y1], [x - b, y1], [x - b, y1 + tf], [x - tw, y1 + tf], [x - tw, y0 - tf], [x - b, y0 - tf]];
      return `<polygon points="${pts.map(p => p.map(v => v.toFixed(2)).join(',')).join(' ')}" fill="#1F4E79" stroke="${INK}" stroke-width="0.4"/>`;
    };
    // 相鄰立桿之間：橫桿（兩端接頭＋楔形插銷）、斜撐（同向，左下往右上，跨高 1.5 m）
    const bays = props.slice(0, -1).map((x1, k) => {
      const x2 = props[k + 1], hd = W(55), off = W(60.2) / 2;                   // 接頭長約 55 mm
      let g = '';
      for (let n = 0; n < LIFTS.length - 1; n++) {
        const a = [x1 + off + hd * 0.6, Y(LIFTS[n])], b = [x2 - off - hd * 0.6, Y(LIFTS[n + 1])];
        const d = `M${a[0].toFixed(2)},${a[1].toFixed(2)} L${b[0].toFixed(2)},${b[1].toFixed(2)}`;
        g += `<path d="${d}" stroke="${INK}" stroke-width="${W(48.6).toFixed(2)}" stroke-linecap="butt"/><path d="${d}" stroke="#fff" stroke-width="${(W(48.6) - 1.4).toFixed(2)}"/>`;
        g += `<circle cx="${a[0].toFixed(2)}" cy="${a[1].toFixed(2)}" r="1.5" fill="${INK}"/><circle cx="${b[0].toFixed(2)}" cy="${b[1].toFixed(2)}" r="1.5" fill="${INK}"/>`;
      }
      LIFTS.forEach(r => {
        const y = Y(r), a = x1 + off + hd, b = x2 - off - hd;
        g += rect(a, y - W(48.6) / 2, b - a, W(48.6), '#fff', 0.8);                       // 橫桿
        [[x1 + off, 1], [x2 - off - hd, -1]].forEach(([hx]) => {
          g += rect(hx, y - W(95) / 2, hd, W(95), INK);                                    // 接頭
          g += rect(hx + hd / 2 - W(12) / 2, y - W(140) / 2, W(12), W(140), '#4A5866');    // 楔形插銷
        });
      });
      return `<g>${g}</g>`;
    }).join('');
    const leader = (x1, y1, y2, label, cls) => `<g class="ag-l ${cls}">
      <circle cx="${x1}" cy="${y1}" r="2.6" fill="${INK}"/>
      <polyline points="${x1},${y1} 486,${y2} 500,${y2}" fill="none" stroke="${INK}" stroke-width="1"/>
      <text x="506" y="${y2 + 5}" font-size="16" font-weight="500">${esc(label)}</text></g>`;
    let ground = '';
    for (let x = 52; x <= 470; x += 12) ground += `<line x1="${x}" y1="${G}" x2="${x - 9}" y2="${G + 10}" stroke="#8E979D" stroke-width="1"/>`;
    const hJ = W(135), hW = W(60), hP = 2.4, hS = W(250);                  // 次墊條 Top Beam 高 135、貫材 60、面板 18（加粗）、樓版 250
    const yJ = yTop - hJ, yW = yJ - hW, yP = yW - hP, yS = yP - hS;
    const L0 = yS - 6;                                                     // 標註文字由此往下每 24 一列
    return `<svg class="ag-draw" viewBox="20 60 610 540" role="img" aria-label="${esc(tr('tbDraw'))}">
  <defs><pattern id="agHatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="9" stroke="#8E979D" stroke-width="1.2"/></pattern></defs>
  <g class="ag-l ag-l1"><line x1="40" y1="${G}" x2="480" y2="${G}" stroke="${INK}" stroke-width="1.6"/>${ground}</g>
  <g class="ag-l ag-l2">${bays}${props.map(shore).join('')}</g>
  <g class="ag-l ag-l3">${props.map(hbeam).join('')}</g>
  <g class="ag-l ag-l4"><rect x="60" y="${yJ}" width="400" height="${hJ}" fill="#CFDCE7" stroke="${INK}" stroke-width="1"/></g>
  <g class="ag-l ag-l5">${walers.map(x => `<rect x="${x - hW / 2}" y="${yW}" width="${hW}" height="${hW}" fill="#CFDCE7" stroke="${INK}" stroke-width="0.8"/>`).join('')}</g>
  <g class="ag-l ag-l6"><rect x="60" y="${yP}" width="400" height="${hP}" fill="#D9A01E" stroke="${INK}" stroke-width="0.6"/></g>
  <g class="ag-l ag-l7"><rect x="60" y="${yS}" width="400" height="${hS}" fill="url(#agHatch)" stroke="${INK}" stroke-width="1.4"/></g>
  ${leader(430, (yS + hS / 2).toFixed(1), (L0 + 6).toFixed(1), tr('lbSlab'), 'ag-l8')}
  ${leader(446, (yP + hP / 2).toFixed(1), (L0 + 30).toFixed(1), tr('lbPanel'), 'ag-l8')}
  ${leader(450, (yW + hW / 2).toFixed(1), (L0 + 54).toFixed(1), tr('lbWaler'), 'ag-l8')}
  ${leader(456, (yJ + hJ / 2).toFixed(1), (L0 + 78).toFixed(1), tr('lbJoist'), 'ag-l8')}
  ${leader((410 + W(HB.b) / 2).toFixed(2), Y(TOPB + HB.d / 2).toFixed(1), (L0 + 102).toFixed(1), tr('lbBearer'), 'ag-l8')}
  ${leader((410 + W(60.2) / 2).toFixed(2), Y(2650).toFixed(1), Y(2650).toFixed(1), tr('lbShore'), 'ag-l8')}
  <g class="ag-tb ag-l ag-l8" font-size="12">
    <rect x="338" y="${G + 24}" width="262" height="48" fill="#fff" stroke="${INK}" stroke-width="1.4"/>
    <line x1="338" y1="${G + 48}" x2="600" y2="${G + 48}" stroke="${INK}" stroke-width="1"/>
    <line x1="382" y1="${G + 24}" x2="382" y2="${G + 72}" stroke="${INK}" stroke-width="1"/>
    <text x="360" y="${G + 40}" text-anchor="middle" fill="#4A5866">${esc(tr('tbName'))}</text>
    <text x="392" y="${G + 40}" font-weight="500">${esc(tr('tbDraw'))}</text>
    <text x="360" y="${G + 64}" text-anchor="middle" fill="#4A5866">${esc(tr('tbOrg'))}</text>
    <text x="392" y="${G + 64}" font-weight="500">${esc(tr('tbOrgV'))}</text></g>
</svg>`;
  }
  // 左側圖面只建立一次（切換登入／忘記密碼等畫面時不重播動畫）
  function shell() {
    let pane = gate.querySelector('.ag-pane');
    if (!pane) {
      gate.innerHTML = `<div class="ag-art" aria-hidden="true">${artSVG()}</div><main class="ag-pane"></main>`;
      pane = gate.querySelector('.ag-pane');
    }
    return pane;
  }

  let VIEW = null;
  function show(view, msg, ok) {
    mount();
    VIEW = view;
    document.documentElement.classList.remove('fw-authed');
    const card = (inner) => { const pane = shell(); const t = tr('title'), k = t.indexOf('系統') + 2; pane.innerHTML = `<form class="ag-form" novalidate><h1 class="ag-title">${k > 1 ? `<span>${esc(t.slice(0, k))}</span><span>${esc(t.slice(k))}</span>` : esc(t)}</h1>${inner}</form>`; return pane.querySelector('form'); };
    const msgHtml = `<div class="ag-msg${ok ? ' ok' : ''}" id="agMsg">${esc(msg || '')}</div>`;
    const setMsg = (m, good) => { const e = gate.querySelector('#agMsg'); e.textContent = m || ''; e.className = 'ag-msg' + (good ? ' ok' : ''); };

    if (view === 'login') {
      const f = card(`<p class="ag-sub">${esc(tr('signInHint'))}</p>
        <label class="ag-field">${esc(tr('email'))}<input id="agEmail" type="email" autocomplete="username" placeholder="name${DOMAIN}" value="${esc(lsGet('fw-last-email') || '')}"></label>
        <label class="ag-field">${esc(tr('password'))}<input id="agPass" type="password" autocomplete="current-password"></label>
        ${msgHtml}
        <button class="ag-btn" type="submit">${esc(tr('signIn'))}</button>
        <div class="ag-foot"><button type="button" class="ag-link" id="agForgot">${esc(tr('forgot'))}</button></div>
        <p class="ag-note">${esc(tr('adminNote'))}</p>`);
      const em = f.querySelector('#agEmail'), pw = f.querySelector('#agPass'), btn = f.querySelector('.ag-btn');
      (em.value ? pw : em).focus();
      f.querySelector('#agForgot').onclick = () => show('forgot');
      f.onsubmit = async e => {
        e.preventDefault();
        const email = em.value.trim().toLowerCase();
        if (!okDomain(email)) { setMsg(tr('badDomain')); return; }
        btn.disabled = true; btn.textContent = tr('signingIn'); setMsg('');
        const r = await sb.auth.signInWithPassword({ email, password: pw.value });
        btn.disabled = false; btn.textContent = tr('signIn');
        if (r.error) { setMsg(tr('badLogin')); return; }
        lsSet('fw-last-email', email);
        touch(true);
        enter(r.data.session);
      };
      return;
    }

    if (view === 'forgot') {
      const f = card(`<p class="ag-sub">${esc(tr('resetHint'))}</p>
        <label class="ag-field">${esc(tr('email'))}<input id="agEmail" type="email" autocomplete="username" placeholder="name${DOMAIN}" value="${esc(lsGet('fw-last-email') || '')}"></label>
        ${msgHtml}
        <button class="ag-btn" type="submit">${esc(tr('sendReset'))}</button>
        <div class="ag-foot"><button type="button" class="ag-link" id="agBack">${esc(tr('back'))}</button></div>`);
      const em = f.querySelector('#agEmail'), btn = f.querySelector('.ag-btn');
      em.focus();
      f.querySelector('#agBack').onclick = () => show('login');
      f.onsubmit = async e => {
        e.preventDefault();
        const email = em.value.trim().toLowerCase();
        if (!okDomain(email)) { setMsg(tr('badDomain')); return; }
        btn.disabled = true;
        await sb.auth.resetPasswordForEmail(email, { redirectTo: SITE });
        btn.disabled = false;
        setMsg(tr('resetSent'), true); // 不透露帳號是否存在
      };
      return;
    }

    if (view === 'newpw') {
      const f = card(`<p class="ag-sub">${esc(tr('newPwTitle'))}</p>
        <label class="ag-field">${esc(tr('newPw'))}<input id="agPw1" type="password" autocomplete="new-password"></label>
        <label class="ag-field">${esc(tr('newPw2'))}<input id="agPw2" type="password" autocomplete="new-password"></label>
        ${msgHtml}
        <button class="ag-btn" type="submit">${esc(tr('savePw'))}</button>`);
      const p1 = f.querySelector('#agPw1'), p2 = f.querySelector('#agPw2'), btn = f.querySelector('.ag-btn');
      p1.focus();
      f.onsubmit = async e => {
        e.preventDefault();
        if (p1.value.length < 8) { setMsg(tr('pwShort')); return; }
        if (p1.value !== p2.value) { setMsg(tr('pwMismatch')); return; }
        btn.disabled = true;
        const r = await sb.auth.updateUser({ password: p1.value });
        btn.disabled = false;
        if (r.error) { setMsg(r.error.message); return; }
        touch(true);
        const { data } = await sb.auth.getSession();
        enter(data.session, tr('pwSaved'));
      };
      return;
    }

    // 錯誤畫面（元件無法載入）
    card(`<p class="ag-msg">${esc(msg || '')}</p>`);
  }

  // ---------------- Supabase ----------------
  if (!window.supabase || !window.supabase.createClient) {
    show('error', tr('noLib'));
    return;
  }

  // 讀取信件連結帶回的參數（必須在建立連線前，連線會清除網址上的權杖）
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const linkType = hash.get('type');                                 // recovery | invite | signup | magiclink
  const linkError = hash.get('error_description') || new URLSearchParams(location.search).get('error_description');
  let needNewPw = linkType === 'recovery' || linkType === 'invite';

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  window.formworkSB = sb;
  window.formworkAuth = { user: null, isAdmin: false };

  const roleOf = u => (u && u.app_metadata && u.app_metadata.role) || 'user';

  function setUser(session) {
    const u = session ? session.user : null;
    window.formworkAuth.user = u;
    window.formworkAuth.isAdmin = roleOf(u) === 'admin';
    renderHeader();
    document.dispatchEvent(new CustomEvent('fw-auth', { detail: window.formworkAuth }));
  }

  function enter(session, msg) {
    if (!session || !session.user || !okDomain(session.user.email)) {
      if (session) sb.auth.signOut();
      setUser(null);
      show('login', session ? tr('badDomain') : '');
      return;
    }
    setUser(session);
    document.documentElement.classList.add('fw-authed');
    gate.innerHTML = ''; VIEW = null;
    // 程式在隱藏狀態下初始化，顯示後重新計算版面（含鋼柱頁 iframe）
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
      try { if (typeof colFit === 'function') colFit(); } catch (e) { }
    });
    if (msg && typeof toast === 'function') toast(msg);
  }

  async function signOut(msg) {
    lsDel(LAST_KEY);
    await sb.auth.signOut().catch(() => { });
    try { const o = document.getElementById('cloudOvl'); if (o) o.remove(); } catch (e) { }
    setUser(null);
    show('login', msg || '');
  }
  window.formworkAuth.signOut = () => signOut();

  // ---------------- 閒置 12 小時自動登出 ----------------
  let lastWrite = 0;
  function touch(force) {
    const now = Date.now();
    if (force || now - lastWrite > 60000) { lastWrite = now; lsSet(LAST_KEY, String(now)); }
  }
  const idleExpired = () => { const t = +lsGet(LAST_KEY); return !!t && Date.now() - t > IDLE_MS; };
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => window.addEventListener(ev, () => {
    if (document.documentElement.classList.contains('fw-authed')) touch(false);
  }, { passive: true, capture: true }));
  setInterval(() => {
    if (document.documentElement.classList.contains('fw-authed') && idleExpired()) signOut(tr('idleOut'));
  }, 60000);
  // 其他分頁登出時同步
  window.addEventListener('storage', e => {
    if (e.key === LAST_KEY && e.newValue === null && document.documentElement.classList.contains('fw-authed')) signOut();
  });

  // ---------------- 頁首：帳號與登出 ----------------
  function renderHeader() {
    const right = document.querySelector('header .right');
    if (!right) return;
    let box = document.getElementById('authUser');
    const u = window.formworkAuth.user;
    if (!u) { if (box) box.remove(); return; }
    if (!box) {
      box = document.createElement('span'); box.id = 'authUser';
      right.insertBefore(box, right.firstChild);
    }
    box.innerHTML = `<span class="au-mail" title="${esc(u.email)}">${esc(u.email)}</span>${window.formworkAuth.isAdmin ? `<span class="au-role">${esc(tr('admin'))}</span>` : ''}<button type="button" id="authOut">${esc(tr('signOut'))}</button>`;
    box.querySelector('#authOut').onclick = () => {
      const go = () => signOut();
      if (typeof guard === 'function') guard(go); else go();
    };
  }
  document.addEventListener('change', e => { if (e.target && e.target.id === 'lang') renderHeader(); });

  // ---------------- 啟動 ----------------
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { needNewPw = true; setUser(session); if (VIEW !== 'newpw') show('newpw'); }
    else if (event === 'SIGNED_OUT') { setUser(null); }
    else if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') { if (session) setUser(session); }
  });

  show('login');
  (async () => {
    const { data } = await sb.auth.getSession();
    const session = data.session;
    if (linkError && !session) { show('login', tr('linkBad')); return; }
    if (!session) return;                                   // 顯示登入畫面
    if (!okDomain(session.user.email)) { await sb.auth.signOut(); show('login', tr('badDomain')); return; }
    if (needNewPw) { setUser(session); if (VIEW !== 'newpw') show('newpw'); return; }   // 重設密碼或受邀帳號第一次登入
    if (idleExpired()) { await signOut(tr('idleOut')); return; }
    touch(true);
    enter(session);
  })();
})();
