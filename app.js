/* =============================================
   APP.JS — PhotoStudio (Native Ultra - Final Fix)
   =============================================
   ⚙️  PARAMÈTRES
   ============================================= */
const ACCESS_CODE = '1837'; 

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
   UPLOAD & FICHIERS
   ============================================= */
const dropZone  = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

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
// CORRECTION : La fonction est réparée et robuste
function openInEditor(id) {
  const photo = photos.find(p => p.id === id);
  if (!photo) return;

  resetFilters();
  rotation = 0; flipH = false; flipV = false;

  const img = new Image();
  img.onload = () => {
    currentImage = img;
    document.getElementById('canvasPlaceholder').style.display = 'none';
    canvas.style.display = 'block';
    
    // Auto-détection orientation
    if (img.naturalWidth > img.naturalHeight) orientation = 'landscape';
    else orientation = 'portrait';
    document.getElementById('btnPortrait') .classList.toggle('active', orientation === 'portrait');
    document.getElementById('btnLandscape').classList.toggle('active', orientation === 'landscape');
    
    document.getElementById('resolutionSelect').value = 'original'; // Reset dropdown
    
    applyResolution();
    showSection('editor');
  };
  img.src = photo.src;
}

/* ------ Résolution & Auto-Amélioration ------ */
// CORRECTION : La 16K est gérée, et l'upscaling active la netteté automatique
function applyResolution() {
  if (!currentImage) return;
  const sel = document.getElementById('resolutionSelect').value;
  let w = currentImage.naturalWidth;
  let h = currentImage.naturalHeight;

  if (sel !== 'original') {
    const [rw, rh] = sel.split('x').map(Number);
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
  document.getElementById('canvasInfo').textContent = `${targetWidth} × ${targetHeight} px`;
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
  document.getElementById('resolutionSelect').value = 'original';
  updateFilterLabels();
  if (currentImage) redraw();
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

/* ------ Algorithme de Netteté (Matrice de Convolution) ------ */
// CORRECTION : L'algorithme est réécrit pour être plus performant
function applySharpen(context, w, h, amount) {
  if (amount <= 0) return;
  
  // Limiter la netteté en preview mobile pour éviter crash
  let effectiveAmount = amount;
  if (context === ctx && window.innerWidth < 600 && (w > 1500 || h > 1500)) {
      effectiveAmount = Math.min(amount, 15); // N'applique qu'un peu de netteté en preview si image géante
  }

  const imgData = context.getImageData(0, 0, w, h);
  const data = imgData.data;
  const buff = new Uint8ClampedArray(data);
  const mix = effectiveAmount / 100; 
  const w4 = w * 4;
  
  // Matrice de convolution Laplacian (renforcée)
  // [ 0, -1,  0]
  // [-1,  5, -1]
  // [ 0, -1,  0]
  for (let y = 1; y < h - 1; y++) {
    const y_w4 = y * w4;
    const y_prev_w4 = (y - 1) * w4;
    const y_next_w4 = (y + 1) * w4;

    for (let x = 1; x < w - 1; x++) {
      const i = y_w4 + x * 4;
      const x4_prev = (x - 1) * 4;
      const x4_next = (x + 1) * 4;

      for (let c = 0; c < 3; c++) {
        const center = buff[i + c];
        // Calcul matrice
        const val = 5 * center
                  - buff[y_prev_w4 + i%w4 + c] // haut
                  - buff[y_next_w4 + i%w4 + c] // bas
                  - buff[y_w4 + x4_prev + c]     // gauche
                  - buff[y_w4 + x4_next + c];    // droite
        
        // Mixage original / aiguisé
        data[i + c] = center + mix * (val - center);
      }
    }
  }
  context.putImageData(imgData, 0, 0);
}

/* ------ Dessin principal (Prévisualisation) ------ */
function redraw() {
  if (!currentImage) return;
  
  // Protection mémoire : En preview, on ne dessine pas en 16K, c'est inutile et ça fait crasher
  // On dessine à la taille de l'écran max, mais on garde targetWidth/Height pour l'info
  let drawW = targetWidth;
  let drawH = targetHeight;
  const MAX_PREVIEW = 2500; // Limite raisonnable pour processeur mobile

  if (drawW > MAX_PREVIEW || drawH > MAX_PREVIEW) {
    const ratio = Math.min(MAX_PREVIEW / drawW, MAX_PREVIEW / drawH);
    drawW = Math.round(drawW * ratio);
    drawH = Math.round(drawH * ratio);
  }

  const swap = rotation === 90 || rotation === 270;
  canvas.width  = swap ? drawH : drawW;
  canvas.height = swap ? drawW : drawH;

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  if (flipH) ctx.scale(-1, 1);
  if (flipV) ctx.scale(1, -1);
  
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  // Filtres CSS natifs (sauf netteté)
  ctx.filter = buildCSSFilter();
  
  ctx.drawImage(currentImage, -drawW/2, -drawH/2, drawW, drawH);
  ctx.restore();

  // Applique la netteté mathématique lourde en JS
  const sharpness = +document.getElementById('sharpness').value;
  if (sharpness > 0) {
    applySharpen(ctx, canvas.width, canvas.height, sharpness);
  }
}

/* ------ Téléchargement (Le moment de vérité pour la qualité) ------ */
function downloadImage() {
  if (!currentImage) { alert('Aucune image chargée.'); return; }
  
  const btn = document.getElementById('btnDownload');
  btn.innerHTML = '⏳ Calcul géant...';
  btn.style.opacity = 0.5;
  btn.disabled = true;

  //setTimeout pour laisser le temps au bouton de changer de texte avant de figer le navigateur
  setTimeout(() => {
    const sel = document.getElementById('resolutionSelect').value;
    const isUpscale = sel.includes('16384') || sel.includes('3840');

    const w = targetWidth;
    const h = targetHeight;
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
    
    // Filtres natifs (rapide)
    exportCtx.filter = buildCSSFilter();

    exportCtx.drawImage(currentImage, -w/2, -h/2, w, h);
    exportCtx.restore();

    // --- AMÉLIORATION DE QUALITÉ GÉANTE ---
    let sharpness = +document.getElementById('sharpness').value;
    
    //🔥 MAGIC : Si on est en 4K/16K, on force une netteté de matrice agressive 
    // pour compenser le flou de l'étirement, même si le curseur est à 0.
    if (isUpscale) {
        sharpness = Math.max(sharpness, 25); // Minimum 25% de netteté pour "inventer" du détail
    }

    if (sharpness > 0) {
      applySharpen(exportCtx, exportCvs.width, exportCvs.height, sharpness);
    }

    try {
        const link = document.createElement('a');
        link.download = `photostudio_${sel}.png`;
        link.href = exportCvs.toDataURL('image/png', 1.0); // Force qualité max
        link.click();
    } catch (e) {
        alert("Erreur: L'image est trop géante (16K?) pour la mémoire de votre navigateur.");
    } finally {
        btn.innerHTML = '↓ Télécharger';
        btn.style.opacity = 1;
        btn.disabled = false;
    }
  }, 100);
}

/* =============================================
   INIT
   ============================================= */
updateEditorAccess();
updateFilterLabels();