const SUPABASE_URL = "https://pfgwavzauqqbrcmgqjou.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_s4lDEuo5PDkgkMpjdqV7aA_mRoAomRI";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const RESTRICTED_MODULES = ["hr", "reports"];
const VIEWS = ["login", "register", "forgot", "reset", "app"];

let myProfile = null;
let myRights = [];
let selectedUserId = null;

function pageUrl() {
  return window.location.origin + window.location.pathname;
}

function showView(name) {
  VIEWS.forEach(function (v) {
    document.getElementById("view-" + v).classList.add("hidden");
  });
  document.getElementById("view-" + name).classList.remove("hidden");
}

function showMessage(id, text, type) {
  const box = document.getElementById(id);
  box.textContent = text;
  box.className = "alert show alert-" + type;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML.replace(/"/g, "&quot;");
}

function getInitials(name) {
  const parts = (name || "?").trim().split(" ");
  const first = parts[0][0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function roleLabel(role) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function hasAccess(moduleKey) {
  if (!RESTRICTED_MODULES.includes(moduleKey)) return true;
  if (myProfile.role !== "user") return true;
  return myRights.includes(moduleKey);
}

document.querySelectorAll("[data-view]").forEach(function (link) {
  link.addEventListener("click", function () {
    showView(link.dataset.view);
  });
});

document.getElementById("toggle-password").addEventListener("click", function () {
  const input = document.getElementById("login-password");
  input.type = input.type === "password" ? "text" : "password";
});

document.getElementById("login-form").addEventListener("submit", async function (event) {
  event.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  const { error } = await db.auth.signInWithPassword({ email: email, password: password });
  if (error) {
    showMessage("msg-login", error.message, "error");
  } else {
    loadApp();
  }
});

document.getElementById("register-form").addEventListener("submit", async function (event) {
  event.preventDefault();
  const firstName = document.getElementById("first-name").value.trim();
  const lastName = document.getElementById("last-name").value.trim();
  const email = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value;

  const { data, error } = await db.auth.signUp({
    email: email,
    password: password,
    options: {
      data: { full_name: firstName + " " + lastName },
      emailRedirectTo: pageUrl()
    }
  });

  if (error) {
    showMessage("msg-register", error.message, "error");
  } else if (data.session) {
    loadApp();
  } else {
    showMessage("msg-register", "Account created! Check your email to confirm it, then sign in.", "success");
    document.getElementById("register-form").reset();
  }
});

document.querySelectorAll(".google-btn").forEach(function (button) {
  button.addEventListener("click", async function () {
    await db.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: pageUrl() }
    });
  });
});

document.getElementById("forgot-form").addEventListener("submit", async function (event) {
  event.preventDefault();
  const email = document.getElementById("forgot-email").value.trim();

  const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: pageUrl() });
  if (error) {
    showMessage("msg-forgot", error.message, "error");
  } else {
    showMessage("msg-forgot", "Reset link sent! Check your inbox.", "success");
  }
});

document.getElementById("reset-form").addEventListener("submit", async function (event) {
  event.preventDefault();
  const newPassword = document.getElementById("new-password").value;

  const { error } = await db.auth.updateUser({ password: newPassword });
  if (error) {
    showMessage("msg-reset", error.message, "error");
  } else {
    showMessage("msg-reset", "Password changed! Redirecting to sign in...", "success");
    setTimeout(async function () {
      await db.auth.signOut();
      window.location.href = pageUrl();
    }, 1500);
  }
});

async function loadApp() {
  const { data: sessionData } = await db.auth.getSession();
  if (!sessionData.session) {
    showView("login");
    return;
  }
  const userId = sessionData.session.user.id;

  const { data: profile, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    alert("Could not load your profile. Did you run schema.sql in Supabase?");
    await db.auth.signOut();
    return;
  }

  if (profile.status === "blocked") {
    alert("Your account is blocked. Please contact an Admin.");
    await db.auth.signOut();
    return;
  }

  const { data: rights } = await db
    .from("module_access")
    .select("module")
    .eq("user_id", userId);

  myProfile = profile;
  myRights = (rights || []).map(function (row) { return row.module; });

  const badge = document.getElementById("role-badge");
  badge.textContent = profile.role.toUpperCase();
  badge.className = "badge " + profile.role;

  buildSidebar();
  showView("app");
  showPage("dashboard");
}

function buildSidebar() {
  const modules = [
    { key: "dashboard", label: "Dashboard", page: "dashboard" },
    { key: "customers", label: "Customers", page: "" },
    { key: "products", label: "Products", page: "" },
    { key: "hr", label: "Human Resources", page: "" },
    { key: "sales", label: "Sales", page: "" },
    { key: "reports", label: "Reports", page: "" }
  ];

  let html = '<div class="brand"><div class="logo dark">H</div>Hope, Inc. ERP</div>';
  html += '<div class="menu-title">MODULES</div>';

  modules.forEach(function (m) {
    if (!hasAccess(m.key)) return;
    html += '<a class="menu-link" data-page="' + m.page + '" id="link-' + m.key + '">' + m.label + "</a>";
  });

  if (myProfile.role === "admin" || myProfile.role === "superadmin") {
    html += '<div class="menu-title">ADMINISTRATION</div>';
    html += '<a class="menu-link" data-page="users" id="link-users">User Management</a>';
  }
  if (myProfile.role === "superadmin") {
    html += '<a class="menu-link" data-page="">System Settings</a>';
  }

  html += '<div class="sidebar-bottom">';
  html += '<div class="avatar c0">' + getInitials(myProfile.full_name) + "</div>";
  html += "<div>" + escapeHtml(myProfile.full_name) + "<small>" + roleLabel(myProfile.role) + "</small></div>";
  html += '<a id="sign-out">Sign out</a></div>';

  document.getElementById("sidebar").innerHTML = html;
}

document.getElementById("sidebar").addEventListener("click", async function (event) {
  if (event.target.id === "sign-out") {
    await db.auth.signOut();
    return;
  }
  const link = event.target.closest(".menu-link");
  if (link && link.dataset.page) {
    showPage(link.dataset.page);
  }
});

function showPage(name) {
  document.getElementById("page-dashboard").classList.add("hidden");
  document.getElementById("page-users").classList.add("hidden");

  document.querySelectorAll(".menu-link").forEach(function (link) {
    link.classList.remove("active");
  });

  if (name === "users") {
    document.getElementById("page-users").classList.remove("hidden");
    document.getElementById("page-title").textContent = "User Management";
    document.getElementById("link-users").classList.add("active");
    loadUsers();
  } else {
    document.getElementById("page-dashboard").classList.remove("hidden");
    document.getElementById("page-title").textContent = "Dashboard";
    document.getElementById("link-dashboard").classList.add("active");
    renderDashboard();
  }
}

function renderDashboard() {
  const firstName = myProfile.full_name.split(" ")[0];
  const messages = {
    superadmin: "You have full system access. Manage every module and assign roles to any user.",
    admin: "You can manage most modules and user rights. Superadmin accounts stay out of reach.",
    user: "You have access to the core modules assigned to you. Contact an Admin for elevated permissions."
  };
  document.getElementById("welcome-name").textContent = "Welcome back, " + firstName;
  document.getElementById("welcome-text").textContent = messages[myProfile.role];

  const actions = [
    { label: "View customers", page: "" },
    { label: "Manage products", page: "" },
    { label: "Human Resources", page: "", moduleKey: "hr" },
    { label: "Sales pipeline", page: "" }
  ];

  if (myProfile.role === "admin" || myProfile.role === "superadmin") {
    actions.push({ label: "Manage users", page: "users" });
  }
  if (myProfile.role === "superadmin") {
    actions.push({ label: "System settings", page: "" });
  }

  let html = "";
  actions.forEach(function (action) {
    const locked = action.moduleKey && !hasAccess(action.moduleKey);
    if (locked) {
      html += '<div class="locked">🔒 <span>' + action.label + "<small>Ask an Admin for access</small></span></div>";
    } else {
      html += '<a data-page="' + action.page + '">' + action.label + "</a>";
    }
  });
  document.getElementById("quick-actions").innerHTML = html;
}

document.getElementById("quick-actions").addEventListener("click", function (event) {
  const link = event.target.closest("a");
  if (link && link.dataset.page) {
    showPage(link.dataset.page);
  }
});

function canManage(target) {
  if (myProfile.role === "superadmin") return target.role !== "superadmin";
  return target.role === "user";
}

async function loadUsers() {
  if (myProfile.role === "user") {
    showPage("dashboard");
    return;
  }

  document.getElementById("accounts-note").textContent =
    myProfile.role === "superadmin"
      ? "Superadmin accounts are hidden and cannot be changed."
      : "You manage Users only. Superadmin accounts are hidden and cannot be changed.";

  if (myProfile.role === "superadmin") {
    document.getElementById("role-box").classList.remove("hidden");
  }

  const { data, error } = await db
    .from("profiles")
    .select("*")
    .neq("role", "superadmin")
    .order("created_at");

  if (error) {
    alert("Could not load users: " + error.message);
    return;
  }

  let html = "";

  data.forEach(function (u, index) {
    const statusText = u.status === "blocked" ? "Blocked" : "Active";
    const statusClass = u.status === "blocked" ? "blocked" : "";

    html += "<tr>";
    html += '<td><div class="name-cell"><div class="avatar c' + (index % 5) + '">' +
            getInitials(u.full_name) + "</div>" + escapeHtml(u.full_name) + "</div></td>";
    html += "<td>" + escapeHtml(u.email) + "</td>";
    html += '<td><span class="badge ' + (u.role === "user" ? "user" : "") + '">' + roleLabel(u.role) + "</span></td>";
    html += '<td><span class="badge ' + statusClass + '">' + statusText + "</span></td>";

    if (canManage(u)) {
      const blockText = u.status === "blocked" ? "Unblock" : "Block";
      const blockClass = u.status === "blocked" ? "" : "btn-red";
      html += '<td class="actions">';
      html += '<button class="btn btn-small ' + blockClass + '" data-action="block" data-id="' + u.id + '" data-status="' + u.status + '">' + blockText + "</button>";
      html += '<button class="btn btn-small btn-soft" data-action="rights" data-id="' + u.id + '" data-role="' + u.role + '">Rights</button>';
      html += '<button class="btn btn-small" data-action="edit" data-id="' + u.id + '" data-name="' + escapeHtml(u.full_name) + '">Edit</button>';
      html += "</td>";
    } else {
      html += "<td>—</td>";
    }
    html += "</tr>";
  });

  document.getElementById("users-body").innerHTML = html;
}

document.getElementById("users-body").addEventListener("click", async function (event) {
  const button = event.target.closest("button");
  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.action;

  if (action === "block") {
    const newStatus = button.dataset.status === "blocked" ? "active" : "blocked";
    const { error } = await db.from("profiles").update({ status: newStatus }).eq("id", id);
    if (error) alert(error.message);
    loadUsers();
  }

  if (action === "edit") {
    const newName = prompt("New name for this user:", button.dataset.name);
    if (newName && newName.trim() !== "") {
      const { error } = await db.from("profiles").update({ full_name: newName.trim() }).eq("id", id);
      if (error) alert(error.message);
      loadUsers();
    }
  }

  if (action === "rights") {
    openRights(id, button.dataset.role);
  }
});

document.getElementById("add-user-btn").addEventListener("click", function () {
  alert("New accounts are created on the Register page. Share that link with the new user.");
});

async function openRights(userId, currentRole) {
  selectedUserId = userId;

  const { data } = await db.from("module_access").select("module").eq("user_id", userId);
  const modules = (data || []).map(function (row) { return row.module; });
  document.getElementById("right-hr").checked = modules.includes("hr");
  document.getElementById("right-reports").checked = modules.includes("reports");

  document.getElementById("role-select").value = currentRole;
  document.getElementById("rights-modal").classList.add("show");
}

document.getElementById("cancel-rights").addEventListener("click", function () {
  document.getElementById("rights-modal").classList.remove("show");
});

document.getElementById("save-rights").addEventListener("click", async function () {
  await db.from("module_access").delete().eq("user_id", selectedUserId);

  const newRights = [];
  if (document.getElementById("right-hr").checked) {
    newRights.push({ user_id: selectedUserId, module: "hr" });
  }
  if (document.getElementById("right-reports").checked) {
    newRights.push({ user_id: selectedUserId, module: "reports" });
  }
  if (newRights.length > 0) {
    const { error } = await db.from("module_access").insert(newRights);
    if (error) alert(error.message);
  }

  if (myProfile.role === "superadmin") {
    const newRole = document.getElementById("role-select").value;
    const { error } = await db.from("profiles").update({ role: newRole }).eq("id", selectedUserId);
    if (error) alert(error.message);
  }

  document.getElementById("rights-modal").classList.remove("show");
  loadUsers();
});

db.auth.onAuthStateChange(function (event) {
  if (event === "PASSWORD_RECOVERY") {
    showView("reset");
  }
  if (event === "SIGNED_OUT") {
    myProfile = null;
    showView("login");
  }
});

async function startApp() {
  if (window.location.hash.includes("type=recovery")) {
    showView("reset");
    return;
  }
  const { data } = await db.auth.getSession();
  if (data.session) {
    loadApp();
  } else {
    showView("login");
  }
}

startApp();
