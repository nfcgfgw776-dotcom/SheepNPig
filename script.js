const welcomeScreen = document.getElementById("welcomeScreen");
const appContainer = document.getElementById("appContainer");
const yearSelect = document.getElementById("yearSelect");
const monthSelect = document.getElementById("monthSelect");
const daySelect = document.getElementById("daySelect");
const entryText = document.getElementById("entryText");
const photoInput = document.getElementById("photoInput");
const addEntryBtn = document.getElementById("addEntryBtn");
const timelineList = document.getElementById("timelineList");
const timelineEntryTemplate = document.getElementById("timelineEntryTemplate");

let selectedAttachments = [];
let attachmentReadPromise = null;
const STORAGE_KEY = "sheepnpigTimelineEntries";
const STORAGE_KEY_BACKUP = "sheepnpigTimelineEntriesBackup_v1";
const BACKUP_META_KEY = "sheepnpigTimelineEntriesBackupMeta_v1";
const PUBLIC_TIMELINE_URL = "timeline.json";
const REMOTE_PATH = "timelineEntries";
let entries = [];
let remoteTimelineRef = null;

// Shared base entry for the public timeline
const initialDate = '2026-05-17';
const initialText = '炀炀和轩轩在一起啦！';

function mergeLocalEntries(publicEntries, localEntries) {
  const merged = [...publicEntries];
  localEntries.forEach((item) => {
    const exists = merged.some(e => (e.createdAt && item.createdAt && e.createdAt === item.createdAt) || (e.date === item.date && e.text === item.text));
    if (!exists) merged.push(item);
  });
  return merged;
}

function ensureInitialEntry(entriesList) {
  if (!entriesList.some(e => e.date === initialDate)) {
    entriesList.push({
      date: initialDate,
      text: initialText,
      attachments: [],
      comments: [],
      createdAt: Date.now(),
    });
  }
}

function loadLocalEntries() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    let entriesFromStorage = normalizeEntries(raw);
    if (!entriesFromStorage.length) {
      const backupRaw = JSON.parse(localStorage.getItem(STORAGE_KEY_BACKUP) || "[]");
      const backupEntries = normalizeEntries(backupRaw);
      if (backupEntries.length) {
        entriesFromStorage = backupEntries;
      }
    }
    return entriesFromStorage;
  } catch (err) {
    return [];
  }
}

function normalizeAttachment(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    data: raw.data || '',
    name: raw.name || 'attachment',
    type: raw.type || '',
  };
}

function normalizeComment(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    id: raw.id || `comment-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text: raw.text || '',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
  };
}

function normalizeEntries(rawEntries) {
  if (!rawEntries) return [];
  let items = rawEntries;
  if (!Array.isArray(items)) {
    if (typeof items === 'object') {
      items = Object.values(items);
    } else {
      return [];
    }
  }
  return items.map((item) => {
    const attachments = Array.isArray(item.attachments)
      ? item.attachments.map(normalizeAttachment).filter(Boolean)
      : item.photo
      ? [normalizeAttachment({ data: item.photo, name: item.photoName || 'attachment', type: item.photoType || '' })]
      : [];
    const comments = Array.isArray(item.comments)
      ? item.comments.map(normalizeComment).filter(Boolean)
      : [];

    return {
      date: item.date || '',
      text: item.text || '',
      attachments,
      comments,
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
    };
  });
}

function updateSyncStatus(message, isError = false) {
  const statusEl = document.getElementById('syncStatus');
  if (!statusEl) return;
  statusEl.textContent = `同步状态：${message}`;
  statusEl.style.color = isError ? '#c0392b' : '#2c3e50';
}

function initRemoteSync() {
  if (window.firebaseConfig && typeof firebase !== 'undefined' && window.firebaseConfig.apiKey && window.firebaseConfig.apiKey !== 'YOUR_API_KEY') {
    try {
      firebase.initializeApp(window.firebaseConfig);
      const db = firebase.database();
      remoteTimelineRef = db.ref(REMOTE_PATH);
      remoteTimelineRef.on('value', (snapshot) => {
        if (!snapshot.exists()) return;
        const remoteEntries = normalizeEntries(snapshot.val());
        entries = remoteEntries;
        saveEntries(false);
        renderTimeline();
      });
      updateSyncStatus('已启用实时同步，正在监听远程更改。');
    } catch (err) {
      console.warn('Remote sync init failed:', err);
      remoteTimelineRef = null;
      updateSyncStatus('Firebase 初始化失败，已回退到本地页面显示。', true);
    }
  } else {
    remoteTimelineRef = null;
    updateSyncStatus('未配置 Firebase，同步功能暂不可用；此页面仅显示本地/公开内容。', true);
  }
}

function loadRemoteTimeline() {
  if (!remoteTimelineRef) {
    return Promise.resolve(null);
  }
  return remoteTimelineRef.once('value').then((snapshot) => {
    if (!snapshot.exists()) return null;
    return normalizeEntries(snapshot.val());
  });
}

function saveEntries(alsoRemote = true) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  try {
    localStorage.setItem(STORAGE_KEY_BACKUP, JSON.stringify(entries));
    localStorage.setItem(BACKUP_META_KEY, JSON.stringify({ createdAt: Date.now() }));
  } catch (err) {
    console.warn('Failed to update backup in localStorage:', err);
  }
  if (alsoRemote && remoteTimelineRef) {
    remoteTimelineRef.set(entries).catch((err) => {
      console.warn('Remote save failed:', err);
    });
  }
}

function loadPublicTimeline() {
  const localEntries = loadLocalEntries();
  return fetch(PUBLIC_TIMELINE_URL)
    .then((response) => {
      if (!response.ok) {
        throw new Error('无法加载公开时间线');
      }
      return response.json();
    })
    .then((publicEntries) => {
      if (!Array.isArray(publicEntries)) {
        throw new Error('公开时间线格式不正确');
      }
      ensureInitialEntry(publicEntries);
      entries = mergeLocalEntries(publicEntries, localEntries);
      saveEntries();
    })
    .catch(() => {
      entries = localEntries;
      ensureInitialEntry(entries);
      saveEntries();
    });
}

function loadInitialTimeline() {
  const localEntries = loadLocalEntries();
  if (!remoteTimelineRef) {
    return loadPublicTimeline();
  }
  return loadRemoteTimeline()
    .then((remoteEntries) => {
      if (remoteEntries && remoteEntries.length) {
        entries = remoteEntries;
        saveEntries(false);
      } else {
        return loadPublicTimeline();
      }
    })
    .catch(() => loadPublicTimeline());
}

// Create an automatic local backup if entries exist and no backup present
function ensureBackupOnLoad() {
  try {
    const haveBackup = localStorage.getItem(STORAGE_KEY_BACKUP);
    if (entries && entries.length && !haveBackup) {
      localStorage.setItem(STORAGE_KEY_BACKUP, JSON.stringify(entries));
      localStorage.setItem(BACKUP_META_KEY, JSON.stringify({ createdAt: Date.now() }));
      console.info('Automatic local backup created.');
    }
  } catch (err) {
    console.warn('Failed to create local backup:', err);
  }
}
ensureBackupOnLoad();

function showTimeline() {
  welcomeScreen.classList.add("hidden");
  appContainer.classList.remove("hidden");
  renderTimeline();
}

function fillDateSelectors() {
  const currentYear = new Date().getFullYear();
  for (let year = 1995; year <= currentYear + 20; year += 1) {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    yearSelect.appendChild(option);
  }

  for (let month = 1; month <= 12; month += 1) {
    const option = document.createElement("option");
    option.value = month;
    option.textContent = month.toString().padStart(2, "0");
    monthSelect.appendChild(option);
  }

  // Set selectors to today's date by default for better UX
  const today = new Date();
  yearSelect.value = today.getFullYear();
  monthSelect.value = today.getMonth() + 1;
  updateDays();
  daySelect.value = today.getDate();
}

function updateDays() {
  const year = Number(yearSelect.value);
  const month = Number(monthSelect.value);
  const days = new Date(year, month, 0).getDate();
  daySelect.innerHTML = "";
  for (let day = 1; day <= days; day += 1) {
    const option = document.createElement("option");
    option.value = day;
    option.textContent = day.toString().padStart(2, "0");
    daySelect.appendChild(option);
  }
}

function renderTimeline() {
  const sorted = [...entries].sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return a.createdAt - b.createdAt;
  });
  timelineList.innerHTML = "";

  if (!sorted.length) {
    timelineList.innerHTML = "<div class='record-card'><div class='record-text'>在这里写下你们的第一条恋爱记录，甜蜜从此刻开始。</div></div>";
    return;
  }

  sorted.forEach((entry) => {
    const clone = timelineEntryTemplate.content.cloneNode(true);
    const card = clone.querySelector(".record-card");
    const dateEl = clone.querySelector(".record-date");
    const textEl = clone.querySelector(".record-text");
    const attachmentsEl = clone.querySelector('.attachments');
    const commentListEl = clone.querySelector('.comment-list');
    const commentInputEl = clone.querySelector('.comment-input');
    const editBtn = clone.querySelector('.edit-btn');
    const delBtn = clone.querySelector('.delete-btn');

    card.dataset.createdAt = entry.createdAt;
    dateEl.textContent = entry.date;
    textEl.textContent = entry.text;

    if (Array.isArray(entry.attachments) && entry.attachments.length) {
      entry.attachments.forEach((attachment) => {
        if (attachment.type && attachment.type.startsWith('image/')) {
          const img = document.createElement('img');
          img.className = 'record-photo';
          img.src = attachment.data;
          img.alt = attachment.name || '恋爱照片';
          img.onerror = () => {
            img.remove();
            const link = document.createElement('a');
            link.className = 'attachment-link';
            link.href = attachment.data;
            link.download = attachment.name || 'attachment';
            link.textContent = `下载: ${attachment.name || '照片'}`;
            attachmentsEl.appendChild(link);
          };
          attachmentsEl.appendChild(img);
        } else {
          const link = document.createElement('a');
          link.className = 'attachment-link';
          link.href = attachment.data;
          link.download = attachment.name || 'attachment';
          link.textContent = `下载: ${attachment.name || '附件'}`;
          attachmentsEl.appendChild(link);
        }
      });
    }

    if (!entry.comments || !entry.comments.length) {
      const empty = document.createElement('div');
      empty.className = 'comment-empty';
      empty.textContent = '还没有评论，留下你的小小心愿吧。';
      commentListEl.appendChild(empty);
    } else {
      entry.comments.sort((a, b) => a.createdAt - b.createdAt).forEach((comment) => {
        const commentItem = document.createElement('div');
        commentItem.className = 'comment-item';
        commentItem.textContent = comment.text;
        commentListEl.appendChild(commentItem);
      });
    }

    editBtn.dataset.createdAt = entry.createdAt;
    delBtn.dataset.createdAt = entry.createdAt;
    commentInputEl.dataset.createdAt = entry.createdAt;

    timelineList.appendChild(clone);
  });
}

timelineList.addEventListener('click', (event) => {
  const submitBtn = event.target.closest('.comment-submit-btn');
  if (!submitBtn) return;

  const card = submitBtn.closest('.record-card');
  if (!card) return;
  const createdAt = Number(card.dataset.createdAt);
  const input = card.querySelector('.comment-input');
  if (!input) return;

  const commentText = input.value.trim();
  if (!commentText) {
    alert('请输入评论内容后再发布。');
    return;
  }

  const entry = entries.find((item) => item.createdAt === createdAt);
  if (!entry) return;

  entry.comments = entry.comments || [];
  entry.comments.push({
    id: `comment-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text: commentText,
    createdAt: Date.now(),
  });
  saveEntries();
  renderTimeline();
});

photoInput.addEventListener("change", (event) => {
  const files = Array.from(event.target.files || []);
  if (!files.length) {
    selectedAttachments = [];
    attachmentReadPromise = null;
    return;
  }

  attachmentReadPromise = Promise.all(files.map((file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        data: reader.result,
        name: file.name || 'attachment',
        type: file.type || '',
      });
    };
    reader.readAsDataURL(file);
  })));

  attachmentReadPromise
    .then((attachments) => {
      selectedAttachments = attachments;
    })
    .catch((err) => {
      console.warn('附件读取失败：', err);
      selectedAttachments = [];
    });
});

addEntryBtn.addEventListener("click", () => {
  const year = yearSelect.value;
  const month = String(monthSelect.value).padStart(2, "0");
  const day = String(daySelect.value).padStart(2, "0");
  const text = entryText.value.trim();
  const targetDate = `${year}-${month}-${day}`;

  const addOrUpdate = (attachments) => {
    if (!text && (!attachments || !attachments.length)) {
      alert("请填写文字或选择一张照片/附件。\n（文本或附件至少需填写一项）");
      return;
    }

    const existingIdx = entries.findIndex((e) => e.date === targetDate);
    if (existingIdx !== -1) {
      if (text) entries[existingIdx].text = text;
      if (attachments && attachments.length) {
        entries[existingIdx].attachments = [...entries[existingIdx].attachments, ...attachments];
      }
      saveEntries();
      renderTimeline();
      entryText.value = "";
      photoInput.value = "";
      selectedAttachments = [];
      attachmentReadPromise = null;
      alert('已更新该日期的条目，照片/附件已追加。');
      return;
    }

    entries.push({
      date: targetDate,
      text,
      attachments: attachments || [],
      comments: [],
      createdAt: Date.now(),
    });

    saveEntries();
    renderTimeline();
    entryText.value = "";
    photoInput.value = "";
    selectedAttachments = [];
    attachmentReadPromise = null;
  };

  const files = photoInput.files || [];
  if (files.length && (!selectedAttachments.length || selectedAttachments.length !== files.length)) {
    if (attachmentReadPromise) {
      attachmentReadPromise.then((attachments) => addOrUpdate(attachments));
      return;
    }
  }

  addOrUpdate(selectedAttachments);
});

// Export handler to preserve user data across updates
const exportBtn = document.getElementById('exportBtn');

if (exportBtn) {
  exportBtn.addEventListener('click', () => {
    try {
      const data = JSON.stringify(entries, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      a.href = url;
      a.download = `sheepnpig-entries-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('导出失败：' + err.message);
    }
  });
}

yearSelect.addEventListener("change", updateDays);
monthSelect.addEventListener("change", updateDays);

welcomeScreen.addEventListener("click", showTimeline);

setTimeout(() => {
  if (!welcomeScreen.classList.contains("hidden")) {
    showTimeline();
  }
}, 2000);

fillDateSelectors();
initRemoteSync();
loadInitialTimeline().then(renderTimeline);


// --- Timeline edit/delete handling (event delegation) ---
timelineList.addEventListener('click', (e) => {
  const card = e.target.closest('.record-card');
  if (!card) return;
  const createdAt = Number(card.dataset.createdAt);
  const idx = entries.findIndex(x => x.createdAt === createdAt);
  const deleteButton = e.target.closest('.delete-btn');
  const editButton = e.target.closest('.edit-btn');

  if (deleteButton) {
    const pin = prompt('请输入删除密码：');
    if (pin !== '8791') {
      alert('密码错误，删除已取消。');
      return;
    }
    if (idx !== -1) {
      entries.splice(idx, 1);
      saveEntries();
      renderTimeline();
      alert('删除成功。');
    }
    return;
  }

  if (editButton) {
    const textEl = card.querySelector('.record-text');
    const originalText = textEl.textContent;
    card.classList.add('record-editing');
    textEl.innerHTML = '';
    const ta = document.createElement('textarea');
    ta.value = originalText;
    ta.className = 'edit-textarea';
    textEl.appendChild(ta);

    const changeBtn = document.createElement('button');
    changeBtn.textContent = '追加附件';
    changeBtn.type = 'button';
    changeBtn.className = 'change-photo-btn';
    const hiddenFile = document.createElement('input');
    hiddenFile.type = 'file';
    hiddenFile.accept = '*/*';
    hiddenFile.style.display = 'none';
    card.appendChild(hiddenFile);
    changeBtn.addEventListener('click', () => hiddenFile.click());

    let pendingAttachment = null;
    hiddenFile.addEventListener('change', (ev) => {
      const f = ev.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        pendingAttachment = {
          data: r.result,
          name: f.name || 'attachment',
          type: f.type || '',
        };
      };
      r.readAsDataURL(f);
    });

    const actions = card.querySelector('.record-actions');
    const saveBtn = document.createElement('button');
    saveBtn.textContent = '保存';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    actions.style.display = 'flex';
    actions.innerHTML = '';
    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    actions.insertBefore(changeBtn, saveBtn);

    saveBtn.addEventListener('click', () => {
      const newText = ta.value.trim();
      let attachmentAdded = false;
      if (idx !== -1) {
        entries[idx].text = newText;
        if (pendingAttachment) {
          entries[idx].attachments = entries[idx].attachments || [];
          entries[idx].attachments.push(pendingAttachment);
          attachmentAdded = true;
        }
        saveEntries();
      }
      card.classList.remove('record-editing');
      renderTimeline();
      if (attachmentAdded) {
        alert('保存成功，附件已追加。');
      } else {
        alert('保存成功。');
      }
    });

    cancelBtn.addEventListener('click', () => {
      card.classList.remove('record-editing');
      renderTimeline();
    });
  }
});

// === 在一起计时小组件（按新奥尔良时区计算天数） ===
const togetherCounterEl = document.getElementById("togetherCounter");
// 起始日期（UTC 日历日）：2026-05-17
const togetherStartUtc = Date.UTC(2026, 4, 17);

function getYMDInTimeZone(timeZone) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  }).formatToParts(now);
  let y, m, d;
  for (const p of parts) {
    if (p.type === 'year') y = Number(p.value);
    if (p.type === 'month') m = Number(p.value);
    if (p.type === 'day') d = Number(p.value);
  }
  return { y, m, d };
}

function updateTogetherCounter() {
  const { y, m, d } = getYMDInTimeZone('America/Chicago');
  const todayUtcMidnight = Date.UTC(y, m - 1, d);
  const diffDays = Math.floor((todayUtcMidnight - togetherStartUtc) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    togetherCounterEl.textContent = '还没开始...';
  } else {
    togetherCounterEl.textContent = `${diffDays} 天`;
  }
}

updateTogetherCounter();
setInterval(updateTogetherCounter, 60 * 1000);
