// ==================== JIGSAW PUZZLE ENGINE ====================
const GRID = 8;
let puzzleImageUrl = '';
let puzzleImageFilename = '';
let placedPieces = new Set();
let moveCount = 0;
let timerSeconds = 0;
let timerInterval = null;
let hTabs = [], vTabs = [];
let puzzleImg = null;
let cellSize = 60, tabSize = 11;
let dragData = null;

function startPuzzle(imageUrl, filename) {
  puzzleImageUrl = imageUrl;
  puzzleImageFilename = filename;
  moveCount = 0;
  timerSeconds = 0;
  placedPieces = new Set();
  switchTab('puzzle');
  setTimeout(() => {
    puzzleImg = new Image();
    puzzleImg.crossOrigin = 'anonymous';
    puzzleImg.onload = () => { buildPuzzle(); startTimer(); };
    puzzleImg.src = imageUrl;
  }, 50);
}

// Generate deterministic tab pattern for grid edges: 1 = tab outward, -1 = socket inward
function genTabs() {
  hTabs = []; vTabs = [];
  for (let r = 0; r < GRID - 1; r++) {
    hTabs[r] = [];
    for (let c = 0; c < GRID; c++) hTabs[r][c] = Math.random() < 0.5 ? 1 : -1;
  }
  for (let r = 0; r < GRID; r++) {
    vTabs[r] = [];
    for (let c = 0; c < GRID - 1; c++) vTabs[r][c] = Math.random() < 0.5 ? 1 : -1;
  }
}

function getTabs(r, c) {
  return {
    top: r === 0 ? 0 : -hTabs[r - 1][c],
    bottom: r === GRID - 1 ? 0 : hTabs[r][c],
    left: c === 0 ? 0 : -vTabs[r][c - 1],
    right: c === GRID - 1 ? 0 : vTabs[r][c]
  };
}

function buildPuzzle() {
  genTabs();
  const board = document.getElementById('puzzleBoard');
  const tray = document.getElementById('puzzleTray');
  if (!board || !tray) return;
  board.innerHTML = ''; tray.innerHTML = '';

  const bs = board.clientWidth || 480;
  cellSize = bs / GRID;
  tabSize = cellSize * 0.20;

  // Outline overlay on board showing jigsaw slots
  const oc = document.createElement('canvas');
  oc.width = bs; oc.height = bs;
  oc.className = 'pz-outline';
  const ctx = oc.getContext('2d');
  ctx.strokeStyle = 'rgba(255, 117, 140, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const t = getTabs(r, c);
      drawPiecePath(ctx, c * cellSize, r * cellSize, cellSize, cellSize, t);
      ctx.stroke();
    }
  }
  board.appendChild(oc);

  // Drop-target cells
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const cell = document.createElement('div');
      cell.className = 'pz-cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      board.appendChild(cell);
    }
  }

  // Shuffled pieces in tray
  const pcs = [];
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++) pcs.push({ r, c });
  for (let i = pcs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pcs[i], pcs[j]] = [pcs[j], pcs[i]];
  }
  pcs.forEach(p => tray.appendChild(makePiece(p.r, p.c)));

  updateStats();
  const vb = document.getElementById('puzzleVictoryBanner');
  if (vb) vb.style.display = 'none';
}

// Create a single jigsaw piece element with canvas clipping
function makePiece(row, col) {
  const t = getTabs(row, col);
  const pT = t.top === 1 ? tabSize : 0;
  const pR = t.right === 1 ? tabSize : 0;
  const pB = t.bottom === 1 ? tabSize : 0;
  const pL = t.left === 1 ? tabSize : 0;
  const cw = Math.ceil(cellSize + pL + pR);
  const ch = Math.ceil(cellSize + pT + pB);

  const cvs = document.createElement('canvas');
  cvs.width = cw; cvs.height = ch;
  const ctx = cvs.getContext('2d');

  // Clip to jigsaw shape
  drawPiecePath(ctx, pL, pT, cellSize, cellSize, t);
  ctx.save(); ctx.clip();

  // Draw corresponding section of source image
  if (puzzleImg && puzzleImg.naturalWidth) {
    const scX = puzzleImg.naturalWidth / (GRID * cellSize);
    const scY = puzzleImg.naturalHeight / (GRID * cellSize);
    ctx.drawImage(puzzleImg,
      (col * cellSize - pL) * scX, (row * cellSize - pT) * scY,
      cw * scX, ch * scY,
      0, 0, cw, ch
    );
  }
  ctx.restore();

  // Outline border around piece shape
  drawPiecePath(ctx, pL, pT, cellSize, cellSize, t);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const div = document.createElement('div');
  div.className = 'pz-piece';
  div.dataset.row = row;
  div.dataset.col = col;
  div.dataset.pL = pL;
  div.dataset.pT = pT;
  div.style.width = cw + 'px';
  div.style.height = ch + 'px';
  div.appendChild(cvs);
  div.addEventListener('pointerdown', onPieceDown);
  return div;
}

// ==================== JIGSAW PATH DRAWING ====================
// Clockwise path: Top -> Right -> Bottom -> Left
function drawPiecePath(ctx, ox, oy, w, h, t) {
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  drawEdge(ctx, ox, oy, ox + w, oy, t.top);
  drawEdge(ctx, ox + w, oy, ox + w, oy + h, t.right);
  drawEdge(ctx, ox + w, oy + h, ox, oy + h, t.bottom);
  drawEdge(ctx, ox, oy + h, ox, oy, t.left);
  ctx.closePath();
}

// Draws a straight edge (dir = 0) or tab/socket curve (dir = 1 or -1)
function drawEdge(ctx, x1, y1, x2, y2, dir) {
  if (dir === 0) { ctx.lineTo(x2, y2); return; }
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  // Outward normal vector (pointing left of clockwise path):
  const nx = (dy / len) * dir;
  const ny = (-dx / len) * dir;
  const b = len * 0.20; // Tab height

  const p1x = x1 + dx * 0.35, p1y = y1 + dy * 0.35;
  const p2x = x1 + dx * 0.65, p2y = y1 + dy * 0.65;
  const mx = x1 + dx * 0.5 + nx * b, my = y1 + dy * 0.5 + ny * b;

  ctx.lineTo(p1x, p1y);
  ctx.bezierCurveTo(p1x + nx * b * 0.85, p1y + ny * b * 0.85, mx - dx * 0.1, my - dy * 0.1, mx, my);
  ctx.bezierCurveTo(mx + dx * 0.1, my + dy * 0.1, p2x + nx * b * 0.85, p2y + ny * b * 0.85, p2x, p2y);
  ctx.lineTo(x2, y2);
}

// ==================== DRAG & DROP ====================
function onPieceDown(e) {
  e.preventDefault();
  const piece = e.currentTarget;
  const rect = piece.getBoundingClientRect();

  dragData = {
    el: piece,
    ox: e.clientX - rect.left,
    oy: e.clientY - rect.top,
    row: parseInt(piece.dataset.row),
    col: parseInt(piece.dataset.col),
    pL: parseFloat(piece.dataset.pL),
    pT: parseFloat(piece.dataset.pT),
    w: piece.style.width,
    h: piece.style.height
  };

  piece.classList.add('pz-dragging');
  document.body.appendChild(piece);
  piece.style.left = (e.clientX - dragData.ox) + 'px';
  piece.style.top = (e.clientY - dragData.oy) + 'px';

  document.addEventListener('pointermove', onDragMove);
  document.addEventListener('pointerup', onDragUp);
}

function onDragMove(e) {
  if (!dragData) return;
  e.preventDefault();
  dragData.el.style.left = (e.clientX - dragData.ox) + 'px';
  dragData.el.style.top = (e.clientY - dragData.oy) + 'px';
}

function onDragUp(e) {
  if (!dragData) return;
  document.removeEventListener('pointermove', onDragMove);
  document.removeEventListener('pointerup', onDragUp);

  const piece = dragData.el;
  piece.classList.remove('pz-dragging');

  // Hide piece briefly to run elementFromPoint on element underneath cursor
  piece.style.display = 'none';
  const hit = document.elementFromPoint(e.clientX, e.clientY);
  piece.style.display = '';

  const cell = hit ? hit.closest('.pz-cell') : null;
  const correct = cell
    && !cell.querySelector('.pz-placed')
    && parseInt(cell.dataset.row) === dragData.row
    && parseInt(cell.dataset.col) === dragData.col;

  if (correct) {
    moveCount++;
    placedPieces.add(dragData.row * GRID + dragData.col);

    const placed = document.createElement('div');
    placed.className = 'pz-placed pz-pop';
    placed.style.left = -dragData.pL + 'px';
    placed.style.top = -dragData.pT + 'px';
    placed.style.width = dragData.w;
    placed.style.height = dragData.h;
    
    const cvs = piece.querySelector('canvas');
    if (cvs) placed.appendChild(cvs);
    cell.appendChild(placed);
    piece.remove();

    try { playPopSound(); } catch (er) {}
    updateStats();
    checkVictory();
  } else {
    // Return piece to tray
    piece.style.position = '';
    piece.style.left = '';
    piece.style.top = '';
    piece.style.zIndex = '';
    const tray = document.getElementById('puzzleTray');
    if (tray) tray.appendChild(piece);
    if (cell) {
      piece.classList.add('pz-shake');
      setTimeout(() => piece.classList.remove('pz-shake'), 400);
    }
  }
  dragData = null;
}

// ==================== VICTORY & STATS ====================
function checkVictory() {
  if (placedPieces.size === GRID * GRID) {
    clearInterval(timerInterval);
    try { playFanfare(); } catch (e) {}
    try { triggerConfetti(); } catch (e) {}
    const vb = document.getElementById('puzzleVictoryBanner');
    if (vb) {
      const st = document.getElementById('victoryStatsText');
      if (st) st.textContent = `Vreme: ${formatTime(timerSeconds)} | Potezi: ${moveCount}`;
      vb.style.display = 'block';
    }
    savePuzzleCompletion();
  }
}

async function savePuzzleCompletion() {
  try {
    await fetch('/api/puzzle/complete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_filename: puzzleImageFilename, moves: moveCount, time_seconds: timerSeconds })
    });
  } catch (e) { console.error('Save error:', e); }
}

function startTimer() {
  clearInterval(timerInterval); timerSeconds = 0;
  timerInterval = setInterval(() => { timerSeconds++; updateStats(); }, 1000);
}

function updateStats() {
  const m = document.getElementById('puzzleMoves'), t = document.getElementById('puzzleTimer'), p = document.getElementById('puzzlePlaced');
  if (m) m.textContent = moveCount;
  if (t) t.textContent = formatTime(timerSeconds);
  if (p) p.textContent = `${placedPieces.size}/${GRID * GRID}`;
}

function formatTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function togglePuzzlePreview() {
  const o = document.getElementById('previewOverlay');
  if (o) o.style.display = o.style.display === 'none' ? 'flex' : 'none';
}
