(function (window) {
  'use strict';

  // Initialize Supabase Client
  var SUPABASE_URL = 'https://pfgwavzauqqbrcmgqjou.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_s4lDEuo5PDkgkMpjdqV7aA_mRoAomRI';

  if (window.supabase && window.supabase.createClient) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  } else {
    console.error('Supabase library not loaded. Make sure to include the Supabase CDN script in index.html before index.js.');
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
