// Global State
let currentUser = null;
let currentTab = 'proposal';

// Proposal Flow State
let noClickCount = 0;
const noMessages = [
  "Jesi li sigurna? 🥺",
  "Stvarno? </3",
  "Zaštooo? 😭",
  "Nema šanse da kažeš ne! 💖",
  "Razmisli još jednom! 🥰",
  "Samo pritisni DA! 🌸",
  "Nemoj mi slomiti srce! 💔",
  "Molim teee! 🧸"
];
let selectedDays = [];
let selectedActivities = [];
let customNoteText = '';

// Puzzle Game State
let puzzleData = null;
let gridSize = 3;
let tiles = []; // Array of tile indices: e.g. [0, 1, 2, 3, 4, 5, 6, 7, 8] where 8 is empty
let emptyIndex = 8;
let moveCount = 0;
let timerSeconds = 0;
let timerInterval = null;
let isPuzzleCompleted = false;

// Audio Synth Helpers (Web Audio API)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playPopSound() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.08);
}

function playFanfare() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
  notes.forEach((freq, idx) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime + idx * 0.12);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime + idx * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + idx * 0.12 + 0.25);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(audioCtx.currentTime + idx * 0.12);
    osc.stop(audioCtx.currentTime + idx * 0.12 + 0.25);
  });
}

// Background Floating Hearts
function initFloatingHearts() {
  const container = document.getElementById('heartBg');
  container.innerHTML = '';
  const heartIcons = ['❤️', '💖', '💕', '💗', '🌸', '✨', '🧸'];
  for (let i = 0; i < 22; i++) {
    const heart = document.createElement('div');
    heart.className = 'floating-heart';
    heart.textContent = heartIcons[Math.floor(Math.random() * heartIcons.length)];
    heart.style.left = Math.random() * 100 + 'vw';
    heart.style.animationDuration = (6 + Math.random() * 8) + 's';
    heart.style.animationDelay = (Math.random() * 5) + 's';
    heart.style.fontSize = (16 + Math.random() * 18) + 'px';
    container.appendChild(heart);
  }
}

// Canvas Confetti Generator
function triggerConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ['#ff758c', '#ff7eb3', '#c026d3', '#ffd166', '#06d6a0', '#118ab2'];

  for (let i = 0; i < 120; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 0.7) * 16,
      size: Math.random() * 10 + 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rSpeed: (Math.random() - 0.5) * 10,
      opacity: 1
    });
  }

  let animationFrame;
  function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // gravity
      p.opacity -= 0.012;
      p.rotation += p.rSpeed;

      if (p.opacity > 0) {
        alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    });

    if (alive) {
      animationFrame = requestAnimationFrame(update);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  update();
}

// ==================== APP INITIALIZATION & AUTH ====================

document.addEventListener('DOMContentLoaded', () => {
  initFloatingHearts();
  checkAuth();
  setupEventListeners();
});

async function checkAuth() {
  try {
    const res = await fetch('/api/me');
    const data = await res.json();
    if (data.authenticated) {
      setUserSession(data.user);
    } else {
      showLoginScreen();
    }
  } catch (err) {
    showLoginScreen();
  }
}

function setUserSession(user) {
  currentUser = user;
  document.getElementById('displayName').textContent = user.display_name;
  document.getElementById('loginSection').style.display = 'none';
  document.getElementById('appHeader').style.display = 'flex';
  
  // Show default tab
  switchTab(currentTab);
}

function showLoginScreen() {
  currentUser = null;
  document.getElementById('appHeader').style.display = 'none';
  document.getElementById('loginSection').style.display = 'block';
  hideAllSections();
}

function hideAllSections() {
  const sections = document.querySelectorAll('.app-section');
  sections.forEach(s => s.style.display = 'none');
}

function switchTab(tabName) {
  currentTab = tabName;
  hideAllSections();

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  if (tabName === 'proposal') {
    document.getElementById('proposalSection').style.display = 'block';
  } else if (tabName === 'puzzle') {
    document.getElementById('puzzleSection').style.display = 'block';
    loadTodayPuzzle();
  } else if (tabName === 'gallery') {
    document.getElementById('gallerySection').style.display = 'block';
    loadGallery();
  } else if (tabName === 'plans') {
    document.getElementById('plansSection').style.display = 'block';
    loadPlans();
  }
}

// ==================== EVENT LISTENERS SETUP ====================

function setupEventListeners() {
  // Navigation tabs
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Logout button
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    showLoginScreen();
  });

  // Login form & Quick logins
  document.getElementById('loginForm').addEventListener('submit', handleLoginSubmit);
  document.getElementById('loginAsVanja').addEventListener('click', () => quickLogin('vanja<3', 'lolxdlol123'));
  document.getElementById('loginAsAndrija').addEventListener('click', () => quickLogin('andrija<3', 'andrija123'));

  // Proposal flow listeners
  document.getElementById('noBtn').addEventListener('click', handleNoClick);
  document.getElementById('noBtn').addEventListener('mouseover', handleNoHover);
  document.getElementById('yesBtn').addEventListener('click', handleYesClick);
  document.getElementById('goToStep3').addEventListener('click', () => showProposalStep(3));
  document.getElementById('backToStep2').addEventListener('click', () => showProposalStep(2));
  document.getElementById('finishProposal').addEventListener('click', handleFinishProposal);
  document.getElementById('resetProposalBtn').addEventListener('click', resetProposalFlow);
  document.getElementById('copyWhatsAppBtn').addEventListener('click', copyWhatsAppMessage);
  document.getElementById('savePlanToDbBtn').addEventListener('click', savePlanToDb);

  // Day selection chips
  document.querySelectorAll('.day-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      playPopSound();
      chip.classList.toggle('selected');
      const day = chip.dataset.day;
      if (chip.classList.contains('selected')) {
        if (!selectedDays.includes(day)) selectedDays.push(day);
      } else {
        selectedDays = selectedDays.filter(d => d !== day);
      }
      document.getElementById('goToStep3').disabled = selectedDays.length === 0;
    });
  });

  // Activity cards
  document.querySelectorAll('.activity-card').forEach(card => {
    card.addEventListener('click', () => {
      playPopSound();
      card.classList.toggle('selected');
      const act = card.dataset.activity;
      if (card.classList.contains('selected')) {
        if (!selectedActivities.includes(act)) selectedActivities.push(act);
      } else {
        selectedActivities = selectedActivities.filter(a => a !== act);
      }
      document.getElementById('finishProposal').disabled = selectedActivities.length === 0;
    });
  });

  // Custom Note Input
  document.getElementById('customNoteInput').addEventListener('input', (e) => {
    customNoteText = e.target.value;
  });

  // Puzzle listeners
  document.getElementById('gridSizeSelect').addEventListener('change', (e) => {
    gridSize = parseInt(e.target.value, 10);
    initPuzzleBoard();
  });
  document.getElementById('togglePreviewBtn').addEventListener('click', togglePuzzlePreview);
  document.getElementById('shufflePuzzleBtn').addEventListener('click', () => initPuzzleBoard(true));
  document.getElementById('autoSolveBtn').addEventListener('click', autoSolvePuzzle);
}

// ==================== AUTHENTICATION HANDLERS ====================

async function quickLogin(username, password) {
  document.getElementById('usernameInput').value = username;
  document.getElementById('passwordInput').value = password;
  handleLoginSubmit(new Event('submit'));
}

async function handleLoginSubmit(e) {
  if (e) e.preventDefault();
  const username = document.getElementById('usernameInput').value.trim();
  const password = document.getElementById('passwordInput').value.trim();
  const errorDiv = document.getElementById('loginError');

  errorDiv.style.display = 'none';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      setUserSession(data.user);
    } else {
      errorDiv.textContent = data.error || 'Neuspešna prijava.';
      errorDiv.style.display = 'block';
    }
  } catch (err) {
    errorDiv.textContent = 'Greška pri povezivanju sa serverom.';
    errorDiv.style.display = 'block';
  }
}

// ==================== PROPOSAL FLOW LOGIC ====================

function handleNoHover() {
  // Move "No" button slightly on hover after 3 attempts
  if (noClickCount >= 3) {
    const noBtn = document.getElementById('noBtn');
    const randomX = (Math.random() - 0.5) * 180;
    const randomY = (Math.random() - 0.5) * 100;
    noBtn.style.transform = `translate(${randomX}px, ${randomY}px)`;
  }
}

function handleNoClick() {
  playPopSound();
  noClickCount++;

  const noBtn = document.getElementById('noBtn');
  const yesBtn = document.getElementById('yesBtn');
  const puppyImg = document.getElementById('proposalPuppyImg');
  const subtitle = document.getElementById('proposalSubtitle');

  // Update text of No button
  const messageIndex = (noClickCount - 1) % noMessages.length;
  noBtn.textContent = noMessages[messageIndex];

  // Scale Yes button bigger and bigger!
  const newScale = 1 + noClickCount * 0.2;
  yesBtn.style.transform = `scale(${newScale})`;

  // Update puppy images based on clicks
  if (noClickCount >= 1 && noClickCount <= 2) {
    puppyImg.src = '/images/sadPuppy.jpg';
    subtitle.textContent = "Pogledaj kako je tužan... Zar stvarno želiš da kažeš ne? 🥺";
  } else if (noClickCount >= 3) {
    puppyImg.src = '/images/rlySadPuppy.jpg';
    subtitle.textContent = "Srce mu se slama... Pritisni DA! 💔😭";
  }
}

function handleYesClick() {
  playFanfare();
  triggerConfetti();

  const puppyImg = document.getElementById('proposalPuppyImg');
  puppyImg.src = '/images/clickedYesPuppy.jpg';

  document.getElementById('proposalTitle').textContent = "Jaaaj! Rekla si DA! 💖🎉";
  document.getElementById('proposalSubtitle').textContent = "Hvala ti ljubavi! Sada izaberi kada idemo i šta radimo ✨";

  document.getElementById('proposalBtnContainer').style.display = 'none';

  setTimeout(() => {
    showProposalStep(2);
  }, 1200);
}

function showProposalStep(stepNumber) {
  document.getElementById('proposalStep1').style.display = 'none';
  document.getElementById('proposalStep2').style.display = 'none';
  document.getElementById('proposalStep3').style.display = 'none';
  document.getElementById('proposalStep4').style.display = 'none';

  document.getElementById(`proposalStep${stepNumber}`).style.display = 'block';
}

function handleFinishProposal() {
  playFanfare();
  triggerConfetti();

  document.getElementById('ticketDays').textContent = selectedDays.join(', ');
  document.getElementById('ticketActivities').textContent = selectedActivities.join(', ');
  
  if (customNoteText.trim()) {
    document.getElementById('ticketNoteRow').style.display = 'flex';
    document.getElementById('ticketNote').textContent = customNoteText;
  } else {
    document.getElementById('ticketNoteRow').style.display = 'none';
  }

  showProposalStep(4);
  savePlanToDb();
}

function resetProposalFlow() {
  noClickCount = 0;
  selectedDays = [];
  selectedActivities = [];
  customNoteText = '';

  document.querySelectorAll('.day-chip').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('.activity-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('customNoteInput').value = '';

  const yesBtn = document.getElementById('yesBtn');
  yesBtn.style.transform = 'scale(1)';
  
  const noBtn = document.getElementById('noBtn');
  noBtn.style.transform = 'none';
  noBtn.textContent = 'Ne 🥺';

  document.getElementById('proposalPuppyImg').src = '/images/firstPuppy.jpg';
  document.getElementById('proposalTitle').textContent = 'Da li želiš da izađeš sa mnom? 💕';
  document.getElementById('proposalSubtitle').textContent = 'Obećavam najbolji provod i najslađi osmeh! ✨';
  document.getElementById('proposalBtnContainer').style.display = 'flex';

  showProposalStep(1);
}

function copyWhatsAppMessage() {
  const daysStr = selectedDays.join(', ');
  const activitiesStr = selectedActivities.join(', ');
  let msg = `Hej ljubavi! Rekla sam DA! 💕\n\n🗓️ Izabrala sam dane: ${daysStr}\n✨ Aktivnosti: ${activitiesStr}`;
  if (customNoteText.trim()) {
    msg += `\n💌 Želja: ${customNoteText.trim()}`;
  }
  msg += `\n\nJedva čekam naš sastanak! 🥰`;

  navigator.clipboard.writeText(msg).then(() => {
    const alertDiv = document.getElementById('savePlanAlert');
    alertDiv.textContent = 'Poruka je kopirana! Sada je možeš poslati na WhatsApp 📲💖';
    alertDiv.style.display = 'block';
    setTimeout(() => { alertDiv.style.display = 'none'; }, 4000);
  });
}

async function savePlanToDb() {
  try {
    const res = await fetch('/api/date-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selected_days: selectedDays,
        selected_activities: selectedActivities,
        custom_note: customNoteText
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      const alertDiv = document.getElementById('savePlanAlert');
      alertDiv.textContent = 'Plan je sačuvan u našoj bazi podataka! 💖';
      alertDiv.style.display = 'block';
      setTimeout(() => { alertDiv.style.display = 'none'; }, 4000);
    }
  } catch (err) {
    console.error('Error saving plan:', err);
  }
}

// ==================== DAILY PUZZLE GAME ENGINE ====================

async function loadTodayPuzzle() {
  try {
    const res = await fetch('/api/puzzle/today');
    puzzleData = await res.json();

    document.getElementById('puzzleDateText').textContent = `Dnevna uspomena za date: ${puzzleData.date} ✨`;
    document.getElementById('previewImage').src = puzzleData.image_url;

    if (puzzleData.progress) {
      gridSize = puzzleData.progress.grid_size || 3;
      document.getElementById('gridSizeSelect').value = gridSize;
      tiles = puzzleData.progress.tiles;
      emptyIndex = tiles.indexOf(gridSize * gridSize - 1);
      moveCount = puzzleData.progress.moves || 0;
      timeSeconds = puzzleData.progress.time_seconds || 0;
      isPuzzleCompleted = puzzleData.progress.is_completed;
    } else {
      initPuzzleBoard();
    }

    renderPuzzle();
    updatePuzzleStats();
  } catch (err) {
    console.error('Error loading today puzzle:', err);
  }
}

function initPuzzleBoard(forceShuffle = true) {
  const totalTiles = gridSize * gridSize;
  tiles = Array.from({ length: totalTiles }, (_, i) => i);
  emptyIndex = totalTiles - 1;
  moveCount = 0;
  timerSeconds = 0;
  isPuzzleCompleted = false;

  document.getElementById('puzzleVictoryBanner').style.display = 'none';

  if (forceShuffle) {
    shuffleTiles();
  }

  startTimer();
  renderPuzzle();
  updatePuzzleStats();
}

function shuffleTiles() {
  const totalTiles = gridSize * gridSize;
  // Perform valid random moves from empty slot to ensure solvability
  for (let i = 0; i < 150; i++) {
    const neighbors = getValidNeighbors(emptyIndex);
    const randomNeighbor = neighbors[Math.floor(Math.random() * neighbors.length)];
    // Swap empty with random neighbor
    const temp = tiles[emptyIndex];
    tiles[emptyIndex] = tiles[randomNeighbor];
    tiles[randomNeighbor] = temp;
    emptyIndex = randomNeighbor;
  }
}

function getValidNeighbors(index) {
  const neighbors = [];
  const row = Math.floor(index / gridSize);
  const col = index % gridSize;

  if (row > 0) neighbors.push((row - 1) * gridSize + col); // Up
  if (row < gridSize - 1) neighbors.push((row + 1) * gridSize + col); // Down
  if (col > 0) neighbors.push(row * gridSize + (col - 1)); // Left
  if (col < gridSize - 1) neighbors.push(row * gridSize + (col + 1)); // Right

  return neighbors;
}

function renderPuzzle() {
  const board = document.getElementById('puzzleBoard');
  board.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
  board.style.gridTemplateRows = `repeat(${gridSize}, 1fr)`;
  board.innerHTML = '';

  const totalTiles = gridSize * gridSize;
  const boardWidth = board.clientWidth || 360;

  tiles.forEach((tileValue, currentSlot) => {
    const tileDiv = document.createElement('div');
    tileDiv.className = 'puzzle-tile';

    if (tileValue === totalTiles - 1 && !isPuzzleCompleted) {
      tileDiv.classList.add('empty-tile');
    } else {
      tileDiv.style.backgroundImage = `url('${puzzleData.image_url}')`;
      
      // Calculate background position based on original tile index
      const origRow = Math.floor(tileValue / gridSize);
      const origCol = tileValue % gridSize;
      const percentStep = 100 / (gridSize - 1);
      
      tileDiv.style.backgroundPosition = `${origCol * percentStep}% ${origRow * percentStep}%`;

      // Optional tile number badge for clarity
      const numSpan = document.createElement('span');
      numSpan.className = 'tile-num';
      numSpan.textContent = tileValue + 1;
      tileDiv.appendChild(numSpan);
    }

    tileDiv.addEventListener('click', () => handleTileClick(currentSlot));
    board.appendChild(tileDiv);
  });
}

function handleTileClick(clickedSlot) {
  if (isPuzzleCompleted) return;

  const validNeighbors = getValidNeighbors(emptyIndex);
  if (validNeighbors.includes(clickedSlot)) {
    playPopSound();

    // Swap clicked slot with empty slot
    const temp = tiles[emptyIndex];
    tiles[emptyIndex] = tiles[clickedSlot];
    tiles[clickedSlot] = temp;
    emptyIndex = clickedSlot;

    moveCount++;
    renderPuzzle();
    updatePuzzleStats();
    checkPuzzleCompletion();
    savePuzzleProgress();
  }
}

function checkPuzzleCompletion() {
  const totalTiles = gridSize * gridSize;
  const isSolved = tiles.every((val, idx) => val === idx);

  if (isSolved && !isPuzzleCompleted) {
    isPuzzleCompleted = true;
    clearInterval(timerInterval);
    playFanfare();
    triggerConfetti();

    renderPuzzle(); // Re-render to show final tile

    const victoryBanner = document.getElementById('puzzleVictoryBanner');
    document.getElementById('victoryStatsText').textContent = `Vreme: ${formatTime(timerSeconds)} | Potezi: ${moveCount}`;
    victoryBanner.style.display = 'block';

    savePuzzleProgress();
  }
}

function autoSolvePuzzle() {
  const totalTiles = gridSize * gridSize;
  tiles = Array.from({ length: totalTiles }, (_, i) => i);
  emptyIndex = totalTiles - 1;
  checkPuzzleCompletion();
}

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!isPuzzleCompleted) {
      timerSeconds++;
      updatePuzzleStats();
    }
  }, 1000);
}

function updatePuzzleStats() {
  document.getElementById('puzzleMoves').textContent = moveCount;
  document.getElementById('puzzleTimer').textContent = formatTime(timerSeconds);
}

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function togglePuzzlePreview() {
  const overlay = document.getElementById('previewOverlay');
  overlay.style.display = overlay.style.display === 'none' ? 'flex' : 'none';
}

async function savePuzzleProgress() {
  if (!puzzleData) return;
  try {
    await fetch('/api/puzzle/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        puzzle_date: puzzleData.date,
        image_filename: puzzleData.image_filename,
        grid_size: gridSize,
        tiles: tiles,
        is_completed: isPuzzleCompleted,
        moves: moveCount,
        time_seconds: timerSeconds
      })
    });
  } catch (err) {
    console.error('Error saving puzzle progress:', err);
  }
}

// ==================== GALLERY & DASHBOARD LOADERS ====================

async function loadGallery() {
  try {
    const res = await fetch('/api/puzzle/gallery');
    const data = await res.json();
    const grid = document.getElementById('galleryGrid');
    grid.innerHTML = '';

    const completedMap = new Map();
    (data.completedDates || []).forEach(c => completedMap.set(c.image_filename, c));

    data.allImages.forEach((item, index) => {
      const isSolved = completedMap.has(item.filename);
      const card = document.createElement('div');
      card.className = 'gallery-item';

      card.innerHTML = `
        <div class="gallery-img-wrapper">
          <img src="${item.image_url}" alt="Uspomena ${index + 1}" class="gallery-img" style="${isSolved ? '' : 'filter: blur(8px); opacity: 0.6;'}">
          ${isSolved ? '<span class="solved-badge">Otključano ✨</span>' : ''}
        </div>
        <div class="gallery-caption">
          ${isSolved ? `Uspomena #${index + 1} 💖` : `Zaključano 🔒 (Otključaj u slagalici)`}
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    console.error('Error loading gallery:', err);
  }
}

async function loadPlans() {
  try {
    const res = await fetch('/api/date-plans');
    const data = await res.json();
    const list = document.getElementById('plansList');
    list.innerHTML = '';

    if (!data.plans || data.plans.length === 0) {
      list.innerHTML = '<p class="subtitle">Još uvek nema sačuvanih planova za sastanke.</p>';
      return;
    }

    data.plans.forEach(p => {
      const card = document.createElement('div');
      card.className = 'plan-card';
      
      const createdDate = new Date(p.created_at).toLocaleString('sr-RS');

      card.innerHTML = `
        <div class="plan-header-info">
          <span>💌 Plan od korisnika: ${p.username}</span>
          <span style="font-size: 0.85rem; color: #64748b;">${createdDate}</span>
        </div>
        <div class="plan-days-badge">🗓️ Izabrani dani: ${p.selected_days.join(', ')}</div>
        <div class="plan-activities-list">
          ${p.selected_activities.map(act => `<span class="activity-tag">✨ ${act}</span>`).join('')}
        </div>
        ${p.custom_note ? `<p style="font-size: 0.9rem; color: #475569; margin-top: 8px;"><strong>Posebna želja:</strong> "${p.custom_note}"</p>` : ''}
      `;
      list.appendChild(card);
    });
  } catch (err) {
    console.error('Error loading plans:', err);
  }
}
