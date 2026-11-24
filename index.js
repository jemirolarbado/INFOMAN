(function (window) {
  'use strict';

  // Supabase Client Initialization
  var SUPABASE_URL = 'https://pfgwavzauqqbrcmgqjou.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZ3dhdnphdXFxYnJjbWdxam91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3MDM5MTIsImV4cCI6MjEwOTI3OTkxMn0.qGqJd6DwjqBx8UNK846oLz0dA-8xgA_L6bjbkml5lVQ';
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

  // --- Async Database Operations ---
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
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '\x26amp;', '<': '\x26lt;', '>': '\x26gt;', '"': '\x26quot;', "'": '\x26#39;' }[c];
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
    lock: '<rect x="4" y="11" width="16" height="10" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>',
    minus: '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>'
  };

  function ic(name, size) {
    size = size || 20;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + PATHS[name] + '</svg>';
  }

  var LOGO = '<span class="logo" aria-hidden="true">H<i></i></span>';

  function roleBadge(role) {
    var cls = { Superadmin: 'b-super', Admin: 'b-admin', User: 'b-user' }[role];
    return '<span class="badge ' + cls + '">' + esc(role) + '</span>';
  }

  function statusPill(status) {
    return '<span class="pill st-' + status.toLowerCase() + '">' + esc(status) + '</span>';
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
        moduleCard('mc-coral', 'sales', 'Sales', 'Orders with line items and totals.') +
      '</section></main>' +
      '<footer class="page-foot">Hope, Inc. ERP Information Management project prototype</footer>';
  }

  function authShell(left, card) {
    return '<div class="auth">' +
      '<section class="auth-left"><div class="brand brand-inv">' + LOGO + '<span>Hope, Inc. ERP</span></div>' +
      '<div>' + left + '</div><div class="auth-foot">Information Management Sprint 1</div></section>' +
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
        '<div><b>Superadmin</b><span>Full menu, including System Settings</span></div>' +
        '<div><b>Admin</b><span>All modules and user rights</span></div>' +
        '<div><b>User</b><span>Only the modules granted to you</span></div>' +
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
    var me = S.me, h = '<aside class="side" aria-label="Main menu">' +
      '<div class="side-brand">' + LOGO + '<span>Hope, Inc. ERP</span></div>' +
      '<div class="side-label">Modules</div>' +
      navBtn('Dashboard', 'dash', active === 'dashboard', 'go', 'dashboard');

    H.MODULES.forEach(function (m) {
      if (H.hasAnyRight(me, m.id)) h += navBtn(m.name, m.icon, false, 'stub', m.name);
    });

    if (me.role !== 'User') {
      h += '<div class="side-label">Administration</div>' +
        navBtn('User Management', 'shield', active === 'users', 'go', 'users');
      if (me.role === 'Superadmin') h += navBtn('System Settings', 'settings', false, 'stub', 'System Settings');
    } else {
      h += '<div class="side-label">Account</div>' + navBtn('My rights', 'shield', false, 'myrights', '');
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
        '<div class="dash-icon">' + ic(m.icon, 28) + '</div>' +
        '<h3>' + esc(m.name) + '</h3>' +
        '<p>' + (ok ? 'Access granted. Open module for records.' : 'No rights assigned for this module.') + '</p>' +
        '<button type="button" class="btn ' + (ok ? 'btn-outline' : 'btn-ghost disabled') + '" data-act="' + (ok ? 'stub' : '') + '" data-arg="' + esc(m.name) + '">' + (ok ? 'Open' : 'Locked') + '</button>' +
      '</div>';
    });

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

    var inner = '' +
      '<div class="users-toolbar"><div class="tabs">' + tabs + '</div></div>' +
      '<div class="table-wrap"><table class="table">' +
        '<thead><tr><th>User</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="4" class="empty">No accounts match this filter.</td></tr>') + '</tbody>' +
      '</table></div>' +
      (logRows ? '<div class="audit-log"><h3>Recent Activity Log</h3><ul>' + logRows + '</ul></div>' : '');

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
      var headerCheck = hasAll ? 'checked' : '';

      var checkboxes = m.items.map(function (itemName, i) {
        var k = H.rightKey(m, i);
        var checked = uRights.indexOf(k) > -1 ? 'checked' : '';
        return '<label class="check-item"><input type="checkbox" data-right="' + k + '"' + checked + (editable ? '' : ' disabled') + '><span>' + esc(itemName) + '</span></label>';
      }).join('');

      return '<div class="right-group" data-mod="' + m.id + '">' +
        '<div class="right-group-head">' +
          '<label><b>' + esc(m.name) + '</b></label>' +
          (editable ? '<div class="row"><button type="button" class="link" data-act="modall" data-arg="' + m.id + '">All</button><span>·</span><button type="button" class="link" data-act="modnone" data-arg="' + m.id + '">None</button><input type="checkbox" data-modbox="' + m.id + '" ' + headerCheck + (hasSome && !hasAll ? ' indeterminate' : '') + ' style="margin-left:8px;" aria-label="Select all ' + esc(m.name) + ' rights"></div>' : '') +
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
  }

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

 // --- Real Supabase Auth Handlers ---
  async function doLogin() {
    var email = val('l-email').toLowerCase(), pw = document.getElementById('l-pw') ? document.getElementById('l-pw').value : '';
    if (!email || !pw) return formError('Enter your email and password.');

    if (db) {
      var authRes = await db.auth.signInWithPassword({ email: email, password: pw });
      if (authRes.error) {
        console.error('Supabase Auth error:', authRes.error);

        // Allow built-in @hope.com demo accounts to sign in with password123
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

        // Show exact Supabase Auth error for non-demo accounts
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
        var idx = S.users.findIndex(function (x) { return x.id === u.id; });
        if (idx > -1) S.users[idx] = u;
        else S.users.push(u);
        persist();
        go('dashboard');
        return;
      }
      return formError('User account profile not found in database.');
    }

    var localMatch = S.users.find(function (x) { return x.email.toLowerCase() === email; });
    if (!localMatch) return formError('Invalid email or password.');
    var blockedLocal = H.signInBlocker(localMatch);
    if (blockedLocal) return formError(blockedLocal);

    S.me = localMatch;
    H.saveSession(localMatch);
    go('dashboard');
  }

  async function doRegister() {
    var first = val('r-first'), last = val('r-last'), email = val('r-email').toLowerCase();
    var pw = document.getElementById('r-pw') ? document.getElementById('r-pw').value : '';
    var repw = document.getElementById('r-repw') ? document.getElementById('r-repw').value : '';

    if (!first || !last) return formError('Enter your first and last name.');
    if (!EMAIL_RE.test(email)) return formError('Enter a valid email address.');
    if (!pw || pw.length < 6) return formError('Password must be at least 6 characters.');
    if (pw !== repw) return formError('Passwords do not match.');

    if (db) {
      var existing = await db.from('app_users').select('id').ilike('email', email).maybeSingle();
      if (existing.data) {
        return formError('An account with that email already exists.');
      }

      var authRes = await db.auth.signUp({
        email: email,
        password: pw,
        options: { data: { first: first, last: last } }
      });

      if (authRes.error) {
        if (authRes.error.message.toLowerCase().includes('already registered')) {
          return formError('An account with that email already exists.');
        }
        return formError('Registration Error: ' + authRes.error.message);
      }

      var newUser = { first: first, last: last, email: email, role: 'User', status: 'Pending', rights: H.defaultRights('User') };
      var dbRes = await db.from('app_users').insert([newUser]).select();
      if (dbRes.error) {
        return formError('An account with that email already exists.');
      }
      if (dbRes.data && dbRes.data[0]) newUser = dbRes.data[0];
      S.users.push(newUser);
    } else {
      if (S.users.some(function (x) { return x.email.toLowerCase() === email; })) {
        return formError('An account with that email already exists.');
      }
      S.users.push({ id: H.nextId(S.users), first: first, last: last, email: email, role: 'User', status: 'Pending', rights: H.defaultRights('User') });
    }

    persist();
    S.flash = { kind: 'ok', text: 'Account created! An Admin must approve your pending account before sign in.' };
    go('login');
  }

  async function doReset() {
    var email = val('p-email').toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return formError('Enter a valid email address.');
    }

    if (!db) {
      return formError('Unable to connect to Supabase. Please try again.');
    }

    var res = await db.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://jemirolarbado.github.io/INFOMAN/'
    });

    if (res.error) {
      return formError(res.error.message);
    }

    S.resetSent = email;
    render();
  }

  async function doUpdatePassword() {
    var newPassword = val('new-pw');
    if (!newPassword || newPassword.length < 6) {
      return formError('Password must be at least 6 characters.');
    }

    if (!db) {
      return formError('Unable to connect to Supabase. Please try again.');
    }

    var sessionRes = await db.auth.getSession();
    if (sessionRes.error || !sessionRes.data.session) {
      return formError('Your password reset link is invalid or expired. Please request a new reset link.');
    }

    var res = await db.auth.updateUser({ password: newPassword });

    if (res.error) {
      return formError(res.error.message);
    }

    window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
    S.isPasswordUpdate = false;
    S.resetSent = null;
    S.flash = {
      kind: 'ok',
      text: 'Password updated successfully! You can now sign in.'
    };
    go('login');
  }

  function applyStatus(target, to) {
    if (!H.canChangeStatus(S.me, target)) { deny(); return null; }
    if (target.status === to) return null;
    var d = H.describeStatusChange(S.me, target, to);
    target.status = to;
    addLog(d.log);

    if (db) {
      db.from('app_users').update({ status: to }).eq('id', target.id).then(function (res) {
        if (res.error) console.error('Error updating status in Supabase:', res.error);
      });
    }
    persist();
    return d;
  }

  function quickStatus(id, to) {
    var t = H.byId(S.users, id);
    if (!t) return;
    var d = applyStatus(t, to);
    if (d) { render(); toast(d.toast); }
  }

  async function saveEdit(id) {
    var t = H.byId(S.users, id);
    if (!t || !H.canManage(S.me, t)) return deny();

    var first = val('ef-first'), last = val('ef-last'), email = val('ef-email').toLowerCase();
    if (!first || !last) return formError('Enter a first and last name.');
    if (!EMAIL_RE.test(email)) return formError('Enter a valid email address.');
    if (S.users.some(function (u) { return u.id !== t.id && u.email.toLowerCase() === email; })) {
      return formError('Another account already uses that email.');
    }

    t.first = first; t.last = last; t.email = email;
    var note = '';

    if (H.canChangeRole(S.me, t)) {
      var role = val('ef-role');
      if ((role === 'User' || role === 'Admin') && role !== t.role) {
        t.role = role;
        t.rights = H.defaultRights(role);
        addLog(H.fullName(S.me) + ' changed ' + H.fullName(t) + ' to ' + role);
        note = ' Role is now ' + role + '.';
      }
    }

    if (H.canChangeStatus(S.me, t)) {
      var status = val('ef-status');
      if (H.STATUSES.indexOf(status) > -1) {
        var d = applyStatus(t, status);
        if (d) note += ' ' + d.toast;
      }
    }

    if (db) {
      await db.from('app_users').update({
        first: t.first,
        last: t.last,
        email: t.email,
        role: t.role,
        status: t.status,
        rights: t.rights
      }).eq('id', t.id);
    }

    persist();
    S.modal = null;
    render();
    toast('Saved changes to ' + H.fullName(t) + '.' + note);
  }

  async function saveRights(id) {
    var t = H.byId(S.users, id);
    if (!t || !H.canRights(S.me, t)) return deny();

    var picked = [];
    Array.prototype.forEach.call(appEl.querySelectorAll('input[data-right]'), function (b) {
      if (b.checked) picked.push(b.getAttribute('data-right'));
    });

    t.rights = H.ALL_RIGHTS.filter(function (k) { return picked.indexOf(k) > -1; });
    addLog(H.fullName(S.me) + ' updated the rights of ' + H.fullName(t));

    if (db) {
      await db.from('app_users').update({ rights: t.rights }).eq('id', t.id);
    }

    persist();
    S.modal = null;
    render();
    toast('Rights saved for ' + H.fullName(t) + ' (' + t.rights.length + ' of ' + H.TOTAL_RIGHTS + ').');
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act');
    var arg = el.getAttribute('data-arg');
    var id = parseInt(arg, 10);

    switch (act) {
      case 'go': go(arg); break;
      case 'logout':
        S.me = null;
        S.modal = null;
        H.saveSession(null);
        if (db) db.auth.signOut();
        go('landing');
        break;
      case 'filter': S.filter = arg; render(); break;
      case 'approve': quickStatus(id, 'Active'); break;
      case 'disapprove': quickStatus(id, 'Disapproved'); break;
      case 'block': quickStatus(id, 'Blocked'); break;
      case 'unblock': quickStatus(id, 'Active'); break;
      case 'edit': openModal({ type: 'edit', id: id }); break;
      case 'rights': openModal({ type: 'rights', id: id }); break;
      case 'myrights': openModal({ type: 'myrights', id: S.me.id }); break;
      case 'close': closeModal(); break;
      case 'overlay': if (e.target === el) closeModal(); break;
      case 'modall': setModule(arg, true); break;
      case 'modnone': setModule(arg, false); break;
      case 'stub': toast(arg + ' is outside the pages built for this task.'); break;
      case 'togglepw':
        var pw = document.getElementById('l-pw');
        var show = pw.type === 'password';
        pw.type = show ? 'text' : 'password';
        el.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        break;
      case 'resetdemo':
        H.clearUsers();
        H.saveSession(null);
        S.users = H.seedUsers();
        S.log = [];
        S.flash = { kind: 'ok', text: 'Demo data was reset.' };
        render();
        break;
    }
  });

  document.addEventListener('submit', function (e) {
    var form = e.target.closest('[data-form]');
    if (!form) return;
    e.preventDefault();
    var kind = form.getAttribute('data-form');
    var id = parseInt(form.getAttribute('data-id'), 10);
    if (kind === 'login') doLogin();
    else if (kind === 'register') doRegister();
    else if (kind === 'reset') doReset();
    else if (kind === 'update_password') doUpdatePassword();
    else if (kind === 'edit') saveEdit(id);
    else if (kind === 'rights') saveRights(id);
  });

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.matches && t.matches('input[data-modbox]')) setModule(t.getAttribute('data-modbox'), t.checked);
    else if (t.matches && t.matches('input[data-right]')) syncRights();
  });

  document.addEventListener('keydown', function (e) {
    if (!S.modal) return;
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key !== 'Tab') return;
    var box = appEl.querySelector('.modal');
    if (!box) return;
    var items = box.querySelectorAll('button, input, select, [href]');
    var list = Array.prototype.filter.call(items, function (n) { return !n.disabled && n.offsetParent !== null; });
    if (!list.length) return;
    var first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // Check URL hash for password reset redirect link or restore saved session
  if (window.location.hash && window.location.hash.includes('access_token')) {
    S.screen = 'reset';
    S.isPasswordUpdate = true;
  } else {
    var savedUser = H.loadSession();
    if (savedUser && !H.signInBlocker(savedUser)) {
      S.me = savedUser;
      S.screen = 'dashboard';
    }
  }

  // Initial render & Supabase sync
  render();

  (async function initApp() {
    var users = await H.fetchUsersFromSupabase();
    S.users = users;

    if (db && !S.isPasswordUpdate) {
      try {
        var sessRes = await db.auth.getSession();
        if (sessRes.data && sessRes.data.session && sessRes.data.session.user) {
          var email = sessRes.data.session.user.email.toLowerCase();
          var freshUser = S.users.find(function (u) { return u.email.toLowerCase() === email; });
          if (freshUser && !H.signInBlocker(freshUser)) {
            S.me = freshUser;
            H.saveSession(freshUser);
            if (S.screen === 'landing' || S.screen === 'login') {
              S.screen = 'dashboard';
            }
          } else if (freshUser && H.signInBlocker(freshUser)) {
            S.me = null;
            H.saveSession(null);
            await db.auth.signOut();
            S.screen = 'login';
          }
        }
      } catch (e) {
        console.error('Session restore error:', e);
      }
    } else if (S.me) {
      var updated = S.users.find(function (u) { return u.id === S.me.id; });
      if (updated && !H.signInBlocker(updated)) {
        S.me = updated;
        H.saveSession(updated);
      } else {
        S.me = null;
        H.saveSession(null);
        S.screen = 'login';
      }
    }

    render();
  })();
})(window);

/* ==========================================================================
   SPRINT 2: Customers, Products, Price history
   Plugs into the app above through window.HopeERP.
   ========================================================================== */
(function (window) {
  'use strict';
  var H = window.HopeERP;
  if (!H) { console.warn('Sprint 2 module needs window.HopeERP'); return; }
  var db = window.supabaseClient, esc = H.esc, S = null;

  /* Capture the app state each time the app renders a signed-in screen */
  var origDash = H.views.dashboard, origUsers = H.views.users;
  H.views.dashboard = function (s) { S = s; return origDash(s); };
  H.views.users = function (s) { S = s; return origUsers(s); };

  /* --- constants --- */
  var PER = 10;
  var TERMS = { COD: 'COD', '30D': 'Net 30', '45D': 'Net 45' };
  var UNITS = ['pc', 'ea', 'mtr', 'pkg', 'ltr'];
  var SALES_C = { C0001: 3 }, SALES_P = { AD0001: 15 }; /* offline demo only; the database trigger decides when online */
  var CFG = {
    customers: { title: 'Customer Management', name: 'Customers', noun: 'customer', key: 'custno', addR: 'customers:0', editR: 'customers:1', delR: 'customers:2', search: ['custno', 'custname', 'address', 'payterm'] },
    products: { title: 'Product Management', name: 'Products', noun: 'product', key: 'prodcode', addR: 'products:0', editR: 'products:1', delR: 'products:2', search: ['prodcode', 'description'] }
  };
  var TBL = {
    customers: { table: 'customer', list: 'customers', key: ['custno'] },
    products: { table: 'product', list: 'products', key: ['prodcode'] },
    price: { table: 'pricehist', list: 'prices', key: ['prodcode', 'effdate'] }
  };
   var LATER = ['Sales', 'Reports', 'System Settings'];

  var I = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    users: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1"/><path d="M17 4a4 4 0 0 1 0 8M22 21v-1a6 6 0 0 0-4-5.6"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    check: '<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/>'
  };

  function ic(n, s) {
    s = s || 20;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[n] + '</svg>';
  }

  /* --- state --- */
  var M = { mod: 'customers', tab: 'active', q: '', page: 1, dlg: null, op: null, remote: false, loading: false, d: { customers: [], products: [], prices: [] } };
  var LOCAL = null, searchTimer = null, toastTimer = null;

  /* --- helpers --- */
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function ts() { var d = new Date(), h = d.getHours(); return today() + ' ' + (h % 12 || 12) + ':' + p2(d.getMinutes()) + ' ' + (h < 12 ? 'AM' : 'PM'); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function money(n) { return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function desc(a, b) { return a.effdate < b.effdate ? 1 : a.effdate > b.effdate ? -1 : 0; }
  function adm() { return S.me.role !== 'User'; }
  function can(r) { return S.me.role !== 'User' || (S.me.rights || []).indexOf(r) > -1; }
  function lab(r) { return M.mod === 'customers' ? r.custname : r.description; }
  function find(mod, key) { return M.d[mod].filter(function (r) { return r[CFG[mod].key] === key; })[0]; }
  function stamp(s) {
    var m = /^(.*?) (\d{4}-\d{2}-\d{2} .*)$/.exec(s || '');
    return m ? '<span class="stamp"><b>' + esc(m[1]) + '</b><br>' + esc(m[2]) + '</span>' : esc(s || '-');
  }
  function toast(msg, err) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('err', !!err);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, err ? 6000 : 3000);
  }

  /* --- data --- */
  function seed() {
    var s = 'ADD system 2026-10-01 9:00 AM', ed = 'EDIT Mark David 2026-10-13 1:01 PM', dl = 'DELETE Jacob Dion 2026-10-13 1:01 PM';
    var cu = [
      ['C0001', 'Globus Medical, Inc', '2560 Gen Armistead Ave Audubon CA 94031', '30D'],
      ['C0002', 'RF Industries, Inc', '7610 Miramar Rd San Diego, CA 92602', '45D', ed],
      ['C0003', 'Trisha Macdowell', '7642 Clairemont Mesa Blvd San Diego CA 90321', 'COD'],
      ['C0004', 'HMS Holdings, Inc', '1000 So Fremont Ave, Suite 225 Alhambra CA 91303', '45D', dl, 1],
      ['C0005', 'Christian Andersen', '1120 Lincoln St Suite 809 Sacramento CA 95815', 'COD'],
      ['C0006', 'Astronics, Inc', '2 Orion Aliso Viejo, CA 92656', '30D'],
      ['C0007', 'Morgan Alegore', '2 Goodyear Irvine, CA 92618', 'COD', ed],
      ['C0008', 'Abaxis, Inc', '3240 Whipple Rd, Union City, CA 94587', '30D'],
      ['C0009', 'Landec Corp.', '3603 Haven Avenue Menlo Park, CA 94025', '30D'],
      ['C0010', 'SMP Corp.', '3718 Northern Long Island NY 12528', '45D'],
      ['C0011', 'B&G Foods', '4 Gatehall Dr., Ste. 110 Parsippany, NJ 07054', '45D']
    ].map(function (a) { return { custno: a[0], custname: a[1], address: a[2], payterm: a[3], stamp: a[4] || s, is_deleted: !!a[5] }; });

    var pr = [
      ['AD0001', 'Toshiba Canvio 1 TB', 'ea', 58], ['AD0002', 'WD Ultra 1TB', 'ea', 69.99, ed],
      ['AD0003', 'Seagate Bracuda 1TB', 'ea', 54.44], ['AD0004', 'Transcend 1 TB', 'ea', 71.99, dl, 1],
      ['AD0005', 'Seagate Expansion 2 TB', 'ea', null, 'ADD Mark David 2026-11-10 9:12 AM'],
      ['AK0001', 'HP Pavilion DV6000', 'pc', 12], ['AK0002', 'Micro Innovations Kb', 'pc', 8.37],
      ['AK0003', 'Steel APEX GAMING KB', 'pc', 99.99], ['AM0001', 'MS Wireless Mouse', 'pc', 38.27],
      ['AM0002', 'LOGITECH 910-002696', 'pc', 72.72], ['AM0003', 'IMICRO KB-IM8911U', 'pc', 21.45],
      ['MD0004', 'Acer S231HL BBID 23', 'ea', 145.43]
    ];

    var products = [], prices = [];
    pr.forEach(function (a) {
      products.push({ prodcode: a[0], description: a[1], unit: a[2], stamp: a[4] || s, is_deleted: !!a[5] });
      if (a[3] !== null) prices.push({ prodcode: a[0], effdate: a[0] === 'MD0004' ? '2010-08-01' : '2010-01-01', unitprice: a[3], stamp: s, is_deleted: false });
    });
    prices.push({ prodcode: 'MD0004', effdate: '2010-05-15', unitprice: 132.21, stamp: s, is_deleted: false });
    return { customers: cu, products: products, prices: prices };
  }

  function mapRow(r) {
    if (!r) return r;
    if (r.is_deleted === undefined && r.status !== undefined) {
      r.is_deleted = String(r.status).trim().toUpperCase() !== 'A';
    }
    return r;
  }

  async function load() {
    if (db) {
      try {
        var r = await Promise.all([
          db.from('customer').select('*').order('custno'),
          db.from('product').select('*').order('prodcode'),
          db.from('pricehist').select('*').order('effdate', { ascending: false })
        ]);
        if (r[0].error) console.error('Customer load error:', r[0].error.message);
        if (r[1].error) console.error('Product load error:', r[1].error.message);
        if (r[2].error) console.error('Pricehist load error:', r[2].error.message);

        if (!r[0].error && !r[1].error) {
          M.d = {
            customers: (r[0].data || []).map(mapRow),
            products: (r[1].data || []).map(mapRow),
            prices: (!r[2].error && r[2].data ? r[2].data : []).map(mapRow)
          };
          M.remote = true;
          return;
        }
      } catch (e) {
        console.error('Supabase load exception:', e);
      }
    }
    M.remote = false;
    if (!LOCAL) LOCAL = seed();
    M.d = LOCAL;
  }

  async function write(what, row, key, verb) {
    var T = TBL[what];
    if (M.remote) {
      var payload = Object.assign({}, row);
      if (!key && (what === 'customers' || what === 'products')) {
        payload.status = 'A';
      }
      if (payload.is_deleted !== undefined) {
        payload.status = payload.is_deleted ? 'I' : 'A';
        delete payload.is_deleted;
      }
      var q = db.from(T.table), r = key ? await q.update(payload).match(key) : await q.insert([payload]);
      if (r.error) return r.error.message;
      await load();
      return '';
    }
    var list = M.d[T.list];
    var o = key && list.filter(function (x) { return Object.keys(key).every(function (k) { return x[k] === key[k]; }); })[0];
    if (o) Object.assign(o, row); else { o = Object.assign({ is_deleted: false }, row); list.push(o); }
    o.stamp = verb + ' ' + H.fullName(S.me) + ' ' + ts();
    return '';
  }

  function keyOf(what, r) {
    var o = {};
    TBL[what].key.forEach(function (k) { o[k] = r[k]; });
    return o;
  }

  /* --- derived lists --- */
  function base() {
    var k = CFG[M.mod].key, l = (M.d[M.mod] || []).slice().sort(function (a, b) { return a[k] < b[k] ? -1 : 1; });
    return adm() ? l : l.filter(function (r) { return !r.is_deleted; });
  }

  function hay(r) {
    return CFG[M.mod].search.map(function (f) { return (r[f] || '') + (f === 'payterm' ? ' ' + TERMS[r[f]] : ''); }).join(' ').toLowerCase();
  }

  function searched() {
    var q = M.q.toLowerCase();
    return base().filter(function (r) { return !q || hay(r).indexOf(q) > -1; });
  }

  function view() {
    var s = searched();
    return adm() ? s.filter(function (r) { return M.tab === 'all' || (M.tab === 'inactive') === !!r.is_deleted; }) : s;
  }

  function priceInfo(code) {
    var t = today();
    var rows = (M.d.prices || []).filter(function (p) { return p.prodcode === code && !p.is_deleted; }).sort(desc);
    return { cur: rows.filter(function (p) { return p.effdate <= t; })[0], next: rows.filter(function (p) { return p.effdate > t; }).pop() };
  }

  /* --- page --- */
  function note() {
    var c = CFG[M.mod], v = [['add', c.addR, 'Adding'], ['edit', c.editR, 'Editing'], ['delete', c.delR, 'Deleting']];
    var ok = v.filter(function (x) { return can(x[1]); }).map(function (x) { return x[0]; });
    var no = v.filter(function (x) { return !can(x[1]); }).map(function (x) { return x[2]; });
    var t = 'You can ' + (ok.length > 2 ? ok.slice(0, -1).join(', ') + ' and ' + ok[ok.length - 1] : ok.length ? ok.join(' and ') : 'view') + ' ' + c.name.toLowerCase();
    if (M.mod === 'products') {
      t += ' and read price history';
      if (!can('products:3') && !can('products:4')) no.push('Changing prices');
    }
    t += '.';
    if (no.length) t += ' ' + no.join(' and ') + ' needs a right you do not have yet.';
    return t;
  }

  function panel() {
    var c = CFG[M.mod], a = adm(), s = searched();
    var n = { active: s.filter(function (r) { return !r.is_deleted; }).length, inactive: s.filter(function (r) { return r.is_deleted; }).length, all: s.length };
    var tabs = a ? '<div class="tabs" role="group" aria-label="Filter by status">' + [['active', 'Active'], ['inactive', 'Inactive'], ['all', 'All']].map(function (t) {
      return '<button type="button" class="tab" aria-pressed="' + (M.tab === t[0]) + '" data-s2="tab" data-a="' + t[0] + '">' + t[1] + ' (' + n[t[0]] + ')</button>';
    }).join('') + '</div>' : '';
    var add = can(c.addR) ? '<button type="button" class="btn btn-primary" data-s2="add">' + ic('plus', 18) + ' Add ' + cap(c.noun) + '</button>' : '';
    return '<section class="s2-card" aria-label="' + c.name + '">' +
      (a ? '' : '<div><h2>' + c.name + '</h2><p class="s2-sub">' + esc(note()) + '</p></div>') +
      '<div class="s2-bar' + (a ? '' : ' user') + '">' + tabs +
      '<div class="s2-tools"><div class="search">' + ic('search', 18) + '<input id="s2-q" class="input" type="search" autocomplete="off" placeholder="Search ' + c.name.toLowerCase() + '" aria-label="Search ' + c.name.toLowerCase() + '" value="' + esc(M.q) + '"></div>' + add + '</div></div>' +
      '<div id="s2-res">' + results() + '</div></section>';
  }

  function empty(icon, title, text, btn) {
    return '<div class="s2-empty"><span class="icon-tile">' + ic(icon, 26) + '</span><h3>' + title + '</h3><p>' + text + '</p>' + (btn || '') + '</div>';
  }

  function results() {
    var c = CFG[M.mod], noun = c.name.toLowerCase(), rows = view(), all = base(), a = adm();
    if (!rows.length) {
      if (!all.length) {
        var may = can(c.addR);
        return empty(M.mod === 'customers' ? 'users' : 'box', 'No ' + noun + ' yet',
          cap(noun) + ' you add will show up here.' + (may ? '' : '<br>Ask an Admin to add the first ' + c.noun + '.'),
          may ? '<button type="button" class="btn btn-primary" data-s2="add">' + ic('plus', 18) + ' Add ' + cap(c.noun) + '</button>' : '');
      }
      if (M.q) return empty('search', 'No ' + noun + ' match "' + esc(M.q) + '"', 'Check the spelling, or search by ' + (M.mod === 'customers' ? 'number, name, address or payment term' : 'code or description') + '.', '<button type="button" class="btn btn-outline" data-s2="clear">Clear search</button>');
      if (M.tab === 'inactive') return empty('check', 'Nothing deleted', 'Deleted ' + noun + ' appear here so an Admin can restore them.');
      return empty(M.mod === 'customers' ? 'users' : 'box', 'No active ' + noun, 'Everything here was deleted. Open the Inactive tab to restore it.');
    }

    var pages = Math.max(1, Math.ceil(rows.length / PER));
    if (M.page > pages) M.page = pages;
    var s = (M.page - 1) * PER, cust = M.mod === 'customers';
    var cols = cust ? ['Cust no', 'Customer name', 'Address', 'Terms'] : ['Prod code', 'Description', 'Unit', 'Current price'];
    if (a) cols = cols.concat(['Status', 'Stamp']);
    cols.push('Actions');

    var th = cols.map(function (h, i) { return '<th' + (!cust && i === 3 ? ' class="num"' : '') + '>' + h + '</th>'; }).join('');
    var tr = rows.slice(s, s + PER).map(function (r) {
      var k = r[c.key], cells = '<td><b>' + esc(k) + '</b></td>';
      if (cust) cells += '<td><b>' + esc(r.custname) + '</b></td><td>' + esc(r.address) + '</td><td>' + esc(TERMS[r.payterm] || r.payterm) + '</td>';
      else {
        var pi = priceInfo(k), p = pi.cur ? money(pi.cur.unitprice) : '<span class="dash">-</span>';
        if (!pi.cur) p += '<small>No price yet</small>';
        if (pi.next) p += '<small>Scheduled ' + money(pi.next.unitprice) + ' from ' + esc(pi.next.effdate) + '</small>';
        cells += '<td><b>' + esc(r.description) + '</b></td><td>' + esc(r.unit) + '</td><td class="num">' + p + '</td>';
      }
      if (a) cells += '<td><span class="pill ' + (r.is_deleted ? 'st-inactive">Inactive' : 'st-active">Active') + '</span></td><td>' + stamp(r.stamp) + '</td>';
      return '<tr' + (r.is_deleted ? ' class="row-del"' : '') + '>' + cells + '<td><div class="nowrap">' + rowActs(r) + '</div></td></tr>';
    }).join('');

    var pg = '<button type="button" class="pg" data-s2="pg" data-a="prev"' + (M.page === 1 ? ' disabled' : '') + '>Previous</button>';
    for (var i = 1; i <= pages; i++) pg += '<button type="button" class="pg' + (i === M.page ? ' on' : '') + '" data-s2="pg" data-a="' + i + '"' + (i === M.page ? ' aria-current="page"' : '') + '>' + i + '</button>';
    pg += '<button type="button" class="pg" data-s2="pg" data-a="next"' + (M.page === pages ? ' disabled' : '') + '>Next</button>';

    return '<div class="table-wrap"><table><thead><tr>' + th + '</tr></thead><tbody>' + tr + '</tbody></table></div>' +
      '<div class="pager"><span>Showing ' + (s + 1) + '-' + Math.min(rows.length, s + PER) + ' of ' + rows.length + ' ' + noun + '</span><nav aria-label="Pages">' + pg + '</nav></div>';
  }

  function rowActs(r) {
    var c = CFG[M.mod], k = esc(r[c.key]), l = esc(lab(r)), h = '';
    if (M.mod === 'products') h += '<button type="button" class="btn btn-soft btn-xs" data-s2="prices" data-a="' + k + '" aria-label="Prices for ' + l + '">Prices</button>';
    if (r.is_deleted) return h + (adm() ? '<button type="button" class="btn btn-soft btn-xs" data-s2="restore" data-a="' + k + '" aria-label="Restore ' + l + '">Restore</button>' : '');
    if (can(c.editR)) h += '<button type="button" class="btn btn-outline btn-xs" data-s2="edit" data-a="' + k + '" aria-label="Edit ' + l + '">Edit</button>';
    if (can(c.delR)) h += '<button type="button" class="btn btn-danger btn-xs" data-s2="del" data-a="' + k + '" aria-label="Delete ' + l + '">Delete</button>';
    return h;
  }

  function mount() {
    var main = document.querySelector('.main');
    if (!main) return;
    var c = CFG[M.mod], cls = S.me.role === 'Superadmin' ? 'b-super' : adm() ? 'b-admin' : 'b-user';
    main.innerHTML = '<header class="header"><h1 id="focus" tabindex="-1">' + c.title + '</h1><div class="header-right"><span class="badge ' + cls + '">' + esc(S.me.role.toUpperCase()) + '</span></div></header>' +
      '<div class="content">' + (M.loading ? '<section class="s2-card"><p class="muted" role="status">Loading ' + c.name.toLowerCase() + '...</p></section>' : panel()) + '</div>';

    Array.prototype.forEach.call(document.querySelectorAll('.side .nav'), function (b) {
      var on = b.getAttribute('data-arg') === c.name;
      b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    document.title = c.title + ' · Hope, Inc. ERP';
  }

  async function openModule(mod) {
    M.mod = mod; M.tab = 'active'; M.q = ''; M.page = 1; M.dlg = null; M.loading = true;
    drawDlg(); mount();
    await load();
    M.loading = false;
    mount();
    var f = document.getElementById('focus');
    if (f) f.focus({ preventScroll: true });
  }

  /* --- dialogs --- */
  function shell(title, sub, inner, cls) {
    return '<div class="overlay" data-s2="overlay"><div class="modal ' + (cls || '') + '" role="dialog" aria-modal="true" aria-labelledby="s2-t">' +
      '<div class="m-head"><div><h2 id="s2-t">' + esc(title) + '</h2>' + (sub ? '<div class="sub">' + esc(sub) + '</div>' : '') + '</div>' +
      '<button type="button" class="icon-btn" data-s2="cancel" aria-label="Close">' + ic('x', 18) + '</button></div>' + inner + '</div></div>';
  }

  function fields(kind, mode) {
    if (kind === 'customers') return [
      { id: 'custno', label: 'Customer no', lock: mode === 'edit', hint: mode === 'edit' ? "The code is the record's identity, so it cannot be changed." : 'Suggested next code. Letter C plus 4 digits.' },
      { id: 'custname', label: 'Customer name', max: 20, hint: 'Up to 20 characters', ph: 'Required' },
      { id: 'address', label: 'Address', max: 50, hint: 'Up to 50 characters', ph: 'Required' },
      { id: 'payterm', label: 'Payment terms', opts: [['', 'Select terms'], ['COD', 'COD'], ['30D', 'Net 30'], ['45D', 'Net 45']] }
    ];
    if (kind === 'products') return [
      { id: 'prodcode', label: 'Prod code', lock: mode === 'edit', hint: mode === 'edit' ? "The code is the record's identity, so it cannot be changed." : 'Two letters plus 4 digits, like AD0001.', ph: 'AD0001' },
      { id: 'description', label: 'Description', max: 30, hint: 'Up to 30 characters', ph: 'Required' },
      { id: 'unit', label: 'Unit', opts: [['', 'Select unit']].concat(UNITS.map(function (u) { return [u, u]; })) }
    ];
    return [
      { id: 'effdate', label: 'Effective date', type: 'date', lock: mode === 'edit', hint: 'The day this price starts. A future date is shown as Scheduled.' },
      { id: 'unitprice', label: 'Unit price', type: 'number', step: '0.01', hint: 'Must be greater than 0', ph: '0.00' }
    ];
  }

  function fld(f, v, e) {
    v = v == null ? '' : v;
    var inv = e ? ' aria-invalid="true" aria-describedby="e-' + f.id + '"' : '', ctl;
    if (f.opts) ctl = '<select class="input" id="f-' + f.id + '"' + inv + '>' + f.opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(v) === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
    else ctl = '<input class="input" id="f-' + f.id + '" type="' + (f.type || 'text') + '"' + (f.step ? ' step="' + f.step + '" min="0"' : '') + (f.max ? ' maxlength="' + f.max + '" data-cnt="1"' : '') + (f.lock ? ' disabled' : '') + (f.ph ? ' placeholder="' + f.ph + '"' : '') + ' value="' + esc(v) + '"' + inv + '>';
    var foot = f.max ? '<div class="hint hc"><span>' + f.hint + '</span><span data-ctr>' + String(v).length + '/' + f.max + '</span></div>' : f.hint ? '<div class="hint">' + f.hint + '</div>' : '';
    return '<div class="field' + (e ? ' err' : '') + '"><label for="f-' + f.id + '">' + f.label + '</label>' + ctl + (e ? '<div class="ferr" id="e-' + f.id + '">' + esc(e) + '</div>' : '') + foot + '</div>';
  }

  function formDlg(d) {
    var n = Object.keys(d.errs || {}).length;
    var banner = d.err ? '<div class="msg msg-err" role="alert">' + ic('alert', 16) + esc(d.err) + '</div>' : n ? '<div class="msg msg-err" role="alert">' + ic('alert', 16) + 'Please fix ' + n + ' field' + (n > 1 ? 's' : '') + ' below.</div>' : '';
    return shell(d.title, d.sub, '<form data-s2form="1" novalidate><div class="m-body">' + banner +
      d.fields.map(function (f) { return fld(f, d.vals[f.id], d.errs && d.errs[f.id]); }).join('') + '</div>' +
      '<div class="m-foot">' + (d.foot || '<span></span>') + '<div class="btns"><button type="button" class="btn btn-outline" data-s2="cancel">Cancel</button><button type="submit" class="btn btn-primary">' + d.submit + '</button></div></div></form>');
  }

  function confirmDlg(d) {
    var bl = d.kind === 'blocked', nm = d.what === 'price' ? 'price' : CFG[d.what].noun;
    var body = bl ? '<div class="msg msg-err">' + esc(d.reason) + '</div>' : '<p class="muted">' +
      (adm() ? 'It is hidden from Users and marked Inactive. You can restore it later. Nothing is permanently erased.' : 'An Admin can restore it if this was a mistake.') + '</p>';
    return '<div class="overlay" data-s2="overlay"><div class="modal confirm" role="alertdialog" aria-modal="true" aria-labelledby="s2-t"><div class="m-body ctr">' +
      '<span class="icon-tile ' + (bl ? 'ic-amber' : 'ic-red') + '">' + ic('trash', 24) + '</span>' +
      '<h2 id="s2-t">' + (bl ? 'This ' + nm + ' cannot be deleted' : 'Delete this ' + nm + '?') + '</h2><span class="chipcode">' + esc(d.label) + '</span>' + body +
      '<div class="row center">' + (bl ? '<button type="button" class="btn btn-outline" data-s2="cancel" data-first>Close</button>' :
      '<button type="button" class="btn btn-outline" data-s2="cancel" data-first>Cancel</button><button type="button" class="btn btn-red" data-s2="dodel">Delete ' + nm + '</button>') +
      '</div></div></div></div>';
  }

  function pricesDlg(d) {
    var p = find('products', d.code) || {}, a = adm(), t = today();
    var rows = (M.d.prices || []).filter(function (x) { return x.prodcode === d.code; }).sort(desc);
    var live = rows.filter(function (x) { return !x.is_deleted; }), cur = live.filter(function (x) { return x.effdate <= t; })[0];
    var cAdd = can('products:3'), cEdit = can('products:4'), cDel = can('products:5'), acts = cAdd || cEdit || cDel;
    var n = { active: live.length, inactive: rows.length - live.length, all: rows.length };
    var shown = a ? rows.filter(function (x) { return d.tab === 'all' || (d.tab === 'inactive') === !!x.is_deleted; }) : live;
    var top = '';
    if (a) top = '<div class="tabs" role="group" aria-label="Filter prices">' + [['active', 'Active'], ['inactive', 'Inactive'], ['all', 'All']].map(function (x) {
      return '<button type="button" class="tab" aria-pressed="' + (d.tab === x[0]) + '" data-s2="ptab" data-a="' + x[0] + '">' + x[1] + ' (' + n[x[0]] + ')</button>';
    }).join('') + '</div>';
    var addBtn = cAdd ? '<button type="button" class="btn btn-primary" data-s2="padd">' + ic('plus', 18) + ' Add Price</button>' : '';
    var warn = !cAdd && !cEdit ? '<div class="msg msg-warn"><b>View only.</b> Ask an Admin for the Add price and Edit price rights.</div>' : '';
    var body;
    if (!shown.length) {
      body = a && d.tab === 'inactive' && rows.length ? empty('check', 'Nothing deleted', 'Deleted prices appear here so an Admin can restore them.') :
        empty('box', 'No prices yet', "Until a price is added, this product's current price shows as - and it cannot be sold.", cAdd ? addBtn : '<span class="muted">Ask an Admin to add a price.</span>');
    } else {
      var th = '<th>Effective date</th><th class="num">Unit price</th>' + (a ? '<th>Status</th><th>Stamp</th>' : '') + (acts ? '<th>Actions</th>' : '');
      var tr = shown.map(function (x) {
        var tag = x.is_deleted ? '' : x === cur ? '<span class="tag">Current</span>' : x.effdate > t ? '<span class="tag soon">Scheduled</span>' : '';
        var ac = '', k = esc(x.effdate);
        if (x.is_deleted) { if (a) ac = '<button type="button" class="btn btn-soft btn-xs" data-s2="prest" data-a="' + k + '">Restore</button>'; }
        else {
          if (cEdit) ac += '<button type="button" class="btn btn-outline btn-xs" data-s2="pedit" data-a="' + k + '" aria-label="Edit price from ' + k + '">Edit</button>';
          if (cDel) ac += '<button type="button" class="btn btn-danger btn-xs" data-s2="pdel" data-a="' + k + '" aria-label="Delete price from ' + k + '">Delete</button>';
        }
        return '<tr' + (x.is_deleted ? ' class="row-del"' : '') + '><td><b>' + k + '</b>' + tag + '</td><td class="num">' + money(x.unitprice) + '</td>' +
          (a ? '<td><span class="pill ' + (x.is_deleted ? 'st-inactive">Inactive' : 'st-active">Active') + '</span></td><td>' + stamp(x.stamp) + '</td>' : '') +
          (acts ? '<td><div class="nowrap">' + ac + '</div></td>' : '') + '</tr>';
      }).join('');
      body = '<div class="table-wrap"><table><thead><tr>' + th + '</tr></thead><tbody>' + tr + '</tbody></table></div>' +
        '<p class="muted">Current price is the row with the latest effective date that is not in the future. Newest first.</p>';
    }
    return shell('Price History · ' + d.code, (p.description || '') + ' · Unit: ' + (p.unit || ''),
      '<div class="m-body">' + warn + (shown.length || a ? '<div class="p-top">' + top + (shown.length && cAdd ? addBtn : '') + '</div>' : '') + body + '</div>' +
      '<div class="m-foot"><span></span><div class="btns"><button type="button" class="btn btn-outline" data-s2="cancel">Close</button></div></div>', 'mid');
  }

  function drawDlg() {
    var host = document.getElementById('s2-host');
    if (!host) { host = document.createElement('div'); host.id = 's2-host'; document.body.appendChild(host); }
    var d = M.dlg;
    host.innerHTML = !d ? '' : d.kind === 'confirm' || d.kind === 'blocked' ? confirmDlg(d) : d.kind === 'prices' ? pricesDlg(d) : formDlg(d);
    if (d) {
      var f = host.querySelector('[data-first]') || host.querySelector('input:not([disabled]), select') || host.querySelector('.m-body button') || host.querySelector('.icon-btn');
      if (f) f.focus();
    }
  }

  function closeDlg() {
    var d = M.dlg;
    if (!d) return;
    if (d.back) { M.dlg = d.back; drawDlg(); return; }
    M.dlg = null; drawDlg(); mount(); refocus();
  }

  function done() { /* after a successful save/delete */
    var d = M.dlg;
    if (d.back) { M.dlg = d.back; drawDlg(); return; }
    M.dlg = null; drawDlg(); mount(); refocus();
  }

  function refocus() {
    var o = M.op, el = o && document.querySelector('[data-s2="' + o.s + '"]' + (o.a != null ? '[data-a="' + o.a + '"]' : ''));
    el = el || document.getElementById('focus');
    if (el) el.focus({ preventScroll: true });
  }

  /* --- actions --- */
  function nextCode() {
    var n = 0;
    M.d.customers.forEach(function (r) { n = Math.max(n, parseInt(String(r.custno).replace(/\D/g, ''), 10) || 0); });
    return 'C' + ('0000' + (n + 1)).slice(-4);
  }

  function openForm(mode, key) {
    var m = M.mod, c = CFG[m], r = mode === 'edit' ? find(m, key) : null, vals = {};
    if (r) Object.keys(r).forEach(function (k) { vals[k] = r[k]; });
    else if (m === 'customers') vals.custno = nextCode();
    M.dlg = {
      kind: m, mode: mode, fields: fields(m, mode), vals: vals, errs: {},
      title: (mode === 'add' ? 'Add ' : 'Edit ') + cap(c.noun),
      sub: mode === 'add' ? 'Status and Stamp are filled in by the system.' : 'Changes are written to the audit log.',
      submit: mode === 'add' ? 'Save ' + cap(c.noun) : 'Save changes',
      foot: r && adm() ? '<div class="hint">Last action<br>' + esc(r.stamp || '') + '</div>' : ''
    };
    drawDlg();
  }

  function openPrice(mode, eff) {
    var prev = M.dlg, r = mode === 'edit' ? M.d.prices.filter(function (x) { return x.prodcode === prev.code && x.effdate === eff; })[0] : null;
    M.dlg = {
      kind: 'price', mode: mode, code: prev.code, back: prev, fields: fields('price', mode), errs: {},
      vals: r ? { effdate: r.effdate, unitprice: r.unitprice } : { effdate: today(), unitprice: '' },
      title: (mode === 'add' ? 'Add' : 'Edit') + ' Price', sub: 'Product ' + prev.code, submit: mode === 'add' ? 'Save Price' : 'Save changes'
    };
    drawDlg();
  }

  function len(e, v, k, max, msg) {
    if (!v[k]) e[k] = msg;
    else if (v[k].length > max) e[k] = 'At most ' + max + ' characters (now ' + v[k].length + ').';
  }

  async function submitForm() {
    var d = M.dlg, v = {}, e = {}, k = d.kind;
    d.fields.forEach(function (f) { var el = document.getElementById('f-' + f.id); v[f.id] = f.lock ? d.vals[f.id] : el.value.trim(); });

    if (k === 'customers') {
      v.custno = String(v.custno).toUpperCase();
      if (!/^C\d{4}$/.test(v.custno)) e.custno = 'Use the letter C plus 4 digits, like C0001.';
      else if (d.mode === 'add' && M.d.customers.some(function (x) { return x.custno === v.custno; })) e.custno = 'Customer number ' + v.custno + ' already exists.';
      len(e, v, 'custname', 20, 'Enter the customer name.');
      len(e, v, 'address', 50, 'Enter the address.');
      if (!v.payterm) e.payterm = 'Choose the payment terms.';
    } else if (k === 'products') {
      v.prodcode = String(v.prodcode).toUpperCase();
      if (!/^[A-Z]{2}\d{4}$/.test(v.prodcode)) e.prodcode = 'Use two letters plus 4 digits, like AD0001.';
      else if (d.mode === 'add' && M.d.products.some(function (x) { return x.prodcode === v.prodcode; })) e.prodcode = 'Product code ' + v.prodcode + ' already exists.';
      len(e, v, 'description', 30, 'Enter the description.');
      if (!v.unit) e.unit = 'Choose a unit.';
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v.effdate)) e.effdate = 'Pick an effective date.';
      else if (d.mode === 'add' && M.d.prices.some(function (x) { return x.prodcode === d.code && x.effdate === v.effdate; })) e.effdate = 'This product already has a price for that date.';
      var n = Number(v.unitprice);
      if (v.unitprice === '' || isNaN(n) || n <= 0) e.unitprice = 'Enter a price greater than 0.';
      else if (n > 99999999.99) e.unitprice = 'Enter a price below 100,000,000.';
    }

    d.vals = v; d.errs = e; d.err = '';
    if (Object.keys(e).length) {
      drawDlg();
      var bad = document.querySelector('#s2-host [aria-invalid="true"]');
      if (bad) bad.focus();
      return;
    }

    var what = k === 'price' ? 'price' : k, row, key = null;
    if (k === 'customers') row = { custno: v.custno, custname: v.custname, address: v.address, payterm: v.payterm };
    else if (k === 'products') row = { prodcode: v.prodcode, description: v.description, unit: v.unit };
    else row = { prodcode: d.code, effdate: v.effdate, unitprice: Number(v.unitprice) };

    if (d.mode === 'edit') {
      key = keyOf(what, row);
      TBL[what].key.forEach(function (x) { delete row[x]; });
    }

    var err = await write(what, row, key, d.mode === 'add' ? 'ADD' : 'EDIT');
    if (err) { d.err = 'Could not save. ' + err; drawDlg(); return; }
    toast(k === 'price' ? (d.mode === 'add' ? 'Price added.' : 'Price saved.') : d.mode === 'add' ? cap(CFG[k].noun) + ' added.' : 'Changes saved to ' + v[CFG[k].key] + '.');
    done();
  }

  function openDel(what, key, label, extra) {
    var prev = M.dlg, blocked = '';
    if (!M.remote) {
      if (what === 'customers' && SALES_C[key]) blocked = 'Cannot delete this customer: ' + SALES_C[key] + ' active sales still refer to it.';
      if (what === 'products') {
        var np = M.d.prices.filter(function (x) { return x.prodcode === key && !x.is_deleted; }).length, ns = SALES_P[key] || 0, parts = [];
        if (ns) parts.push(ns + ' active sale lines');
        if (np) parts.push(np + ' active price' + (np > 1 ? 's' : ''));
        if (parts.length) blocked = 'Cannot delete this product: ' + parts.join(' and ') + ' still refer to it. Delete the prices first.';
      }
    }
    M.dlg = { kind: blocked ? 'blocked' : 'confirm', what: what, key: extra || keyOf(what, find(what, key) || {}), label: label, reason: blocked, back: prev && prev.kind === 'prices' ? prev : null };
    drawDlg();
  }

  async function doDel() {
    var d = M.dlg, err = await write(d.what, { is_deleted: true }, d.key, 'DELETE');
    if (err) { d.kind = 'blocked'; d.reason = err; drawDlg(); return; }
    toast((d.what === 'price' ? 'Price' : cap(CFG[d.what].noun)) + ' deleted.' + (adm() ? ' Find it under Inactive to restore it.' : ''));
    done();
  }

  async function restore(what, key, name) {
    var err = await write(what, { is_deleted: false }, key, 'RESTORE');
    if (err) return toast('Could not restore. ' + err, true);
    toast(name + ' restored.');
    if (M.dlg && M.dlg.kind === 'prices') drawDlg(); else mount();
  }

  /* --- events --- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act="stub"]');
    if (!el || !S || !S.me) return;
    var n = el.getAttribute('data-arg');
    if (n === 'Customers' || n === 'Products') { e.stopPropagation(); openModule(n.toLowerCase()); }
    else if (LATER.indexOf(n) > -1) { e.stopPropagation(); toast(n + ' arrives in a later sprint.'); }
  }, true);

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-s2]');
    if (!el || !S || !S.me) return;
    var act = el.getAttribute('data-s2'), a = el.getAttribute('data-a');
    if (!el.closest('.overlay')) M.op = { s: act, a: a };
    switch (act) {
      case 'overlay': if (e.target === el) closeDlg(); break;
      case 'cancel': closeDlg(); break;
      case 'tab': M.tab = a; M.page = 1; mount(); break;
      case 'pg': M.page = a === 'prev' ? M.page - 1 : a === 'next' ? M.page + 1 : +a; document.getElementById('s2-res').innerHTML = results(); break;
      case 'clear': M.q = ''; M.page = 1; mount(); var q = document.getElementById('s2-q'); if (q) q.focus(); break;
      case 'add': openForm('add'); break;
      case 'edit': openForm('edit', a); break;
      case 'del': var r = find(M.mod, a); openDel(M.mod, a, a + ' · ' + lab(r)); break;
      case 'restore': var rr = find(M.mod, a); restore(M.mod, keyOf(M.mod, rr), cap(CFG[M.mod].noun)); break;
      case 'prices': M.dlg = { kind: 'prices', code: a, tab: 'active' }; drawDlg(); break;
      case 'ptab': M.dlg.tab = a; drawDlg(); break;
      case 'padd': openPrice('add'); break;
      case 'pedit': openPrice('edit', a); break;
      case 'pdel': openDel('price', null, M.dlg.code + ' · ' + a, { prodcode: M.dlg.code, effdate: a }); break;
      case 'prest': restore('price', { prodcode: M.dlg.code, effdate: a }, 'Price'); break;
      case 'dodel': doDel(); break;
    }
  });

  document.addEventListener('submit', function (e) {
    if (!e.target.closest('[data-s2form]')) return;
    e.preventDefault();
    submitForm();
  });

  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 's2-q') {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        M.q = t.value.trim(); M.page = 1;
        var res = document.getElementById('s2-res');
        if (res) res.innerHTML = results();
        var bar = document.querySelectorAll('.s2-bar .tab');
        if (bar.length) mountTabsOnly();
      }, 250);
    } else if (t.matches && t.matches('[data-cnt]')) {
      var c = t.closest('.field').querySelector('[data-ctr]');
      if (c) c.textContent = t.value.length + '/' + t.maxLength;
    }
  });

  function mountTabsOnly() {
    var s = searched();
    var n = { active: s.filter(function (r) { return !r.is_deleted; }).length, inactive: s.filter(function (r) { return r.is_deleted; }).length, all: s.length };
    Array.prototype.forEach.call(document.querySelectorAll('.s2-bar .tab'), function (b) {
      var k = b.getAttribute('data-a');
      b.textContent = cap(k) + ' (' + n[k] + ')';
    });
  }

  document.addEventListener('keydown', function (e) {
    if (!M.dlg) return;
    if (e.key === 'Escape') { e.stopPropagation(); closeDlg(); return; }
    if (e.key !== 'Tab') return;
    var box = document.querySelector('#s2-host .modal');
    if (!box) return;
    var list = Array.prototype.filter.call(box.querySelectorAll('button, input, select'), function (n) { return !n.disabled && n.offsetParent !== null; });
    if (!list.length) return;
    var first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
})(window);


/* ==========================================================================
   SPRINT 3: Human Resources (employees, jobs, departments, job history)
   APPEND this block at the very END of index.js. Nothing above is changed.
   ========================================================================== */
(function (window) {
  'use strict';
  var H = window.HopeERP;
  if (!H) return;
  var esc = H.esc, S = null, KEY = 'hope_erp_hr_v1', toastT = null;

  var oD = H.views.dashboard, oU = H.views.users;
  H.views.dashboard = function (s) { S = s; return oD(s); };
  H.views.users = function (s) { S = s; return oU(s); };

  var I = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    brief: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/>',
    check: '<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>'
  };
  function ic(n, s) { s = s || 20; return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[n] + '</svg>'; }

  /* ---------- data (browser storage prototype, same as Sprint 2 offline mode) ---------- */
  function seed() {
    var s = 'ADD system 2026-10-12 09:00 AM';
    function J(c, d) { return { jobcode: c, jobdesc: d, del: false, stamp: s }; }
    function Dp(c, d) { return { deptcode: c, deptname: d, del: false, stamp: s }; }
    function E(n, l, f, g, b, h, sp, del, st) { return { empno: n, lastname: l, firstname: f, gender: g, birthdate: b, hiredate: h, sepdate: sp || '', del: !!del, stamp: st || s }; }
    function Hh(n, j, d, e, sal) { return { empno: n, jobcode: j, deptcode: d, effdate: e, salary: sal, del: false, stamp: s }; }
    return {
      jobs: [J('PRES', 'President'), J('VP', 'Vice president'), J('MGR', 'Manager'), J('SA1', 'Sales Agent 1'), J('SA2', 'Sales Agent 2'), J('SPVR', 'Supervisor'), J('CLK1', 'Clerk 1'), J('CLK2', 'Clerk 2'), J('PR1', 'Programmer 1'), J('PR2', 'Programmer 2'), J('ANL', 'Analyst')],
      depts: [Dp('ACT', 'Accounting'), Dp('BR1', 'Sales Branch 1'), Dp('BR2', 'Sales Branch 2'), Dp('EXC', 'Executive'), Dp('HRD', 'Human Resource'), Dp('IT', 'Information Tech'), Dp('PAY', 'Payroll'), Dp('WHS', 'Warehouse')],
      emps: [E('00001', 'Smith', 'John', 'M', '1985-02-20', '2010-05-11'), E('00003', 'Smith', 'Jane', 'F', '1990-05-16', '2010-05-11'), E('00005', 'King', 'Don', 'M', '1986-02-14', '2010-06-23'),
        E('00007', 'Jenskin', 'Floyd', 'M', '1990-02-20', '2010-05-30', '', false, 'EDIT David Kim 2026-11-05 10:20 AM'), E('00015', 'Zulueta', 'Maggie', 'F', '1990-08-03', '2010-07-05', '2011-03-30'),
        E('00023', 'Dela Cruz', 'Ana', 'F', '1992-01-10', '2012-03-01', '', true)],
      hist: [Hh('00001', 'PR1', 'IT', '2010-05-11', 48000), Hh('00001', 'PR2', 'IT', '2010-12-01', 50000), Hh('00001', 'MGR', 'IT', '2030-01-01', 65000),
        Hh('00003', 'PR1', 'IT', '2010-05-11', 50000), Hh('00003', 'ANL', 'IT', '2010-12-01', 55000),
        Hh('00007', 'ANL', 'IT', '2010-05-30', 55000), Hh('00007', 'MGR', 'IT', '2011-01-02', 60000), Hh('00007', 'VP', 'IT', '2011-03-31', 80000),
        Hh('00015', 'SA1', 'BR1', '2010-07-05', 36000)]
    };
  }
  var D;
  try { D = JSON.parse(window.localStorage.getItem(KEY)); } catch (e) { D = null; }
  if (!D || !D.emps) D = seed();
  function save() { try { window.localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} }

  /* ---------- state + helpers ---------- */
  var R = { tab: 'employees', f: 'active', q: '', dlg: null, prof: null, op: null };
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function ts() { var d = new Date(), h = d.getHours(); return today() + ' ' + p2(h % 12 || 12) + ':' + p2(d.getMinutes()) + ' ' + (h < 12 ? 'AM' : 'PM'); }
  function money(n) { return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function adm() { return S.me.role !== 'User'; }
  function can(i) { return S.me.role !== 'User' || (S.me.rights || []).indexOf('hr:' + i) > -1; }
  function mk(verb) { return verb + ' ' + H.fullName(S.me) + ' ' + ts(); }
  function toast(m, err) {
    var el = document.getElementById('toast'); if (!el) return;
    el.textContent = m; el.classList.toggle('err', !!err); el.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('show'); }, err ? 6000 : 3000);
  }
  function stamp(s) {
    var m = /^(\w+ .*?) (\d{4}-\d{2}-\d{2} .*)$/.exec(s || '');
    return m ? '<span class="stamp"><b>' + esc(m[1]) + '</b><br>' + esc(m[2]) + '</span>' : esc(s || '-');
  }
  function jobName(c) { var j = D.jobs.filter(function (x) { return x.jobcode === c; })[0]; return j ? j.jobdesc : c; }
  function deptName(c) { var d = D.depts.filter(function (x) { return x.deptcode === c; })[0]; return d ? d.deptname : (c || 'None'); }
  function emp(n) { return D.emps.filter(function (e) { return e.empno === n; })[0]; }
  function ename(e) { return e.firstname + ' ' + e.lastname; }
  function mon(a, b) { var x = a.split('-'), y = b.split('-'); return (y[0] - x[0]) * 12 + (y[1] - x[1]) - (+y[2] < +x[2] ? 1 : 0); }
  function dur(m) { if (m < 1) return 'Less than a month'; var y = Math.floor(m / 12), r = m % 12; return (y ? y + ' yr' + (y > 1 ? 's' : '') + ' ' : '') + (r ? r + ' mo' + (r > 1 ? 's' : '') : '').trim(); }
  function used(what, code) {
    return D.hist.filter(function (h) { return !h.del && (what === 'jobs' ? h.jobcode : h.deptcode) === code; }).length;
  }

  /* timeline model: tags, deltas, current/scheduled */
  function timeline(e) {
    var t = today(), act = D.hist.filter(function (h) { return h.empno === e.empno && !h.del; }).sort(function (a, b) { return a.effdate < b.effdate ? -1 : 1; });
    var curI = -1; act.forEach(function (h, i) { if (h.effdate <= t) curI = i; });
    return act.map(function (h, i) {
      var p = act[i - 1], tag = 'Joined', delta = 0;
      if (p) {
        delta = h.salary - p.salary;
        tag = h.jobcode !== p.jobcode ? (h.salary > p.salary ? 'Promotion' : 'Job change') : h.deptcode !== p.deptcode ? 'Transfer' : h.salary > p.salary ? 'Raise' : 'Update';
      }
      var nx = act[i + 1], end = nx && nx.effdate <= t ? nx.effdate : e.sepdate || '';
      var state = h.effdate > t ? 'sched' : (i === curI && !e.sepdate) ? 'cur' : 'past';
      return { r: h, tag: tag, delta: delta, state: state, end: end, next: nx };
    });
  }
  function curPos(e) { var tl = timeline(e).filter(function (x) { return x.state !== 'sched'; }); return tl.length ? tl[tl.length - 1].r : null; }

  /* ---------- screens ---------- */
  function empty(icon, title, text, btn) { return '<div class="s2-empty"><span class="icon-tile">' + ic(icon, 26) + '</span><h3>' + title + '</h3><p>' + text + '</p>' + (btn || '') + '</div>'; }
  function rowsFor() {
    var q = R.q.toLowerCase(), key = { employees: 'emps', jobs: 'jobs', departments: 'depts' }[R.tab];
    var l = D[key].filter(function (r) { return adm() || !r.del; });
    return l.filter(function (r) { return !q || JSON.stringify(r).toLowerCase().indexOf(q) > -1; });
  }
  function counts(l) { return { active: l.filter(function (r) { return !r.del; }).length, inactive: l.filter(function (r) { return r.del; }).length, all: l.length }; }

  function listHtml() {
    var all = rowsFor(), n = counts(all), a = adm(), tab = R.tab;
    var rows = a ? all.filter(function (r) { return R.f === 'all' || (R.f === 'inactive') === r.del; }) : all;
    var noun = tab === 'employees' ? 'employee' : tab === 'jobs' ? 'job' : 'department';
    var addI = tab === 'employees' ? 6 : tab === 'jobs' ? 0 : 3, edI = addI + 1, delI = addI + 2;
    if (!rows.length) {
      if (R.q) return empty('search', 'No ' + tab + ' match "' + esc(R.q) + '"', 'Check the spelling, or search by code, last name or first name.', '<button type="button" class="btn btn-outline" data-hr="clear">Clear search</button>');
      if (a && R.f === 'inactive') return empty('check', 'Nothing deleted', 'Deleted ' + tab + ' appear here so an Admin can restore them.');
      return empty('brief', 'No ' + tab + ' yet', can(addI) ? 'Add the first ' + noun + '.' : 'Ask an Admin to add the first ' + noun + '.');
    }
    var th, tr;
    if (tab === 'employees') {
      th = ['Emp no', 'Last name', 'First name', 'Sex', 'Birth date', 'Hire date', 'Sep date'].concat(a ? ['Status', 'Stamp'] : []).concat(['Actions']);
      tr = rows.map(function (e) {
        var ac = '';
        if (can(9)) ac += '<button type="button" class="btn btn-soft btn-xs" data-hr="hist" data-a="' + e.empno + '">History</button>';
        if (e.del) { if (a) ac += '<button type="button" class="btn btn-soft btn-xs" data-hr="restore" data-a="' + e.empno + '">Restore</button>'; }
        else {
          if (can(7)) ac += '<button type="button" class="btn btn-outline btn-xs" data-hr="edit" data-a="' + e.empno + '">Edit</button>';
          if (can(8)) ac += '<button type="button" class="btn btn-danger btn-xs" data-hr="del" data-a="' + e.empno + '">Delete</button>';
        }
        return '<tr' + (e.del ? ' class="row-del"' : '') + '><td><code>' + e.empno + '</code></td><td><button type="button" class="link hr-link" data-hr="prof" data-a="' + e.empno + '">' + esc(e.lastname) + '</button></td><td>' + esc(e.firstname) + '</td><td>' + e.gender + '</td><td>' + e.birthdate + '</td><td>' + e.hiredate + '</td><td>' + (e.sepdate ? e.sepdate + '<br><span class="pill st-none">Separated</span>' : '—') + '</td>' +
          (a ? '<td><span class="pill ' + (e.del ? 'st-inactive">Inactive' : 'st-active">Active') + '</span></td><td>' + stamp(e.stamp) + '</td>' : '') + '<td><div class="nowrap">' + ac + '</div></td></tr>';
      });
    } else {
      var isJ = tab === 'jobs', ck = isJ ? 'jobcode' : 'deptcode', nk = isJ ? 'jobdesc' : 'deptname';
      th = [isJ ? 'Job code' : 'Dept code', isJ ? 'Description' : 'Department name'].concat(a ? ['Status', 'Stamp'] : []).concat(['Actions']);
      tr = rows.map(function (r) {
        var ac = '';
        if (r.del) { if (a) ac = '<button type="button" class="btn btn-soft btn-xs" data-hr="restore" data-a="' + r[ck] + '">Restore</button>'; }
        else {
          if (can(edI)) ac += '<button type="button" class="btn btn-outline btn-xs" data-hr="edit" data-a="' + r[ck] + '">Edit</button>';
          if (can(delI)) ac += '<button type="button" class="btn btn-danger btn-xs" data-hr="del" data-a="' + r[ck] + '">Delete</button>';
        }
        return '<tr' + (r.del ? ' class="row-del"' : '') + '><td><code>' + esc(r[ck]) + '</code></td><td><b>' + esc(r[nk]) + '</b></td>' +
          (a ? '<td><span class="pill ' + (r.del ? 'st-inactive">Inactive' : 'st-active">Active') + '</span></td><td>' + stamp(r.stamp) + '</td>' : '') + '<td><div class="nowrap">' + ac + '</div></td></tr>';
      });
    }
    return '<div class="table-wrap"><table><thead><tr>' + th.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' + tr.join('') + '</tbody></table></div>';
  }

  function panel() {
    var a = adm(), n = counts(rowsFor()), tab = R.tab;
    var tabs = ['employees', 'jobs', 'departments'].map(function (t) { return '<button type="button" class="hr-tab' + (t === tab ? ' on' : '') + '" data-hr="tab" data-a="' + t + '"' + (t === tab ? ' aria-current="page"' : '') + '>' + t.charAt(0).toUpperCase() + t.slice(1) + '</button>'; }).join('');
    var chips = a ? '<div class="tabs" role="group" aria-label="Filter by status">' + [['active', 'Active'], ['inactive', 'Inactive'], ['all', 'All']].map(function (t) { return '<button type="button" class="tab" aria-pressed="' + (R.f === t[0]) + '" data-hr="f" data-a="' + t[0] + '">' + t[1] + ' (' + n[t[0]] + ')</button>'; }).join('') + '</div>' : '';
    var addI = tab === 'employees' ? 6 : tab === 'jobs' ? 0 : 3, noun = tab === 'employees' ? 'Employee' : tab === 'jobs' ? 'Job' : 'Department';
    var add = can(addI) ? '<button type="button" class="btn btn-primary" data-hr="add">' + ic('plus', 18) + ' Add ' + noun + '</button>' : '';
    return '<section class="s2-card" aria-label="Human Resources"><div><h2>Human Resources</h2><p class="s2-sub">' + (a ? 'You see every record, including deleted ones. Deleted rows are shaded and can be restored.' : 'You see active records only. The buttons you have depend on your rights.') + '</p></div>' +
      '<div class="hr-tabs" role="navigation" aria-label="Sections">' + tabs + '</div>' +
      '<div class="s2-bar' + (a ? '' : ' user') + '">' + chips + '<div class="s2-tools"><div class="search">' + ic('search', 18) + '<input id="hr-q" class="input" type="search" autocomplete="off" placeholder="Search ' + tab + '..." aria-label="Search ' + tab + '" value="' + esc(R.q) + '"></div>' + add + '</div></div>' +
      '<div id="hr-res">' + listHtml() + '</div></section>';
  }

  function profile() {
    var e = emp(R.prof); if (!e) { R.prof = null; return panel(); }
    var a = adm(), v = can(9), cp = v ? curPos(e) : null, tl = v ? timeline(e).reverse() : [];
    var sep = !!e.sepdate;
    var top = '<div class="p-top"><button type="button" class="btn btn-outline" data-hr="back">&larr; Employees</button><div class="row">' +
      (can(7) && !e.del ? '<button type="button" class="btn btn-outline" data-hr="edit" data-a="' + e.empno + '">Edit employee</button>' : '') +
      (can(10) && !e.del ? '<button type="button" class="btn btn-primary" data-hr="hadd2" data-a="' + e.empno + '">+ Add history</button>' : '') + '</div></div>';
    var head = '<div class="hr-id"><span class="avatar hr-av">' + esc(e.firstname.charAt(0) + e.lastname.charAt(0)) + '</span><div><h2>' + esc(ename(e)) + '</h2><div class="row"><span class="chipcode">' + e.empno + '</span>' + (a ? '<span class="pill ' + (e.del ? 'st-inactive">Inactive' : 'st-active">Active') + '</span>' : '') + (sep ? '<span class="pill st-none">Separated</span>' : '') + '</div></div></div>';
    var tenure = mon(e.hiredate, sep ? e.sepdate : today());
    var facts = '<div class="hr-box"><h3 class="hr-cap">Personal and employment facts</h3><dl class="hr-dl"><div><dt>Gender</dt><dd>' + (e.gender === 'M' ? 'Male' : 'Female') + '</dd></div><div><dt>Birth date</dt><dd>' + e.birthdate + '</dd></div><div><dt>Hire date</dt><dd>' + e.hiredate + '</dd></div>' +
      (sep ? '<div><dt>Separation date</dt><dd>' + e.sepdate + '</dd></div>' : '<div><dt>Status</dt><dd>Still employed</dd></div>') + '<div><dt>Tenure</dt><dd>' + dur(tenure) + (sep ? ' (until separation)' : '') + '</dd></div>' + (a ? '<div><dt>Last change</dt><dd>' + stamp(e.stamp) + '</dd></div>' : '') + '</dl></div>';
    var pos = '<div class="hr-box"><h3 class="hr-cap">' + (sep ? 'Last position' : 'Current position') + '</h3>' + (!v ? '<p class="muted">Hidden. You need the “View job history” right.</p>' : cp ? '<div class="hr-big">' + esc(jobName(cp.jobcode)) + '</div><p class="muted">' + esc(deptName(cp.deptcode)) + '</p><p><b class="hr-sal">' + money(cp.salary) + '</b> <span class="muted">since ' + cp.effdate + '</span></p>' : '<p class="muted">No job history yet.</p>') + '</div>';
    var tlh;
    if (!v) tlh = locked();
    else tlh = '<div class="p-top"><h3 class="hr-cap">Job timeline</h3><button type="button" class="btn btn-soft" data-hr="hist" data-a="' + e.empno + '">Open Job History</button></div>' + (tl.length ? timelineHtml(timeline(e).reverse(), e, false) : empty('brief', 'No job history yet', 'Add the first job to start the timeline.'));
    return '<section class="s2-card">' + top + head + '<div class="hr-2">' + facts + pos + '</div><div class="hr-box">' + tlh + '</div></section>';
  }
  function locked() { return '<div class="hr-lock"><span class="icon-tile">' + ic('lock', 22) + '</span><div><b>Job history is private</b><p class="muted">Salary and job changes are personal data. Ask an Admin for the “View job history” right to see them.</p></div></div>'; }

  function timelineHtml(items, e, acts, filter) {
    var t = today();
    return '<ol class="tl" aria-label="Job timeline of ' + esc(ename(e)) + ', newest first">' + items.map(function (x) {
      var r = x.r, cls = x.state === 'cur' ? ' cur' : x.state === 'sched' ? ' sched' : '';
      var chips = (x.state === 'cur' ? '<span class="tchip ok">Current</span>' : '') + (x.state === 'sched' ? '<span class="tchip info">Scheduled</span>' : '') + '<span class="tchip ' + (x.tag === 'Job change' ? 'info' : x.tag === 'Transfer' ? 'warn' : 'ok') + '">' + x.tag + '</span>';
      var delta = x.delta ? '<span class="tchip ' + (x.delta > 0 ? 'ok' : 'bad') + '">' + (x.delta > 0 ? '+' : '-') + money(Math.abs(x.delta)) + '</span>' : '';
      var span = x.state === 'cur' ? 'Since ' + r.effdate + ' · ' + dur(mon(r.effdate, t)) + ' so far' : x.state === 'sched' ? 'Starts ' + r.effdate : r.effdate + ' → ' + (x.end || '') + ' · ' + dur(mon(r.effdate, x.end || t)) + (e.sepdate && !x.next ? ' · left the company' : '');
      var ac = '';
      if (acts) {
        if (can(11)) ac += '<button type="button" class="btn btn-outline btn-xs" data-hr="hedit" data-a="' + r.effdate + '">Edit</button>';
        if (can(12)) ac += '<button type="button" class="btn btn-danger btn-xs" data-hr="hdel" data-a="' + r.effdate + '">Delete</button>';
      }
      return '<li class="tl-i' + cls + '"><span class="tl-dot" aria-hidden="true"></span><div class="tl-card"><div class="row tl-top"><b>' + r.effdate + '</b>' + chips + '</div><div class="tl-job">' + esc(jobName(r.jobcode)) + ' <span class="muted">· ' + esc(deptName(r.deptcode)) + '</span></div><div class="row"><b>' + money(r.salary) + '</b>' + delta + '<span class="muted">' + span + '</span></div>' + (ac ? '<div class="nowrap">' + ac + '</div>' : '') + '</div></li>';
    }).join('') + '</ol>';
  }

  function mount() {
    var main = document.querySelector('.main'); if (!main || !S || !S.me) return;
    var cls = S.me.role === 'Superadmin' ? 'b-super' : adm() ? 'b-admin' : 'b-user';
    main.innerHTML = '<header class="header"><h1 id="focus" tabindex="-1">' + (R.prof ? 'Employee profile' : 'Human Resources') + '</h1><div class="header-right"><span class="badge ' + cls + '">' + esc(S.me.role) + '</span></div></header><div class="content">' + (R.prof ? profile() : panel()) + '</div>';
    Array.prototype.forEach.call(document.querySelectorAll('.side .nav'), function (b) {
      var on = b.getAttribute('data-arg') === 'Human Resources'; b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    document.title = 'Human Resources · Hope, Inc. ERP';
  }
  function res() { var r = document.getElementById('hr-res'); if (r) r.innerHTML = listHtml(); }

  /* ---------- dialogs ---------- */
  function shell(title, sub, inner, cls) {
    return '<div class="overlay" data-hr="overlay"><div class="modal ' + (cls || '') + '" role="dialog" aria-modal="true" aria-labelledby="hr-t"><div class="m-head"><div><h2 id="hr-t">' + esc(title) + '</h2>' + (sub ? '<div class="sub">' + esc(sub) + '</div>' : '') + '</div><button type="button" class="icon-btn" data-hr="cancel" aria-label="Close">' + ic('x', 18) + '</button></div>' + inner + '</div></div>';
  }
  function fld(f, v, e) {
    v = v == null ? '' : v; var inv = e ? ' aria-invalid="true"' : '', c;
    if (f.radio) c = '<div class="row" role="radiogroup" aria-label="' + f.label + '">' + f.opts.map(function (o) { return '<label class="chk"><input type="radio" name="f-' + f.id + '" value="' + o[0] + '"' + (v === o[0] ? ' checked' : '') + '> ' + o[1] + '</label>'; }).join('') + '</div>';
    else if (f.opts) c = '<select class="input" id="f-' + f.id + '"' + inv + '>' + f.opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(v) === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
    else c = '<input class="input" id="f-' + f.id + '" type="' + (f.type || 'text') + '"' + (f.step ? ' step="0.01" min="0"' : '') + (f.max ? ' maxlength="' + f.max + '"' : '') + (f.lock ? ' disabled' : '') + ' value="' + esc(v) + '"' + inv + '>';
    return '<div class="field' + (e ? ' err' : '') + '"><label for="f-' + f.id + '">' + f.label + '</label>' + c + (f.hint ? '<div class="hint">' + f.hint + '</div>' : '') + (e ? '<div class="ferr">' + esc(e) + '</div>' : '') + '</div>';
  }
  function formDlg(d) {
    var n = Object.keys(d.errs || {}).length;
    var banner = n ? '<div class="msg msg-err" role="alert">' + ic('alert', 16) + 'Please fix ' + n + ' field' + (n > 1 ? 's' : '') + ' below.</div>' : '';
    return shell(d.title, d.sub, '<form data-hrform="1" novalidate><div class="m-body">' + banner + d.fields.map(function (f) { return fld(f, d.vals[f.id], d.errs[f.id]); }).join('') + '</div><div class="m-foot"><span class="hint">Status and stamp are filled in by the system.</span><div class="btns"><button type="button" class="btn btn-outline" data-hr="cancel">Cancel</button><button type="submit" class="btn btn-primary">' + d.submit + '</button></div></div></form>');
  }
  function confirmDlg(d) {
    var bl = !!d.reason;
    return '<div class="overlay" data-hr="overlay"><div class="modal confirm" role="alertdialog" aria-modal="true" aria-labelledby="hr-t"><div class="m-body ctr"><span class="icon-tile ' + (bl ? 'ic-amber' : 'ic-red') + '">' + ic('trash', 24) + '</span><h2 id="hr-t">' + (bl ? 'This ' + d.noun + ' cannot be deleted' : 'Delete this ' + d.noun + '?') + '</h2><span class="chipcode">' + esc(d.label) + '</span>' +
      (bl ? '<div class="msg msg-err">' + esc(d.reason) + '</div>' : '<p class="muted">' + (adm() ? 'It is hidden from Users and marked Inactive. You can restore it later. Nothing is permanently erased.' : 'An Admin can restore it if this was a mistake.') + '</p>') +
      '<div class="row center">' + (bl ? '<button type="button" class="btn btn-outline" data-hr="cancel" data-first>Close</button>' : '<button type="button" class="btn btn-outline" data-hr="cancel" data-first>Cancel</button><button type="button" class="btn btn-red" data-hr="dodel">Delete ' + d.noun + '</button>') + '</div></div></div></div>';
  }
  function histDlg(d) {
    var e = emp(d.emp), a = adm(), cp = curPos(e), all = D.hist.filter(function (h) { return h.empno === e.empno; });
    var n = counts(all.map(function (h) { return { del: h.del }; }));
    var tlAll = timeline(e), shown = tlAll;
    if (a && d.f !== 'active') {
      var inact = all.filter(function (h) { return h.del; }).map(function (h) { return { r: h, tag: 'Inactive', delta: 0, state: 'past', end: '', next: null, off: true }; });
      shown = d.f === 'inactive' ? inact : tlAll.concat(inact);
    }
    shown = shown.slice().sort(function (x, y) { return x.r.effdate < y.r.effdate ? 1 : -1; });
    var box = function (k, v) { return '<div class="hr-sum"><span>' + k + '</span><b>' + v + '</b></div>'; };
    var top = '<div class="hr-sums">' + box('Job', cp ? esc(jobName(cp.jobcode)) : '—') + box('Department', cp ? esc(deptName(cp.deptcode)) : '—') + box('Salary', cp ? money(cp.salary) : '—') + '</div>';
    var views = '<div class="tabs"><button type="button" class="tab" aria-pressed="' + (d.v === 'tl') + '" data-hr="hv" data-a="tl">Timeline</button><button type="button" class="tab" aria-pressed="' + (d.v === 'tb') + '" data-hr="hv" data-a="tb">Table</button></div>';
    var flt = a ? '<div class="tabs">' + [['active', 'Active'], ['inactive', 'Inactive'], ['all', 'All']].map(function (t) { return '<button type="button" class="tab" aria-pressed="' + (d.f === t[0]) + '" data-hr="hf" data-a="' + t[0] + '">' + t[1] + ' (' + n[t[0]] + ')</button>'; }).join('') + '</div>' : '';
    var add = can(10) ? '<button type="button" class="btn btn-primary" data-hr="hadd">+ Add History</button>' : '';
    var body;
    if (!shown.length) body = empty('brief', 'No job history yet', 'Add the first job to start the timeline.', add);
    else if (d.v === 'tl') body = '<ol class="tl">' + shown.map(function (x) {
      if (x.off) return '<li class="tl-i"><span class="tl-dot"></span><div class="tl-card hatch"><div class="row"><b>' + x.r.effdate + '</b><span class="tchip">Inactive</span></div><div class="tl-job">' + esc(jobName(x.r.jobcode)) + ' <span class="muted">· ' + esc(deptName(x.r.deptcode)) + '</span></div><b>' + money(x.r.salary) + '</b><div class="muted">' + stamp(x.r.stamp) + '</div>' + (a ? '<button type="button" class="btn btn-soft btn-xs" data-hr="hrest" data-a="' + x.r.effdate + '">Restore</button>' : '') + '</div></li>';
      return timelineHtml([x], e, true).replace(/^<ol[^>]*>|<\/ol>$/g, '');
    }).join('') + '</ol>';
    else body = '<div class="table-wrap"><table><thead><tr><th>Effective date</th><th>Job</th><th>Department</th><th>Salary</th>' + (a ? '<th>Stamp</th>' : '') + '</tr></thead><tbody>' + shown.map(function (x) { return '<tr' + (x.off ? ' class="row-del"' : '') + '><td>' + x.r.effdate + '</td><td>' + esc(jobName(x.r.jobcode)) + '</td><td>' + esc(deptName(x.r.deptcode)) + '</td><td>' + money(x.r.salary) + '</td>' + (a ? '<td>' + stamp(x.r.stamp) + '</td>' : '') + '</tr>'; }).join('') + '</tbody></table></div>';
    return shell('Job History — ' + e.empno, ename(e) + ' · Hired ' + e.hiredate, '<div class="m-body">' + top + '<div class="p-top">' + views + flt + add + '</div>' + body + '</div><div class="m-foot"><span class="hint">' + (a ? 'Birth date and salary are personal data. Every view and change is recorded in the stamp.' : 'Salary is personal data. Please do not share it.') + '</span><div class="btns"><button type="button" class="btn btn-primary" data-hr="cancel">Done</button></div></div>', 'mid');
  }
  function draw() {
    var host = document.getElementById('hr-host');
    if (!host) { host = document.createElement('div'); host.id = 'hr-host'; document.body.appendChild(host); }
    var d = R.dlg;
    host.innerHTML = !d ? '' : d.kind === 'confirm' ? confirmDlg(d) : d.kind === 'hist' ? histDlg(d) : formDlg(d);
    if (d) { var f = host.querySelector('[data-first]') || host.querySelector('input:not([disabled]), select') || host.querySelector('.icon-btn'); if (f) f.focus(); }
  }
  function close() {
    var d = R.dlg; if (!d) return;
    if (d.back) { R.dlg = d.back; draw(); return; }
    R.dlg = null; draw(); mount(); refocus();
  }
  function refocus() {
    var o = R.op, el = o && document.querySelector('[data-hr="' + o.s + '"]' + (o.a != null ? '[data-a="' + o.a + '"]' : ''));
    el = el || document.getElementById('focus'); if (el) el.focus({ preventScroll: true });
  }

  /* ---------- forms ---------- */
  function openForm(kind, key, back) {
    var tab = R.tab, vals = {}, fields, r, title, ed = key != null && kind !== 'hist';
    if (kind === 'emp') {
      r = ed ? emp(key) : null; if (r) Object.keys(r).forEach(function (k) { vals[k] = r[k]; });
      fields = [{ id: 'empno', label: 'Employee number', lock: ed, max: 5, hint: ed ? 'The number is the record’s identity, so it cannot be changed.' : '5 digits. Must be new.' },
        { id: 'lastname', label: 'Last name', max: 15, hint: 'Up to 15 characters.' }, { id: 'firstname', label: 'First name', max: 15, hint: 'Up to 15 characters.' },
        { id: 'gender', label: 'Gender', radio: true, opts: [['M', 'Male'], ['F', 'Female']] },
        { id: 'birthdate', label: 'Birth date', type: 'date' }, { id: 'hiredate', label: 'Hire date', type: 'date' },
        { id: 'sepdate', label: 'Separation date (optional)', type: 'date', hint: 'Fill this in only when the employee has left the company. This is not the same as deleting the record.' }];
      title = (ed ? 'Edit' : 'Add') + ' Employee';
    } else if (kind === 'job') {
      r = ed ? D.jobs.filter(function (x) { return x.jobcode === key; })[0] : null; if (r) vals = { jobcode: r.jobcode, jobdesc: r.jobdesc };
      fields = [{ id: 'jobcode', label: 'Job code', lock: ed, max: 4, hint: '2 to 4 capital letters or digits. Must be new.' }, { id: 'jobdesc', label: 'Description', max: 20, hint: 'Up to 20 characters.' }];
      title = (ed ? 'Edit' : 'Add') + ' Job';
    } else if (kind === 'dept') {
      r = ed ? D.depts.filter(function (x) { return x.deptcode === key; })[0] : null; if (r) vals = { deptcode: r.deptcode, deptname: r.deptname };
      fields = [{ id: 'deptcode', label: 'Department code', lock: ed, max: 3, hint: '2 or 3 capital letters or digits. Must be new.' }, { id: 'deptname', label: 'Department name', max: 20, hint: 'Up to 20 characters.' }];
      title = (ed ? 'Edit' : 'Add') + ' Department';
    } else {
      var em = emp(back.emp); ed = key != null;
      r = ed ? D.hist.filter(function (h) { return h.empno === em.empno && h.effdate === key && !h.del; })[0] : null;
      vals = r ? { jobcode: r.jobcode, deptcode: r.deptcode, effdate: r.effdate, salary: r.salary } : { jobcode: '', deptcode: '', effdate: today(), salary: '' };
      fields = [{ id: 'jobcode', label: 'Job', lock: ed, opts: [['', 'Select a job']].concat(D.jobs.filter(function (j) { return !j.del; }).map(function (j) { return [j.jobcode, j.jobdesc]; })) },
        { id: 'deptcode', label: 'Department', opts: [['', 'None']].concat(D.depts.filter(function (x) { return !x.del; }).map(function (x) { return [x.deptcode, x.deptname]; })) },
        { id: 'effdate', label: 'Effective date', type: 'date', lock: ed, hint: 'Not before the hire date (' + em.hiredate + '). A future date schedules a change.' },
        { id: 'salary', label: 'Salary (USD)', type: 'number', step: 1 }];
      title = (ed ? 'Edit' : 'Add') + ' History';
    }
    R.dlg = { kind: 'form', form: kind, mode: ed ? 'edit' : 'add', key: key, fields: fields, vals: vals, errs: {}, title: title, sub: kind === 'hist' ? ename(emp(back.emp)) + ' · ' + back.emp : '', submit: ed ? 'Save changes' : 'Save ' + title.split(' ')[1], back: back || null };
    draw();
  }
  function submitForm() {
    var d = R.dlg, v = {}, e = {}, k = d.form;
    d.fields.forEach(function (f) {
      if (f.lock) { v[f.id] = d.vals[f.id]; return; }
      if (f.radio) { var c = document.querySelector('#hr-host input[name="f-' + f.id + '"]:checked'); v[f.id] = c ? c.value : ''; }
      else v[f.id] = document.getElementById('f-' + f.id).value.trim();
    });
    function len(id, max, msg) { if (!v[id]) e[id] = msg; else if (v[id].length > max) e[id] = 'At most ' + max + ' characters (now ' + v[id].length + ').'; }
    var t = today();
    if (k === 'emp') {
      if (!/^\d{5}$/.test(v.empno)) e.empno = 'Use exactly 5 digits.'; else if (d.mode === 'add' && emp(v.empno)) e.empno = 'Employee number ' + v.empno + ' already exists.';
      len('lastname', 15, 'Enter the last name.'); len('firstname', 15, 'Enter the first name.');
      if (!v.gender) e.gender = 'Choose Male or Female.';
      if (!v.birthdate) e.birthdate = 'Pick the birth date.'; else if (v.birthdate >= t) e.birthdate = 'The birth date must be in the past.';
      if (!v.hiredate) e.hiredate = 'Pick the hire date.'; else if (v.birthdate && v.hiredate <= v.birthdate) e.hiredate = 'The hire date must be after the birth date.';
      else { var fh = D.hist.filter(function (h) { return h.empno === v.empno && !h.del; }).sort(function (a, b) { return a.effdate < b.effdate ? -1 : 1; })[0]; if (fh && v.hiredate > fh.effdate) e.hiredate = 'The hire date cannot be after the first job history row (' + fh.effdate + ').'; }
      if (v.sepdate && v.hiredate && v.sepdate < v.hiredate) e.sepdate = 'The separation date cannot be before the hire date.';
    } else if (k === 'job') {
      v.jobcode = v.jobcode.toUpperCase();
      if (!/^[A-Z0-9]{2,4}$/.test(v.jobcode)) e.jobcode = 'Use 2 to 4 capital letters or digits.'; else if (d.mode === 'add' && D.jobs.some(function (x) { return x.jobcode === v.jobcode; })) e.jobcode = 'Job code ' + v.jobcode + ' already exists.';
      len('jobdesc', 20, 'Enter the job description.');
    } else if (k === 'dept') {
      v.deptcode = v.deptcode.toUpperCase();
      if (!/^[A-Z0-9]{2,3}$/.test(v.deptcode)) e.deptcode = 'Use 2 or 3 capital letters or digits.'; else if (d.mode === 'add' && D.depts.some(function (x) { return x.deptcode === v.deptcode; })) e.deptcode = 'Department code ' + v.deptcode + ' already exists.';
      len('deptname', 20, 'Enter the department name.');
    } else {
      var em = emp(d.back.emp);
      if (!v.jobcode) e.jobcode = 'Choose a job.';
      if (!v.effdate) e.effdate = 'Pick an effective date.'; else if (v.effdate < em.hiredate) e.effdate = 'The effective date cannot be before the hire date (' + em.hiredate + ').';
      else if (d.mode === 'add' && v.jobcode) {
        var same = D.hist.filter(function (h) { return h.empno === em.empno && h.jobcode === v.jobcode && h.effdate === v.effdate; })[0];
        if (same) e.effdate = same.del ? 'A deleted row for this job and date exists. Restore it instead.' : 'This employee already has this job on that date.';
      }
      if (v.salary === '' || isNaN(Number(v.salary))) e.salary = 'Enter the salary.'; else if (Number(v.salary) < 0) e.salary = 'The salary cannot be negative.';
    }
    d.vals = v; d.errs = e;
    if (Object.keys(e).length) { draw(); var bad = document.querySelector('#hr-host [aria-invalid="true"], #hr-host .field.err input'); if (bad) bad.focus(); return; }
    var verb = d.mode === 'add' ? 'ADD' : 'EDIT', msg;
    if (k === 'emp') {
      if (d.mode === 'add') D.emps.push({ empno: v.empno, lastname: v.lastname, firstname: v.firstname, gender: v.gender, birthdate: v.birthdate, hiredate: v.hiredate, sepdate: v.sepdate, del: false, stamp: mk(verb) });
      else Object.assign(emp(v.empno), { lastname: v.lastname, firstname: v.firstname, gender: v.gender, birthdate: v.birthdate, hiredate: v.hiredate, sepdate: v.sepdate, stamp: mk(verb) });
      msg = 'Employee ' + (d.mode === 'add' ? 'added.' : 'saved.');
    } else if (k === 'job') {
      if (d.mode === 'add') D.jobs.push({ jobcode: v.jobcode, jobdesc: v.jobdesc, del: false, stamp: mk(verb) }); else { var j = D.jobs.filter(function (x) { return x.jobcode === v.jobcode; })[0]; j.jobdesc = v.jobdesc; j.stamp = mk(verb); }
      msg = 'Job ' + (d.mode === 'add' ? 'added.' : 'saved.');
    } else if (k === 'dept') {
      if (d.mode === 'add') D.depts.push({ deptcode: v.deptcode, deptname: v.deptname, del: false, stamp: mk(verb) }); else { var p = D.depts.filter(function (x) { return x.deptcode === v.deptcode; })[0]; p.deptname = v.deptname; p.stamp = mk(verb); }
      msg = 'Department ' + (d.mode === 'add' ? 'added.' : 'saved.');
    } else {
      var en = d.back.emp;
      if (d.mode === 'add') D.hist.push({ empno: en, jobcode: v.jobcode, deptcode: v.deptcode, effdate: v.effdate, salary: Number(v.salary), del: false, stamp: mk(verb) });
      else { var h = D.hist.filter(function (x) { return x.empno === en && x.effdate === d.key && !x.del; })[0]; h.deptcode = v.deptcode; h.salary = Number(v.salary); h.stamp = mk(verb); }
      msg = 'History ' + (d.mode === 'add' ? 'added.' : 'saved.');
    }
    save(); toast(msg); close();
  }

  function openDel(what, key, extra) {
    var noun, label, reason = '', back = R.dlg && R.dlg.kind === 'hist' ? R.dlg : null;
    if (what === 'emp') { var e = emp(key), n = D.hist.filter(function (h) { return h.empno === key && !h.del; }).length; noun = 'employee'; label = key + ' · ' + ename(e); if (n) reason = 'Cannot delete this employee: ' + n + ' active job history row' + (n > 1 ? 's' : '') + ' still refer to it. Delete the job history first.'; }
    else if (what === 'job') { noun = 'job'; label = key + ' · ' + jobName(key); var nj = used('jobs', key); if (nj) reason = 'This job cannot be deleted: ' + nj + ' active job history row' + (nj > 1 ? 's' : '') + ' use it.'; }
    else if (what === 'dept') { noun = 'department'; label = key + ' · ' + deptName(key); var nd = used('depts', key); if (nd) reason = 'This department cannot be deleted: ' + nd + ' active job history row' + (nd > 1 ? 's' : '') + ' use it.'; }
    else { noun = 'history row'; label = back.emp + ' · ' + key; }
    R.dlg = { kind: 'confirm', what: what, key: key, noun: noun, label: label, reason: reason, back: back };
    draw();
  }
  function doDel() {
    var d = R.dlg, w = d.what, k = d.key, o;
    if (w === 'emp') o = emp(k); else if (w === 'job') o = D.jobs.filter(function (x) { return x.jobcode === k; })[0]; else if (w === 'dept') o = D.depts.filter(function (x) { return x.deptcode === k; })[0];
    else o = D.hist.filter(function (h) { return h.empno === d.back.emp && h.effdate === k && !h.del; })[0];
    o.del = true; o.stamp = mk('DELETE'); save();
    toast(d.noun.charAt(0).toUpperCase() + d.noun.slice(1) + ' deleted.' + (adm() ? ' Find it under Inactive to restore it.' : '')); close();
  }
  function restore(what, key) {
    var o;
    if (what === 'emp') o = emp(key); else if (what === 'job') o = D.jobs.filter(function (x) { return x.jobcode === key; })[0]; else if (what === 'dept') o = D.depts.filter(function (x) { return x.deptcode === key; })[0];
    else o = D.hist.filter(function (h) { return h.empno === R.dlg.emp && h.effdate === key && h.del; })[0];
    if (!o) return; o.del = false; o.stamp = mk('RESTORE'); save(); toast('Restored.');
    if (R.dlg) draw(); else mount();
  }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act="stub"]');
    if (!el || !S || !S.me) return;
    if (el.getAttribute('data-arg') === 'Human Resources') {
      e.stopPropagation(); e.stopImmediatePropagation();
      R.tab = 'employees'; R.f = 'active'; R.q = ''; R.prof = null; R.dlg = null; draw(); mount();
      var f = document.getElementById('focus'); if (f) f.focus({ preventScroll: true });
    }
  }, true);

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-hr]');
    if (!el || !S || !S.me) return;
    var act = el.getAttribute('data-hr'), a = el.getAttribute('data-a');
    if (!el.closest('.overlay')) R.op = { s: act, a: a };
    var kind = { employees: 'emp', jobs: 'job', departments: 'dept' }[R.tab];
    switch (act) {
      case 'overlay': if (e.target === el) close(); break;
      case 'cancel': close(); break;
      case 'tab': R.tab = a; R.f = 'active'; R.q = ''; mount(); break;
      case 'f': R.f = a; mount(); break;
      case 'clear': R.q = ''; mount(); var q = document.getElementById('hr-q'); if (q) q.focus(); break;
      case 'add': openForm(kind); break;
      case 'edit': openForm(R.prof && R.tab === 'employees' ? 'emp' : kind, a); break;
      case 'del': openDel(kind, a); break;
      case 'restore': restore(kind, a); break;
      case 'prof': R.prof = a; mount(); break;
      case 'back': R.prof = null; mount(); refocus(); break;
      case 'hist': R.dlg = { kind: 'hist', emp: a, v: 'tl', f: 'active' }; draw(); break;
      case 'hadd2': R.dlg = { kind: 'hist', emp: a, v: 'tl', f: 'active' }; openForm('hist', null, R.dlg); break;
      case 'hv': R.dlg.v = a; draw(); break;
      case 'hf': R.dlg.f = a; draw(); break;
      case 'hadd': openForm('hist', null, R.dlg); break;
      case 'hedit': openForm('hist', a, R.dlg); break;
      case 'hdel': openDel('hist', a); break;
      case 'hrest': restore('hist', a); break;
      case 'dodel': doDel(); break;
    }
  });
  document.addEventListener('submit', function (e) { if (!e.target.closest('[data-hrform]')) return; e.preventDefault(); submitForm(); });
  document.addEventListener('input', function (e) {
    if (e.target.id !== 'hr-q') return;
    var t = e.target; clearTimeout(window.__hrQ);
    window.__hrQ = setTimeout(function () { R.q = t.value.trim(); res(); }, 250);
  });
  document.addEventListener('keydown', function (e) {
    if (!R.dlg) return;
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    var box = document.querySelector('#hr-host .modal'); if (!box) return;
    var list = Array.prototype.filter.call(box.querySelectorAll('button, input, select'), function (n) { return !n.disabled && n.offsetParent !== null; });
    if (!list.length) return;
    var first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });


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
    view: 'sales',
    tab: 'active',
    payFilter: 'all',
    q: '',
    page: 1,
    perPage: 20,
    dlg: null,
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

  

function syncSidebarNav() {
  if (!S || !S.me) return;

  var side = document.querySelector('.side');
  if (!side) return;

  // Keep Audit Log for Admin and Superadmin.
  if (adm() && !side.querySelector('[data-s4-nav="audit"]')) {
    var adminLabel = Array.prototype.slice.call(
      side.querySelectorAll('.side-label')
    ).filter(function(el) {
      return el.textContent.trim().toLowerCase() === 'administration';
    })[0];

    if (adminLabel) {
      var auditBtn = document.createElement('button');
      auditBtn.type = 'button';
      auditBtn.className = 'nav';
      auditBtn.setAttribute('data-s4-nav', 'audit');
      auditBtn.innerHTML = ic('search', 20) + '<span>Audit Log</span>';

      adminLabel.insertAdjacentElement('afterend', auditBtn);
    }
  }
}

function setActiveS4Nav(activeKey) {
  syncSidebarNav();

  Array.prototype.forEach.call(
    document.querySelectorAll('.side .nav'),
    function(btn) {
      var s4k = btn.getAttribute('data-s4-nav');
      var on = !!activeKey && s4k === activeKey;

      btn.classList.toggle('on', on);

      if (on) {
        btn.setAttribute('aria-current', 'page');
      } else if (s4k) {
        btn.removeAttribute('aria-current');
      }
    }
  );
}

function roleHeaderBadge() {
  var role = S && S.me ? S.me.role : 'User';
  var cls = role === 'Superadmin' ? 'b-super' : role === 'Admin' ? 'b-admin' : 'b-user';
  return '<span class="badge ' + cls + '">' + esc(role) + '</span>';
}


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

  function openS4View(targetView) {
    if (!S || !S.me) return false;
    V4.view = targetView;
    V4.dlg = null;
    renderS4Modal();
    if (targetView === 'sales') renderSalesView();
    else if (targetView === 'reports') renderReportsView();
    else if (targetView === 'audit') renderAuditView();
    return true;
  }

  /* Wrap H.views so S is always captured and sidebar stays synced */
  if (H.views) {
    Object.keys(H.views).forEach(function (viewName) {
      var orig = H.views[viewName];
      if (typeof orig === 'function') {
        H.views[viewName] = function (s) {
          if (s) S = s;
          var res = orig.apply(this, arguments);
          setTimeout(function () {
            if (S && S.me) {
              syncSidebarNav();
              if (document.querySelector('[data-s4-nav]')) {
                setActiveS4Nav(null);
              }
            }
          }, 0);
          return res;
        };
      }
    });
  }

  /* Capture phase intercepts clicks before Sprint 2's stub handler shows "later sprint" */
  document.addEventListener('click', function (e) {
    var navBtn = e.target.closest('[data-s4-nav]');
    if (navBtn) {
      var v = navBtn.getAttribute('data-s4-nav');
      if (openS4View(v)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
      return;
    }

    var stubEl = e.target.closest('[data-act="stub"]');
    if (stubEl) {
      var arg = stubEl.getAttribute('data-arg');
      var mapArg = { 'Sales': 'sales', 'Reports': 'reports', 'Audit Log': 'audit' };
      if (mapArg[arg] && openS4View(mapArg[arg])) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    }
  }, true);

  document.addEventListener('click', function (e) {
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

  var navTimer = setInterval(function () {
    if (S && S.me && document.querySelector('.side')) {
      syncSidebarNav();
    }
  }, 400);

   window.addEventListener('beforeunload', function () {
    clearInterval(navTimer);
  });
})(window);

})(window);
