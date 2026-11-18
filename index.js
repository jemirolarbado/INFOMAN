(function (window) {
  'use strict';

  // Supabase Client Initialization
  var SUPABASE_URL = 'https://pfgwavzauqqbrcmgqjou.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_s4IDEuo5PDkgkMpjdqV7aA_mRoAomRI';
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
      return { '&': '&', '<': '<', '>': '>', '"': '"', "'": ''' }[c];
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
        return formError('Invalid email or password.');
      }

      var userRes = await db.from('app_users').select('*').eq('email', email).maybeSingle();
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
  var LATER = ['Human Resources', 'Sales', 'Reports', 'System Settings'];

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

  async function load() {
    if (db) {
      try {
        var a = adm(), sfx = a ? '' : '_active';
        var r = await Promise.all([
          db.from('customer' + sfx).select('*').order('custno'),
          db.from('product' + sfx).select('*').order('prodcode'),
          db.from('pricehist' + sfx).select('*').order('effdate', { ascending: false })
        ]);
        if (!r[0].error && !r[1].error && !r[2].error) {
          M.d = { customers: r[0].data || [], products: r[1].data || [], prices: r[2].data || [] };
          M.remote = true;
          return;
        }
      } catch (e) { /* fall back to the in-browser demo data */ }
    }
    M.remote = false;
    if (!LOCAL) LOCAL = seed();
    M.d = LOCAL;
  }

  async function write(what, row, key, verb) {
    var T = TBL[what];
    if (M.remote) {
      var q = db.from(T.table), r = key ? await q.update(row).match(key) : await q.insert([row]);
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
