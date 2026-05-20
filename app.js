/* =============================================
   APP.JS — PhotoStudio
   =============================================
   ⚙️  PARAMÈTRES
   ============================================= */
const ACCESS_CODE = '1837';
const AI_API_KEY = '4dbd8756-0a5a-4c5c-a747-586d7d971009'; // Ta clé API

/* =============================================
   ÉTAT GLOBAL
   ============================================= */
let photos        = [];
let currentImage  = null;   
let rotation      = 0;
let flipH         = false;
let flipV         = false;
let targetWidth   = null;
let targetHeight  = null;
let orientation   = 'portrait';

const canvas      = document.getElementById('mainCanvas');
const ctx         = canvas.getContext('2d');
const exportCvs   = document.getElementById('exportCanvas');
const exportCtx   = exportCvs.getContext('2d');

/* =============================================
   LOCK / UNLOCK
   ============================================= */
(function initLock() {
  const digits   = document.querySelectorAll('.pin-digit');
  const unlockBtn= document.getElementById('unlockBtn');
  const errorEl  = document.getElementById('pinError');

  digits.forEach((d, i) => {
    d.addEventListener('input', () => {
      d.value = d.value.replace(/\D/g, '').slice(-1);
      if (d.value && i < digits.length - 1) digits[i+1].focus();
    });
    d.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !d.value && i > 0) digits[i-1].focus();
      if (e.key === 'Enter') tryUnlock();
    });
  });
  unlockBtn.addEventListener('click', tryUnlock);

  function tryUnlock() {
    const entered = [...digits].map(d => d.value).join('');
    if (entered === ACCESS_CODE) {
      const ls = document.getElementById('lockScreen');
      ls.classList.add('exit');
      setTimeout(() => {
        ls.style.display = 'none';
        document.getElementById('app').classList.remove('hidden');
        renderGallery();
      }, 500);
    } else {
      errorEl.classList.add('visible');
      digits.forEach(d => {
        d.value = '';
        d.classList.add('shake');
        setTimeout(() => d.classList.remove('shake'), 500);
      });
      digits[0].focus();
      setTimeout(() => errorEl.classList.remove('visible'), 2000);
    }
  }
  digits[0].focus();
})();

function lockApp() {
  document.getElementById('app').classList.add('hidden');
  const ls = document.getElementById('lockScreen');
  ls.style.display = '';
  ls.classList.remove('exit');
  document.querySelectorAll('.pin-digit').forEach(d => d.value = '');
  document.getElementById('pinError').classList.remove('visible');
  document.querySelectorAll('.pin-digit')[0].focus();
}

/* =============================================
   NAVIGATION
   ============================================= */
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('section' + name.charAt(0).toUpperCase() + name.slice(1)).classList.add('active');
  document.getElementById('nav' + name.charAt(0).toUpperCase() + name.slice(1)).classList.add('active');
  if (name === 'gallery') renderGallery();
}

/* =============================================
   UPLOAD & FICHIERS (CORRIGÉ: CLICS & MOBILE)
   ============================================= */
const dropZone  = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

// Évite le double-clic (conflit entre le label et la div)
dropZone.addEventListener('click', (e) => {
  if (e.target.tagName === 'LABEL' || e.target.tagName === 'INPUT') return;
  fileInput.click();
});

dropZone.addEventListener('dragover',   e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave',  ()=> dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFiles([...e.dataTransfer.files]);
});
fileInput.addEventListener('change', () => handleFiles([...fileInput.files]));

function handleFiles(files) {
  // Prise en charge des formats mobiles récents comme .heic
  const valid = files.filter(f => 
    f.type.startsWith('image/') || 
    f.name.match(/\.(jpg|jpeg|png|webp|heic|heif)$/i)
  );

  valid.forEach(file => {
    const src = URL.createObjectURL(file);
    const id = 'photo_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    
    photos.push({ id, src: src, name: file.name });
    addUploadThumb(id, src);
    updateEditorAccess();
  });
  fileInput.value = '';
}

function addUploadThumb(id, src) {
  const grid = document.getElementById('uploadPreview');
  const wrap = document.createElement('div');
  wrap.className = 'upload-thumb';
  wrap.dataset.id = id;
  wrap.innerHTML = `
    <img src="${src}" alt="aperçu" />
    <div class="thumb-overlay">
      <button class="btn-edit" onclick="openInEditor('${id}')">✏ Éditer</button>
      <button class="btn-del"  onclick="deletePhoto('${id}')">✕</button>
    </div>`;
  grid.prepend(wrap);
}

function updateEditorAccess() {
  const btn = document.getElementById('navEditor');
  btn.disabled = photos.length === 0;
}

/* =============================================
   GALERIE
   ============================================= */
function renderGallery() {
  const grid = document.getElementById('gallery');
  const countEl = document.getElementById('photoCount');
  countEl.textContent = photos.length + ' photo(s)';
  grid.innerHTML = '';

  if (photos.length === 0) {
    grid.innerHTML = `
      <div class="gallery-empty">
        <p>Votre album est vide.</p>
        <button onclick="showSection('upload')">Importer des photos →</button>
      </div>`;
    return;
  }
  photos.forEach(p => {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.innerHTML = `
      <img src="${p.src}" alt="${p.name}" loading="lazy" />
      <div class="gi-overlay">
        <button class="btn-edit-g" onclick="openInEditor('${p.id}')">✏ Éditer</button>
        <button class="btn-del-g"  onclick="deletePhoto('${p.id}')">✕</button>
      </div>`;
    grid.appendChild(item);
  });
}

function deletePhoto(id) {
  photos = photos.filter(p => p.id !== id);
  renderGallery();
  const el = document.querySelector(`.upload-thumb[data-id="${id}"]`);
  if (el) el.remove();
  updateEditorAccess();
}

function clearGallery() {
  if (photos.length === 0) return;
  if (!confirm('Vider tout l\'album ?')) return;
  photos = [];
  renderGallery();
  document.getElementById('uploadPreview').innerHTML = '';
  updateEditorAccess();
}

/* =============================================
   ÉDITEUR
   ============================================= */
function openInEditor(id) {
  const photo = photos.find(p => p.id === id);
  if (!photo) return;

  resetFilters();
  rotation = 0; flipH = false; flipV = false;

  const img = new Image();
  img.crossOrigin = "Anonymous";
  img.onload = () => {
    currentImage = img;
    document.getElementById('canvasPlaceholder').style.display = 'none';
    canvas.style.display = 'block';
    applyResolution();
    showSection('editor');
  };
  img.src = photo.src;
}

/* ------ Résolution ------ */
function applyResolution() {
  if (!currentImage) return;
  const sel = document.getElementById('resolutionSelect').value;
  let w = currentImage.naturalWidth;
  let h = currentImage.naturalHeight;

  if (sel !== 'original') {
    const [rw, rh] = sel.split('x').map(Number);
    const ratio = w / h;
    if (orientation === 'landscape') {
      w = Math.max(rw, rh); h = Math.min(rw, rh);
    } else {
      w = Math.min(rw, rh); h = Math.max(rw, rh);
    }
  } else {
    if (orientation === 'landscape' && w < h) { [w,h] = [h,w]; }
    if (orientation === 'portrait'  && w > h) { [w,h] = [h,w]; }
  }
  targetWidth = w; targetHeight = h;
  redraw();
  document.getElementById('canvasInfo').textContent = `${w} × ${h} px`;
}

/* ------ Orientation ------ */
function setOrientation(mode) {
  orientation = mode;
  document.getElementById('btnPortrait') .classList.toggle('active', mode === 'portrait');
  document.getElementById('btnLandscape').classList.toggle('active', mode === 'landscape');
  applyResolution();
}

/* ------ Rotation & Miroir ------ */
function rotateImage(deg) {
  rotation = (rotation + deg + 360) % 360;
  redraw();
}
function flipImage(axis) {
  if (axis === 'h') flipH = !flipH;
  else             flipV = !flipV;
  redraw();
}

/* ------ Filtres ------ */
function applyFilters() {
  updateFilterLabels();
  redraw();
}

function updateFilterLabels() {
  ['brightness','contrast','saturation','sharpness','blur','hue','sepia','grayscale','invert'].forEach(id => {
    const val = document.getElementById(id).value;
    const label = document.getElementById('val' + id.charAt(0).toUpperCase() + id.slice(1));
    if (label) label.textContent = val;
  });
}

function resetFilters() {
  const defaults = {brightness:0, contrast:0, saturation:0, sharpness:0, blur:0, hue:0, sepia:0, grayscale:0, invert:0};
  Object.entries(defaults).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
  updateFilterLabels();
  if (currentImage) redraw();
}

/* ------ Dessin principal ------ */
function redraw() {
  if (!currentImage) return;
  const w = targetWidth  || currentImage.naturalWidth;
  const h = targetHeight || currentImage.naturalHeight;

  const swap = rotation === 90 || rotation === 270;
  canvas.width  = swap ? h : w;
  canvas.height = swap ? w : h;

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  if (flipH) ctx.scale(-1, 1);
  if (flipV) ctx.scale(1, -1);
  
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  ctx.drawImage(currentImage, -w/2, -h/2, w, h);
  ctx.restore();

  canvas.style.filter = buildCSSFilter();
}

function buildCSSFilter() {
  const b  = +document.getElementById('brightness').value;
  const c  = +document.getElementById('contrast').value;
  const s  = +document.getElementById('saturation').value;
  const bl = +document.getElementById('blur').value;
  const h  = +document.getElementById('hue').value;
  const sp = +document.getElementById('sepia').value;
  const gs = +document.getElementById('grayscale').value;
  const iv = +document.getElementById('invert').value;

  return [
    `brightness(${1 + b/100})`,
    `contrast(${1 + c/100})`,
    `saturate(${1 + s/100})`,
    `blur(${bl}px)`,
    `hue-rotate(${h}deg)`,
    `sepia(${sp}%)`,
    `grayscale(${gs}%)`,
    `invert(${iv}%)`
  ].join(' ');
}

/* =============================================
   INTÉGRATION IA (CORRIGÉE: NE TOURNE PLUS DANS LE VIDE)
   ============================================= */
async function upscaleImageWithAI() {
  if (!currentImage) return;
  
  const btn = document.getElementById('btnAiUpscale');
  if(btn) btn.textContent = '⏳ Traitement...';
  
  try {
    exportCvs.width = currentImage.naturalWidth;
    exportCvs.height = currentImage.naturalHeight;
    exportCtx.clearRect(0, 0, exportCvs.width, exportCvs.height);
    exportCtx.drawImage(currentImage, 0, 0);
    
    // On force le code à attendre que l'image soit bien transformée en fichier
    const blob = await new Promise((resolve, reject) => {
      exportCvs.toBlob((b) => {
        if(b) resolve(b);
        else reject(new Error("Impossible de préparer l'image."));
      }, 'image/jpeg', 0.9);
    });
      
    const formData = new FormData();
    formData.append('image', blob);
    
    const response = await fetch('https://api.deepai.org/api/torch-srgan', {
      method: 'POST',
      headers: { 'api-key': AI_API_KEY },
      body: formData
    });
    
    const data = await response.json();
    
    if (data.output_url) {
      const newImg = new Image();
      newImg.crossOrigin = "Anonymous";
      newImg.onload = () => {
        currentImage = newImg;
        applyResolution(); // Met à jour l'image avec la version haute qualité
        if(btn) btn.textContent = '✨ Amélioré !';
        setTimeout(() => { if(btn) btn.textContent = '✨ IA Upscale'; }, 3000);
      };
      newImg.onerror = () => { throw new Error("Le navigateur a bloqué la nouvelle image."); };
      newImg.src = data.output_url;
    } else {
      throw new Error(data.err || data.error || "L'API a retourné une erreur inconnue.");
    }
  } catch (err) {
    console.error(err);
    alert("Erreur IA : " + err.message);
    if(btn) btn.textContent = '✨ IA Upscale';
  }
}

/* ------ Téléchargement ------ */
function downloadImage() {
  if (!currentImage) { alert('Aucune image chargée.'); return; }
  const w = targetWidth  || currentImage.naturalWidth;
  const h = targetHeight || currentImage.naturalHeight;
  const swap = rotation === 90 || rotation === 270;

  exportCvs.width  = swap ? h : w;
  exportCvs.height = swap ? w : h;

  exportCtx.save();
  exportCtx.translate(exportCvs.width/2, exportCvs.height/2);
  exportCtx.rotate((rotation * Math.PI) / 180);
  if (flipH) exportCtx.scale(-1, 1);
  if (flipV) exportCtx.scale(1, -1);
  
  exportCtx.imageSmoothingEnabled = true;
  exportCtx.imageSmoothingQuality = 'high';
  
  exportCtx.drawImage(currentImage, -w/2, -h/2, w, h);
  exportCtx.restore();

  applyCanvasFilters(exportCtx, exportCvs.width, exportCvs.height);

  const link = document.createElement('a');
  link.download = 'photostudio_export.png';
  link.href = exportCvs.toDataURL('image/png');
  link.click();
}

function applyCanvasFilters(ctx2, w, h) {
  const b  = +document.getElementById('brightness').value;
  const c  = +document.getElementById('contrast').value;
  const s  = +document.getElementById('saturation').value;
  const sp = +document.getElementById('sepia').value;
  const gs = +document.getElementById('grayscale').value;
  const iv = +document.getElementById('invert').value;

  if (!b && !c && !s && !sp && !gs && !iv) return; 

  const imgData = ctx2.getImageData(0, 0, w, h);
  const d = imgData.data;

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i+1], bi2 = d[i+2];

    r += b * 2.55; g += b * 2.55; bi2 += b * 2.55;

    const cf = (259 * (c + 255)) / (255 * (259 - c));
    r  = cf * (r  - 128) + 128;
    g  = cf * (g  - 128) + 128;
    bi2= cf * (bi2- 128) + 128;

    if (gs > 0) {
      const gray = 0.299*r + 0.587*g + 0.114*bi2;
      const gf = gs/100;
      r  = r  + (gray - r)  * gf;
      g  = g  + (gray - g)  * gf;
      bi2= bi2+ (gray - bi2)* gf;
    }

    if (sp > 0) {
      const sf = sp/100;
      const sr = 0.393*r + 0.769*g + 0.189*bi2;
      const sg = 0.349*r + 0.686*g + 0.168*bi2;
      const sb = 0.272*r + 0.534*g + 0.131*bi2;
      r  = r  + (sr - r)  * sf;
      g  = g  + (sg - g)  * sf;
      bi2= bi2+ (sb - bi2)* sf;
    }

    if (iv > 0) {
      const ivf = iv/100;
      r  = r  + (255-r  *2) * ivf;
      g  = g  + (255-g  *2) * ivf;
      bi2= bi2+ (255-bi2*2) * ivf;
    }

    d[i]   = Math.min(255, Math.max(0, r));
    d[i+1] = Math.min(255, Math.max(0, g));
    d[i+2] = Math.min(255, Math.max(0, bi2));
  }
  ctx2.putImageData(imgData, 0, 0);
}

/* =============================================
   INIT
   ============================================= */
updateEditorAccess();
updateFilterLabels();

// Injection dynamique du bouton IA à côté des résolutions
document.addEventListener('DOMContentLoaded', () => {
  const resGroup = document.querySelector('#resolutionSelect').parentElement;
  if(resGroup) {
    const aiBtn = document.createElement('button');
    aiBtn.id = 'btnAiUpscale';
    aiBtn.className = 'tool-btn accent';
    aiBtn.style.width = 'auto';
    aiBtn.style.padding = '0 10px';
    aiBtn.style.marginLeft = '10px';
    aiBtn.textContent = '✨ IA Upscale';
    aiBtn.onclick = upscaleImageWithAI;
    resGroup.appendChild(aiBtn);
  }
});