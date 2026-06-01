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

let selectedPhotoData = "";
let selectedPhotoName = "";
let selectedPhotoType = "";
const STORAGE_KEY = "sheepnpigTimelineEntries";
const STORAGE_KEY_BACKUP = "sheepnpigTimelineEntriesBackup_v1";
const BACKUP_META_KEY = "sheepnpigTimelineEntriesBackupMeta_v1";
const PUBLIC_TIMELINE_URL = "timeline.json";
let entries = [];

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
    entriesList.push({ date: initialDate, text: initialText, photo: '', photoName: '', photoType: '', createdAt: Date.now() });
  }
}

function loadPublicTimeline() {
  const localEntries = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
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
    const photoEl = clone.querySelector(".record-photo");
    const editBtn = clone.querySelector('.edit-btn');
    const delBtn = clone.querySelector('.delete-btn');

    card.dataset.createdAt = entry.createdAt;
    dateEl.textContent = entry.date;
    textEl.textContent = entry.text;

    if (entry.photo) {
      // remove any prior download link in this cloned card
      const oldLink = clone.querySelector('.download-photo');
      if (oldLink) oldLink.remove();

      // if file type is known and not an image, show a download link instead
      if (entry.photoType && !entry.photoType.startsWith('image/')) {
        photoEl.classList.add('hidden');
        const linkEl = document.createElement('a');
        linkEl.className = 'download-photo';
        linkEl.href = entry.photo;
        linkEl.download = entry.photoName || 'photo';
        linkEl.textContent = `下载: ${entry.photoName || '照片'}`;
        card.appendChild(linkEl);
      } else {
        // try to display as image; if browser can't render, fallback to download link
        photoEl.src = entry.photo;
        photoEl.classList.remove("hidden");
        photoEl.onerror = () => {
          photoEl.classList.add('hidden');
          const linkEl = document.createElement('a');
          linkEl.className = 'download-photo';
          linkEl.href = entry.photo;
          linkEl.download = entry.photoName || 'photo';
          linkEl.textContent = `下载: ${entry.photoName || '照片'}`;
          card.appendChild(linkEl);
        };
      }
    }

    timelineList.appendChild(clone);
  });
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  try {
    // keep a recent backup copy as well
    localStorage.setItem(STORAGE_KEY_BACKUP, JSON.stringify(entries));
    localStorage.setItem(BACKUP_META_KEY, JSON.stringify({ createdAt: Date.now() }));
  } catch (err) {
    console.warn('Failed to update backup in localStorage:', err);
  }
}

photoInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) {
    selectedPhotoData = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    selectedPhotoData = reader.result;
    selectedPhotoName = file.name || '';
    selectedPhotoType = file.type || '';
  };
  reader.readAsDataURL(file);
});

addEntryBtn.addEventListener("click", () => {
  const year = yearSelect.value;
  const month = String(monthSelect.value).padStart(2, "0");
  const day = String(daySelect.value).padStart(2, "0");
  const text = entryText.value.trim();

  // Helper to actually push or update the entry and update UI
  const pushEntry = (photoData, photoName = '', photoType = '') => {
    if (!text && !photoData) {
      alert("请填写文字或选择一张照片。\n（文本或照片至少需填写一项）");
      return;
    }

    const targetDate = `${year}-${month}-${day}`;
    const existingIdx = entries.findIndex(e => e.date === targetDate);
    if (existingIdx !== -1) {
      // Update existing entry for that date: replace photo if provided, replace text if provided
      if (text) entries[existingIdx].text = text;
      if (photoData) {
        entries[existingIdx].photo = photoData;
        entries[existingIdx].photoName = photoName || '';
        entries[existingIdx].photoType = photoType || '';
      }
      saveEntries();
      renderTimeline();
      entryText.value = "";
      photoInput.value = "";
      selectedPhotoData = "";
      selectedPhotoName = '';
      selectedPhotoType = '';
      alert('已更新该日期的条目（替换或添加照片/文字）。');
      return;
    }

    // create a new entry when no existing date found
    entries.push({
      date: targetDate,
      text,
      photo: photoData || "",
      photoName: photoName || '',
      photoType: photoType || '',
      createdAt: Date.now(),
    });

    saveEntries();
    renderTimeline();
    entryText.value = "";
    photoInput.value = "";
    selectedPhotoData = "";
    selectedPhotoName = '';
    selectedPhotoType = '';
  };

  // If a file is selected but FileReader hasn't finished, read it now and then push
  const file = photoInput.files && photoInput.files[0];
  if (file && !selectedPhotoData) {
    const reader = new FileReader();
    reader.onload = () => pushEntry(reader.result, file.name || '', file.type || '');
    reader.readAsDataURL(file);
    return;
  }

  // Otherwise use already-read data (or none)
  pushEntry(selectedPhotoData, selectedPhotoName, selectedPhotoType);
});

// Export and Import handlers to preserve user data across updates
const exportBtn = document.getElementById('exportBtn');
const importInput = document.getElementById('importInput');

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

if (importInput) {
  importInput.addEventListener('change', (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const parsed = JSON.parse(r.result);
        if (!Array.isArray(parsed)) throw new Error('文件格式不正确：需要数组');
        // Merge without duplicating entries (by createdAt when available)
        let added = 0;
        parsed.forEach((item) => {
          const has = entries.some(e => (e.createdAt && item.createdAt && e.createdAt === item.createdAt) || (e.date === item.date && e.text === item.text));
          if (!has) {
            // ensure createdAt exists
            if (!item.createdAt) item.createdAt = Date.now() + Math.floor(Math.random() * 1000);
            entries.push(item);
            added += 1;
          }
        });
        if (added) {
          saveEntries();
          renderTimeline();
          alert(`已合并 ${added} 条新记录，原有数据已保留。`);
        } else {
          alert('未检测到可合并的新记录。');
        }
      } catch (err) {
        alert('导入失败：' + err.message);
      }
    };
    r.readAsText(f);
    // clear input so same file can be reselected later
    ev.target.value = '';
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
loadPublicTimeline().then(renderTimeline);


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
    // enter edit mode
    const textEl = card.querySelector('.record-text');
    const photoEl = card.querySelector('.record-photo');
    const originalText = textEl.textContent;
    card.classList.add('record-editing');
    textEl.innerHTML = '';
    const ta = document.createElement('textarea');
    ta.value = originalText;
    ta.className = 'edit-textarea';
    textEl.appendChild(ta);

    // photo change control: preview selected image, but only replace on Save
    const changeBtn = document.createElement('button');
    changeBtn.textContent = '更换照片';
    changeBtn.type = 'button';
    changeBtn.className = 'change-photo-btn';
    const hiddenFile = document.createElement('input');
    hiddenFile.type = 'file';
    hiddenFile.accept = '*/*';
    hiddenFile.style.display = 'none';
    card.appendChild(hiddenFile);
    changeBtn.addEventListener('click', () => hiddenFile.click());

    // pendingPhoto holds the new image until user clicks Save (with metadata)
    let pendingPhotoName = '';
    let pendingPhotoType = '';
    let pendingPhoto = null;
    hiddenFile.addEventListener('change', (ev) => {
      const f = ev.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        const b64 = r.result;
        pendingPhoto = b64;
        pendingPhotoName = f.name || '';
        pendingPhotoType = f.type || '';
        if (photoEl) {
          photoEl.src = b64;
          photoEl.classList.remove('hidden');
        }
      };
      r.readAsDataURL(f);
    });

    // replace actions with save/cancel
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
      let photoChanged = false;
      if (idx !== -1) {
        entries[idx].text = newText;
        if (pendingPhoto) {
          entries[idx].photo = pendingPhoto;
          entries[idx].photoName = pendingPhotoName || '';
          entries[idx].photoType = pendingPhotoType || '';
          photoChanged = true;
        }
        saveEntries();
      }
      card.classList.remove('record-editing');
      renderTimeline();
      if (photoChanged) {
        alert('保存成功，照片已更换。');
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
