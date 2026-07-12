/* === Configuration === */
const CONFIG = {
  FOCUS: 25 * 60,
  SHORT_BREAK: 5 * 60,
  LONG_BREAK: 15 * 60,
  POMODOROS_PER_CYCLE: 4,
};

const CIRCUMFERENCE = 2 * Math.PI * 90;

/* === State === */
const state = {
  timerStatus: 'IDLE',
  mode: 'FOCUS',
  remainingSeconds: CONFIG.FOCUS,
  targetEndTime: null,
  completedPomodoros: 0,
  totalPomodoros: 0,
};

let tickInterval = null;
let audioCtx = null;

/* === Utility === */
function getDurationForMode(mode) {
  switch (mode) {
    case 'FOCUS': return CONFIG.FOCUS;
    case 'SHORT_BREAK': return CONFIG.SHORT_BREAK;
    case 'LONG_BREAK': return CONFIG.LONG_BREAK;
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getModeLabel(mode) {
  switch (mode) {
    case 'FOCUS': return '专注';
    case 'SHORT_BREAK': return '短休息';
    case 'LONG_BREAK': return '长休息';
  }
}

/* === DOM References === */
const body = document.body;
const modeIndicator = document.getElementById('modeIndicator');
const timerDisplay = document.getElementById('timerDisplay');
const progressRing = document.getElementById('progressRing');
const sessionCounter = document.getElementById('sessionCounter');
const totalCount = document.getElementById('totalCount');
const btnStartPause = document.getElementById('btnStartPause');
const btnReset = document.getElementById('btnReset');
const btnSkip = document.getElementById('btnSkip');

/* === Timer Engine === */
function start() {
  if (state.timerStatus === 'RUNNING') return;

  if (state.timerStatus === 'COMPLETED') {
    advanceToNextMode();
  }

  ensureAudioContext();
  requestNotificationPermission();

  state.targetEndTime = Date.now() + state.remainingSeconds * 1000;
  state.timerStatus = 'RUNNING';

  clearInterval(tickInterval);
  tickInterval = setInterval(tick, 250);

  render();
}

function pause() {
  if (state.timerStatus !== 'RUNNING') return;

  state.remainingSeconds = Math.max(0, Math.ceil((state.targetEndTime - Date.now()) / 1000));
  state.targetEndTime = null;
  state.timerStatus = 'PAUSED';

  clearInterval(tickInterval);
  tickInterval = null;

  render();
}

function reset() {
  clearInterval(tickInterval);
  tickInterval = null;

  state.timerStatus = 'IDLE';
  state.remainingSeconds = getDurationForMode(state.mode);
  state.targetEndTime = null;

  render();
}

function tick() {
  const remaining = Math.max(0, Math.ceil((state.targetEndTime - Date.now()) / 1000));
  state.remainingSeconds = remaining;

  renderIncremental();

  if (remaining <= 0) {
    clearInterval(tickInterval);
    tickInterval = null;
    completeSession();
  }
}

function completeSession() {
  if (state.mode === 'FOCUS') {
    state.completedPomodoros++;
    state.totalPomodoros++;
  }

  state.timerStatus = 'COMPLETED';

  playChime();
  showNotification();

  // Auto-advance after a short delay
  setTimeout(() => {
    if (state.timerStatus === 'COMPLETED') {
      advanceToNextMode();
      render();
    }
  }, 2000);
}

function advanceToNextMode() {
  if (state.mode === 'FOCUS') {
    if (state.completedPomodoros >= CONFIG.POMODOROS_PER_CYCLE) {
      state.mode = 'LONG_BREAK';
      state.completedPomodoros = 0;
      state.remainingSeconds = CONFIG.LONG_BREAK;
    } else {
      state.mode = 'SHORT_BREAK';
      state.remainingSeconds = CONFIG.SHORT_BREAK;
    }
  } else {
    state.mode = 'FOCUS';
    state.remainingSeconds = CONFIG.FOCUS;
  }

  state.timerStatus = 'IDLE';
  state.targetEndTime = null;
}

function toggleStartPause() {
  if (state.timerStatus === 'RUNNING') {
    pause();
  } else {
    start();
  }
}

function skip() {
  clearInterval(tickInterval);
  tickInterval = null;

  advanceToNextMode();
  render();
}

/* === UI Rendering === */
function render() {
  body.setAttribute('data-mode', state.mode === 'SHORT_BREAK' ? 'short-break' : state.mode === 'LONG_BREAK' ? 'long-break' : 'focus');
  modeIndicator.textContent = getModeLabel(state.mode);

  const duration = getDurationForMode(state.mode);
  const progress = state.remainingSeconds / duration;
  const offset = CIRCUMFERENCE * (1 - progress);
  progressRing.style.strokeDashoffset = offset;

  timerDisplay.textContent = formatTime(state.remainingSeconds);

  renderSessionCounter();
  renderButtons();
  renderPageTitle();

  totalCount.textContent = state.totalPomodoros;
}

function renderIncremental() {
  const duration = getDurationForMode(state.mode);
  const progress = state.remainingSeconds / duration;
  const offset = CIRCUMFERENCE * (1 - progress);
  progressRing.style.strokeDashoffset = offset;

  timerDisplay.textContent = formatTime(state.remainingSeconds);
  renderPageTitle();
}

function renderSessionCounter() {
  let html = '';
  for (let i = 0; i < CONFIG.POMODOROS_PER_CYCLE; i++) {
    const cls = i < state.completedPomodoros ? 'dot' : 'dot empty';
    html += `<span class="${cls}"></span>`;
  }
  sessionCounter.innerHTML = html;
}

function renderButtons() {
  switch (state.timerStatus) {
    case 'IDLE':
      btnStartPause.textContent = '开始';
      btnStartPause.disabled = false;
      btnReset.disabled = true;
      break;
    case 'RUNNING':
      btnStartPause.textContent = '暂停';
      btnStartPause.disabled = false;
      btnReset.disabled = false;
      break;
    case 'PAUSED':
      btnStartPause.textContent = '继续';
      btnStartPause.disabled = false;
      btnReset.disabled = false;
      break;
    case 'COMPLETED':
      btnStartPause.textContent = '开始下一轮';
      btnStartPause.disabled = false;
      btnReset.disabled = false;
      break;
  }
}

function renderPageTitle() {
  const label = state.mode === 'FOCUS' ? '专注' : '休息';
  document.title = `${formatTime(state.remainingSeconds)} - ${label}`;
}

/* === Audio === */
function ensureAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playChime() {
  if (!audioCtx) return;

  const notes = [880, 1100, 1320];
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.frequency.value = freq;
    osc.type = 'sine';
    const startTime = audioCtx.currentTime + i * 0.25;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);

    osc.start(startTime);
    osc.stop(startTime + 0.6);
  });
}

/* === Notifications === */
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function showNotification() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const title = state.mode === 'FOCUS' ? '番茄时间到!' : '休息时间结束!';
  const body = state.mode === 'FOCUS' ? '该休息一下了 ☕' : '继续专注工作吧 💪';

  new Notification(title, { body });
}

/* === Keyboard Shortcuts === */
function handleKeydown(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  switch (e.key) {
    case ' ':
      e.preventDefault();
      toggleStartPause();
      break;
    case 'r':
    case 'R':
      if (state.timerStatus !== 'IDLE') reset();
      break;
    case 's':
    case 'S':
      if (state.timerStatus === 'RUNNING' || state.timerStatus === 'PAUSED') skip();
      break;
  }
}

/* === Init === */
function init() {
  btnStartPause.addEventListener('click', toggleStartPause);
  btnReset.addEventListener('click', reset);
  btnSkip.addEventListener('click', skip);
  document.addEventListener('keydown', handleKeydown);

  // Click anywhere on body to init audio context on first interaction
  const initAudio = () => {
    ensureAudioContext();
    document.body.removeEventListener('click', initAudio);
  };
  document.body.addEventListener('click', initAudio);

  render();
}

document.addEventListener('DOMContentLoaded', init);