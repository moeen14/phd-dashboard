const DB_KEY = 'phd_dashboard_v1';

// ── Cloud sync state ──────────────────────────────────────────────────────
let _currentUserId = null;
let _syncTimer = null;
let _isSyncing = false;

// ── Local data layer ──────────────────────────────────────────────────────
function getData() {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) return seedData();
  try { return JSON.parse(raw); } catch { return seedData(); }
}

function saveData(data) {
  localStorage.setItem(DB_KEY, JSON.stringify(data));
  _scheduleCloudSync();
}

function generateId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function currentWeekStr() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d);
  mon.setDate(diff);
  return mon.toISOString().split('T')[0];
}

function seedData() {
  const now = new Date().toISOString();
  const data = {
    habits: [
      { id: 'h1', text: 'Check timing / priority (2 AM to 2 PM)', checked: false },
      { id: 'h2', text: 'Check phone timing', checked: false },
      { id: 'h3', text: 'Note in calendar / daily log', checked: false },
      { id: 'h4', text: 'Paper reading', checked: false },
      { id: 'h5', text: 'Check on Goals', checked: false },
    ],
    habitsLastReset: todayStr(),
    tasks: [
      { id: 't1', text: 'Mail Drone Company', category: 'admin', priority: 'high', deadline: null, createdAt: now },
      { id: 't2', text: 'Course Work', category: 'coursework', priority: 'medium', deadline: null, createdAt: now },
      { id: 't3', text: 'ASABE Completion', category: 'research', priority: 'high', deadline: '2026-06-20', createdAt: now },
      { id: 't4', text: 'AIM Presentation', category: 'research', priority: 'high', deadline: '2026-07-01', createdAt: now },
      { id: 't5', text: 'AMGCP Circuits', category: 'research', priority: 'medium', deadline: null, createdAt: now },
      { id: 't6', text: 'AMGCP Moving to Shed', category: 'admin', priority: 'medium', deadline: null, createdAt: now },
      { id: 't7', text: 'Paper Reading + Presentation', category: 'research', priority: 'medium', deadline: null, createdAt: now },
      { id: 't8', text: "Read Dr. Thomasson's Attachments", category: 'research', priority: 'medium', deadline: null, createdAt: now },
      { id: 't9', text: 'Starlink Order', category: 'admin', priority: 'low', deadline: null, createdAt: now },
      { id: 't10', text: 'SAGEIN Traineeship Application', category: 'admin', priority: 'medium', deadline: null, createdAt: now },
      { id: 't11', text: 'Reminder: Posters for ASABE (Dr. Chen)', category: 'admin', priority: 'medium', deadline: null, createdAt: now },
    ],
    completedTasks: [],
    projects: [
      { id: 'p1', name: 'Soft Robot', url: '' },
      { id: 'p2', name: 'AMGCP', url: '' },
      { id: 'p3', name: 'ASABE 2026', url: '' },
      { id: 'p4', name: 'Real-to-Sim-to-Real', url: '' },
      { id: 'p5', name: 'Navigation with CI', url: '' },
    ],
    deadlines: [
      { id: 'd1', text: 'AIMS Paper Revision', date: '2026-05-22' },
      { id: 'd2', text: "System's Paper", date: '2026-06-10' },
      { id: 'd3', text: 'ASABE (June)', date: '2026-06-06' },
      { id: 'd4', text: 'ASABE (final)', date: '2026-06-20' },
      { id: 'd5', text: 'AMGCP Paper', date: '2026-06-30' },
      { id: 'd6', text: 'AIMS Presentation', date: '2026-07-01' },
    ],
    weeklyGoals: [],
    weeklyGoalsWeek: currentWeekStr(),
    _schemaVersion: 1,
  };
  saveData(data);
  return data;
}

// ── Firebase sync layer ────────────────────────────────────────────────────
function _scheduleCloudSync() {
  if (!_currentUserId) return;
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(_syncNow, 1500);
}

async function _syncNow() {
  if (!_currentUserId || _isSyncing) return;
  _isSyncing = true;
  try {
    const data = getData();
    await firebase.firestore()
      .collection('users').doc(_currentUserId)
      .collection('data').doc('main')
      .set(data);
    _showSyncStatus('saved');
  } catch (e) {
    console.error('Sync failed:', e);
    _showSyncStatus('error');
  } finally {
    _isSyncing = false;
  }
}

async function loadFromCloud(uid) {
  _currentUserId = uid;
  try {
    const doc = await firebase.firestore()
      .collection('users').doc(uid)
      .collection('data').doc('main')
      .get();
    if (doc.exists) {
      localStorage.setItem(DB_KEY, JSON.stringify(doc.data()));
    } else {
      // First sign-in: upload existing local data (includes seeded data)
      await _syncNow();
    }
  } catch (e) {
    console.error('Failed to load from cloud, using local cache:', e);
  }
}

function _showSyncStatus(state) {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  el.textContent = state === 'saved' ? '✓ Saved' : '⚠ Sync error';
  el.style.color = state === 'saved' ? 'var(--success)' : 'var(--danger)';
  el.style.opacity = '1';
  setTimeout(() => { el.style.opacity = '0'; }, 2000);
}

function signOutUser() {
  // Force sync before signing out
  clearTimeout(_syncTimer);
  _syncNow().finally(() => firebase.auth().signOut());
}

// ── Auto-sync on page close ───────────────────────────────────────────────
window.addEventListener('beforeunload', () => {
  if (_currentUserId) {
    clearTimeout(_syncTimer);
    // Best-effort sync on unload
    navigator.sendBeacon && navigator.sendBeacon('', '');
    const data = getData();
    firebase.firestore()
      .collection('users').doc(_currentUserId)
      .collection('data').doc('main')
      .set(data);
  }
});

// ── Habits ────────────────────────────────────────────────────────────────
function maybeResetHabits(data) {
  if (data.habitsLastReset !== todayStr()) {
    data.habits.forEach(h => h.checked = false);
    data.habitsLastReset = todayStr();
    saveData(data);
  }
}

function maybeResetWeeklyGoals(data) {
  const week = currentWeekStr();
  if (data.weeklyGoalsWeek !== week) {
    data.weeklyGoals.filter(g => g.completed).forEach(g => {
      data.completedTasks.unshift({
        id: generateId(),
        text: g.text,
        category: 'weekly-goal',
        priority: 'medium',
        deadline: null,
        createdAt: g.createdAt || new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });
    });
    data.weeklyGoals = [];
    data.weeklyGoalsWeek = week;
    saveData(data);
  }
}

function completeTask(id) {
  const data = getData();
  const idx = data.tasks.findIndex(t => t.id === id);
  if (idx === -1) return;
  const [task] = data.tasks.splice(idx, 1);
  task.completedAt = new Date().toISOString();
  data.completedTasks.unshift(task);
  saveData(data);
}

function deleteTask(id) {
  const data = getData();
  data.tasks = data.tasks.filter(t => t.id !== id);
  saveData(data);
}

function addTask(text, category, priority, deadline) {
  const data = getData();
  data.tasks.push({ id: generateId(), text, category, priority, deadline: deadline || null, createdAt: new Date().toISOString() });
  saveData(data);
}

function toggleHabit(id) {
  const data = getData();
  const h = data.habits.find(h => h.id === id);
  if (h) { h.checked = !h.checked; saveData(data); }
}

function addHabit(text) {
  const data = getData();
  data.habits.push({ id: generateId(), text, checked: false });
  saveData(data);
}

function deleteHabit(id) {
  const data = getData();
  data.habits = data.habits.filter(h => h.id !== id);
  saveData(data);
}

function addProject(name, url) {
  const data = getData();
  data.projects.push({ id: generateId(), name, url: url || '' });
  saveData(data);
}

function deleteProject(id) {
  const data = getData();
  data.projects = data.projects.filter(p => p.id !== id);
  saveData(data);
}

function addDeadline(text, date) {
  const data = getData();
  data.deadlines.push({ id: generateId(), text, date });
  data.deadlines.sort((a, b) => a.date.localeCompare(b.date));
  saveData(data);
}

function deleteDeadline(id) {
  const data = getData();
  data.deadlines = data.deadlines.filter(d => d.id !== id);
  saveData(data);
}

function addWeeklyGoal(text) {
  const data = getData();
  data.weeklyGoals.push({ id: generateId(), text, completed: false, createdAt: new Date().toISOString() });
  saveData(data);
}

function toggleWeeklyGoal(id) {
  const data = getData();
  const g = data.weeklyGoals.find(g => g.id === id);
  if (g) { g.completed = !g.completed; saveData(data); }
}

function deleteWeeklyGoal(id) {
  const data = getData();
  data.weeklyGoals = data.weeklyGoals.filter(g => g.id !== id);
  saveData(data);
}

function restoreTask(id) {
  const data = getData();
  const idx = data.completedTasks.findIndex(t => t.id === id);
  if (idx === -1) return;
  const [task] = data.completedTasks.splice(idx, 1);
  delete task.completedAt;
  data.tasks.push(task);
  saveData(data);
}

function clearAllCompleted() {
  const data = getData();
  data.completedTasks = [];
  saveData(data);
}

// ── Helpers ───────────────────────────────────────────────────────────────
function deadlineUrgency(dateStr) {
  if (!dateStr) return 'none';
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  const diff = Math.ceil((d - today) / 86400000);
  if (diff < 0) return 'overdue';
  if (diff <= 3) return 'urgent';
  if (diff <= 7) return 'soon';
  return 'ok';
}

function deadlineDaysLabel(dateStr) {
  if (!dateStr) return '';
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  const diff = Math.ceil((d - today) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return `in ${diff}d`;
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
