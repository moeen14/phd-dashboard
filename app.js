const DB_KEY = 'phd_dashboard_v1';

const HABIT_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
];

// Habits with a metric attached
const HABIT_METRICS = {
  hours:  { label: 'Work Hours',    unit: 'hrs',    icon: '⏱', placeholder: '8',   step: '0.5' },
  papers: { label: 'Papers Read',   unit: 'papers', icon: '📄', placeholder: '1',   step: '1'   },
  words:  { label: 'Words Written', unit: 'words',  icon: '✍', placeholder: '500', step: '50'  },
};

// ── Cloud sync state ──────────────────────────────────────────────────────
let _currentUserId = null;
let _syncTimer = null;
let _isSyncing = false;

// ── Migration ─────────────────────────────────────────────────────────────
function migrateData(data) {
  if (!data.habits) return data;
  data.habits.forEach((h, i) => {
    if (!h.color)   h.color   = HABIT_COLORS[i % HABIT_COLORS.length];
    if (!h.history) h.history = {};
    if (typeof h.metric === 'undefined') h.metric = null;

    // Rename old "Check on Goals" to "Practice Writing"
    if (h.text === 'Check on Goals') {
      h.text   = 'Practice Writing';
      h.metric = 'words';
    }

    // Auto-assign metrics to known habit IDs if not already set
    if (h.id === 'h1' && !h.metric) h.metric = 'hours';
    if (h.id === 'h4' && !h.metric) h.metric = 'papers';
    if (h.id === 'h5' && !h.metric) h.metric = 'words';
  });
  return data;
}

// ── Local data layer ──────────────────────────────────────────────────────
function getData() {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) return seedData();
  try { return migrateData(JSON.parse(raw)); } catch { return seedData(); }
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
  const mon = new Date(d); mon.setDate(diff);
  return mon.toISOString().split('T')[0];
}

function seedData() {
  const now = new Date().toISOString();
  const data = {
    habits: [
      { id: 'h1', text: 'Check timing / priority (2 AM to 2 PM)', checked: false, color: HABIT_COLORS[0], history: {}, metric: 'hours'  },
      { id: 'h2', text: 'Check phone timing',                      checked: false, color: HABIT_COLORS[1], history: {}, metric: null    },
      { id: 'h3', text: 'Note in calendar / daily log',            checked: false, color: HABIT_COLORS[2], history: {}, metric: null    },
      { id: 'h4', text: 'Paper reading',                           checked: false, color: HABIT_COLORS[3], history: {}, metric: 'papers' },
      { id: 'h5', text: 'Practice Writing',                        checked: false, color: HABIT_COLORS[4], history: {}, metric: 'words'  },
    ],
    habitsLastReset: todayStr(),
    tasks: [
      { id: 't1',  text: 'Mail Drone Company',                        category: 'admin',      priority: 'high',   deadline: null,         createdAt: now },
      { id: 't2',  text: 'Course Work',                               category: 'coursework', priority: 'medium', deadline: null,         createdAt: now },
      { id: 't3',  text: 'ASABE Completion',                          category: 'research',   priority: 'high',   deadline: '2026-06-20', createdAt: now },
      { id: 't4',  text: 'AIM Presentation',                          category: 'research',   priority: 'high',   deadline: '2026-07-01', createdAt: now },
      { id: 't5',  text: 'AMGCP Circuits',                            category: 'research',   priority: 'medium', deadline: null,         createdAt: now },
      { id: 't6',  text: 'AMGCP Moving to Shed',                      category: 'admin',      priority: 'medium', deadline: null,         createdAt: now },
      { id: 't7',  text: 'Paper Reading + Presentation',              category: 'research',   priority: 'medium', deadline: null,         createdAt: now },
      { id: 't8',  text: "Read Dr. Thomasson's Attachments",          category: 'research',   priority: 'medium', deadline: null,         createdAt: now },
      { id: 't9',  text: 'Starlink Order',                            category: 'admin',      priority: 'low',    deadline: null,         createdAt: now },
      { id: 't10', text: 'SAGEIN Traineeship Application',            category: 'admin',      priority: 'medium', deadline: null,         createdAt: now },
      { id: 't11', text: 'Reminder: Posters for ASABE (Dr. Chen)',    category: 'admin',      priority: 'medium', deadline: null,         createdAt: now },
    ],
    completedTasks: [],
    projects: [
      { id: 'p1', name: 'Soft Robot',         url: '' },
      { id: 'p2', name: 'AMGCP',              url: '' },
      { id: 'p3', name: 'ASABE 2026',         url: '' },
      { id: 'p4', name: 'Real-to-Sim-to-Real',url: '' },
      { id: 'p5', name: 'Navigation with CI', url: '' },
    ],
    deadlines: [
      { id: 'd1', text: 'AIMS Paper Revision', date: '2026-05-22' },
      { id: 'd2', text: "System's Paper",       date: '2026-06-10' },
      { id: 'd3', text: 'ASABE (June)',          date: '2026-06-06' },
      { id: 'd4', text: 'ASABE (final)',         date: '2026-06-20' },
      { id: 'd5', text: 'AMGCP Paper',           date: '2026-06-30' },
      { id: 'd6', text: 'AIMS Presentation',     date: '2026-07-01' },
    ],
    weeklyGoals: [],
    weeklyGoalsWeek: currentWeekStr(),
    _schemaVersion: 3,
  };
  saveData(data);
  return data;
}

// ── Date helpers ──────────────────────────────────────────────────────────
function getWeekStart(date) {
  const d = new Date(date); d.setHours(0,0,0,0);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}

function addDays(date, n) {
  const d = new Date(date); d.setDate(d.getDate() + n); return d;
}

function dateStr(date) { return date.toISOString().split('T')[0]; }

// ── Habit history helpers ─────────────────────────────────────────────────
function habitDoneOnDate(h, ds) {
  const e = h.history && h.history[ds];
  if (!e) return false;
  return typeof e === 'object' ? e.done === true : Boolean(e);
}

function habitValueOnDate(h, ds) {
  const e = h.history && h.history[ds];
  if (!e || typeof e !== 'object') return null;
  return typeof e.value === 'number' ? e.value : null;
}

function getMetricTotal(data, metricType, startDate, endDate) {
  let total = 0;
  data.habits.forEach(h => {
    if (h.metric !== metricType || !h.history) return;
    Object.entries(h.history).forEach(([ds, entry]) => {
      const d = new Date(ds + 'T12:00:00');
      if (d >= startDate && d <= endDate) {
        const v = typeof entry === 'object' ? entry.value : null;
        if (typeof v === 'number') total += v;
      }
    });
  });
  return total;
}

// ── Firebase sync layer ────────────────────────────────────────────────────
function _scheduleCloudSync() {
  if (!_currentUserId) return;
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(_syncNow, 1500);
}

async function forceSyncNow() { clearTimeout(_syncTimer); await _syncNow(); }

async function _syncNow() {
  if (!_currentUserId || _isSyncing) return;
  _isSyncing = true;
  try {
    await firebase.firestore()
      .collection('users').doc(_currentUserId)
      .collection('data').doc('main')
      .set(getData());
    _showSyncStatus('saved');
  } catch(e) {
    console.error('Sync failed:', e);
    _showSyncStatus('error');
  } finally { _isSyncing = false; }
}

async function loadFromCloud(uid) {
  _currentUserId = uid;
  try {
    const doc = await firebase.firestore()
      .collection('users').doc(uid)
      .collection('data').doc('main')
      .get();
    if (doc.exists) {
      const migrated = migrateData(doc.data());
      localStorage.setItem(DB_KEY, JSON.stringify(migrated));
      // Always write back so migrations (colors, renamed habits) persist
      await firebase.firestore()
        .collection('users').doc(uid)
        .collection('data').doc('main')
        .set(migrated);
    } else {
      await _syncNow();
    }
  } catch(e) { console.error('Load failed:', e); }
}


function cleanDemoData() {
  const demoTexts = new Set([
    'Literature review: soft robot locomotion','Update AMGCP circuit diagrams',
    'Weekly lab meeting notes','Submit ASABE registration form',
    'Read: Zhang et al. 2024 (navigation CI)','AMGCP sensor calibration write-up',
    'Email Dr. Chen about poster format','Chapter 2 draft — intro section',
    'Coursework: controls problem set 4','Review AIMS paper reviewer comments',
    'Lab equipment inventory check','Read: Doe et al. 2023 (sim-to-real gap)',
    'AMGCP status update slides for Dr. T','Finish coursework midterm project',
    'Write abstract for ASABE 2026','Order replacement sensors (AMGCP)',
    'Read: Peng et al. 2022 (RL locomotion)','Coursework: final report submission',
    'Soft robot CAD model update','Draft introduction — AMGCP paper',
  ]);
  const data = getData();
  const before = data.completedTasks.length;
  data.completedTasks = data.completedTasks.filter(t => !demoTexts.has(t.text));
  // Wipe all habit history — demo seeded 90 days of fake entries
  data.habits.forEach(h => { h.history = {}; });
  localStorage.setItem(DB_KEY, JSON.stringify(data));
  return { tasks: before - data.completedTasks.length };
}

function getISOWeek(date) {
  const d = new Date(date); d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const y = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - y) / 86400000) + 1) / 7);
}

function _showSyncStatus(state) {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  el.textContent = state === 'saved' ? '✓ Saved' : '⚠ Sync error';
  el.style.color  = state === 'saved' ? 'var(--success)' : 'var(--danger)';
  el.style.opacity = '1';
  setTimeout(() => { el.style.opacity = '0'; }, 2000);
}

function signOutUser() {
  clearTimeout(_syncTimer);
  _syncNow().finally(() => firebase.auth().signOut());
}

window.addEventListener('beforeunload', () => {
  if (_currentUserId) {
    clearTimeout(_syncTimer);
    firebase.firestore()
      .collection('users').doc(_currentUserId)
      .collection('data').doc('main')
      .set(getData());
  }
});

// ── Habits ────────────────────────────────────────────────────────────────
function maybeResetHabits(data) {
  if (data.habitsLastReset !== todayStr()) {
    data.habits.forEach(h => { h.checked = false; });
    data.habitsLastReset = todayStr();
    saveData(data);
  }
}

function maybeResetWeeklyGoals(data) {
  const week = currentWeekStr();
  if (data.weeklyGoalsWeek !== week) {
    data.weeklyGoals.filter(g => g.completed).forEach(g => {
      data.completedTasks.unshift({
        id: generateId(), text: g.text, category: 'weekly-goal',
        priority: 'medium', deadline: null,
        createdAt: g.createdAt || new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });
    });
    data.weeklyGoals = [];
    data.weeklyGoalsWeek = week;
    saveData(data);
  }
}

function toggleHabit(id) {
  const data = getData();
  const h = data.habits.find(h => h.id === id);
  if (!h) return;
  h.checked = !h.checked;
  if (!h.history) h.history = {};
  const ds = todayStr();
  if (h.checked) {
    // Preserve any existing value if re-checking
    const existing = h.history[ds];
    const existingVal = (existing && typeof existing === 'object') ? existing.value : null;
    h.history[ds] = h.metric ? { done: true, value: existingVal } : true;
  } else {
    delete h.history[ds];
  }
  saveData(data);
}

function setHabitMetricValue(id, rawValue) {
  const data = getData();
  const h = data.habits.find(h => h.id === id);
  if (!h || !h.checked) return;
  const v = parseFloat(rawValue);
  const ds = todayStr();
  h.history[ds] = { done: true, value: isNaN(v) ? null : v };
  saveData(data);
}

function addHabit(text) {
  const data = getData();
  const used = new Set(data.habits.map(h => h.color));
  const color = HABIT_COLORS.find(c => !used.has(c)) || HABIT_COLORS[data.habits.length % HABIT_COLORS.length];
  data.habits.push({ id: generateId(), text, checked: false, color, history: {}, metric: null });
  saveData(data);
}

function deleteHabit(id) {
  const data = getData();
  data.habits = data.habits.filter(h => h.id !== id);
  saveData(data);
}

// ── Tasks ─────────────────────────────────────────────────────────────────
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

// ── Projects ──────────────────────────────────────────────────────────────
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

// ── Deadlines ─────────────────────────────────────────────────────────────
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

// ── Weekly Goals ──────────────────────────────────────────────────────────
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

// ── Completed ─────────────────────────────────────────────────────────────
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

// ── Display helpers ───────────────────────────────────────────────────────
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
  if (diff < 0)  return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return `in ${diff}d`;
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  return new Date(isoStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatDateTime(isoStr) {
  if (!isoStr) return '';
  return new Date(isoStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtShort(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
