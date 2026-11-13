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
    title:      ['模板與支撐系統分析與設計程式', 'Formwork & Shoring Design'],
    signInHint: ['請以公司帳號（@sucoot.com）登入', 'Sign in with your company account (@sucoot.com)'],
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
#authGate{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:16px;background:var(--bg,#f4f5f2);overflow:auto}
#authGate .ag-card{background:#fff;border:1px solid var(--line,#dde1dc);border-radius:12px;padding:24px 22px;width:min(380px,100%);box-shadow:0 10px 30px rgba(0,0,0,.08)}
#authGate h2{margin:0 0 4px;font-size:18px;color:var(--accent,#1f4e79)}
#authGate .ag-sub{margin:0 0 16px;font-size:13px;color:var(--sub,#5d6670)}
#authGate label{display:flex;flex-direction:column;gap:4px;font-size:12.5px;color:var(--sub,#5d6670);margin-bottom:10px}
#authGate input{font:inherit;font-size:14px;padding:8px 10px;border:1px solid #c9cec8;border-radius:6px;width:100%;box-sizing:border-box}
#authGate .ag-btn{width:100%;padding:9px;font-size:14px;margin-top:4px}
#authGate .ag-msg{min-height:1.4em;font-size:12.5px;margin:6px 0 2px;color:#9b3415}
#authGate .ag-msg.ok{color:#1e7b3a}
#authGate .ag-link{background:none;border:0;padding:0;color:var(--accent,#1f4e79);cursor:pointer;font-size:12.5px;text-decoration:underline}
#authGate .ag-foot{display:flex;justify-content:space-between;align-items:center;margin-top:12px}
#authUser{display:flex;align-items:center;gap:6px;font-size:12.5px;color:inherit;opacity:.9;max-width:260px}
#authUser .au-mail{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#authUser .au-role{font-size:11px;padding:1px 6px;border-radius:8px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);white-space:nowrap}`;
  document.head.appendChild(css);

  // ---------------- 登入畫面 ----------------
  const gate = document.createElement('div');
  gate.id = 'authGate';
  const mount = () => { if (!gate.isConnected) document.body.appendChild(gate); };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  let VIEW = null;
  function show(view, msg, ok) {
    mount();
    VIEW = view;
    document.documentElement.classList.remove('fw-authed');
    const card = (inner) => { gate.innerHTML = `<form class="ag-card" novalidate><h2>${esc(tr('title'))}</h2>${inner}</form>`; return gate.querySelector('form'); };
    const msgHtml = `<div class="ag-msg${ok ? ' ok' : ''}" id="agMsg">${esc(msg || '')}</div>`;
    const setMsg = (m, good) => { const e = gate.querySelector('#agMsg'); e.textContent = m || ''; e.className = 'ag-msg' + (good ? ' ok' : ''); };

    if (view === 'login') {
      const f = card(`<p class="ag-sub">${esc(tr('signInHint'))}</p>
        <label>${esc(tr('email'))}<input id="agEmail" type="email" autocomplete="username" placeholder="name${DOMAIN}" value="${esc(lsGet('fw-last-email') || '')}"></label>
        <label>${esc(tr('password'))}<input id="agPass" type="password" autocomplete="current-password"></label>
        ${msgHtml}
        <button class="pri ag-btn" type="submit">${esc(tr('signIn'))}</button>
        <div class="ag-foot"><button type="button" class="ag-link" id="agForgot">${esc(tr('forgot'))}</button><span></span></div>`);
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
        <label>${esc(tr('email'))}<input id="agEmail" type="email" autocomplete="username" placeholder="name${DOMAIN}" value="${esc(lsGet('fw-last-email') || '')}"></label>
        ${msgHtml}
        <button class="pri ag-btn" type="submit">${esc(tr('sendReset'))}</button>
        <div class="ag-foot"><button type="button" class="ag-link" id="agBack">${esc(tr('back'))}</button><span></span></div>`);
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
        <label>${esc(tr('newPw'))}<input id="agPw1" type="password" autocomplete="new-password"></label>
        <label>${esc(tr('newPw2'))}<input id="agPw2" type="password" autocomplete="new-password"></label>
        ${msgHtml}
        <button class="pri ag-btn" type="submit">${esc(tr('savePw'))}</button>`);
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
    card(`<div class="ag-msg">${esc(msg || '')}</div>`);
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
