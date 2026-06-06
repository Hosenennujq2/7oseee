/* ================================
   7oseeeFile — main.js
   ================================ */

const FILES_KEY = '7oseeeFile_files';

/* ── STORAGE ─────────────────────── */
function getFiles() {
  try { return JSON.parse(localStorage.getItem(FILES_KEY)) || []; }
  catch { return []; }
}

function saveFiles(files) {
  localStorage.setItem(FILES_KEY, JSON.stringify(files));
}

/* ── FORMATTERS ──────────────────── */
function formatSize(bytes) {
  if (bytes < 1024)        return bytes + ' B';
  if (bytes < 1048576)     return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824)  return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(2) + ' GB';
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('ar-SA', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

function getExt(name) {
  return name.split('.').pop().toUpperCase().slice(0, 5);
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ── TOAST ───────────────────────── */
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

/* ── RENDER FILES ────────────────── */
function renderFiles() {
  const files   = getFiles();
  const counter = document.getElementById('countStat');
  const list    = document.getElementById('fileList');

  if (counter) counter.textContent = files.length;
  if (!list)   return;

  if (!files.length) {
    list.innerHTML = '<div class="empty-state">لا توجد ملفات مرفوعة بعد 📭</div>';
    return;
  }

  const recent = files.slice().reverse().slice(0, 10);

  list.innerHTML = recent.map(f => `
    <div class="file-row">
      <div class="file-name-cell">
        <span class="file-ext">${getExt(f.name)}</span>
        <span>${f.name}</span>
      </div>
      <div class="file-size">${formatSize(f.size)}</div>
      <div class="file-date">${formatDate(f.date)}</div>
      <div>
        <button class="file-dl-btn" data-id="${f.id}">⬇️ تحميل</button>
      </div>
    </div>
  `).join('');

  // attach download events
  list.querySelectorAll('.file-dl-btn').forEach(btn => {
    btn.addEventListener('click', () => downloadFile(btn.dataset.id));
  });
}

/* ── DOWNLOAD ────────────────────── */
function downloadFile(id) {
  const file = getFiles().find(f => f.id === id);
  if (!file) return;
  const link    = document.createElement('a');
  link.href     = file.data;
  link.download = file.name;
  link.click();
}

/* ── UPLOAD ──────────────────────── */
function handleUpload(fileList) {
  if (!fileList || !fileList.length) return;

  const file = fileList[0];

  if (file.size > 2 * 1024 * 1024 * 1024) {
    showToast('❌ الملف أكبر من 2GB!');
    return;
  }

  const progress = document.getElementById('uploadProgress');
  const fill     = document.getElementById('progressFill');
  const pText    = document.getElementById('progressText');

  progress.classList.remove('hidden');
  fill.style.width  = '0%';
  pText.textContent = `جاري رفع: ${file.name}`;

  const reader = new FileReader();

  reader.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = Math.round(e.loaded / e.total * 100);
      fill.style.width  = pct + '%';
      pText.textContent = `جاري الرفع... ${pct}%`;
    }
  };

  reader.onload = (e) => {
    fill.style.width  = '100%';
    pText.textContent = '✅ تم الرفع بنجاح!';

    const newFile = {
      id:   genId(),
      name: file.name,
      size: file.size,
      type: file.type,
      date: Date.now(),
      data: e.target.result
    };

    const files = getFiles();
    files.push(newFile);
    saveFiles(files);
    renderFiles();
    showToast('✅ تم رفع ' + file.name + ' بنجاح!');

    setTimeout(() => {
      progress.classList.add('hidden');
      fill.style.width = '0%';
    }, 2500);
  };

  reader.onerror = () => {
    showToast('❌ حدث خطأ أثناء قراءة الملف');
    progress.classList.add('hidden');
  };

  reader.readAsDataURL(file);
}

/* ── EVENT LISTENERS ─────────────── */
document.addEventListener('DOMContentLoaded', () => {

  const zone      = document.getElementById('uploadZone');
  const fileInput = document.getElementById('fileInput');
  const uploadBtn = document.getElementById('uploadBtn');
  const browseBtn = document.getElementById('browseBtn');

  // drag & drop
  if (zone) {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      handleUpload(e.dataTransfer.files);
    });
  }

  // file input change
  if (fileInput) {
    fileInput.addEventListener('change', () => handleUpload(fileInput.files));
  }

  // upload button
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => fileInput.click());
  }

  // browse button scrolls to files
  if (browseBtn) {
    browseBtn.addEventListener('click', () => {
      document.getElementById('files')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // initial render
  renderFiles();
});
