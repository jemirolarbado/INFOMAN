(function (window) {
  'use strict';

  // --- Supabase Client Initialization ---
  var SUPABASE_URL = 'https://pfgwavzauqqbrcmgqjou.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_s4lDEuo5PDkgkMpjdqV7aA_mRoAomRI';

  if (window.supabase && window.supabase.createClient) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  } else {
    console.warn('Supabase SDK not loaded. Make sure the CDN script is included in index.html before index.js.');
  }
  var db = window.supabaseClient;

  window.HopeERP = window.HopeERP || {};
  var H = window.HopeERP;

  H.STORAGE_KEY = 'hope_erp_users_v1';
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
    return { id: id, first: first, last: last, email: email, role: role, status: status, rights: H.defaultRights(role) };
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
      '<footer class="page-foot">Hope, Inc. ERP · Information Management project prototype</footer>';
  }

  function authShell(left, card) {
    return '<div class="auth">' +
      '<section class="auth-left"><div class="brand brand-inv">' + LOGO + '<span>Hope, Inc. ERP</span></div>' +
      '<div>' + left + '</div><div class="auth-foot">Information Management · Sprint 1</div></section>' +
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
        (tab === 'all' ? 'All accounts' : esc(tab)) + ' <span class="count">' + counts[tab] + '</span></button>';
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
        actions += '<span class="muted">—</span>';
      }

      return '<tr>' +
        '<td><div class="user-cell">' + avatar(u, true) + '<div><b>' + esc(H.fullName(u)) + '</b><span>' + esc(u.email) + '</span></div></div></td>' +
        '<td>' + roleBadge(u.role) + '</td>' +
        '<td>' + statusPill(status) + '</td>' +
        '<td><div class="row-actions">' + actions + '</div></td>' +
      '</tr>';
    }).join('');

    var logRows = S.log.slice(0, 5).map(function (l) {
      return '<li><span>' + esc(l.time) + '</span> ' + esc(l.text) + '</li>';
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
        (canRole ? '<div class="field"><label for="ef-role">Role</label><select class="input" id="ef-role">' + H.ROLES.filter(function(r){return r!=='Superadmin';}).map(function(r){return '<option value="' + r + '"' + (target.role === r ? ' selected' : '') + '>' + r + '</option>';}).join('') + '</select></div>' : '') +
        (canStat ? '<div class="field"><label for="ef-status">Status</label><select class="input" id="ef-status">' + H.STATUSES.map(function(st){return '<option value="' + st + '"' + (target.status === st ? ' selected' : '') + '>' + st + '</option>';}).join('') + '</select></div>' : '') +
        '<div class="msg msg-err" id="form-error" role="alert" hidden></div>' +
        '<div class="modal-foot"><button type="button" class="btn btn-outline" data-act="close">Cancel</button><button type="submit" class="btn btn-primary">Save changes</button></div>' +
        '</form>';
      return modalShell('Edit Account — ' + H.fullName(target), '', body);
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

  H.views = { landing: landing, register: register, login: login, reset: reset, dashboard: dashboard, users: users, modal: modal };

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
    log: []
  };

  var TITLES = {
    landing: 'Hope, Inc. ERP', register: 'Create account · Hope, Inc. ERP', login: 'Sign in · Hope, Inc. ERP',
    reset: 'Reset password · Hope, Inc. ERP', dashboard: 'Dashboard · Hope, Inc. ERP', users: 'User Management · Hope, Inc. ERP'
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
    var email = val('l-email').toLowerCase(), pw = document.getElementById('l-pw').value;
    if (!email || !pw) return formError('Enter your email and password.');

    if (db) {
      // 1. Authenticate against Supabase Auth service
      var authRes = await db.auth.signInWithPassword({ email: email, password: pw });
      if (authRes.error) {
        var localMatch = S.users.find(function(x) { return x.email.toLowerCase() === email; });
        if (!localMatch) return formError('Invalid email or password.');
      }

      // 2. Load account permissions & status from database
      var userRes = await db.from('app_users').select('*').eq('email', email).maybeSingle();
      if (userRes.data) {
        var u = userRes.data;
        var blocked = H.signInBlocker(u);
        if (blocked) {
          await db.auth.signOut();
          return formError(blocked);
        }
        S.me = u;
        var idx = S.users.findIndex(function(x) { return x.id === u.id; });
        if (idx > -1) S.users[idx] = u;
        else S.users.push(u);

        go('dashboard');
        return;
      }
    }

    // Fallback in-memory login logic
    var u = S.users.filter(function (x) { return x.email.toLowerCase() === email; })[0];
    if (!u) return formError('No account found for that email. Register to create one.');
    var blocked = H.signInBlocker(u);
    if (blocked) return formError(blocked);
    S.me = u;
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
      // Register credentials with Supabase Auth
      var authRes = await db.auth.signUp({
        email: email,
        password: pw,
        options: { data: { first: first, last: last } }
      });

      if (authRes.error) {
        if (authRes.error.message.includes('already registered')) {
          return formError('An account with that email already exists.');
        }
        return formError('Registration Error: ' + authRes.error.message);
      }

      // Sync user row in database
      var newUser = { first: first, last: last, email: email, role: 'User', status: 'Pending', rights: H.defaultRights('User') };
      var dbRes = await db.from('app_users').insert([newUser]).select();
      if (dbRes.data && dbRes.data[0]) newUser = dbRes.data[0];
      S.users.push(newUser);
    } else {
      S.users.push({ id: H.nextId(S.users), first: first, last: last, email: email, role: 'User', status: 'Pending', rights: H.defaultRights('User') });
    }

    persist();
    S.flash = { kind: 'ok', text: 'Account created! An Admin must approve your pending account before sign in.' };
    go('login');
  }

  async function doReset() {
    var email = val('p-email').toLowerCase();
    if (!EMAIL_RE.test(email)) return formError('Enter a valid email address.');

    if (db) {
      var res = await db.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname + '#reset-password'
      });
      if (res.error) return formError(res.error.message);
    }

    S.resetSent = email;
    render();
  }

  async function doUpdatePassword() {
    var newPassword = val('new-pw');
    if (!newPassword || newPassword.length < 6) return formError('Password must be at least 6 characters.');

    if (db) {
      var res = await db.auth.updateUser({ password: newPassword });
      if (res.error) return formError(res.error.message);
    }

    window.location.hash = '';
    S.flash = { kind: 'ok', text: 'Password updated successfully! You can now sign in.' };
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
    if (S.users.some(function (u) { return u.id !== t.id && u.email.toLowerCase() === email; })) return formError('Another account already uses that email.');

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
      case 'logout': S.me = null; S.modal = null; if (db) db.auth.signOut(); go('landing'); break;
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

  // Check URL hash for password reset redirect link
  if (window.location.hash && window.location.hash.includes('access_token')) {
    S.screen = 'reset';
    S.isPasswordUpdate = true;
  }

  // App initialization & Supabase sync
  render();
  H.fetchUsersFromSupabase().then(function (users) {
    S.users = users;
    render();
  });

})(window);

```
