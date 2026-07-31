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
  const notes = [523.25, 659.25, 783.99, 1046.50];
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
      x: canvas.width / 2, y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 14, vy: (Math.random() - 0.7) * 16,
      size: Math.random() * 10 + 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360, rSpeed: (Math.random() - 0.5) * 10,
      opacity: 1
    });
  }

  function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.35;
      p.opacity -= 0.012; p.rotation += p.rSpeed;
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
    if (alive) requestAnimationFrame(update);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  update();
}

// ==================== APP INITIALIZATION & AUTH ====================

document.addEventListener('DOMContentLoaded', () => {
  initFloatingHearts();
  clearSessionAndShowLogin();
  setupEventListeners();
});

async function clearSessionAndShowLogin() {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } catch (err) {}
  try {
    localStorage.removeItem('cutie_user');
  } catch (e) {}
  showLoginScreen();
}

function setUserSession(user) {
  currentUser = user;
  document.getElementById('displayName').textContent = user.display_name;
  document.getElementById('loginSection').style.display = 'none';
  document.getElementById('appHeader').style.display = 'flex';
  switchTab(currentTab);
}

function showLoginScreen() {
  currentUser = null;
  document.getElementById('appHeader').style.display = 'none';
  document.getElementById('loginSection').style.display = 'block';
  hideAllSections();
}

function hideAllSections() {
  document.querySelectorAll('.app-section').forEach(s => s.style.display = 'none');
}

function switchTab(tabName) {
  currentTab = tabName;
  hideAllSections();
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  const mainContent = document.querySelector('.main-content');
  if (mainContent) mainContent.classList.toggle('wide', tabName === 'puzzle');

  if (tabName === 'proposal') {
    document.getElementById('proposalSection').style.display = 'block';
  } else if (tabName === 'puzzle') {
    document.getElementById('puzzleSection').style.display = 'block';
    // Don't auto-load puzzle — user picks from gallery
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
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await fetch('/api/logout', { method: 'POST' });
      showLoginScreen();
    });
  }

  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);

  const vanjaBtn = document.getElementById('loginAsVanja');
  if (vanjaBtn) vanjaBtn.addEventListener('click', () => quickLogin('vanja<3', 'lolxdlol123'));

  const andrijaBtn = document.getElementById('loginAsAndrija');
  if (andrijaBtn) andrijaBtn.addEventListener('click', () => quickLogin('andrija<3', 'andrija123'));

  const noBtn = document.getElementById('noBtn');
  if (noBtn) {
    noBtn.addEventListener('click', handleNoClick);
    noBtn.addEventListener('mouseover', handleNoHover);
  }
  const yesBtn = document.getElementById('yesBtn');
  if (yesBtn) yesBtn.addEventListener('click', handleYesClick);

  const goToStep3 = document.getElementById('goToStep3');
  if (goToStep3) goToStep3.addEventListener('click', () => showProposalStep(3));

  const backToStep2 = document.getElementById('backToStep2');
  if (backToStep2) backToStep2.addEventListener('click', () => showProposalStep(2));

  const finishProposal = document.getElementById('finishProposal');
  if (finishProposal) finishProposal.addEventListener('click', handleFinishProposal);

  const resetProposalBtn = document.getElementById('resetProposalBtn');
  if (resetProposalBtn) resetProposalBtn.addEventListener('click', resetProposalFlow);

  const copyWhatsAppBtn = document.getElementById('copyWhatsAppBtn');
  if (copyWhatsAppBtn) copyWhatsAppBtn.addEventListener('click', copyWhatsAppMessage);

  const savePlanToDbBtn = document.getElementById('savePlanToDbBtn');
  if (savePlanToDbBtn) savePlanToDbBtn.addEventListener('click', savePlanToDb);

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
      const step3Btn = document.getElementById('goToStep3');
      if (step3Btn) step3Btn.disabled = selectedDays.length === 0;
    });
  });

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
      const finishBtn = document.getElementById('finishProposal');
      if (finishBtn) finishBtn.disabled = selectedActivities.length === 0;
    });
  });

  const customNoteInput = document.getElementById('customNoteInput');
  if (customNoteInput) {
    customNoteInput.addEventListener('input', (e) => { customNoteText = e.target.value; });
  }

  const togglePreviewBtn = document.getElementById('togglePreviewBtn');
  if (togglePreviewBtn) togglePreviewBtn.addEventListener('click', togglePuzzlePreview);
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
  noBtn.textContent = noMessages[(noClickCount - 1) % noMessages.length];
  const newScale = 1 + noClickCount * 0.2;
  yesBtn.style.transform = `scale(${newScale})`;
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
  document.getElementById('proposalPuppyImg').src = '/images/clickedYesPuppy.jpg';
  document.getElementById('proposalTitle').textContent = "Jaaaj! Rekla si DA! 💖🎉";
  document.getElementById('proposalSubtitle').textContent = "Hvala ti ljubavi! Sada izaberi kada idemo i šta radimo ✨";
  document.getElementById('proposalBtnContainer').style.display = 'none';
  setTimeout(() => showProposalStep(2), 1200);
}

function showProposalStep(stepNumber) {
  ['proposalStep1','proposalStep2','proposalStep3','proposalStep4'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
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

let isPlanSaved = false;

function resetProposalFlow() {
  noClickCount = 0;
  selectedDays = [];
  selectedActivities = [];
  customNoteText = '';
  isPlanSaved = false;
  document.querySelectorAll('.day-chip').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('.activity-card').forEach(c => c.classList.remove('selected'));
  const noteInput = document.getElementById('customNoteInput');
  if (noteInput) noteInput.value = '';
  const saveBtn = document.getElementById('savePlanToDbBtn');
  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.style.background = '';
    saveBtn.textContent = '💖 Sačuvaj u našu bazu';
  }
  document.getElementById('yesBtn').style.transform = 'scale(1)';
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
  let msg = `Hej bubabiii!\n\n🗓️ Izabrala sam: ${selectedDays.join(', ')}, tada sam slobodna!\n✨ Aktivnosti: ${selectedActivities.join(', ')}`;
  if (customNoteText.trim()) msg += `\n💌 Želja: ${customNoteText.trim()}`;
  msg += `\n\nJedva čekam da se guzvamo u zagrljaju! 🥰`;
  navigator.clipboard.writeText(msg).then(() => {
    const alertDiv = document.getElementById('savePlanAlert');
    alertDiv.textContent = 'Poruka je kopirana! Sada mi je posalji... sad... odma';
    alertDiv.style.display = 'block';
    setTimeout(() => { alertDiv.style.display = 'none'; }, 4000);
  });
}

async function savePlanToDb() {
  const saveBtn = document.getElementById('savePlanToDbBtn');
  if (isPlanSaved) {
    switchTab('plans');
    return;
  }
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Čuvam... ⏳';
  }
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
    const alertDiv = document.getElementById('savePlanAlert');
    if (res.ok && data.success) {
      isPlanSaved = true;
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '💌 Pogledaj u Planovi';
        saveBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      }
      if (alertDiv) {
        alertDiv.textContent = 'Plan je sačuvan! Klikni na dugme iznad da otvoriš Planove 💌';
        alertDiv.style.display = 'block';
        alertDiv.style.color = '#059669';
        setTimeout(() => { alertDiv.style.display = 'none'; }, 4000);
      }
    } else {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '💖 Sačuvaj u našu bazu';
      }
      if (alertDiv) {
        alertDiv.textContent = data.error || 'Greška pri čuvanju u bazi.';
        alertDiv.style.display = 'block';
        alertDiv.style.color = '#ef4444';
      }
    }
  } catch (err) {
    console.error('Error saving plan:', err);
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '💖 Sačuvaj u našu bazu';
    }
  }
}

// ==================== GALLERY ====================

async function loadGallery() {
  try {
    const res = await fetch('/api/puzzle/gallery');
    const data = await res.json();
    const grid = document.getElementById('galleryGrid');
    grid.innerHTML = '';

    const completedSet = new Set();
    (data.completed || []).forEach(c => completedSet.add(c.image_filename));

    data.allImages.forEach((item, index) => {
      const isSolved = completedSet.has(item.filename);
      const card = document.createElement('div');
      card.className = 'gallery-item' + (isSolved ? ' solved' : ' locked');
      card.innerHTML = `
        <div class="gallery-img-wrapper">
          <img src="${item.image_url}" alt="Uspomena ${index + 1}" class="gallery-img ${isSolved ? 'unlocked-img' : 'locked-img'}">
          ${isSolved ? `
            <span class="solved-badge">✨ Otključano</span>
          ` : `
            <div class="lock-overlay">
              <span class="lock-icon">🔒</span>
              <span class="play-badge">🧩 Složi slagalicu</span>
            </div>
          `}
        </div>
        <div class="gallery-caption">
          Uspomena #${index + 1} ${isSolved ? '💖' : '🔒'}
        </div>
      `;
      // Click to start puzzle with this image
      card.addEventListener('click', () => {
        const previewBtn = document.getElementById('togglePreviewBtn');
        if (previewBtn) previewBtn.style.display = 'inline-block';
        const previewImg = document.getElementById('previewImage');
        if (previewImg) previewImg.src = item.image_url;
        const subtitle = document.getElementById('puzzleSubtitle');
        if (subtitle) subtitle.textContent = `Uspomena #${index + 1} — složi slagalicu! 🧩`;
        const workspace = document.getElementById('puzzleWorkspace');
        if (workspace) workspace.style.display = 'flex';
        startPuzzle(item.image_url, item.filename);
      });
      grid.appendChild(card);
    });
  } catch (err) {
    console.error('Error loading gallery:', err);
  }
}

// ==================== PLANS DASHBOARD ====================

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
