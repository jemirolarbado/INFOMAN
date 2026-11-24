(function (window) {
  'use strict';

  // Supabase Client Initialization
  var SUPABASE_URL = 'https://pfgwavzauqqbrcmgqjou.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZ3dhdnphdXFxYnJjbWdxam91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3MDM5MTIsImV4cCI6MjEwOTEzOTkxMn0.qGqJd6DwjqBx8UNK8460Lz0dA-8xgA_L6bjbkml5IVQ';

  if (window.supabase && window.supabase.createClient) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  } else {
    console.warn('Supabase SDK not loaded. Make sure the CDN script is included in index.html before index.js.');
  }

  var db = window.supabaseClient;
  window.HopeERP = window.HopeERP || {};
  var H = window.HopeERP;

  H.STORAGE_KEY = 'hope_erp_users_v1';
  H.SESSION_KEY = 'hope_erp_session_v1';
  H.STATUSES = ['Active', 'Pending', 'Blocked', 'Disapproved'];
  H.ROLES = ['User', 'Admin', 'Superadmin'];
  H.MODULES = [
    { id: 'customers', name: 'Customers', icon: 'customers', items: ['Add customer', 'Edit customer', 'Delete customer'] },
    { id: 'products', name: 'Products', icon: 'products', items: ['Add product', 'Edit product', 'Delete product', 'Add price', 'Edit price', 'Delete price'] },
    { id: 'hr', name: 'Human Resources', icon: 'hr', items: ['Add job', 'Edit job', 'Delete job', 'Add department', 'Edit department', 'Delete department', 'Add employee', 'Edit employee', 'Delete employee', 'View job history', 'Add job history', 'Edit job history', 'Delete job history'] },
    { id: 'sales', name: 'Sales', icon: 'sales', items: ['Add sale', 'Edit sale', 'Delete sale', 'View sale details', 'Add sale detail', 'Edit sale detail', 'Delete sale detail'] },
    { id: 'reports', name: 'Reports', icon: 'reports', items: ['Top customers', 'Product master list', 'Top products', 'Active employees', 'All employees', 'Employee job history', 'Top sales'] }
  ];

  H.rightKey = function (mod, index) { return mod.id + ':' + index; };
  H.ALL_RIGHTS = [];
  H.MODULES.forEach(function (m) {
    m.items.forEach(function (_, i) { H.ALL_RIGHTS.push(H.rightKey(m, i)); });
  });
  H.TOTAL_RIGHTS = H.ALL_RIGHTS.length;
  H.DEFAULT_USER_RIGHTS = [
    'customers:0', 'customers:1',
    'products:0', 'products:1',
    'sales:3',
    'reports:0', 'reports:1', 'reports:3', 'reports:6'
  ];

  H.defaultRights = function (role) {
    return (role === 'User' ? H.DEFAULT_USER_RIGHTS : H.ALL_RIGHTS).slice();
  };

  function make(id, first, last, email, role, status) {
    return {
      id: id,
      first: first,
      last: last,
      email: email,
      role: role,
      status: status,
      rights: H.defaultRights(role)
    };
  }

  H.seedUsers = function () {
    return [
      make(1, 'Michael', 'Reyes', 'ceo@hope.com', 'Superadmin', 'Active'),
      make(2, 'Sarah', 'Chen', 'superadmin@hope.com', 'Superadmin', 'Active'),
      make(3, 'Lisa', 'Park', 'admin@hope.com', 'Admin', 'Active'),
      make(4, 'David', 'Kim', 'manager@hope.com', 'Admin', 'Active'),
      make(5, 'Alex', 'Rivera', 'user@hope.com', 'User', 'Active')
    ];
  };

  // --- Async Database Operations
  H.fetchUsersFromSupabase = async function () {
    if (!db) return H.loadUsersLocal();
    try {
      var res = await db.from('app_users').select('*').order('id', { ascending: true });
      if (res.error) {
        console.error('Error fetching users from Supabase:', res.error.message);
        return H.loadUsersLocal();
      }
      if (res.data && res.data.length > 0) {
        H.saveUsersLocal(res.data);
        return res.data;
      }
    } catch (e) {
      console.error('Supabase connection error:', e);
    }
    return H.loadUsersLocal();
  };

  H.loadUsersLocal = function () {
    try {
      var raw = window.localStorage.getItem(H.STORAGE_KEY);
      if (raw) {
        var list = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) return list;
      }
    } catch (e) {}
    return H.seedUsers();
  };

  H.saveUsersLocal = function (users) {
    try { window.localStorage.setItem(H.STORAGE_KEY, JSON.stringify(users)); } catch (e) {}
  };

  H.clearUsers = function () {
    try { window.localStorage.removeItem(H.STORAGE_KEY); } catch (e) {}
  };

  H.saveSession = function (user) {
    try {
      if (user) window.localStorage.setItem(H.SESSION_KEY, JSON.stringify(user));
      else window.localStorage.removeItem(H.SESSION_KEY);
    } catch (e) {}
  };

  H.loadSession = function () {
    try {
      var raw = window.localStorage.getItem(H.SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  };

  H.nextId = function (users) {
    return users.reduce(function (max, u) { return Math.max(max, u.id); }, 0) + 1;
  };

  H.byId = function (users, id) {
    for (var i = 0; i < users.length; i++) if (users[i].id === id) return users[i];
    return null;
  };

  H.fullName = function (u) { return u.first + ' ' + u.last; };

  H.initials = function (u) {
    return ((u.first || '?').charAt(0) + (u.last || '').charAt(0)).toUpperCase();
  };

  H.canManage = function (actor, target) {
    if (!actor || !target || actor.id === target.id) return false;
    if (actor.role === 'Superadmin') return true;
    if (actor.role === 'Admin') return target.role !== 'Superadmin';
    return false;
  };

  H.canChangeStatus = function (actor, target) {
    return H.canManage(actor, target) && target.role !== 'Superadmin';
  };

  H.canChangeRole = function (actor, target) {
    return !!actor && actor.role === 'Superadmin' && actor.id !== target.id && target.role !== 'Superadmin';
  };

  H.canRights = function (actor, target) {
    if (!H.canManage(actor, target) || target.role === 'Superadmin') return false;
    if (target.role === 'Admin') return actor.role === 'Superadmin';
    return true;
  };

  H.visibleUsers = function (actor, users) {
    return users.filter(function (u) { return actor.role === 'Superadmin' || u.role !== 'Superadmin'; });
  };

  H.hasAnyRight = function (user, moduleId) {
    if (!user) return false;
    if (user.role !== 'User') return true;
    return (user.rights || []).some(function (k) { return k.indexOf(moduleId + ':') === 0; });
  };

  H.describeStatusChange = function (actor, target, to) {
    var who = H.fullName(actor), name = H.fullName(target), verb = null;
    if (to === 'Active') verb = target.status === 'Blocked' ? 'unblocked' : 'approved';
    else if (to === 'Blocked') verb = 'blocked';
    else if (to === 'Disapproved') verb = 'disapproved';
    if (verb) return { log: who + ' ' + verb + ' ' + name, toast: name + ' was ' + verb + '.' };
    return { log: who + ' moved ' + name + ' to Pending', toast: name + ' is now Pending.' };
  };

  H.signInBlocker = function (user) {
    if (user.status === 'Pending') return 'Your account is waiting for approval by an Admin.';
    if (user.status === 'Blocked') return 'This account is blocked. Please contact an Admin.';
    if (user.status === 'Disapproved') return 'Your registration was disapproved. Please contact an Admin.';
    return '';
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  H.esc = esc;

  var PATHS = {
    dash: '<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',
    customers: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1"/><path d="M17 4a4 4 0 0 1 0 8M22 21v-1a6 6 0 0 0-4-5.6"/>',
    products: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    hr: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
    sales: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    reports: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    settings: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    audit: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>',
    minus: '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>'
  };

  function ic(name, size) {
    size = size || 20;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (PATHS[name] || '') + '</svg>';
  }
  H.ic = ic;

  var LOGO = '<span class="logo" aria-hidden="true">H<i></i></span>';

  function roleBadge(role) {
    var cls = { Superadmin: 'b-super', Admin: 'b-admin', User: 'b-user' }[role] || 'b-user';
    return '<span class="badge ' + cls + '">' + esc(role) + '</span>';
  }

  function statusPill(status) {
    return '<span class="pill st-' + String(status || '').toLowerCase() + '">' + esc(status) + '</span>';
  }

  function avatarColor(u) {
    if (u.role === 'Superadmin') return '#10201E';
    if (u.role === 'Admin') return '#0B6E64';
    return u.status === 'Blocked' ? '#5B6B68' : '#C9432C';
  }

  function avatar(u, small) {
    return '<span class="avatar' + (small ? ' sm' : '') + '" style="background:' + avatarColor(u) + '" aria-hidden="true">' + esc(H.initials(u)) + '</span>';
  }

  function flash(S) {
    if (!S.flash) return '';
    return '<div class="msg ' + (S.flash.kind === 'ok' ? 'msg-ok' : 'msg-err') + '" role="status">' + esc(S.flash.text) + '</div>';
  }

  function googleBtn() {
    return '<button type="button" class="btn btn-outline btn-block" data-act="stub" data-arg="Sign in with Google"><span class="g-icon" aria-hidden="true">G</span>Continue with Google</button>';
  }

  function moduleCard(cls, icon, title, text) {
    return '<article class="mcard ' + cls + '"><span class="ico">' + ic(icon, 22) + '</span><h3>' + title + '</h3><p>' + text + '</p></article>';
  }

  function landing() {
    return '' +
      '<header class="topbar"><div class="in">' +
      '<div class="brand">' + LOGO + '<span>Hope, Inc. ERP</span></div>' +
      '<div class="row"><button type="button" class="btn btn-ghost" data-act="go" data-arg="login">Sign in</button>' +
      '<button type="button" class="btn btn-primary" data-act="go" data-arg="register">Register</button></div>' +
      '</div></header>' +
      '<main><section class="hero">' +
      '<h1 id="focus" tabindex="-1">Every department, <span>one source of truth.</span></h1>' +
      '<p>Hope, Inc. ERP brings customers, products, people and sales into a single system, so the numbers in every report always agree.</p>' +
      '<div class="row center">' +
      '<button type="button" class="btn btn-primary btn-lg" data-act="go" data-arg="login">Sign in to your workspace</button>' +
      '<button type="button" class="btn btn-outline btn-lg" data-act="go" data-arg="register">Create an account</button>' +
      '</div>' +
      '</section>' +
      '<section class="cards4" aria-label="Modules">' +
      moduleCard('mc-teal', 'customers', 'Customers', 'Accounts, addresses and payment terms.') +
      moduleCard('mc-white', 'products', 'Products', 'Catalog with price history over time.') +
      moduleCard('mc-ink', 'hr', 'Human Resources', 'Employees, jobs, departments, history.') +
      moduleCard('mc-coral', 'sales', 'Sales', 'Orders, payments, reports and audit trail.') +
      '</section></main>' +
      '<footer class="page-foot">Hope, Inc. ERP Information Management project prototype</footer>';
  }

  function authShell(left, card) {
    return '<div class="auth">' +
      '<section class="auth-left"><div class="brand brand-inv">' + LOGO + '<span>Hope, Inc. ERP</span></div>' +
      '<div>' + left + '</div><div class="auth-foot">Hope, Inc. ERP · Sprint 4</div></section>' +
      '<main class="auth-right">' + card + '</main></div>';
  }

  var TICK = ic('check', 22);

  function register() {
    var left = '<h1 id="focus" tabindex="-1">Join the workspace.</h1>' +
      '<p>Create an account in under a minute. An Admin then approves it and opens the modules you need.</p>' +
      '<ul class="auth-list"><li>' + TICK + 'Starts with User access</li><li>' + TICK + 'An Admin approves new accounts</li><li>' + TICK + 'Rights are granted per module</li></ul>';
    var card = '<form class="auth-card" data-form="register" novalidate>' +
      '<div><h2>Create your account</h2><div class="sub">Takes less than a minute.</div></div>' +
      '<div class="msg msg-note">New accounts start as <b>User</b> and stay <b>Pending</b> until an Admin approves them.</div>' +
      '<div class="two-col">' +
      '<div class="field"><label for="r-first">First name</label><input class="input" id="r-first" autocomplete="given-name" required></div>' +
      '<div class="field"><label for="r-last">Last name</label><input class="input" id="r-last" autocomplete="family-name" required></div>' +
      '</div>' +
      '<div class="field"><label for="r-email">Email address</label><input class="input" id="r-email" type="email" autocomplete="email" required></div>' +
      '<div class="field"><label for="r-pw">Password</label><input class="input" id="r-pw" type="password" placeholder="At least 6 characters" required></div>' +
      '<div class="field"><label for="r-repw">Confirm password</label><input class="input" id="r-repw" type="password" placeholder="Re-enter password" required></div>' +
      '<div class="msg msg-err" id="form-error" role="alert" hidden></div>' +
      '<button type="submit" class="btn btn-primary btn-block">Register</button>' +
      '<div class="divider">or</div>' + googleBtn() +
      '<div class="center-txt">Already have an account? <button type="button" class="link" data-act="go" data-arg="login">Sign in</button></div>' +
      '</form>';
    return authShell(left, card);
  }

  function login(S) {
    var left = '<h1 id="focus" tabindex="-1">Welcome back.</h1>' +
      '<p>Sign in to see the modules your role allows. The menu adapts to who you are.</p>' +
      '<div class="role-cards">' +
      '<div><b>Superadmin</b><span>Full menu, including System Settings and Audit Log</span></div>' +
      '<div><b>Admin</b><span>All modules, reports, audit log and user rights</span></div>' +
      '<div><b>User</b><span>Only the modules and reports granted to you</span></div>' +
      '</div>';
    var card = '<form class="auth-card" data-form="login" novalidate>' +
      '<div><h2>Sign in</h2><div class="sub">Use your Hope, Inc. ERP account.</div></div>' +
      flash(S) +
      '<div class="msg msg-warn"><b>Demo accounts</b><br>' +
      'ceo@hope.com or superadmin@hope.com: Superadmin<br>' +
      'admin@hope.com or manager@hope.com: Admin<br>' +
      'user@hope.com: User</div>' +
      '<div class="field"><label for="l-email">Email address</label><input class="input" id="l-email" type="email" autocomplete="username" value="ceo@hope.com" required></div>' +
      '<div class="field"><label for="l-pw">Password</label><div class="input-wrap">' +
      '<input class="input" id="l-pw" type="password" autocomplete="current-password" value="password123" required>' +
      '<button type="button" data-act="togglepw" aria-label="Show password">' + ic('eye') + '</button></div></div>' +
      '<div class="check-row"><label><input type="checkbox"> Remember me</label>' +
      '<button type="button" class="link" data-act="go" data-arg="reset">Forgot password?</button></div>' +
      '<div class="msg msg-err" id="form-error" role="alert" hidden></div>' +
      '<button type="submit" class="btn btn-primary btn-block">Sign in</button>' +
      '<div class="divider">or</div>' + googleBtn() +
      '<div class="center-txt">New here? <button type="button" class="link" data-act="go" data-arg="register">Create an account</button></div>' +
      '<div class="center-txt"><button type="button" class="link" data-act="resetdemo">Reset demo data</button></div>' +
      '</form>';
    return authShell(left, card);
  }

  function reset(S) {
    var isUpdateMode = window.location.hash.includes('access_token') || S.isPasswordUpdate;
    var title = isUpdateMode ? 'Set new password' : 'Reset password';
    var sub = isUpdateMode ? 'Enter your new secure password below.' : 'We will send you a secure link to reset it.';
    var left = '<h1 id="focus" tabindex="-1">Locked out? No problem.</h1>' +
      '<p>We will e-mail a secure reset link. It expires after a short time, so use it soon.</p>' +
      '<ol class="auth-steps"><li class="on"><b>1</b>Enter your account email</li><li><b>2</b>Open the link in your inbox</li><li><b>3</b>Choose a new password</li></ol>';
    var card = '<form class="auth-card" data-form="' + (isUpdateMode ? 'update_password' : 'reset') + '" novalidate>' +
      '<span class="icon-tile">' + ic('lock', 26) + '</span>' +
      '<div><h2>' + title + '</h2><div class="sub">' + sub + '</div></div>' +
      (S.resetSent ? '<div class="msg msg-ok" role="status">If an account exists for <b>' + esc(S.resetSent) + '</b>, a reset email is on its way. Check your inbox!</div>' : '') +
      (!isUpdateMode ?
        '<div class="field"><label for="p-email">Email address</label><input class="input" id="p-email" type="email" autocomplete="email" required></div>' :
        '<div class="field"><label for="new-pw">New Password</label><input class="input" id="new-pw" type="password" required></div>'
      ) +
      '<div class="msg msg-err" id="form-error" role="alert" hidden></div>' +
      '<button type="submit" class="btn btn-primary btn-block">' + (isUpdateMode ? 'Update Password' : 'Send reset link') + '</button>' +
      '<div class="center-txt">Remember your password? <button type="button" class="link" data-act="go" data-arg="login">Back to sign in</button></div>' +
      '</form>';
    return authShell(left, card);
  }

  function navBtn(label, icon, on, act, arg) {
    return '<button type="button" class="nav' + (on ? ' on' : '') + '" data-act="' + act + '" data-arg="' + esc(arg) + '"' + (on ? ' aria-current="page"' : '') + '>' + ic(icon) + '<span>' + esc(label) + '</span></button>';
  }

  function sidebar(S, active) {
    var me = S.me;
    var h = '<aside class="side" aria-label="Main menu">' +
      '<div class="side-brand">' + LOGO + '<span>Hope, Inc. ERP</span></div>' +
      '<div class="side-label">Modules</div>' +
      navBtn('Dashboard', 'dash', active === 'dashboard', 'go', 'dashboard');

    H.MODULES.forEach(function (m) {
      if (H.hasAnyRight(me, m.id)) {
        var isAct = active === m.id;
        h += navBtn(m.name, m.icon, isAct, 'stub', m.name);
      }
    });

    if (me.role !== 'User') {
      h += '<div class="side-label">Administration</div>' +
        navBtn('User Management', 'shield', active === 'users', 'go', 'users') +
        navBtn('Audit Log', 'audit', active === 'audit', 'stub', 'Audit Log');
      if (me.role === 'Superadmin') {
        h += navBtn('System Settings', 'settings', active === 'settings', 'stub', 'System Settings');
      }
    } else {
      h += '<div class="side-label">Account</div>' +
        navBtn('My rights', 'shield', false, 'myrights', '');
    }

    h += '<div class="side-user">' + avatar(me) +
      '<div class="who"><b>' + esc(H.fullName(me)) + '</b><span>' + esc(me.role) + '</span></div>' +
      '<button type="button" class="link" data-act="logout">Sign out</button></div></aside>';
    return h;
  }

  function shell(S, active, title, inner) {
    return '<div class="shell">' + sidebar(S, active) +
      '<main class="main">' +
      '<header class="header">' +
      '<h1 id="focus" tabindex="-1">' + esc(title) + '</h1>' +
      '<div class="header-right">' +
      statusPill(S.me.status) +
      roleBadge(S.me.role) +
      '</div>' +
      '</header>' +
      '<div class="content">' + inner + '</div>' +
      '</main></div>';
  }

  function dashboard(S) {
    var me = S.me;
    var cards = '';
    H.MODULES.forEach(function (m) {
      var ok = H.hasAnyRight(me, m.id);
      cards += '<div class="dash-card' + (ok ? '' : ' locked') + '">' +
        '<div class="dash-icon">' + ic(m.icon, 24) + '</div>' +
        '<h3>' + esc(m.name) + '</h3>' +
        '<p>' + (ok ? 'Access granted. Open module for records.' : 'No rights assigned for this module.') + '</p>' +
        '<button type="button" class="btn ' + (ok ? 'btn-outline' : 'btn-ghost') + '" data-act="' + (ok ? 'stub' : '') + '" data-arg="' + esc(m.name) + '">' + (ok ? 'Open' : 'Locked') + '</button>' +
        '</div>';
    });

    if (me.role !== 'User') {
      cards += '<div class="dash-card">' +
        '<div class="dash-icon">' + ic('audit', 24) + '</div>' +
        '<h3>Audit Log</h3>' +
        '<p>Append-only trail of additions, edits, deletions and restores.</p>' +
        '<button type="button" class="btn btn-outline" data-act="stub" data-arg="Audit Log">Open</button>' +
        '</div>';
    }

    var inner = '' +
      '<div class="welcome-banner">' +
      '<h2>Welcome back, ' + esc(me.first) + '.</h2>' +
      '<p>You are signed in as <b>' + esc(me.role) + '</b> with status <b>' + esc(me.status) + '</b>.</p>' +
      '</div>' +
      '<div class="dash-grid">' + cards + '</div>';
    return shell(S, 'dashboard', 'Dashboard', inner);
  }

  function users(S) {
    var list = H.visibleUsers(S.me, S.users);
    var counts = { all: list.length, Active: 0, Pending: 0, Blocked: 0, Disapproved: 0 };
    list.forEach(function (u) { if (counts[u.status] !== undefined) counts[u.status]++; });
    var filtered = list.filter(function (u) { return S.filter === 'all' || u.status === S.filter; });

    var tabs = ['all', 'Active', 'Pending', 'Blocked', 'Disapproved'].map(function (tab) {
      return '<button type="button" class="tab' + (S.filter === tab ? ' on' : '') + '" data-act="filter" data-arg="' + tab + '">' +
        (tab === 'all' ? 'All accounts' : esc(tab)) + '<span class="count">' + counts[tab] + '</span></button>';
    }).join('');

    var rows = filtered.map(function (u) {
      var manage = H.canManage(S.me, u);
      var status = u.status;
      var actions = '';
      if (manage) {
        if (status === 'Pending') {
          actions += '<button type="button" class="btn btn-xs btn-primary" data-act="approve" data-arg="' + u.id + '">Approve</button>';
          actions += '<button type="button" class="btn btn-xs btn-outline" data-act="disapprove" data-arg="' + u.id + '">Disapprove</button>';
        } else if (status === 'Active') {
          actions += '<button type="button" class="btn btn-xs btn-outline" data-act="block" data-arg="' + u.id + '">Block</button>';
        } else {
          actions += '<button type="button" class="btn btn-xs btn-outline" data-act="unblock" data-arg="' + u.id + '">Unblock</button>';
        }
        actions += '<button type="button" class="btn btn-xs btn-ghost" data-act="edit" data-arg="' + u.id + '">Edit</button>';
        if (H.canRights(S.me, u)) {
          actions += '<button type="button" class="btn btn-xs btn-ghost" data-act="rights" data-arg="' + u.id + '">Rights</button>';
        }
      } else {
        actions += '<span class="muted">-</span>';
      }
      return '<tr>' +
        '<td><div class="user-cell">' + avatar(u, true) + '<div><b>' + esc(H.fullName(u)) + '</b><span>' + esc(u.email) + '</span></div></div></td>' +
        '<td>' + roleBadge(u.role) + '</td>' +
        '<td>' + statusPill(status) + '</td>' +
        '<td><div class="row-actions">' + actions + '</div></td>' +
        '</tr>';
    }).join('');

    var logRows = S.log.slice(0, 5).map(function (l) {
      return '<li><span>' + esc(l.time) + '</span>' + esc(l.text) + '</li>';
    }).join('');

    var inner = '<section class="s2-card">' +
      '<div class="users-toolbar"><div class="tabs">' + tabs + '</div></div>' +
      '<div class="table-wrap"><table class="table">' +
      '<thead><tr><th>User</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="4" class="empty">No accounts match this filter.</td></tr>') + '</tbody>' +
      '</table></div>' +
      (logRows ? '<div class="audit-log"><h3>Recent Activity Log</h3><ul>' + logRows + '</ul></div>' : '') +
      '</section>';
    return shell(S, 'users', 'User Management', inner);
  }

  function modal(S) {
    if (!S.modal) return '';
    var type = S.modal.type;
    var target = H.byId(S.users, S.modal.id);
    if (!target) return '';

    if (type === 'myrights') {
      return modalShell('My Rights (' + (target.rights || []).length + ' of ' + H.TOTAL_RIGHTS + ')', '', rightsChecklist(target, false));
    }

    if (type === 'edit') {
      var canRole = H.canChangeRole(S.me, target);
      var canStat = H.canChangeStatus(S.me, target);
      var body = '' +
        '<form data-form="edit" data-id="' + target.id + '" novalidate>' +
        '<div class="two-col">' +
        '<div class="field"><label for="ef-first">First name</label><input class="input" id="ef-first" value="' + esc(target.first) + '" required></div>' +
        '<div class="field"><label for="ef-last">Last name</label><input class="input" id="ef-last" value="' + esc(target.last) + '" required></div>' +
        '</div>' +
        '<div class="field"><label for="ef-email">Email address</label><input class="input" id="ef-email" type="email" value="' + esc(target.email) + '" required></div>' +
        (canRole ? '<div class="field"><label for="ef-role">Role</label><select class="input" id="ef-role">' + H.ROLES.filter(function (r) { return r !== 'Superadmin'; }).map(function (r) { return '<option value="' + r + '"' + (target.role === r ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select></div>' : '') +
        (canStat ? '<div class="field"><label for="ef-status">Status</label><select class="input" id="ef-status">' + H.STATUSES.map(function (st) { return '<option value="' + st + '"' + (target.status === st ? ' selected' : '') + '>' + st + '</option>'; }).join('') + '</select></div>' : '') +
        '<div class="msg msg-err" id="form-error" role="alert" hidden></div>' +
        '<div class="modal-foot"><button type="button" class="btn btn-outline" data-act="close">Cancel</button><button type="submit" class="btn btn-primary">Save changes</button></div>' +
        '</form>';
      return modalShell('Edit Account - ' + H.fullName(target), '', body);
    }

    if (type === 'rights') {
      return '' +
        '<div class="overlay" data-act="overlay">' +
        '<div class="modal modal-lg" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
        '<div class="modal-head"><h2 id="modal-title">Edit Rights: ' + esc(H.fullName(target)) + '</h2><button type="button" class="btn-icon" data-act="close" aria-label="Close">' + ic('x', 18) + '</button></div>' +
        '<form data-form="rights" data-id="' + target.id + '" novalidate>' +
        '<div class="modal-body">' + rightsChecklist(target, true) + '</div>' +
        '<div class="modal-foot"><span class="muted"><b id="rcount">' + (target.rights || []).length + '</b> of ' + H.TOTAL_RIGHTS + ' rights selected</span><div class="row"><button type="button" class="btn btn-outline" data-act="close">Cancel</button><button type="submit" class="btn btn-primary">Save rights</button></div></div>' +
        '</form></div></div>';
    }

    return '';
  }

  function modalShell(title, sub, body) {
    return '' +
      '<div class="overlay" data-act="overlay">' +
      '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
      '<div class="modal-head"><h2 id="modal-title">' + esc(title) + '</h2><button type="button" class="btn-icon" data-act="close" aria-label="Close">' + ic('x', 18) + '</button></div>' +
      (sub ? '<div class="modal-sub">' + esc(sub) + '</div>' : '') +
      '<div class="modal-body">' + body + '</div>' +
      '</div></div>';
  }

  function rightsChecklist(target, editable) {
    var uRights = target.rights || [];
    return H.MODULES.map(function (m) {
      var modBoxes = m.items.map(function (_, i) { return H.rightKey(m, i); });
      var hasAll = modBoxes.every(function (k) { return uRights.indexOf(k) > -1; });
      var hasSome = modBoxes.some(function (k) { return uRights.indexOf(k) > -1; });
      var headerCheck = hasAll ? ' checked' : '';
      var checkboxes = m.items.map(function (itemName, i) {
        var k = H.rightKey(m, i);
        var checked = uRights.indexOf(k) > -1 ? ' checked' : '';
        return '<label class="check-item"><input type="checkbox" data-right="' + k + '"' + checked + (editable ? '' : ' disabled') + '><span>' + esc(itemName) + '</span></label>';
      }).join('');

      return '<div class="right-group" data-mod="' + m.id + '">' +
        '<div class="right-group-head">' +
        '<label><b>' + esc(m.name) + '</b></label>' +
        (editable ? '<div class="row"><button type="button" class="link" data-act="modall" data-arg="' + m.id + '">All</button><span>·</span><button type="button" class="link" data-act="modnone" data-arg="' + m.id + '">None</button><input type="checkbox" data-modbox="' + m.id + '"' + headerCheck + (hasSome && !hasAll ? ' data-ind="1"' : '') + ' style="margin-left:8px;" aria-label="Select all ' + esc(m.name) + ' rights"></div>' : '') +
        '</div>' +
        '<div class="right-grid">' + checkboxes + '</div>' +
        '</div>';
    }).join('');
  }

  H.views = {
    landing: landing,
    register: register,
    login: login,
    reset: reset,
    dashboard: dashboard,
    users: users,
    modal: modal
  };

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var appEl = document.getElementById('app');
  var toastEl = document.getElementById('toast');
  var toastTimer = null;

  var S = {
    screen: 'landing',
    me: null,
    users: H.loadUsersLocal(),
    filter: 'all',
    modal: null,
    flash: null,
    resetSent: null,
    isPasswordUpdate: false,
    log: []
  };
  H.S = S;

  var TITLES = {
    landing: 'Hope, Inc. ERP',
    register: 'Create account · Hope, Inc. ERP',
    login: 'Sign in · Hope, Inc. ERP',
    reset: 'Reset password · Hope, Inc. ERP',
    dashboard: 'Dashboard · Hope, Inc. ERP',
    users: 'User Management · Hope, Inc. ERP'
  };

  function persist() { H.saveUsersLocal(S.users); }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove('err');
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 3200);
  }

  function now() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function addLog(text) { S.log.unshift({ time: now(), text: text }); }

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function formError(msg) {
    var el = document.getElementById('form-error');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
  }

  function deny() { toast('You do not have permission for that action.'); }

  function render() {
    var V = H.views, html;
    if ((S.screen === 'dashboard' || S.screen === 'users') && !S.me) S.screen = 'login';
    if (S.modal) {
      var t = H.byId(S.users, S.modal.id);
      var ok = S.modal.type === 'myrights' ? !!S.me
        : S.modal.type === 'edit' ? (t && H.canManage(S.me, t))
        : (t && H.canRights(S.me, t));
      if (!ok) S.modal = null;
    }
    switch (S.screen) {
      case 'register': html = V.register(S); break;
      case 'login': html = V.login(S); break;
      case 'reset': html = V.reset(S); break;
      case 'dashboard': html = V.dashboard(S); break;
      case 'users': html = V.users(S); break;
      default: html = V.landing(S);
    }
    appEl.innerHTML = html + V.modal(S);
    document.title = TITLES[S.screen] || TITLES.landing;
    if (S.modal && S.modal.type === 'rights') syncRights();
    if (typeof H.onAfterRender === 'function') H.onAfterRender(S);
  }
  H.render = render;

  function go(to) {
    S.screen = to;
    S.modal = null;
    if (to !== 'login') S.flash = null;
    if (to !== 'reset') S.resetSent = null;
    render();
    window.scrollTo(0, 0);
    var f = document.getElementById('focus');
    if (f) f.focus({ preventScroll: true });
  }
  H.go = go;

  function openModal(modal) {
    S.modal = modal;
    render();
    var first = appEl.querySelector('.modal input:not([type=checkbox]), .modal select, .modal button');
    if (first) first.focus();
  }

  function closeModal() { S.modal = null; render(); }

  function syncRights() {
    var total = 0;
    H.MODULES.forEach(function (m) {
      var boxes = appEl.querySelectorAll('[data-mod="' + m.id + '"] input[data-right]');
      var head = appEl.querySelector('input[data-modbox="' + m.id + '"]');
      var n = 0;
      Array.prototype.forEach.call(boxes, function (b) { if (b.checked) n++; });
      total += n;
      if (head) {
        head.checked = n === boxes.length && n > 0;
        head.indeterminate = n > 0 && n < boxes.length;
      }
    });
    var c = document.getElementById('rcount');
    if (c) c.textContent = total;
  }

  function setModule(id, on) {
    Array.prototype.forEach.call(appEl.querySelectorAll('[data-mod="' + id + '"] input[data-right]'), function (b) { b.checked = on; });
    syncRights();
  }

  // --- Real Supabase Auth Handlers
  async function doLogin() {
    var email = val('l-email').toLowerCase(), pw = document.getElementById('l-pw') ? document.getElementById('l-pw').value : '';
    if (!email || !pw) return formError('Enter your email and password.');
    if (db) {
      var authRes = await db.auth.signInWithPassword({ email: email, password: pw });
      if (authRes.error) {
        console.error('Supabase Auth error:', authRes.error);
        var demoMatch = S.users.find(function (x) {
          return x.email.toLowerCase() === email && email.endsWith('@hope.com') && pw === 'password123';
        });
        if (demoMatch) {
          var blockedDemo = H.signInBlocker(demoMatch);
          if (blockedDemo) return formError(blockedDemo);
          S.me = demoMatch;
          H.saveSession(demoMatch);
          go('dashboard');
          return;
        }
        return formError(authRes.error.message || 'Invalid email or password.');
      }
      var userRes = await db.from('app_users').select('*').ilike('email', email).maybeSingle();
      if (userRes.data) {
        var u = userRes.data;
        var blocked = H.signInBlocker(u);
        if (blocked) {
          await db.auth.signOut();
          return formError(blocked);
        }
        S.me = u;
        H.saveSession(u);
        var idx = S.users.findIndex(function (x) { return x.id === u.id




                                    /* ==========================================================================
   SPRINT 4: Sales, Payments, Reports & Audit Log
   Plugs into window.HopeERP without modifying existing Sprint 1-3 code.
   ========================================================================== */
(function (window) {
  'use strict';
  var H = window.HopeERP;
  if (!H) return;

  var db = window.supabaseClient;
  var esc = H.esc;
  var S = null;
  var S4_KEY = 'hope_erp_sprint4_v1';
  var toastTimer = null;
  var searchTimer = null;

  var oDash = H.views.dashboard;
  var oUsers = H.views.users;
  H.views.dashboard = function (s) { S = s; return oDash(s); };
  H.views.users = function (s) { S = s; return oUsers(s); };

  var REPORTS_DEF = [
    { id: 'top_customers', name: 'Top Customers', right: 'reports:0', desc: 'Who buys the most?' },
    { id: 'product_master', name: 'Product Master List', right: 'reports:1', desc: 'What do we sell, at what current price?' },
    { id: 'top_products', name: 'Top Products', right: 'reports:2', desc: 'Which products earn the most (quantity and amount)?' },
    { id: 'active_employees', name: 'Active Employees', right: 'reports:3', desc: 'Who works here now? (no separation date)' },
    { id: 'all_employees', name: 'All Employees', right: 'reports:4', desc: 'Everyone, including those who left' },
    { id: 'emp_history', name: 'Employee Job History', right: 'reports:5', desc: "How did one person's job and salary change?" },
    { id: 'top_sales', name: 'Top Sales', right: 'reports:6', desc: 'Which single sales are the biggest?' }
  ];

  var I = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6 18 18M18 6 6 18"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/>',
    check: '<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>'
  };

  function ic(name, size) {
    size = size || 18;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (I[name] || '') + '</svg>';
  }

  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  }
  function ts() {
    var d = new Date(), h = d.getHours();
    return today() + ' ' + (h % 12 || 12) + ':' + p2(d.getMinutes()) + ' ' + (h < 12 ? 'AM' : 'PM');
  }
  function money(n) {
    return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function adm() { return !!(S && S.me && S.me.role !== 'User'); }
  function can(r) {
    if (!S || !S.me) return false;
    if (S.me.role !== 'User') return true;
    return (S.me.rights || []).indexOf(r) > -1;
  }
  function toast(msg, err) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('err', !!err);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, err ? 5000 : 3000);
  }
  function stamp(s) {
    var m = /^(.*?) (\d{4}-\d{2}-\d{2} .*)$/.exec(s || '');
    return m ? '<span class="stamp"><b>' + esc(m[1]) + '</b><br>' + esc(m[2]) + '</span>' : esc(s || '-');
  }

  /* Access Sprint 2 & Sprint 3 local collections seamlessly for calculations & reports */
  function getSalesDataStore() {
    var custs = [], prods = [], prices = [];
    try {
      if (window.localStorage.getItem('hope_erp_s2_v1')) {
        var s2 = JSON.parse(window.localStorage.getItem('hope_erp_s2_v1'));
        custs = s2.customers || [];
        prods = s2.products || [];
        prices = s2.prices || [];
      }
    } catch (e) {}
    if (!custs.length) {
      custs = [
        { custno: 'C0001', custname: 'Globus Medical, Inc', address: '2560 Gen Armistead Ave Audubon CA 94031', payterm: '30D', is_deleted: false },
        { custno: 'C0003', custname: 'Trisha Macdowell', address: '7642 Clairemont Mesa Blvd San Diego CA 90321', payterm: 'COD', is_deleted: false },
        { custno: 'C0004', custname: 'HMS Holdings, Inc', address: '1000 So Fremont Ave Alhambra CA 91303', payterm: '45D', is_deleted: true },
        { custno: 'C0009', custname: 'Landec Corp.', address: '3603 Haven Avenue Menlo Park CA 94025', payterm: '30D', is_deleted: false },
        { custno: 'C0046', custname: 'Oxford Academy', address: 'Cypress CA 90630', payterm: '30D', is_deleted: false },
        { custno: 'C0077', custname: 'Office NY Tech Serv', address: 'New York NY', payterm: '30D', is_deleted: false },
        { custno: 'C0078', custname: 'FDA New York', address: 'New York NY', payterm: '30D', is_deleted: false },
        { custno: 'C0080', custname: 'Social Sec Admn CA', address: 'Sacramento CA', payterm: '30D', is_deleted: false },
        { custno: 'C0081', custname: 'Dept Food and Agri', address: 'Sacramento CA', payterm: '30D', is_deleted: false },
        { custno: 'C0082', custname: 'California Dept Tech', address: 'Sacramento CA', payterm: '30D', is_deleted: false }
      ];
    }
    if (!prods.length) {
      prods = [
        { prodcode: 'AD0001', description: 'Toshiba Canvio 1 TB', unit: 'ea', is_deleted: false },
        { prodcode: 'NB0001', description: 'Dell Inspiron Laptop', unit: 'ea', is_deleted: false },
        { prodcode: 'NB0005', description: 'Apple Mac Pro Laptop', unit: 'ea', is_deleted: false },
        { prodcode: 'PC0002', description: 'Dell 745 Opti Desk', unit: 'pc', is_deleted: false },
        { prodcode: 'PC0004', description: 'Dell Inspiron 660', unit: 'pc', is_deleted: false },
        { prodcode: 'PR0001', description: 'Epson Expression', unit: 'pc', is_deleted: false },
        { prodcode: 'PS0001', description: 'VirServ 12Core 128GB', unit: 'ea', is_deleted: false },
        { prodcode: 'MP0003', description: 'SAMSUNG GALAXY S4', unit: 'ea', is_deleted: false }
      ];
    }
    if (!prices.length) {
      prices = [
        { prodcode: 'AD0001', effdate: '2010-01-01', unitprice: 58.00, is_deleted: false },
        { prodcode: 'NB0001', effdate: '2010-01-01', unitprice: 300.00, is_deleted: false },
        { prodcode: 'NB0005', effdate: '2010-01-01', unitprice: 1184.72, is_deleted: false },
        { prodcode: 'PC0002', effdate: '2010-01-01', unitprice: 196.78, is_deleted: false },
        { prodcode: 'PC0004', effdate: '2010-01-01', unitprice: 538.00, is_deleted: false },
        { prodcode: 'PR0001', effdate: '2010-01-01', unitprice: 81.72, is_deleted: false },
        { prodcode: 'PS0001', effdate: '2010-01-01', unitprice: 3200.00, is_deleted: false },
        { prodcode: 'MP0003', effdate: '2010-01-01', unitprice: 425.00, is_deleted: false }
      ];
    }

    var hr = { jobs: [], depts: [], emps: [], hist: [] };
    try {
      if (window.localStorage.getItem('hope_erp_hr_v1')) {
        hr = JSON.parse(window.localStorage.getItem('hope_erp_hr_v1'));
      }
    } catch (e) {}
    if (!hr.emps || !hr.emps.length) {
      hr = {
        jobs: [
          { jobcode: 'PRES', jobdesc: 'President' },
          { jobcode: 'VP', jobdesc: 'Vice president' },
          { jobcode: 'MGR', jobdesc: 'Manager' },
          { jobcode: 'SA1', jobdesc: 'Sales Agent 1' },
          { jobcode: 'SA2', jobdesc: 'Sales Agent 2' },
          { jobcode: 'PR1', jobdesc: 'Programmer 1' },
          { jobcode: 'ANL', jobdesc: 'Analyst' }
        ],
        depts: [
          { deptcode: 'ACT', deptname: 'Accounting' },
          { deptcode: 'BR1', deptname: 'Sales Branch 1' },
          { deptcode: 'EXC', deptname: 'Executive' },
          { deptcode: 'IT', deptname: 'Information Tech' }
        ],
        emps: [
          { empno: '00001', lastname: 'Smith', firstname: 'John', gender: 'M', birthdate: '1985-02-20', hiredate: '2010-05-11', sepdate: '' },
          { empno: '00005', lastname: 'King', firstname: 'Don', gender: 'M', birthdate: '1986-02-14', hiredate: '2010-06-23', sepdate: '' },
          { empno: '00007', lastname: 'Jenskin', firstname: 'Floyd', gender: 'M', birthdate: '1990-02-20', hiredate: '2010-05-30', sepdate: '' },
          { empno: '00015', lastname: 'Zulueta', firstname: 'Maggie', gender: 'F', birthdate: '1990-08-03', hiredate: '2010-07-05', sepdate: '2011-03-30' }
        ],
        hist: [
          { empno: '00001', jobcode: 'PR1', deptcode: 'IT', effdate: '2010-05-11', salary: 48000, del: false },
          { empno: '00005', jobcode: 'SA1', deptcode: 'BR1', effdate: '2010-06-23', salary: 36000, del: false },
          { empno: '00005', jobcode: 'SA2', deptcode: 'BR1', effdate: '2011-01-02', salary: 38000, del: false },
          { empno: '00007', jobcode: 'ANL', deptcode: 'IT', effdate: '2010-05-30', salary: 55000, del: false },
          { empno: '00015', jobcode: 'SA1', deptcode: 'BR1', effdate: '2010-07-05', salary: 36000, del: false }
        ]
      };
    }

    return { customers: custs, products: prods, prices: prices, hr: hr };
  }

  function seedS4() {
    var st = 'ADD system 2026-10-12 09:00 AM';
    return {
      sales: [
        { transno: 'TR000002', saledate: '2010-07-05', custno: 'C0003', empno: '00005', is_deleted: false, stamp: st },
        { transno: 'TR000004', saledate: '2010-07-07', custno: 'C0004', empno: '00005', is_deleted: true, stamp: 'DELETE Lisa Park 2026-11-06 10:02 AM' },
        { transno: 'TR000104', saledate: '2011-03-30', custno: 'C0009', empno: '00005', is_deleted: false, stamp: st },
        { transno: 'TR000120', saledate: '2011-04-10', custno: 'C0078', empno: '00005', is_deleted: false, stamp: st },
        { transno: 'TR000123', saledate: '2011-04-12', custno: 'C0081', empno: '00005', is_deleted: false, stamp: st },
        { transno: 'TR000124', saledate: '2011-04-15', custno: 'C0082', empno: '00005', is_deleted: false, stamp: st }
      ],
      lines: [
        { transno: 'TR000002', prodcode: 'NB0001', qty: 5, unitprice: 300.00, is_deleted: false, stamp: st },
        { transno: 'TR000002', prodcode: 'PR0001', qty: 1, unitprice: 81.72, is_deleted: false, stamp: st },
        { transno: 'TR000104', prodcode: 'PC0004', qty: 7, unitprice: 538.00, is_deleted: false, stamp: st },
        { transno: 'TR000104', prodcode: 'PR0001', qty: 16, unitprice: 81.72, is_deleted: false, stamp: st },
        { transno: 'TR000120', prodcode: 'PS0001', qty: 32, unitprice: 3240.88, is_deleted: false, stamp: st },
        { transno: 'TR000123', prodcode: 'NB0005', qty: 35, unitprice: 1197.11, is_deleted: false, stamp: st },
        { transno: 'TR000124', prodcode: 'PC0004', qty: 33, unitprice: 541.61, is_deleted: false, stamp: st }
      ],
      payments: [
        { orno: 'OR000002', transno: 'TR000002', paydate: '2010-07-05', amount: 1581.72, is_deleted: false, stamp: st },
        { orno: 'OR000154', transno: 'TR000104', paydate: '2011-04-30', amount: 3000.00, is_deleted: false, stamp: st },
        { orno: 'OR000120', transno: 'TR000120', paydate: '2011-04-10', amount: 103708.17, is_deleted: false, stamp: st },
        { orno: 'OR000123', transno: 'TR000123', paydate: '2011-04-12', amount: 41898.90, is_deleted: false, stamp: st },
        { orno: 'OR000124', transno: 'TR000124', paydate: '2011-04-15', amount: 17872.99, is_deleted: false, stamp: st }
      ],
      audit: [
        { id: 1, when: '2026-11-07 2:30 PM', action: 'DELETE', table: 'salesdetail', record: 'TR000010 | AP0001', by: 'Lisa Park', changes: [{ col: 'QUANTITY', before: '2', after: 'deleted' }] },
        { id: 2, when: '2026-11-06 10:02 AM', action: 'DELETE', table: 'sales', record: 'TR000004', by: 'Lisa Park', changes: [{ col: 'STATUS', before: 'Active', after: 'Inactive' }] },
        { id: 3, when: '2026-11-05 10:20 AM', action: 'EDIT', table: 'customer', record: 'C0007', by: 'David Kim', changes: [{ col: 'PAYTERM', before: 'COD', after: '30D' }] },
        { id: 4, when: '2026-11-05 10:20 AM', action: 'EDIT', table: 'employee', record: '00007', by: 'David Kim', changes: [{ col: 'LASTNAME', before: 'Jenkins', after: 'Jenskin' }] }
      ]
    };
  }

  var D4;
  try { D4 = JSON.parse(window.localStorage.getItem(S4_KEY)); } catch (e) { D4 = null; }
  if (!D4 || !Array.isArray(D4.sales)) D4 = seedS4();

  function saveS4() {
    try { window.localStorage.setItem(S4_KEY, JSON.stringify(D4)); } catch (e) {}
  }

  function pushAudit(action, tableName, recordKey, changes) {
    var by = S && S.me ? H.fullName(S.me) : 'system';
    var nextId = D4.audit.reduce(function (m, x) { return Math.max(m, x.id || 0); }, 0) + 1;
    D4.audit.unshift({
      id: nextId,
      when: ts(),
      action: action,
      table: tableName,
      record: recordKey,
      by: by,
      changes: changes || []
    });
    saveS4();
  }

  var V4 = {
    view: 'sales', /* 'sales' | 'reports' | 'audit' */
    tab: 'active',
    payFilter: 'all',
    q: '',
    page: 1,
    perPage: 20,
    dlg: null, /* { kind: 'saleForm'|'saleDetails'|'confirm', ... } */
    repId: 'top_customers',
    repFilters: {
      from: '2010-06-27',
      to: '2020-10-25',
      topN: 5,
      empno: '00005'
    },
    repRan: true,
    auditFilters: {
      table: 'all',
      action: 'all',
      by: '',
      record: '',
      from: '',
      to: '',
      expandedId: null
    }
  };

  function priceOnDate(prodcode, dateStr, pricesList) {
    var list = (pricesList || getSalesDataStore().prices).filter(function (p) {
      return p.prodcode === prodcode && !p.is_deleted && (!dateStr || p.effdate <= dateStr);
    }).sort(function (a, b) {
      return a.effdate < b.effdate ? 1 : a.effdate > b.effdate ? -1 : 0;
    });
    return list[0] ? Number(list[0].unitprice) : 0;
  }

  function calcSale(sale) {
    var activeLines = D4.lines.filter(function (l) {
      return l.transno === sale.transno && !l.is_deleted;
    });
    var activePays = D4.payments.filter(function (p) {
      return p.transno === sale.transno && !p.is_deleted;
    });
    var total = sale.is_deleted ? 0 : activeLines.reduce(function (sum, l) {
      var unitPrice = l.unitprice != null ? Number(l.unitprice) : priceOnDate(l.prodcode, sale.saledate);
      return sum + (Number(l.qty) || 0) * unitPrice;
    }, 0);
    var paid = activePays.reduce(function (sum, p) {
      return sum + (Number(p.amount) || 0);
    }, 0);
    var balance = total - paid;
    var status = 'No lines';
    var chipClass = 'p-none';

    if (activeLines.length === 0 && total === 0) {
      status = 'No lines';
      chipClass = 'p-none';
    } else if (Math.abs(balance) < 0.005) {
      status = 'Paid';
      chipClass = 'p-paid';
    } else if (balance < 0) {
      status = 'Overpaid';
      chipClass = 'p-overpaid';
    } else if (paid > 0) {
      status = 'Partial';
      chipClass = 'p-partial';
    } else {
      status = 'Unpaid';
      chipClass = 'p-unpaid';
    }

    return {
      total: Number(total.toFixed(2)),
      paid: Number(paid.toFixed(2)),
      balance: Number(balance.toFixed(2)),
      status: status,
      chipClass: chipClass,
      lineCount: activeLines.length,
      payCount: activePays.length
    };
  }

  function paymentChip(calc, isDeleted) {
    if (isDeleted) return '<span class="pchip p-none">-</span>';
    return '<span class="pchip ' + calc.chipClass + '">' + esc(calc.status) + '</span>';
  }

  function custLabel(custno, store) {
    var c = (store || getSalesDataStore()).customers.filter(function (x) { return x.custno === custno; })[0];
    return c ? c.custname : custno;
  }

  function empLabel(empno, store) {
    var e = (store || getSalesDataStore()).hr.emps.filter(function (x) { return x.empno === empno; })[0];
    return e ? (e.firstname + ' ' + e.lastname) : empno;
  }

  function nextTransNo() {
    var maxNum = D4.sales.reduce(function (m, s) {
      var n = parseInt(String(s.transno || '').replace(/\D/g, ''), 10) || 0;
      return Math.max(m, n);
    }, 0);
    return 'TR' + ('000000' + (maxNum + 1)).slice(-6);
  }

  function nextOrNo() {
    var maxNum = D4.payments.reduce(function (m, p) {
      var n = parseInt(String(p.orno || '').replace(/\D/g, ''), 10) || 0;
      return Math.max(m, n);
    }, 165);
    return 'OR' + ('000000' + (maxNum + 1)).slice(-6);
  }

  /* Ensure Sales, Reports, and Audit Log appear in sidebar */
  function syncSidebarNav() {
    if (!S || !S.me) return;
    var side = document.querySelector('.side');
    if (!side || side.querySelector('[data-s4-nav]')) return;

    var navs = Array.prototype.slice.call(side.querySelectorAll('.nav'));
    var adminLabel = Array.prototype.slice.call(side.querySelectorAll('.side-label')).filter(function (el) {
      return el.textContent.trim().toLowerCase() === 'administration';
    })[0];

    var salesBtn = document.createElement('button');
    salesBtn.type = 'button';
    salesBtn.className = 'nav';
    salesBtn.setAttribute('data-s4-nav', 'sales');
    salesBtn.innerHTML = ic('box', 20) + '<span>Sales</span>';

    var reportsBtn = document.createElement('button');
    reportsBtn.type = 'button';
    reportsBtn.className = 'nav';
    reportsBtn.setAttribute('data-s4-nav', 'reports');
    reportsBtn.innerHTML = ic('check', 20) + '<span>Reports</span>';

    var hrBtn = navs.filter(function (b) { return b.textContent.trim() === 'Human Resources'; })[0];
    if (hrBtn && hrBtn.parentNode) {
      hrBtn.insertAdjacentElement('afterend', salesBtn);
      salesBtn.insertAdjacentElement('afterend', reportsBtn);
    }

    if (adm() && adminLabel) {
      var auditBtn = document.createElement('button');
      auditBtn.type = 'button';
      auditBtn.className = 'nav';
      auditBtn.setAttribute('data-s4-nav', 'audit');
      auditBtn.innerHTML = ic('search', 20) + '<span>Audit Log</span>';
      adminLabel.insertAdjacentElement('afterend', auditBtn);
    }
  }

  function setActiveS4Nav(activeKey) {
    syncSidebarNav();
    Array.prototype.forEach.call(document.querySelectorAll('.side .nav'), function (btn) {
      var s4k = btn.getAttribute('data-s4-nav');
      var on = !!activeKey && s4k === activeKey;
      btn.classList.toggle('on', on);
      if (on) btn.setAttribute('aria-current', 'page');
      else if (s4k) btn.removeAttribute('aria-current');
    });
  }

  function roleHeaderBadge() {
    var role = S && S.me ? S.me.role : 'User';
    var cls = role === 'Superadmin' ? 'b-super' : role === 'Admin' ? 'b-admin' : 'b-user';
    return '<span class="badge ' + cls + '">' + esc(role) + '</span>';
  }

  /* ---------------- SALES LIST & NEW SALE ---------------- */
  function filteredSales() {
    var store = getSalesDataStore();
    var a = adm();
    var q = V4.q.trim().toLowerCase();

    return D4.sales
      .slice()
      .sort(function (x, y) { return x.transno < y.transno ? 1 : x.transno > y.transno ? -1 : 0; })
      .filter(function (s) {
        if (!a && s.is_deleted) return false;
        if (a) {
          if (V4.tab === 'active' && s.is_deleted) return false;
          if (V4.tab === 'inactive' && !s.is_deleted) return false;
        }
        var calc = calcSale(s);
        if (V4.payFilter !== 'all' && calc.status.toLowerCase() !== V4.payFilter) return false;
        if (!q) return true;
        var hay = [
          s.transno,
          s.saledate,
          s.custno,
          custLabel(s.custno, store),
          s.empno,
          empLabel(s.empno, store),
          calc.status
        ].join(' ').toLowerCase();
        return hay.indexOf(q) > -1;
      });
  }

  function salesTableHtml(rows, store) {
    var a = adm();
    var start = (V4.page - 1) * V4.perPage;
    var slice = rows.slice(start, start + V4.perPage);

    if (!slice.length) {
      return '<div class="s2-empty"><span class="icon-tile">' + ic('search', 24) + '</span>' +
        '<h3>No sales match</h3><p>Try another search or payment filter.</p>' +
        '<button type="button" class="btn btn-outline" data-s4="clear-sales">Clear search and filter</button></div>';
    }

    var head = '<th>TRANS NO</th><th>DATE</th><th>CUSTOMER · SOLD BY</th><th class="num">TOTAL</th><th class="num">BALANCE</th><th>PAYMENT</th>' +
      (a ? '<th>STATUS · LAST CHANGE</th>' : '') + '<th>ACTIONS</th>';

    var body = slice.map(function (s) {
      var calc = calcSale(s);
      var custName = custLabel(s.custno, store);
      var empName = empLabel(s.empno, store);
      var trNo = esc(s.transno);

      var acts = '<button type="button" class="btn btn-soft btn-xs" data-s4="details" data-a="' + trNo + '">Details</button>';
      if (s.is_deleted) {
        if (a) acts += '<button type="button" class="btn btn-soft btn-xs" data-s4="restore-sale" data-a="' + trNo + '">Restore</button>';
      } else {
        if (can('sales:1')) acts += '<button type="button" class="btn btn-outline btn-xs" data-s4="edit-sale" data-a="' + trNo + '">Edit</button>';
        if (can('sales:2')) acts += '<button type="button" class="btn btn-danger btn-xs" data-s4="del-sale" data-a="' + trNo + '">Delete</button>';
      }

      return '<tr class="' + (s.is_deleted ? 'row-del' : '') + '">' +
        '<td><code>' + trNo + '</code></td>' +
        '<td>' + esc(s.saledate) + '</td>' +
        '<td><b>' + esc(custName) + '</b><span class="subline">' + esc(s.custno) + ' · sold by ' + esc(empName) + '</span></td>' +
        '<td class="num">' + money(calc.total) + '</td>' +
        '<td class="num">' + (s.is_deleted ? '<span class="dash">—</span>' : money(calc.balance)) + '</td>' +
        '<td>' + paymentChip(calc, s.is_deleted) + '</td>' +
        (a ? '<td><span class="pill ' + (s.is_deleted ? 'st-inactive">Inactive' : 'st-active">Active') + '</span>' + stamp(s.stamp) + '</td>' : '') +
        '<td><div class="nowrap">' + acts + '</div></td>' +
        '</tr>';
    }).join('');

    return '<div class="table-wrap"><table class="dense"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  function renderSalesView() {
    var store = getSalesDataStore();
    var a = adm();
    var rows = filteredSales();
    var totalPages = Math.max(1, Math.ceil(rows.length / V4.perPage));
    if (V4.page > totalPages) V4.page = totalPages;

    var activeCnt = D4.sales.filter(function (x) { return !x.is_deleted; }).length;
    var inactiveCnt = D4.sales.filter(function (x) { return x.is_deleted; }).length;
    var allCnt = D4.sales.length;

    var tabsHtml = a
      ? '<div class="tabs" role="group" aria-label="Filter sales">' +
        [['active', 'Active (' + activeCnt + ')'], ['inactive', 'Inactive (' + inactiveCnt + ')'], ['all', 'All (' + allCnt + ')']].map(function (t) {
          return '<button type="button" class="tab" aria-pressed="' + (V4.tab === t[0]) + '" data-s4="tab" data-a="' + t[0] + '">' + t[1] + '</button>';
        }).join('') +
        '</div>'
      : '';

    var paySel = '<select class="s4-select" id="s4-pay" aria-label="Filter by payment status">' +
      [['all', 'All payments'], ['paid', 'Paid'], ['partial', 'Partial'], ['unpaid', 'Unpaid'], ['overpaid', 'Overpaid'], ['no lines', 'No lines']].map(function (o) {
        return '<option value="' + o[0] + '"' + (V4.payFilter === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') +
      '</select>';

    var addBtn = can('sales:0')
      ? '<button type="button" class="btn btn-primary" data-s4="new-sale">' + ic('plus', 18) + ' New Sale</button>'
      : '';

    var startIdx = rows.length ? (V4.page - 1) * V4.perPage + 1 : 0;
    var endIdx = Math.min(rows.length, V4.page * V4.perPage);

    var pagerHtml = rows.length
      ? '<div class="pager"><span>Showing ' + startIdx + '–' + endIdx + ' of ' + rows.length + ' sales</span>' +
        '<nav aria-label="Sales pages">' +
        '<button type="button" class="pg" data-s4="pg" data-a="prev"' + (V4.page <= 1 ? ' disabled' : '') + '>Previous</button>' +
        '<button type="button" class="pg" data-s4="pg" data-a="next"' + (V4.page >= totalPages ? ' disabled' : '') + '>Next</button>' +
        '</nav></div>'
      : '';

    var inner = '<section class="s2-card" aria-label="Sales">' +
      '<div><h2>Sales</h2><p class="s2-sub">' +
      (a ? 'Every sale, including deleted ones. A sale\'s total is calculated from its lines and the prices on its date.' : 'Active sales only. The buttons you have depend on your rights.') +
      '</p></div>' +
      '<div class="s4-toolbar">' + tabsHtml +
      '<div class="s4-filters">' + paySel +
      '<div class="search">' + ic('search', 18) +
      '<input id="s4-q" class="input" type="search" autocomplete="off" placeholder="Search sales..." aria-label="Search sales" value="' + esc(V4.q) + '">' +
      '</div>' + addBtn + '</div></div>' +
      '<div id="s4-sales-res">' + salesTableHtml(rows, store) + pagerHtml + '</div>' +
      '</section>';

    var main = document.querySelector('.main');
    if (main) {
      main.innerHTML = '<header class="header"><h1 id="focus" tabindex="-1">Sales Management</h1><div class="header-right">' + roleHeaderBadge() + '</div></header>' +
        '<div class="content">' + inner + '</div>';
    }
    setActiveS4Nav('sales');
    document.title = 'Sales Management — Hope, Inc. ERP';
  }

  /* ---------------- REPORTS (ALL 7 + PRINT/PDF) ---------------- */
  function buildReportSheet(repId) {
    var store = getSalesDataStore();
    var f = V4.repFilters;
    var genBy = S && S.me ? H.fullName(S.me) : 'System';
    var genAt = ts();

    var activeSales = D4.sales.filter(function (s) {
      return !s.is_deleted && (!f.from || s.saledate >= f.from) && (!f.to || s.saledate <= f.to);
    });
    var activeSaleMap = {};
    var periodGrandTotal = 0;
    activeSales.forEach(function (s) {
      var c = calcSale(s);
      activeSaleMap[s.transno] = s;
      periodGrandTotal += c.total;
    });

    var th = '', rowsHtml = '', totalRowHtml = '', footNote = '', rowCount = 0;

    if (repId === 'top_customers') {
      var mapC = {};
      activeSales.forEach(function (s) {
        var c = calcSale(s);
        if (!mapC[s.custno]) {
          mapC[s.custno] = { custno: s.custno, name: custLabel(s.custno, store), salesCount: 0, total: 0 };
        }
        mapC[s.custno].salesCount += 1;
        mapC[s.custno].total += c.total;
      });
      var listC = Object.keys(mapC).map(function (k) { return mapC[k]; })
        .sort(function (a, b) { return b.total - a.total; })
        .slice(0, Math.max(1, Math.min(100, parseInt(f.topN, 10) || 5)));
      var shownSum = listC.reduce(function (acc, r) { return acc + r.total; }, 0);
      rowCount = listC.length;

      th = '<th>RANK</th><th>CUST NO</th><th>CUSTOMER NAME</th><th class="num">SALES</th><th class="num">TOTAL SALES</th>';
      rowsHtml = listC.map(function (r, idx) {
        return '<tr><td>' + (idx + 1) + '</td><td><code>' + esc(r.custno) + '</code></td><td>' + esc(r.name) + '</td><td class="num">' + r.salesCount + '</td><td class="num">' + money(r.total) + '</td></tr>';
      }).join('');
      totalRowHtml = '<tr class="sheet-total-row"><td colspan="4">Total of the ' + rowCount + ' shown</td><td class="num">' + money(shownSum) + '</td></tr>';
      footNote = 'All active sales from ' + esc(f.from || 'start') + ' to ' + esc(f.to || 'end') + ' add up to ' + money(periodGrandTotal) + '. The rows shown are ' + money(shownSum) + ' of that.';
    } else if (repId === 'product_master') {
      var prods = store.products.filter(function (p) { return !p.is_deleted; });
      rowCount = prods.length;
      th = '<th>PROD CODE</th><th>DESCRIPTION</th><th>UNIT</th><th class="num">CURRENT PRICE</th>';
      rowsHtml = prods.map(function (p) {
        var curPrice = priceOnDate(p.prodcode, today(), store.prices);
        return '<tr><td><code>' + esc(p.prodcode) + '</code></td><td>' + esc(p.description) + '</td><td>' + esc(p.unit) + '</td><td class="num">' + (curPrice > 0 ? money(curPrice) : '—') + '</td></tr>';
      }).join('');
      footNote = 'Current price is the latest active price effective on or before ' + today() + '.';
    } else if (repId === 'top_products') {
      var mapP = {};
      D4.lines.forEach(function (l) {
        if (l.is_deleted || !activeSaleMap[l.transno]) return;
        var sObj = activeSaleMap[l.transno];
        var up = l.unitprice != null ? Number(l.unitprice) : priceOnDate(l.prodcode, sObj.saledate, store.prices);
        var amt = (Number(l.qty) || 0) * up;
        var pObj = store.products.filter(function (x) { return x.prodcode === l.prodcode; })[0];
        if (!mapP[l.prodcode]) {
          mapP[l.prodcode] = { prodcode: l.prodcode, desc: pObj ? pObj.description : l.prodcode, qty: 0, amount: 0 };
        }
        mapP[l.prodcode].qty += Number(l.qty) || 0;
        mapP[l.prodcode].amount += amt;
      });
      var listP = Object.keys(mapP).map(function (k) { return mapP[k]; })
        .sort(function (a, b) { return b.amount - a.amount; })
        .slice(0, Math.max(1, Math.min(100, parseInt(f.topN, 10) || 5)));
      var shownAmt = listP.reduce(function (acc, r) { return acc + r.amount; }, 0);
      rowCount = listP.length;

      th = '<th>RANK</th><th>PROD CODE</th><th>DESCRIPTION</th><th class="num">QTY SOLD</th><th class="num">AMOUNT</th>';
      rowsHtml = listP.map(function (r, idx) {
        return '<tr><td>' + (idx + 1) + '</td><td><code>' + esc(r.prodcode) + '</code></td><td>' + esc(r.desc) + '</td><td class="num">' + r.qty + '</td><td class="num">' + money(r.amount) + '</td></tr>';
      }).join('');
      totalRowHtml = '<tr class="sheet-total-row"><td colspan="4">Total of the ' + rowCount + ' shown</td><td class="num">' + money(shownAmt) + '</td></tr>';
      footNote = 'All active sales from ' + esc(f.from || 'start') + ' to ' + esc(f.to || 'end') + ' add up to ' + money(periodGrandTotal) + '.';
    } else if (repId === 'active_employees' || repId === 'all_employees') {
      var emps = store.hr.emps.filter(function (e) {
        return repId === 'all_employees' ? true : !e.sepdate;
      });
      rowCount = emps.length;
      th = repId === 'all_employees'
        ? '<th>EMP NO</th><th>NAME</th><th>JOB</th><th>DEPARTMENT</th><th>HIRED</th><th>SEPARATED</th>'
        : '<th>EMP NO</th><th>NAME</th><th>JOB</th><th>DEPARTMENT</th><th>HIRED</th>';
      rowsHtml = emps.map(function (e) {
        var hRows = (store.hr.hist || []).filter(function (h) { return h.empno === e.empno && !h.del; })
          .sort(function (a, b) { return a.effdate < b.effdate ? 1 : -1; });
        var latest = hRows[0] || {};
        var jObj = (store.hr.jobs || []).filter(function (j) { return j.jobcode === latest.jobcode; })[0];
        var dObj = (store.hr.depts || []).filter(function (d) { return d.deptcode === latest.deptcode; })[0];
        return '<tr><td><code>' + esc(e.empno) + '</code></td><td>' + esc(e.firstname + ' ' + e.lastname) + '</td>' +
          '<td>' + esc(jObj ? jObj.jobdesc : (latest.jobcode || '—')) + '</td>' +
          '<td>' + esc(dObj ? dObj.deptname : (latest.deptcode || '—')) + '</td>' +
          '<td>' + esc(e.hiredate) + '</td>' +
          (repId === 'all_employees' ? '<td>' + esc(e.sepdate || '—') + '</td>' : '') + '</tr>';
      }).join('');
      footNote = 'Employee count: ' + rowCount + '.';
    } else if (repId === 'emp_history') {
      var selEmp = store.hr.emps.filter(function (e) { return e.empno === f.empno; })[0] || store.hr.emps[0];
      var histList = (store.hr.hist || []).filter(function (h) { return selEmp && h.empno === selEmp.empno && !h.del; })
        .sort(function (a, b) { return a.effdate > b.effdate ? 1 : -1; });
      rowCount = histList.length;
      th = '<th>EFFECTIVE</th><th>JOB</th><th>DEPARTMENT</th><th class="num">SALARY (USD)</th><th>CHANGE</th>';
      rowsHtml = histList.map(function (h, idx) {
        var jObj = (store.hr.jobs || []).filter(function (j) { return j.jobcode === h.jobcode; })[0];
        var dObj = (store.hr.depts || []).filter(function (d) { return d.deptcode === h.deptcode; })[0];
        var chg = idx === 0 ? 'Joined' : (idx === histList.length - 1 ? 'Promotion (current)' : 'Update');
        return '<tr><td>' + esc(h.effdate) + '</td><td>' + esc(jObj ? jObj.jobdesc : h.jobcode) + '</td>' +
          '<td>' + esc(dObj ? dObj.deptname : h.deptcode) + '</td><td class="num">' + money(h.salary) + '</td><td>' + esc(chg) + '</td></tr>';
      }).join('');
      footNote = (selEmp ? (selEmp.firstname + ' ' + selEmp.lastname + ' · ' + selEmp.empno + ' · hired ' + selEmp.hiredate + '. ') : '') + 'Oldest row first.';
    } else if (repId === 'top_sales') {
      var salesRanked = activeSales.map(function (s) {
        return { sale: s, calc: calcSale(s) };
      }).sort(function (a, b) { return b.calc.total - a.calc.total; })
        .slice(0, Math.max(1, Math.min(100, parseInt(f.topN, 10) || 5)));
      var topSalesSum = salesRanked.reduce(function (acc, item) { return acc + item.calc.total; }, 0);
      rowCount = salesRanked.length;

      th = '<th>RANK</th><th>TRANS NO</th><th>DATE</th><th>CUSTOMER</th><th>SOLD BY</th><th class="num">TOTAL</th>';
      rowsHtml = salesRanked.map(function (item, idx) {
        return '<tr><td>' + (idx + 1) + '</td><td><code>' + esc(item.sale.transno) + '</code></td><td>' + esc(item.sale.saledate) + '</td>' +
          '<td>' + esc(custLabel(item.sale.custno, store)) + '</td><td>' + esc(empLabel(item.sale.empno, store)) + '</td>' +
          '<td class="num">' + money(item.calc.total) + '</td></tr>';
      }).join('');
      totalRowHtml = '<tr class="sheet-total-row"><td colspan="5">Total of the ' + rowCount + ' shown</td><td class="num">' + money(topSalesSum) + '</td></tr>';
      footNote = 'All active sales from ' + esc(f.from || 'start') + ' to ' + esc(f.to || 'end') + ' add up to ' + money(periodGrandTotal) + '.';
    }

    var def = REPORTS_DEF.filter(function (r) { return r.id === repId; })[0] || REPORTS_DEF[0];
    var criteriaText = (repId === 'top_customers' || repId === 'top_products' || repId === 'top_sales')
      ? 'From ' + esc(f.from || 'start') + ' to ' + esc(f.to || 'end') + ' · Top ' + (parseInt(f.topN, 10) || 5)
      : def.desc;

    return '<div class="rep-sheet" id="s4-print-sheet">' +
      '<div class="sheet-top"><div><div class="sheet-brand">HOPE, INC. ERP</div><h3>' + esc(def.name) + '</h3><div class="subline">' + criteriaText + '</div></div>' +
      '<div class="sheet-meta">Generated by ' + esc(genBy) + '<br>' + esc(genAt) + '</div></div>' +
      '<div class="table-wrap"><table class="dense"><thead><tr>' + th + '</tr></thead><tbody>' +
      (rowsHtml || '<tr><td colspan="6" class="empty">No records for the selected criteria.</td></tr>') +
      totalRowHtml + '</tbody></table></div>' +
      '<div class="sheet-foot"><span>' + footNote + '</span><span>' + rowCount + ' rows · Hope, Inc. ERP</span></div>' +
      '</div>';
  }

  function renderReportsView() {
    var store = getSalesDataStore();
    var currentDef = REPORTS_DEF.filter(function (r) { return r.id === V4.repId; })[0] || REPORTS_DEF[0];
    if (!can(currentDef.right)) {
      var firstAllowed = REPORTS_DEF.filter(function (r) { return can(r.right); })[0];
      if (firstAllowed) {
        V4.repId = firstAllowed.id;
        currentDef = firstAllowed;
      }
    }

    var leftList = '<aside class="rep-nav" aria-label="Reports list"><div class="rep-nav-title">REPORTS</div>' +
      REPORTS_DEF.map(function (r) {
        var allowed = can(r.right);
        var active = r.id === V4.repId;
        return '<button type="button" class="rep-item' + (active ? ' on' : '') + (!allowed ? ' locked' : '') + '"' +
          (!allowed ? ' disabled title="Locked — requires ' + esc(r.name) + ' right"' : ' data-s4="rep-pick" data-a="' + r.id + '"') + '>' +
          '<span>' + esc(r.name) + '</span>' + (!allowed ? ic('lock', 14) : '') + '</button>';
      }).join('') + '</aside>';

    var filterControls = '';
    if (V4.repId === 'top_customers' || V4.repId === 'top_products' || V4.repId === 'top_sales') {
      filterControls = '<div class="field"><label for="rf-from">From date</label><input class="input" id="rf-from" type="date" value="' + esc(V4.repFilters.from) + '"></div>' +
        '<div class="field"><label for="rf-to">To date</label><input class="input" id="rf-to" type="date" value="' + esc(V4.repFilters.to) + '"></div>' +
        '<div class="field"><label for="rf-topn">Top N</label><input class="input" id="rf-topn" type="number" min="1" max="100" value="' + esc(V4.repFilters.topN) + '"></div>';
    } else if (V4.repId === 'emp_history') {
      var empOpts = (store.hr.emps || []).map(function (e) {
        var label = e.lastname + ', ' + e.firstname + ' (' + e.empno + ')';
        return '<option value="' + esc(e.empno) + '"' + (V4.repFilters.empno === e.empno ? ' selected' : '') + '>' + esc(label) + '</option>';
      }).join('');
      filterControls = '<div class="field" style="flex:2 1 260px;"><label for="rf-emp">Employee</label><select class="s4-select" id="rf-emp" style="width:100%;">' + empOpts + '</select></div>';
    }

    var filterCard = '<section class="s2-card rep-card-controls">' +
      '<div class="rep-head"><div><h2>' + esc(currentDef.name) + '</h2><p class="s2-sub">' + esc(currentDef.desc) + '</p></div>' +
      '<div class="row"><button type="button" class="btn btn-outline" data-s4="print-rep">Print</button>' +
      '<button type="button" class="btn btn-primary" data-s4="pdf-rep">Save as PDF</button></div></div>' +
      '<div class="rep-filters">' + filterControls +
      '<div class="field" style="flex:0 0 auto;"><button type="button" class="btn btn-primary" data-s4="run-rep">Run report</button></div>' +
      '</div></section>';

    var sheetHtml = V4.repRan ? buildReportSheet(V4.repId) : '';

    var main = document.querySelector('.main');
    if (main) {
      main.innerHTML = '<header class="header"><h1 id="focus" tabindex="-1">Reports</h1><div class="header-right">' + roleHeaderBadge() + '</div></header>' +
        '<div class="content"><div class="rep-layout">' + leftList + '<div class="rep-main">' + filterCard + sheetHtml + '</div></div></div>';
    }
    setActiveS4Nav('reports');
    document.title = 'Reports — Hope, Inc. ERP';
  }

  /* ---------------- AUDIT LOG (ADMIN / SUPERADMIN ONLY) ---------------- */
  function filteredAudit() {
    var f = V4.auditFilters;
    var byQ = f.by.trim().toLowerCase();
    var recQ = f.record.trim().toLowerCase();

    return D4.audit.filter(function (entry) {
      if (f.table !== 'all' && entry.table !== f.table) return false;
      if (f.action !== 'all' && entry.action !== f.action) return false;
      if (byQ && String(entry.by || '').toLowerCase().indexOf(byQ) === -1) return false;
      if (recQ && String(entry.record || '').toLowerCase().indexOf(recQ) === -1) return false;
      var datePart = String(entry.when || '').slice(0, 10);
      if (f.from && datePart < f.from) return false;
      if (f.to && datePart > f.to) return false;
      return true;
    });
  }

  function renderAuditView() {
    if (!adm()) {
      renderSalesView();
      toast('Audit Log is restricted to Admin and Superadmin accounts.', true);
      return;
    }

    var f = V4.auditFilters;
    var rows = filteredAudit();

    var tbody = rows.length
      ? rows.map(function (entry) {
          var isOpen = f.expandedId === entry.id;
          var diffHtml = '';
          if (isOpen) {
            var chgRows = (entry.changes && entry.changes.length ? entry.changes : [{ col: 'RECORD', before: '—', after: entry.record }])
              .map(function (c) {
                return '<tr><td><code>' + esc(c.col) + '</code></td><td>' + esc(c.before) + '</td><td><b>' + esc(c.after) + '</b></td></tr>';
              }).join('');
            diffHtml = '<tr class="audit-diff-row"><td colspan="6"><div class="diff-box"><table class="dense"><thead><tr><th>COLUMN</th><th>BEFORE</th><th>AFTER</th></tr></thead><tbody>' + chgRows + '</tbody></table></div></td></tr>';
          }

          return '<tr>' +
            '<td>' + esc(entry.when) + '</td>' +
            '<td><span class="pill st-none">' + esc(entry.action) + '</span></td>' +
            '<td><code>' + esc(entry.table) + '</code></td>' +
            '<td><code>' + esc(entry.record) + '</code></td>' +
            '<td>' + esc(entry.by) + '</td>' +
            '<td><button type="button" class="btn btn-outline btn-xs" data-s4="toggle-diff" data-a="' + entry.id + '">' + (isOpen ? 'Hide' : 'Changes') + '</button></td>' +
            '</tr>' + diffHtml;
        }).join('')
      : '<tr><td colspan="6"><div class="s2-empty"><span class="icon-tile">' + ic('search', 24) + '</span>' +
        '<h3>No entries match</h3><p>Change or clear the filters to see more of the log.</p>' +
        '<button type="button" class="btn btn-outline" data-s4="clear-audit">Clear filters</button></div></td></tr>';

    var card = '<section class="s2-card" aria-label="Audit log">' +
      '<div><h2>Audit log</h2><p class="s2-sub">Every add, edit, delete and restore, newest first. The log is append-only: nobody can edit or remove an entry.</p></div>' +
      '<div class="audit-filters">' +
      '<div class="field"><label for="af-table">Table</label><select class="s4-select" id="af-table" style="width:100%;">' +
      [['all', 'All tables'], ['sales', 'sales'], ['salesdetail', 'salesdetail'], ['payment', 'payment'], ['customer', 'customer'], ['product', 'product'], ['employee', 'employee']].map(function (o) {
        return '<option value="' + o[0] + '"' + (f.table === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></div>' +
      '<div class="field"><label for="af-action">Action</label><select class="s4-select" id="af-action" style="width:100%;">' +
      [['all', 'All actions'], ['ADD', 'ADD'], ['EDIT', 'EDIT'], ['DELETE', 'DELETE'], ['RESTORE', 'RESTORE']].map(function (o) {
        return '<option value="' + o[0] + '"' + (f.action === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></div>' +
      '<div class="field"><label for="af-by">Done by</label><input class="input" id="af-by" placeholder="Name" value="' + esc(f.by) + '"></div>' +
      '<div class="field"><label for="af-rec">Record</label><input class="input" id="af-rec" placeholder="e.g. TR000093" value="' + esc(f.record) + '"></div>' +
      '<div class="field"><label for="af-from">From</label><input class="input" id="af-from" type="date" value="' + esc(f.from) + '"></div>' +
      '<div class="field"><label for="af-to">To</label><input class="input" id="af-to" type="date" value="' + esc(f.to) + '"></div>' +
      '</div>' +
      '<div class="table-wrap"><table class="dense"><thead><tr><th>WHEN</th><th>ACTION</th><th>TABLE</th><th>RECORD</th><th>BY</th><th>DETAILS</th></tr></thead><tbody>' + tbody + '</tbody></table></div>' +
      '<div class="pager"><span>Showing ' + rows.length + ' of ' + D4.audit.length + ' entries</span></div>' +
      '</section>';

    var main = document.querySelector('.main');
    if (main) {
      main.innerHTML = '<header class="header"><h1 id="focus" tabindex="-1">Audit Log</h1><div class="header-right">' + roleHeaderBadge() + '</div></header>' +
        '<div class="content">' + card + '</div>';
    }
    setActiveS4Nav('audit');
    document.title = 'Audit Log — Hope, Inc. ERP';
  }

  /* ---------------- SALE MODALS (NEW/EDIT SALE & SALE DETAILS) ---------------- */
  function renderS4Modal() {
    var host = document.getElementById('s4-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 's4-host';
      document.body.appendChild(host);
    }
    var dlg = V4.dlg;
    if (!dlg) {
      host.innerHTML = '';
      return;
    }

    var store = getSalesDataStore();

    if (dlg.kind === 'saleForm') {
      var isEdit = dlg.mode === 'edit';
      var saleDateVal = dlg.vals.saledate || today();
      var activeCusts = store.customers.filter(function (c) { return !c.is_deleted || c.custno === dlg.vals.custno; });
      var eligibleEmps = (store.hr.emps || []).filter(function (e) {
        if (e.empno === dlg.vals.empno) return true;
        if (e.hiredate && e.hiredate > saleDateVal) return false;
        if (e.sepdate && e.sepdate < saleDateVal) return false;
        return true;
      });

      var errCount = Object.keys(dlg.errs || {}).length;
      var errBanner = errCount
        ? '<div class="msg msg-err" role="alert">' + ic('alert', 16) + ' Please fix ' + errCount + ' field' + (errCount > 1 ? 's' : '') + ' below.</div>'
        : '';

      host.innerHTML = '<div class="overlay" data-s4="overlay"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="s4-m-t">' +
        '<div class="m-head"><div><h2 id="s4-m-t">' + (isEdit ? 'Edit Sale — ' + esc(dlg.vals.transno) : 'New Sale') + '</h2><div class="sub">Header of the sale</div></div>' +
        '<button type="button" class="icon-btn" data-s4="close-dlg" aria-label="Close">' + ic('x', 18) + '</button></div>' +
        '<form data-s4-saleform="1" novalidate><div class="m-body">' + errBanner +
        '<div class="field"><label for="sf-no">Transaction no.</label><input class="input" id="sf-no" value="' + esc(dlg.vals.transno) + '" disabled><div class="hint">Numbered automatically, so two sales can never share a number.</div></div>' +
        '<div class="field' + (dlg.errs.saledate ? ' err' : '') + '"><label for="sf-date">Sale date</label><input class="input" id="sf-date" type="date" value="' + esc(saleDateVal) + '"><div class="hint">Line prices are taken from this date.</div>' +
        (dlg.errs.saledate ? '<div class="ferr">' + esc(dlg.errs.saledate) + '</div>' : '') + '</div>' +
        '<div class="field' + (dlg.errs.custno ? ' err' : '') + '"><label for="sf-cust">Customer</label><select class="input" id="sf-cust"><option value="">Choose a customer...</option>' +
        activeCusts.map(function (c) {
          return '<option value="' + esc(c.custno) + '"' + (dlg.vals.custno === c.custno ? ' selected' : '') + '>' + esc(c.custname + ' (' + c.custno + ')') + '</option>';
        }).join('') + '</select>' + (dlg.errs.custno ? '<div class="ferr">' + esc(dlg.errs.custno) + '</div>' : '') + '</div>' +
        '<div class="field' + (dlg.errs.empno ? ' err' : '') + '"><label for="sf-emp">Sold by</label><select class="input" id="sf-emp"><option value="">Choose an employee...</option>' +
        eligibleEmps.map(function (e) {
          return '<option value="' + esc(e.empno) + '"' + (dlg.vals.empno === e.empno ? ' selected' : '') + '>' + esc(e.firstname + ' ' + e.lastname + ' (' + e.empno + ')') + '</option>';
        }).join('') + '</select><div class="hint">Active employees hired on or before the sale date.</div>' +
        (dlg.errs.empno ? '<div class="ferr">' + esc(dlg.errs.empno) + '</div>' : '') + '</div>' +
        '</div><div class="m-foot"><span></span><div class="btns"><button type="button" class="btn btn-outline" data-s4="close-dlg">Cancel</button>' +
        '<button type="submit" class="btn btn-primary">' + (isEdit ? 'Save changes' : 'Create sale') + '</button></div></div></form>' +
        '</div></div>';
      return;
    }

    if (dlg.kind === 'saleDetails') {
      var saleObj = D4.sales.filter(function (s) { return s.transno === dlg.transno; })[0];
      if (!saleObj) { host.innerHTML = ''; return; }
      var calc = calcSale(saleObj);
      var a = adm();
      var subTab = dlg.subTab || 'lines';
      var statusFilter = dlg.statusFilter || 'active';
      var lockedByDelete = !!saleObj.is_deleted;

      var allLines = D4.lines.filter(function (l) { return l.transno === saleObj.transno; });
      var liveLines = allLines.filter(function (l) { return !l.is_deleted; });
      var shownLines = a
        ? allLines.filter(function (l) { return statusFilter === 'all' || (statusFilter === 'inactive') === !!l.is_deleted; })
        : liveLines;

      var allPays = D4.payments.filter(function (p) { return p.transno === saleObj.transno; });
      var livePays = allPays.filter(function (p) { return !p.is_deleted; });
      var shownPays = a
        ? allPays.filter(function (p) { return statusFilter === 'all' || (statusFilter === 'inactive') === !!p.is_deleted; })
        : livePays;

      var balLabel = calc.balance < 0 ? 'OVERPAID BY' : 'BALANCE DUE';
      var balVal = calc.balance < 0 ? money(Math.abs(calc.balance)) : money(calc.balance);

      var addActionBtn = '';
      if (!lockedByDelete) {
        if (subTab === 'lines' && can('sales:4')) {
          addActionBtn = '<button type="button" class="btn btn-primary btn-xs" data-s4="toggle-add-line">' + ic('plus', 16) + ' Add Line</button>';
        } else if (subTab === 'payments' && can('sales:4')) {
          addActionBtn = '<button type="button" class="btn btn-primary btn-xs" data-s4="toggle-add-pay">' + ic('plus', 16) + ' Record Payment</button>';
        }
      }

      var addLinePanel = '';
      if (dlg.showAddLine && !lockedByDelete) {
        var availProds = store.products.filter(function (p) { return !p.is_deleted; });
        var selProd = dlg.lineProd || '';
        var selQty = dlg.lineQty || '';
        var unitP = selProd ? priceOnDate(selProd, saleObj.saledate, store.prices) : 0;
        var linePrev = (selProd && Number(selQty) > 0)
          ? '<div class="live-preview">' + money(unitP) + ' each on ' + esc(saleObj.saledate) + ' · line total ' + money(Number(selQty) * unitP) + '</div>'
          : '<div class="subline">Pick a product to see its price on ' + esc(saleObj.saledate) + '.</div>';

        var lErrs = dlg.lineErrs || {};
        var lErrKeys = Object.keys(lErrs);
        addLinePanel = '<div class="sub-card"><h3>Add a product line</h3>' +
          (lErrKeys.length ? '<div class="msg msg-err" role="alert">Please fix ' + lErrKeys.length + ' field' + (lErrKeys.length > 1 ? 's' : '') + ' below.</div>' : '') +
          '<div class="two-col">' +
          '<div class="field' + (lErrs.prod ? ' err' : '') + '"><label for="lf-prod">Product</label><select class="input" id="lf-prod"><option value="">Choose a product...</option>' +
          availProds.map(function (p) {
            var pr = priceOnDate(p.prodcode, saleObj.saledate, store.prices);
            return '<option value="' + esc(p.prodcode) + '"' + (selProd === p.prodcode ? ' selected' : '') + '>' + esc(p.description + ' (' + p.prodcode + ') — ' + money(pr)) + '</option>';
          }).join('') + '</select><div class="hint">Only active products with a price on ' + esc(saleObj.saledate) + ' are listed.</div>' +
          (lErrs.prod ? '<div class="ferr">' + esc(lErrs.prod) + '</div>' : '') + '</div>' +
          '<div class="field' + (lErrs.qty ? ' err' : '') + '"><label for="lf-qty">Quantity</label><input class="input" id="lf-qty" type="number" step="0.01" min="0" value="' + esc(selQty) + '">' +
          (lErrs.qty ? '<div class="ferr">' + esc(lErrs.qty) + '</div>' : '') + '</div></div>' +
          linePrev +
          '<div class="row" style="justify-content:flex-end;"><button type="button" class="btn btn-outline btn-xs" data-s4="cancel-subform">Cancel</button>' +
          '<button type="button" class="btn btn-primary btn-xs" data-s4="save-line">Add line</button></div></div>';
      }

      var addPayPanel = '';
      if (dlg.showAddPay && !lockedByDelete) {
        var defAmt = dlg.payAmt != null ? dlg.payAmt : (calc.balance > 0 ? calc.balance.toFixed(2) : '0.00');
        var defDate = dlg.payDate != null ? dlg.payDate : today();
        var pErrs = dlg.payErrs || {};
        var pErrKeys = Object.keys(pErrs);
        addPayPanel = '<div class="sub-card"><h3>Record a payment</h3>' +
          (pErrKeys.length ? '<div class="msg msg-err" role="alert">Please fix ' + pErrKeys.length + ' field' + (pErrKeys.length > 1 ? 's' : '') + ' below.</div>' : '') +
          '<div class="two-col">' +
          '<div class="field' + (pErrs.date ? ' err' : '') + '"><label for="pf-date">Payment date</label><input class="input" id="pf-date" type="date" value="' + esc(defDate) + '">' +
          (pErrs.date ? '<div class="ferr">' + esc(pErrs.date) + '</div>' : '') + '</div>' +
          '<div class="field' + (pErrs.amt ? ' err' : '') + '"><label for="pf-amt">Amount (USD)</label><input class="input" id="pf-amt" type="number" step="0.01" value="' + esc(defAmt) + '">' +
          '<div class="hint">Balance due ' + money(Math.max(0, calc.balance)) + '. A payment cannot be more than that.</div>' +
          (pErrs.amt ? '<div class="ferr">' + esc(pErrs.amt) + '</div>' : '') + '</div></div>' +
          '<div class="hint">The official receipt number (' + esc(nextOrNo()) + ') is assigned automatically.</div>' +
          '<div class="row" style="justify-content:flex-end;"><button type="button" class="btn btn-outline btn-xs" data-s4="cancel-subform">Cancel</button>' +
          '<button type="button" class="btn btn-primary btn-xs" data-s4="save-pay">Record payment</button></div></div>';
      }

      var tabBodyHtml = '';
      if (subTab === 'lines') {
        if (!shownLines.length) {
          tabBodyHtml = '<div class="s2-empty"><span class="icon-tile">' + ic('box', 24) + '</span>' +
            '<h3>No products on this sale yet</h3><p>Add product lines to calculate the sale total.</p></div>';
        } else {
          var lRows = shownLines.map(function (l) {
            var pObj = store.products.filter(function (p) { return p.prodcode === l.prodcode; })[0];
            var up = l.unitprice != null ? Number(l.unitprice) : priceOnDate(l.prodcode, saleObj.saledate, store.prices);
            var lt = (Number(l.qty) || 0) * up;
            var lAct = '';
            if (!lockedByDelete) {
              if (l.is_deleted && a) lAct = '<button type="button" class="btn btn-soft btn-xs" data-s4="restore-line" data-a="' + esc(l.prodcode) + '">Restore</button>';
              else if (!l.is_deleted && can('sales:6')) lAct = '<button type="button" class="btn btn-danger btn-xs" data-s4="del-line" data-a="' + esc(l.prodcode) + '">Delete</button>';
            }
            return '<tr class="' + (l.is_deleted ? 'row-del' : '') + '">' +
              '<td><code>' + esc(l.prodcode) + '</code></td>' +
              '<td><b>' + esc(pObj ? pObj.description : l.prodcode) + '</b></td>' +
              '<td class="num">' + esc(l.qty) + '</td>' +
              '<td>' + esc(pObj ? pObj.unit : 'ea') + '</td>' +
              '<td class="num">' + money(up) + '</td>' +
              '<td class="num"><b>' + money(lt) + '</b></td>' +
              (a ? '<td><span class="pill ' + (l.is_deleted ? 'st-inactive">Inactive' : 'st-active">Active') + '</span>' + stamp(l.stamp) + '</td>' : '') +
              '<td><div class="nowrap">' + lAct + '</div></td></tr>';
          }).join('');
          tabBodyHtml = '<div class="table-wrap"><table class="dense"><thead><tr><th>PROD CODE</th><th>DESCRIPTION</th><th class="num">QTY</th><th>UNIT</th><th class="num">UNIT PRICE</th><th class="num">LINE TOTAL</th>' +
            (a ? '<th>STATUS · CHANGE</th>' : '') + '<th>ACTIONS</th></tr></thead><tbody>' + lRows + '</tbody></table></div>';
        }
      } else {
        if (!shownPays.length) {
          tabBodyHtml = '<div class="s2-empty"><span class="icon-tile">' + ic('check', 24) + '</span>' +
            '<h3>No payments yet</h3><p>Payments recorded against this sale appear here.</p></div>';
        } else {
          var pRows = shownPays.map(function (p) {
            var pAct = '';
            if (!lockedByDelete) {
              if (p.is_deleted && a) pAct = '<button type="button" class="btn btn-soft btn-xs" data-s4="restore-pay" data-a="' + esc(p.orno) + '">Restore</button>';
              else if (!p.is_deleted && can('sales:6')) pAct = '<button type="button" class="btn btn-danger btn-xs" data-s4="del-pay" data-a="' + esc(p.orno) + '">Delete</button>';
            }
            return '<tr class="' + (p.is_deleted ? 'row-del' : '') + '">' +
              '<td><code>' + esc(p.orno) + '</code></td>' +
              '<td>' + esc(p.paydate) + '</td>' +
              '<td class="num"><b>' + money(p.amount) + '</b></td>' +
              (a ? '<td><span class="pill ' + (p.is_deleted ? 'st-inactive">Inactive' : 'st-active">Active') + '</span>' + stamp(p.stamp) + '</td>' : '') +
              '<td><div class="nowrap">' + pAct + '</div></td></tr>';
          }).join('');
          tabBodyHtml = '<div class="table-wrap"><table class="dense"><thead><tr><th>OR NO</th><th>DATE</th><th class="num">AMOUNT</th>' +
            (a ? '<th>STATUS · CHANGE</th>' : '') + '<th>ACTIONS</th></tr></thead><tbody>' + pRows + '</tbody></table></div>';
        }
      }

      var statusFilterBar = a
        ? '<div class="tabs" role="group" aria-label="Filter items">' +
          [['active', 'Active (' + (subTab === 'lines' ? liveLines.length : livePays.length) + ')'],
           ['inactive', 'Inactive (' + (subTab === 'lines' ? allLines.length - liveLines.length : allPays.length - livePays.length) + ')'],
           ['all', 'All (' + (subTab === 'lines' ? allLines.length : allPays.length) + ')']].map(function (t) {
            return '<button type="button" class="tab" aria-pressed="' + (statusFilter === t[0]) + '" data-s4="subfilter" data-a="' + t[0] + '">' + t[1] + '</button>';
          }).join('') + '</div>'
        : '';

      host.innerHTML = '<div class="overlay" data-s4="overlay"><div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="s4-m-t">' +
        '<div class="m-head"><div><h2 id="s4-m-t">Sale Details — ' + esc(saleObj.transno) + '</h2><div class="sub">' + esc(custLabel(saleObj.custno, store) + ' · ' + saleObj.saledate) + '</div></div>' +
        '<button type="button" class="icon-btn" data-s4="close-dlg" aria-label="Close">' + ic('x', 18) + '</button></div>' +
        '<div class="m-body">' +
        (lockedByDelete ? '<div class="msg msg-warn">This sale is deleted. Restore it from the list to change its lines or payments.</div>' : '') +
        '<div class="sale-meta"><div><span>Customer</span><b>' + esc(custLabel(saleObj.custno, store)) + ' <span class="muted">' + esc(saleObj.custno) + '</span></b></div>' +
        '<div><span>Sold by</span><b>' + esc(empLabel(saleObj.empno, store)) + '</b></div>' +
        '<div><span>Date</span><b>' + esc(saleObj.saledate) + '</b></div></div>' +
        '<div class="sum-tiles">' +
        '<div class="sum-tile"><span class="k">TOTAL</span><span class="v">' + money(calc.total) + '</span></div>' +
        '<div class="sum-tile"><span class="k">PAID</span><span class="v">' + money(calc.paid) + '</span></div>' +
        '<div class="sum-tile' + (calc.balance < 0 ? ' overpaid' : '') + '"><span class="k">' + balLabel + '</span><span class="v">' + balVal + '</span>' +
        '<div>' + paymentChip(calc, saleObj.is_deleted) + '</div></div>' +
        '</div>' +
        '<div class="p-top"><div class="tabs"><button type="button" class="tab" aria-pressed="' + (subTab === 'lines') + '" data-s4="subtab" data-a="lines">Lines (' + liveLines.length + ')</button>' +
        '<button type="button" class="tab" aria-pressed="' + (subTab === 'payments') + '" data-s4="subtab" data-a="payments">Payments (' + livePays.length + ')</button></div>' +
        addActionBtn + '</div>' +
        statusFilterBar +
        addLinePanel +
        addPayPanel +
        tabBodyHtml +
        '</div>' +
        '<div class="m-foot"><span class="hint">Total = quantity × unit price on ' + esc(saleObj.saledate) + '. Balance = total − payments.</span>' +
        '<div class="btns"><button type="button" class="btn btn-primary" data-s4="close-dlg">Done</button></div></div>' +
        '</div></div>';
      return;
    }

    if (dlg.kind === 'confirm') {
      var blocked = !!dlg.reason;
      host.innerHTML = '<div class="overlay" data-s4="overlay"><div class="modal confirm" role="alertdialog" aria-modal="true" aria-labelledby="s4-m-t"><div class="m-body ctr">' +
        '<span class="icon-tile ' + (blocked ? 'ic-amber' : 'ic-red') + '">' + ic('alert', 24) + '</span>' +
        '<h2 id="s4-m-t">' + (blocked ? 'This sale cannot be deleted' : 'Delete this sale?') + '</h2>' +
        '<span class="chipcode">' + esc(dlg.label) + '</span>' +
        (blocked
          ? '<div class="msg msg-err">' + esc(dlg.reason) + '</div>'
          : '<p class="muted">It is hidden from Users and marked Inactive. You can restore it later.</p>') +
        '<div class="row center">' +
        (blocked
          ? '<button type="button" class="btn btn-outline" data-s4="close-dlg">Close</button>'
          : '<button type="button" class="btn btn-outline" data-s4="close-dlg">Cancel</button><button type="button" class="btn btn-red" data-s4="confirm-del-sale">Delete sale</button>') +
        '</div></div></div></div>';
    }
  }

  function submitSaleForm() {
    var dlg = V4.dlg;
    if (!dlg || dlg.kind !== 'saleForm') return;
    var saledate = (document.getElementById('sf-date') || {}).value || '';
    var custno = (document.getElementById('sf-cust') || {}).value || '';
    var empno = (document.getElementById('sf-emp') || {}).value || '';
    var errs = {};

    if (!/^\d{4}-\d{2}-\d{2}$/.test(saledate)) errs.saledate = 'Pick a valid sale date.';
    if (!custno) errs.custno = 'Choose a customer.';
    if (!empno) errs.empno = 'Choose the employee who made the sale.';

    var store = getSalesDataStore();
    var empObj = (store.hr.emps || []).filter(function (e) { return e.empno === empno; })[0];
    if (empObj && saledate) {
      if (empObj.hiredate && empObj.hiredate > saledate) {
        errs.empno = 'Employee was not hired yet on ' + saledate + '.';
      } else if (empObj.sepdate && empObj.sepdate < saledate) {
        errs.empno = 'Employee separated before ' + saledate + '.';
      }
    }

    if (Object.keys(errs).length) {
      dlg.vals = { transno: dlg.vals.transno, saledate: saledate, custno: custno, empno: empno };
      dlg.errs = errs;
      renderS4Modal();
      return;
    }

    var verb = dlg.mode === 'edit' ? 'EDIT' : 'ADD';
    var stampStr = verb + ' ' + (S && S.me ? H.fullName(S.me) : 'system') + ' ' + ts();

    if (dlg.mode === 'edit') {
      var existing = D4.sales.filter(function (s) { return s.transno === dlg.vals.transno; })[0];
      if (existing) {
        var beforeCust = existing.custno, beforeEmp = existing.empno, beforeDate = existing.saledate;
        existing.saledate = saledate;
        existing.custno = custno;
        existing.empno = empno;
        existing.stamp = stampStr;
        pushAudit('EDIT', 'sales', existing.transno, [
          { col: 'SALEDATE', before: beforeDate, after: saledate },
          { col: 'CUSTNO', before: beforeCust, after: custno },
          { col: 'EMPNO', before: beforeEmp, after: empno }
        ]);
      }
      toast('Sale ' + dlg.vals.transno + ' updated.');
    } else {
      var newSale = {
        transno: dlg.vals.transno,
        saledate: saledate,
        custno: custno,
        empno: empno,
        is_deleted: false,
        stamp: stampStr
      };
      D4.sales.unshift(newSale);
      pushAudit('ADD', 'sales', newSale.transno, [
        { col: 'CUSTNO', before: '—', after: custno },
        { col: 'SALEDATE', before: '—', after: saledate }
      ]);
      toast('Sale ' + newSale.transno + ' created.');
    }

    saveS4();
    V4.dlg = null;
    renderS4Modal();
    renderSalesView();
  }

  function saveSaleLine() {
    var dlg = V4.dlg;
    if (!dlg || dlg.kind !== 'saleDetails') return;
    var saleObj = D4.sales.filter(function (s) { return s.transno === dlg.transno; })[0];
    if (!saleObj) return;

    var prodcode = (document.getElementById('lf-prod') || {}).value || '';
    var qtyRaw = (document.getElementById('lf-qty') || {}).value || '';
    var qty = Number(qtyRaw);
    var errs = {};

    if (!prodcode) {
      errs.prod = 'Choose a product.';
    } else {
      var dup = D4.lines.filter(function (l) {
        return l.transno === saleObj.transno && l.prodcode === prodcode && !l.is_deleted;
      })[0];
      if (dup) errs.prod = 'This sale already has an active line for ' + prodcode + '.';
    }

    if (!qtyRaw || isNaN(qty) || qty <= 0) {
      errs.qty = 'Enter a quantity greater than 0.';
    }

    if (Object.keys(errs).length) {
      dlg.lineProd = prodcode;
      dlg.lineQty = qtyRaw;
      dlg.lineErrs = errs;
      renderS4Modal();
      return;
    }

    var store = getSalesDataStore();
    var up = priceOnDate(prodcode, saleObj.saledate, store.prices);
    D4.lines.push({
      transno: saleObj.transno,
      prodcode: prodcode,
      qty: Number(qty.toFixed(2)),
      unitprice: up,
      is_deleted: false,
      stamp: 'ADD ' + (S && S.me ? H.fullName(S.me) : 'system') + ' ' + ts()
    });
    pushAudit('ADD', 'salesdetail', saleObj.transno + ' | ' + prodcode, [
      { col: 'QUANTITY', before: '—', after: String(qty) },
      { col: 'UNITPRICE', before: '—', after: money(up) }
    ]);
    saveS4();

    dlg.showAddLine = false;
    dlg.lineProd = '';
    dlg.lineQty = '';
    dlg.lineErrs = {};
    renderS4Modal();
    renderSalesView();
    toast('Product line added.');
  }

  function saveSalePayment() {
    var dlg = V4.dlg;
    if (!dlg || dlg.kind !== 'saleDetails') return;
    var saleObj = D4.sales.filter(function (s) { return s.transno === dlg.transno; })[0];
    if (!saleObj) return;
    var calc = calcSale(saleObj);

    var payDate = (document.getElementById('pf-date') || {}).value || '';
    var amtRaw = (document.getElementById('pf-amt') || {}).value || '';
    var amt = Number(amtRaw);
    var errs = {};

    if (!/^\d{4}-\d{2}-\d{2}$/.test(payDate)) {
      errs.date = 'Enter a valid payment date.';
    } else if (payDate > today()) {
      errs.date = 'The payment date cannot be in the future.';
    }

    if (!amtRaw || isNaN(amt) || amt <= 0) {
      errs.amt = 'Enter an amount greater than 0.';
    } else if (amt > calc.balance + 0.0001) {
      errs.amt = 'More than the balance due (' + money(calc.balance) + ').';
    }

    if (Object.keys(errs).length) {
      dlg.payDate = payDate;
      dlg.payAmt = amtRaw;
      dlg.payErrs = errs;
      renderS4Modal();
      return;
    }

    var orno = nextOrNo();
    D4.payments.push({
      orno: orno,
      transno: saleObj.transno,
      paydate: payDate,
      amount: Number(amt.toFixed(2)),
      is_deleted: false,
      stamp: 'ADD ' + (S && S.me ? H.fullName(S.me) : 'system') + ' ' + ts()
    });
    pushAudit('ADD', 'payment', orno, [
      { col: 'TRANSNO', before: '—', after: saleObj.transno },
      { col: 'AMOUNT', before: '—', after: money(amt) }
    ]);
    saveS4();

    dlg.showAddPay = false;
    dlg.payDate = '';
    dlg.payAmt = null;
    dlg.payErrs = {};
    renderS4Modal();
    renderSalesView();
    toast('Payment ' + orno + ' recorded.');
  }

  /* ---------------- EVENT DELEGATION ---------------- */
  document.addEventListener('click', function (e) {
    var navBtn = e.target.closest('[data-s4-nav]');
    if (navBtn) {
      if (!S || !S.me) return;
      var targetView = navBtn.getAttribute('data-s4-nav');
      V4.view = targetView;
      V4.dlg = null;
      renderS4Modal();
      if (targetView === 'sales') renderSalesView();
      else if (targetView === 'reports') renderReportsView();
      else if (targetView === 'audit') renderAuditView();
      return;
    }

    var stubEl = e.target.closest('[data-act="stub"]');
    if (stubEl && S && S.me) {
      var arg = stubEl.getAttribute('data-arg');
      if (arg === 'Sales') {
        e.stopPropagation();
        e.stopImmediatePropagation();
        V4.view = 'sales';
        renderSalesView();
        return;
      }
      if (arg === 'Reports') {
        e.stopPropagation();
        e.stopImmediatePropagation();
        V4.view = 'reports';
        renderReportsView();
        return;
      }
      if (arg === 'Audit Log') {
        e.stopPropagation();
        e.stopImmediatePropagation();
        V4.view = 'audit';
        renderAuditView();
        return;
      }
    }

    var actEl = e.target.closest('[data-s4]');
    if (!actEl) return;
    var act = actEl.getAttribute('data-s4');
    var a = actEl.getAttribute('data-a');

    if (act === 'overlay' && e.target !== actEl) return;

    switch (act) {
      case 'overlay':
      case 'close-dlg':
        V4.dlg = null;
        renderS4Modal();
        break;
      case 'tab':
        V4.tab = a;
        V4.page = 1;
        renderSalesView();
        break;
      case 'pg':
        if (a === 'prev' && V4.page > 1) V4.page--;
        else if (a === 'next') V4.page++;
        renderSalesView();
        break;
      case 'clear-sales':
        V4.q = '';
        V4.payFilter = 'all';
        V4.page = 1;
        renderSalesView();
        break;
      case 'new-sale':
        if (!can('sales:0')) return toast('You do not have permission to create sales.', true);
        V4.dlg = { kind: 'saleForm', mode: 'add', vals: { transno: nextTransNo(), saledate: today(), custno: '', empno: '' }, errs: {} };
        renderS4Modal();
        break;
      case 'edit-sale':
        if (!can('sales:1')) return toast('You do not have permission to edit sales.', true);
        var edS = D4.sales.filter(function (x) { return x.transno === a; })[0];
        if (edS) {
          V4.dlg = { kind: 'saleForm', mode: 'edit', vals: { transno: edS.transno, saledate: edS.saledate, custno: edS.custno, empno: edS.empno }, errs: {} };
          renderS4Modal();
        }
        break;
      case 'del-sale':
        if (!can('sales:2')) return toast('You do not have permission to delete sales.', true);
        var activeL = D4.lines.filter(function (l) { return l.transno === a && !l.is_deleted; }).length;
        var activeP = D4.payments.filter(function (p) { return p.transno === a && !p.is_deleted; }).length;
        var reason = '';
        if (activeL || activeP) {
          var parts = [];
          if (activeL) parts.push(activeL + ' active line' + (activeL > 1 ? 's' : ''));
          if (activeP) parts.push(activeP + ' active payment' + (activeP > 1 ? 's' : ''));
          reason = 'Cannot delete this sale while ' + parts.join(' and ') + ' still exist.';
        }
        V4.dlg = { kind: 'confirm', transno: a, label: a, reason: reason };
        renderS4Modal();
        break;
      case 'confirm-del-sale':
        var delS = D4.sales.filter(function (x) { return x.transno === V4.dlg.transno; })[0];
        if (delS) {
          delS.is_deleted = true;
          delS.stamp = 'DELETE ' + (S && S.me ? H.fullName(S.me) : 'system') + ' ' + ts();
          pushAudit('DELETE', 'sales', delS.transno, [{ col: 'STATUS', before: 'Active', after: 'Inactive' }]);
          saveS4();
          toast('Sale ' + delS.transno + ' marked Inactive.');
        }
        V4.dlg = null;
        renderS4Modal();
        renderSalesView();
        break;
      case 'restore-sale':
        var resS = D4.sales.filter(function (x) { return x.transno === a; })[0];
        if (resS) {
          resS.is_deleted = false;
          resS.stamp = 'RESTORE ' + (S && S.me ? H.fullName(S.me) : 'system') + ' ' + ts();
          pushAudit('RESTORE', 'sales', resS.transno, [{ col: 'STATUS', before: 'Inactive', after: 'Active' }]);
          saveS4();
          toast('Sale ' + resS.transno + ' restored.');
          renderSalesView();
        }
        break;
      case 'details':
        V4.dlg = { kind: 'saleDetails', transno: a, subTab: 'lines', statusFilter: 'active', showAddLine: false, showAddPay: false, lineErrs: {}, payErrs: {} };
        renderS4Modal();
        break;
      case 'subtab':
        if (V4.dlg && V4.dlg.kind === 'saleDetails') {
          V4.dlg.subTab = a;
          V4.dlg.showAddLine = false;
          V4.dlg.showAddPay = false;
          renderS4Modal();
        }
        break;
      case 'subfilter':
        if (V4.dlg && V4.dlg.kind === 'saleDetails') {
          V4.dlg.statusFilter = a;
          renderS4Modal();
        }
        break;
      case 'toggle-add-line':
        if (V4.dlg && V4.dlg.kind === 'saleDetails') {
          V4.dlg.showAddLine = !V4.dlg.showAddLine;
          V4.dlg.lineErrs = {};
          renderS4Modal();
        }
        break;
      case 'toggle-add-pay':
        if (V4.dlg && V4.dlg.kind === 'saleDetails') {
          V4.dlg.showAddPay = !V4.dlg.showAddPay;
          V4.dlg.payErrs = {};
          renderS4Modal();
        }
        break;
      case 'cancel-subform':
        if (V4.dlg && V4.dlg.kind === 'saleDetails') {
          V4.dlg.showAddLine = false;
          V4.dlg.showAddPay = false;
          V4.dlg.lineErrs = {};
          V4.dlg.payErrs = {};
          renderS4Modal();
        }
        break;
      case 'save-line':
        saveSaleLine();
        break;
      case 'save-pay':
        saveSalePayment();
        break;
      case 'del-line':
        if (V4.dlg && V4.dlg.kind === 'saleDetails') {
          var ln = D4.lines.filter(function (x) { return x.transno === V4.dlg.transno && x.prodcode === a && !x.is_deleted; })[0];
          if (ln) {
            ln.is_deleted = true;
            ln.stamp = 'DELETE ' + (S && S.me ? H.fullName(S.me) : 'system') + ' ' + ts();
            pushAudit('DELETE', 'salesdetail', V4.dlg.transno + ' | ' + a, [{ col: 'STATUS', before: 'Active', after: 'Inactive' }]);
            saveS4();
            renderS4Modal();
            renderSalesView();
            toast('Line removed.');
          }
        }
        break;
      case 'restore-line':
        if (V4.dlg && V4.dlg.kind === 'saleDetails') {
          var rln = D4.lines.filter(function (x) { return x.transno === V4.dlg.transno && x.prodcode === a && x.is_deleted; })[0];
          if (rln) {
            rln.is_deleted = false;
            rln.stamp = 'RESTORE ' + (S && S.me ? H.fullName(S.me) : 'system') + ' ' + ts();
            pushAudit('RESTORE', 'salesdetail', V4.dlg.transno + ' | ' + a, [{ col: 'STATUS', before: 'Inactive', after: 'Active' }]);
            saveS4();
            renderS4Modal();
            renderSalesView();
            toast('Line restored.');
          }
        }
        break;
      case 'del-pay':
        if (V4.dlg && V4.dlg.kind === 'saleDetails') {
          var py = D4.payments.filter(function (x) { return x.transno === V4.dlg.transno && x.orno === a && !x.is_deleted; })[0];
          if (py) {
            py.is_deleted = true;
            py.stamp = 'DELETE ' + (S && S.me ? H.fullName(S.me) : 'system') + ' ' + ts();
            pushAudit('DELETE', 'payment', a, [{ col: 'STATUS', before: 'Active', after: 'Inactive' }]);
            saveS4();
            renderS4Modal();
            renderSalesView();
            toast('Payment ' + a + ' deleted.');
          }
        }
        break;
      case 'restore-pay':
        if (V4.dlg && V4.dlg.kind === 'saleDetails') {
          var rpy = D4.payments.filter(function (x) { return x.transno === V4.dlg.transno && x.orno === a && x.is_deleted; })[0];
          if (rpy) {
            rpy.is_deleted = false;
            rpy.stamp = 'RESTORE ' + (S && S.me ? H.fullName(S.me) : 'system') + ' ' + ts();
            pushAudit('RESTORE', 'payment', a, [{ col: 'STATUS', before: 'Inactive', after: 'Active' }]);
            saveS4();
            renderS4Modal();
            renderSalesView();
            toast('Payment ' + a + ' restored.');
          }
        }
        break;
      case 'rep-pick':
        V4.repId = a;
        V4.repRan = true;
        renderReportsView();
        break;
      case 'run-rep':
        if (document.getElementById('rf-from')) V4.repFilters.from = document.getElementById('rf-from').value;
        if (document.getElementById('rf-to')) V4.repFilters.to = document.getElementById('rf-to').value;
        if (document.getElementById('rf-topn')) V4.repFilters.topN = parseInt(document.getElementById('rf-topn').value, 10) || 5;
        if (document.getElementById('rf-emp')) V4.repFilters.empno = document.getElementById('rf-emp').value;
        V4.repRan = true;
        renderReportsView();
        break;
      case 'print-rep':
      case 'pdf-rep':
        window.print();
        break;
      case 'toggle-diff':
        var numId = parseInt(a, 10);
        V4.auditFilters.expandedId = (V4.auditFilters.expandedId === numId) ? null : numId;
        renderAuditView();
        break;
      case 'clear-audit':
        V4.auditFilters = { table: 'all', action: 'all', by: '', record: '', from: '', to: '', expandedId: null };
        renderAuditView();
        break;
    }
  });

  document.addEventListener('submit', function (e) {
    if (e.target.closest('[data-s4-saleform]')) {
      e.preventDefault();
      submitSaleForm();
    }
  });

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 's4-pay') {
      V4.payFilter = t.value;
      V4.page = 1;
      renderSalesView();
    } else if (t.id === 'lf-prod' && V4.dlg && V4.dlg.kind === 'saleDetails') {
      V4.dlg.lineProd = t.value;
      var qEl = document.getElementById('lf-qty');
      if (qEl) V4.dlg.lineQty = qEl.value;
      renderS4Modal();
    } else if (t.id === 'af-table' || t.id === 'af-action' || t.id === 'af-from' || t.id === 'af-to') {
      V4.auditFilters.table = (document.getElementById('af-table') || {}).value || 'all';
      V4.auditFilters.action = (document.getElementById('af-action') || {}).value || 'all';
      V4.auditFilters.from = (document.getElementById('af-from') || {}).value || '';
      V4.auditFilters.to = (document.getElementById('af-to') || {}).value || '';
      renderAuditView();
    }
  });

  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 's4-q') {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        V4.q = t.value;
        V4.page = 1;
        renderSalesView();
        var reInput = document.getElementById('s4-q');
        if (reInput) {
          reInput.focus();
          reInput.setSelectionRange(reInput.value.length, reInput.value.length);
        }
      }, 200);
    } else if (t.id === 'lf-qty' && V4.dlg && V4.dlg.kind === 'saleDetails') {
      V4.dlg.lineQty = t.value;
    } else if (t.id === 'af-by' || t.id === 'af-rec') {
      V4.auditFilters.by = (document.getElementById('af-by') || {}).value || '';
      V4.auditFilters.record = (document.getElementById('af-rec') || {}).value || '';
      renderAuditView();
    }
  });

  /* Inject Sprint 4 sidebar links whenever dashboard or user management renders */
  var obs = new MutationObserver(function () {
    if (S && S.me && document.querySelector('.side')) {
      syncSidebarNav();
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
})(window);
