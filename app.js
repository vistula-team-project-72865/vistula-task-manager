// Task Manager – Supabase REST API (no backend server)
let API_URL = '';
let HEADERS = {};
let editingId = null;

const form = document.getElementById('task-form');
const titleInput = document.getElementById('task-title');
const descInput = document.getElementById('task-description');
const submitBtn = document.getElementById('task-submit');
const cancelBtn = document.getElementById('task-cancel');
const list = document.getElementById('task-list');
const statusEl = document.getElementById('status-message');

function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = isError ? 'error' : 'ok';
}

async function api(path, options = {}) {
  const res = await fetch(API_URL + path, { ...options, headers: { ...HEADERS, ...(options.headers || {}) } });
  if (!res.ok) {
    let detail = res.statusText;
    try { const body = await res.json(); detail = body.message || JSON.stringify(body); } catch (_) {}
    throw new Error(`HTTP ${res.status}: ${detail}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// GET /tasks?select=*
async function loadTasks(message) {
  try {
    const tasks = await api('/tasks?select=*&order=id.asc');
    renderTasks(tasks);
    showStatus(message || `Loaded ${tasks.length} task(s).`);
  } catch (err) {
    showStatus('Could not load tasks. ' + err.message, true);
  }
}

// GET /tasks?id=eq.ID&select=*
async function getTask(id) {
  const rows = await api(`/tasks?id=eq.${id}&select=*`);
  if (!rows || !rows.length) throw new Error('Task not found.');
  return rows[0];
}

function renderTasks(tasks) {
  list.innerHTML = '';
  if (!tasks.length) {
    list.innerHTML = '<p class="empty">No tasks yet. Add one above.</p>';
    return;
  }
  for (const task of tasks) {
    const item = document.createElement('div');
    item.className = 'task-item' + (task.completed ? ' done' : '');
    item.dataset.id = task.id;

    const title = document.createElement('h3');
    title.className = 'task-title';
    title.textContent = task.title;

    const desc = document.createElement('p');
    desc.className = 'task-description';
    desc.textContent = task.description || '';

    const status = document.createElement('span');
    status.className = 'task-status';
    status.textContent = task.completed ? 'Completed' : 'Incomplete';

    const actions = document.createElement('div');
    actions.className = 'task-actions';
    actions.innerHTML = `
      <button type="button" class="toggle-task">${task.completed ? 'Mark incomplete' : 'Mark complete'}</button>
      <button type="button" class="edit-task">Edit</button>
      <button type="button" class="delete-task">Delete</button>`;

    item.append(title, desc, status, actions);
    list.appendChild(item);
  }
}

function resetForm() {
  editingId = null;
  form.reset();
  submitBtn.textContent = 'Add Task';
  cancelBtn.hidden = true;
}

// POST /tasks  or  PATCH /tasks?id=eq.ID
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  if (!title) { showStatus('Title is required.', true); return; }
  const payload = { title, description: descInput.value.trim() };
  submitBtn.disabled = true;
  try {
    let msg;
    if (editingId) {
      await api(`/tasks?id=eq.${editingId}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(payload)
      });
      msg = 'Task updated.';
    } else {
      await api('/tasks', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ ...payload, completed: false })
      });
      msg = 'Task added.';
    }
    resetForm();
    await loadTasks(msg);
  } catch (err) {
    showStatus('Could not save task. ' + err.message, true);
  } finally {
    submitBtn.disabled = false;
  }
});

cancelBtn.addEventListener('click', () => { resetForm(); showStatus('Edit cancelled.'); });

list.addEventListener('click', async (e) => {
  const item = e.target.closest('.task-item');
  if (!item) return;
  const id = item.dataset.id;
  try {
    if (e.target.classList.contains('edit-task')) {
      const task = await getTask(id);
      editingId = task.id;
      titleInput.value = task.title;
      descInput.value = task.description || '';
      submitBtn.textContent = 'Save Changes';
      cancelBtn.hidden = false;
      titleInput.focus();
      showStatus(`Editing task #${task.id}.`);
    } else if (e.target.classList.contains('toggle-task')) {
      const completed = !item.classList.contains('done');
      await api(`/tasks?id=eq.${id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ completed })
      });
      await loadTasks(completed ? 'Task marked complete.' : 'Task marked incomplete.');
    } else if (e.target.classList.contains('delete-task')) {
      if (!confirm('Delete this task?')) return;
      await api(`/tasks?id=eq.${id}`, { method: 'DELETE' });
      if (String(editingId) === String(id)) resetForm();
      await loadTasks('Task deleted.');
    }
  } catch (err) {
    showStatus('Operation failed. ' + err.message, true);
  }
});

async function init() {
  try {
    const res = await fetch('config.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('config.json not found');
    const config = await res.json();
    if (!config.supabaseUrl || config.supabaseUrl.includes('YOUR_') || !config.supabasePublishableKey || config.supabasePublishableKey.includes('YOUR_')) {
      throw new Error('Fill in supabaseUrl and supabasePublishableKey in config.json');
    }
    API_URL = config.supabaseUrl.replace(/\/$/, '') + '/rest/v1';
    HEADERS = {
      apikey: config.supabasePublishableKey,
      'Content-Type': 'application/json'
    };
    await loadTasks();
  } catch (err) {
    showStatus('Configuration error: ' + err.message, true);
  }
}

init();
