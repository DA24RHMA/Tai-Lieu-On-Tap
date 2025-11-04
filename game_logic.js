// game_logic.js - Phiên bản mới (toàn bộ, thay thế file logic cũ)
// Mục tiêu: giữ nguyên chức năng, vá lỗi modal -> trắng màn hình,
// lưu resume, quản lý sửa/ẩn câu, nhạc nền, các màn hình menu/preview/quiz/manage.

// =======================================================
// ================  HEADER / KHỞI TẠO ==================
// =======================================================
console.log("✅ game_logic.js: bắt đầu khởi tạo...");

// --- Thông tin môn học (lấy từ meta trong HTML) ---
const subjectMeta = document.querySelector('meta[name="subject-info"]');
if (!subjectMeta) {
  console.error("Không tìm thấy meta[name='subject-info'] — dừng script.");
  // nếu không có thì dừng, tránh lỗi tiếp theo
} 

const SUBJECT_ID = subjectMeta ? subjectMeta.getAttribute('data-id') : 'unknown';
const SUBJECT_NAME = subjectMeta ? subjectMeta.getAttribute('data-name') : 'Môn học';
const CUSTOM_DATA_KEY = `${SUBJECT_ID}_custom_data`;
const RESUME_DATA_KEY_PREFIX = `${SUBJECT_ID}_resume_`;

// =======================================================
// ================ TRẠNG THÁI CHUNG ====================
// =======================================================
let originalDecksData = {};       // { deckId: [questions...] }
let customData = { edited: {}, ignored: [] }; // lưu chỉnh sửa + ẩn
let mergedDecks = {};             // deckId -> merged questions (original + edits)
let mergedAllQuestions = [];      // tất cả câu đã gộp
let currentQuestions = [];        // câu đang chơi (quiz)
let currentQuestionIndex = 0;
let score = 0;
let wrongAnswers = 0;
let currentDeckId = null;
let currentAction = ''; // 'start', 'preview', 'random', 'deck_sequential', 'deck_random', ...
let currentEditQuestionId = null;
let isShuffleOptionsEnabled = false;

// lưu màn hình trước khi mở modal (lưu key trong screens, ví dụ 'quiz' / 'preview')
let lastActiveScreenKey = 'menu';

// cấu hình option keys (có thể A..E)
const optionKeys = ['A','B','C','D','E'];
const optionColumns = ['optiona','optionb','optionc','optiond','optione'];

// =======================================================
// ================ LẤY PHẦN TỬ DOM =====================
// =======================================================
const screens = {
  menu: document.getElementById('menu-container'),
  deckSelect: document.getElementById('deck-select-container'),
  randomDeckSelect: document.getElementById('random-deck-select-container'),
  modeSelect: document.getElementById('mode-select-container'),
  quiz: document.getElementById('quiz-container'),
  result: document.getElementById('result-container'),
  preview: document.getElementById('preview-container'),
  manage: document.getElementById('manage-data-container'),
  editModalBackdrop: document.getElementById('edit-modal-backdrop')
};

// Menu & deck select
const startSetMenuBtn = document.getElementById('start-set-menu-btn');
const startRandomBtn = document.getElementById('start-random-btn');
const previewMenuBtn = document.getElementById('preview-menu-btn');
const manageDataBtn = document.getElementById('manage-data-btn');
const deckListButtons = document.getElementById('deck-list-buttons');
const deckSelectTitle = document.getElementById('deck-select-title');
const randomDeckListCheckboxes = document.getElementById('random-deck-list-checkboxes');
const startRandomSelectedBtn = document.getElementById('start-random-selected-btn');

// mode select
const modeSelectTitle = document.getElementById('mode-select-title');
const startSequentialBtn = document.getElementById('start-sequential-btn');
const startDeckRandomBtn = document.getElementById('start-deck-random-btn');
const backToDeckSelectBtn = document.getElementById('back-to-deck-select');

// quiz elements
const questionCounter = document.getElementById('question-counter');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const feedbackText = document.getElementById('feedback-text');
const nextBtn = document.getElementById('next-btn');
const editQuestionBtn = document.getElementById('edit-question-btn');

// result
const scoreText = document.getElementById('score-text');

// preview
const previewDeckTitle = document.getElementById('preview-deck-title');
const previewContent = document.getElementById('preview-content');

// manage
const manageTabs = document.querySelectorAll('.manage-tabs .tab-btn');
const manageContentEdited = document.getElementById('manage-content-edited');
const manageContentIgnored = document.getElementById('manage-content-ignored');
const resetAllDataBtn = document.getElementById('reset-all-data-btn');

// modal (edit)
const editModal = document.getElementById('edit-modal');
const modalQuestionId = document.getElementById('modal-question-id');
const modalQuestionText = document.getElementById('modal-question-text');
const modalOptions = {
  A: document.getElementById('modal-option-A'),
  B: document.getElementById('modal-option-B'),
  C: document.getElementById('modal-option-C'),
  D: document.getElementById('modal-option-D'),
  E: document.getElementById('modal-option-E')
};
const modalCorrectAnswer = document.getElementById('modal-correct-answer');
const modalExplanationText = document.getElementById('modal-explanation-text');
const modalSaveBtn = document.getElementById('modal-save-btn');
const modalIgnoreBtn = document.getElementById('modal-ignore-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');

// music
const bgMusic = document.getElementById('bg-music'); // <audio id="bg-music">
const musicToggleBtn = document.getElementById('music-toggle-btn');
const musicSelect = document.getElementById('music-select');
const shuffleOptionsDeck = document.getElementById('toggle-shuffle-options-deck');
const shuffleOptionsRandom = document.getElementById('toggle-shuffle-options-random');
// === THÊM DOM MỚI ===
const themeSelect = document.getElementById('theme-select');
const THEME_KEY = `${SUBJECT_ID}_theme`; // Key để lưu theme

// =======================================================
// ================== HỖ TRỢ DỮ LIỆU =====================
// =======================================================

function parseCSV(text) {
  // loại BOM nếu có
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.substring(1);
  }
  // dùng PapaParse (giả định đã include)
  if (typeof Papa === 'undefined') {
    console.error('PapaParse không có - vui lòng include thư viện PapaParse.');
    return [];
  }
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim().toLowerCase()
  });
  if (result.errors && result.errors.length) {
    console.warn('Có lỗi khi parse CSV:', result.errors);
  }
  return result.data || [];
}

async function fetchDeckData(deckInfo) {
  // deckInfo: { id, name, file }
  const deckId = deckInfo.id;
  if (originalDecksData[deckId]) return originalDecksData[deckId];
  try {
    const res = await fetch(`data/${deckInfo.file}`);
    if (!res.ok) throw new Error(`Không thể tải file ${deckInfo.file}`);
    const arrBuf = await res.arrayBuffer();
    const text = new TextDecoder('utf-8').decode(arrBuf);
    const questions = parseCSV(text);
    questions.forEach(q => q.deck = deckId);
    originalDecksData[deckId] = questions;
    console.log(`Đã tải & parse ${questions.length} câu từ ${deckInfo.file}`);
    return questions;
  } catch (e) {
    console.error(e);
    alert(`Lỗi tải đề ${deckInfo.name}: ${e.message}`);
    return [];
  }
}

function loadCustomData() {
  const s = localStorage.getItem(CUSTOM_DATA_KEY);
  if (!s) {
    customData = { edited: {}, ignored: [] };
    return;
  }
  try {
    customData = JSON.parse(s);
    if (!customData.edited) customData.edited = {};
    if (!customData.ignored) customData.ignored = [];
  } catch (e) {
    console.error('Custom data parse error:', e);
    customData = { edited: {}, ignored: [] };
  }
}

function saveCustomData() {
  localStorage.setItem(CUSTOM_DATA_KEY, JSON.stringify(customData));
}

// build mergedDecks from originalDecksData + customData
function buildMergedData(deckIdsToBuild) {
  mergedDecks = {};
  mergedAllQuestions = [];
  const loadedDeckIds = Object.keys(originalDecksData);
  const targetDeckIds = deckIdsToBuild ? deckIdsToBuild.filter(id => loadedDeckIds.includes(id)) : loadedDeckIds;
  for (const deckId of targetDeckIds) {
    const original = originalDecksData[deckId] || [];
    const mergedQ = [];
    for (const q of original) {
      if (customData.ignored.includes(q.id)) continue;
      if (customData.edited[q.id]) {
        const edited = customData.edited[q.id];
        mergedQ.push({ ...edited, id: q.id, deck: q.deck });
      } else {
        mergedQ.push(q);
      }
    }
    mergedDecks[deckId] = mergedQ;
    mergedAllQuestions.push(...mergedQ);
  }
}

// helpers tìm câu
function findOriginalQuestionById(id) {
  for (const deckId in originalDecksData) {
    const found = originalDecksData[deckId].find(q => q.id === id);
    if (found) return found;
  }
  return null;
}
function findQuestionById(id) {
  if (customData.edited[id]) {
    const orig = findOriginalQuestionById(id);
    return { ...customData.edited[id], id, deck: orig ? orig.deck : 'N/A' };
  }
  return findOriginalQuestionById(id);
}

// resume state
function getResumeKey(action, deckIds) {
  const ids = Array.isArray(deckIds) ? deckIds : [deckIds];
  if (action === 'random') {
    const sorted = ids.slice().sort().join('+');
    return `${RESUME_DATA_KEY_PREFIX}random_${sorted}`;
  }
  // deck action
  return `${RESUME_DATA_KEY_PREFIX}${action}_${ids[0]}`;
}
function saveGameState(resumeKey) {
  try {
    const state = {
      action: currentAction,
      questions: currentQuestions,
      index: currentQuestionIndex,
      score,
      wrong: wrongAnswers,
      shuffleOptions: isShuffleOptionsEnabled
    };
    localStorage.setItem(resumeKey, JSON.stringify(state));
  } catch (e) {
    console.warn('Không lưu được resume:', e);
  }
}
function loadGameState(resumeKey) {
  const s = localStorage.getItem(resumeKey);
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { return null; }
}
function clearGameState(resumeKey) {
  localStorage.removeItem(resumeKey);
}
function resumeGame(state) {
  if (!state) return;
  currentAction = state.action;
  currentQuestions = state.questions || [];
  currentQuestionIndex = state.index || 0;
  score = state.score || 0;
  wrongAnswers = state.wrong || 0;
  isShuffleOptionsEnabled = !!state.shuffleOptions;
  showScreen('quiz');
  showQuestion();
}

// =======================================================
// ================ UI / SCREEN CONTROL ==================
// =======================================================

// Helper: map element (or element.id) --> key trong screens object
function getScreenKeyByElement(elOrId) {
  const elId = typeof elOrId === 'string' ? elOrId : (elOrId && elOrId.id);
  if (!elId) return null;
  for (const key in screens) {
    if (screens[key] && screens[key].id === elId) return key;
  }
  return null;
}

/**
 * showScreen(screenKey)
 * - Nếu screenKey === 'editModalBackdrop' => chỉ hiện modal (overlay),
 *   lưu màn hình trước đó bằng key logic.
 * - Nếu là màn hình chính => ẩn các container, hiện màn hình đó.
 */
function showScreen(screenKey) {
  if (!screens) return;

  // Modal: không ẩn screen khác, chỉ overlay modal
  if (screenKey === 'editModalBackdrop') {
    const active = document.querySelector('.container.active');
    if (active) {
      const key = getScreenKeyByElement(active);
      lastActiveScreenKey = key || lastActiveScreenKey || 'menu';
    }
    if (screens.editModalBackdrop) {
      screens.editModalBackdrop.style.display = 'flex';
      screens.editModalBackdrop.classList.add('active');
    }
    return;
  }

  // Nếu là màn hình chính hợp lệ thì lưu key
  if (screens[screenKey] && screens[screenKey].classList.contains('container')) {
    lastActiveScreenKey = screenKey;
  }

  // Ẩn tất cả container (bao gồm modal) trước
  Object.values(screens).forEach(s => {
    if (!s) return;
    s.classList.remove('active');
    if (s.id === 'edit-modal-backdrop') s.style.display = 'none';
  });

  // Hiện màn hình yêu cầu
  if (screens[screenKey]) {
    screens[screenKey].classList.add('active');
    // nếu modal thì set display: flex
    if (screenKey === 'editModalBackdrop' && screens.editModalBackdrop) {
      screens.editModalBackdrop.style.display = 'flex';
    }
  } else {
    // safety: nếu screenKey không tồn tại, fallback về menu
    if (screens.menu) screens.menu.classList.add('active');
  }
}

// =======================================================
// =================== QUIZ / PREVIEW =====================
// =======================================================

function startQuiz(questionsToPlay) {
  currentQuestions = Array.isArray(questionsToPlay) ? [...questionsToPlay] : [];
  if (currentAction === 'deck_random' || currentAction === 'random') {
    currentQuestions.sort(() => Math.random() - 0.5);
  }
  currentQuestionIndex = 0;
  score = 0;
  wrongAnswers = 0;

  if (!currentQuestions.length) {
    alert('Không có câu hỏi để bắt đầu.');
    showScreen('menu');
    return;
  }

  const deckIds = currentAction === 'random' ? Array.from(randomDeckListCheckboxes.querySelectorAll('input:checked')).map(cb => cb.value) : [currentDeckId];
  const resumeKey = getResumeKey(currentAction === 'deck_sequential' ? 'deck_sequential' : currentAction, deckIds);
  saveGameState(resumeKey);

  showScreen('quiz');
  showQuestion();
}

function showQuestion() {
  // reset UI
  if (feedbackText) feedbackText.style.display = 'none';
  if (nextBtn) nextBtn.style.display = 'none';
  if (optionsContainer) optionsContainer.innerHTML = '';

  if (currentQuestionIndex >= currentQuestions.length) {
    showResult();
    return;
  }

  const q = currentQuestions[currentQuestionIndex];
  if (!q) {
    showResult();
    return;
  }
  currentEditQuestionId = q.id;

  // show text and counter
  if (questionCounter) questionCounter.textContent = `Câu ${currentQuestionIndex + 1}/${currentQuestions.length}`;
  if (questionText) questionText.textContent = q.cau || '(Không có nội dung câu hỏi)';

  // prepare options
  const options = [];
  optionKeys.forEach((k, idx) => {
    const col = optionColumns[idx];
    const txt = q[col];
    if (txt && String(txt).trim() !== '') {
      options.push({ originalKey: k, originalText: String(txt).trim() });
    }
  });

  // shuffle option texts if needed
  if (isShuffleOptionsEnabled) {
    const texts = options.map(o => o.originalText).sort(() => Math.random() - 0.5);
    options.forEach((o, i) => o.shuffledText = texts[i]);
  }

  // render options as buttons
  options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.classList.add('btn', 'option-btn');
    const displayKey = optionKeys[idx]; // A, B, ...
    const displayText = isShuffleOptionsEnabled ? opt.shuffledText : opt.originalText;
    btn.textContent = `${displayKey}. ${displayText}`;
    // determine original key for this displayed text
    let originalKey = opt.originalKey;
    if (isShuffleOptionsEnabled) {
      const origin = options.find(o => o.originalText === displayText);
      if (origin) originalKey = origin.originalKey;
    }
    btn.dataset.answer = originalKey;
    btn.addEventListener('click', () => selectAnswer(btn, originalKey, q.dapan, q.giaithich));
    optionsContainer.appendChild(btn);
  });

  // save resume
  const deckIds = currentAction === 'random' ? Array.from(randomDeckListCheckboxes.querySelectorAll('input:checked')).map(cb => cb.value) : [currentDeckId];
  const finalDeckIds = (deckIds && deckIds.length) ? deckIds : [currentDeckId];
  const resumeKey = getResumeKey(currentAction, finalDeckIds);
  saveGameState(resumeKey);
}

function selectAnswer(button, selectedKey, correctKey, explanation) {
  // disable all
  Array.from(optionsContainer.children).forEach(b => {
    b.disabled = true;
    if (b.dataset.answer === correctKey) b.classList.add('correct');
  });

  if (selectedKey === correctKey) {
    score++;
  } else {
    wrongAnswers++;
    button.classList.add('incorrect');
  }

  // feedback
  const correctOptionText = findQuestionById(currentEditQuestionId)[`option${correctKey.toLowerCase()}`] || '';
  if (feedbackText) {
    feedbackText.innerHTML = `<b>Đáp án đúng: ${correctKey}</b>. ${correctOptionText}<br>${explanation || ''}`;
    feedbackText.style.display = 'block';
  }
  if (nextBtn) nextBtn.style.display = 'block';

  // save resume again
  const deckIds = currentAction === 'random' ? Array.from(randomDeckListCheckboxes.querySelectorAll('input:checked')).map(cb => cb.value) : [currentDeckId];
  const finalDeckIds = (deckIds && deckIds.length) ? deckIds : [currentDeckId];
  const resumeKey = getResumeKey(currentAction, finalDeckIds);
  saveGameState(resumeKey);
}

function showResult() {
  if (scoreText) scoreText.textContent = `Đúng: ${score} / Sai: ${wrongAnswers} (Tổng: ${currentQuestions.length})`;
  // clear resume
  const deckIds = currentAction === 'random' ? Array.from(randomDeckListCheckboxes.querySelectorAll('input:checked')).map(cb => cb.value) : [currentDeckId];
  const resumeKey = getResumeKey(currentAction, deckIds);
  clearGameState(resumeKey);
  showScreen('result');
}

// preview
function showPreview() {
  if (!currentDeckId) {
    alert('Không có đề được chọn.');
    showScreen('menu');
    return;
  }
  const deckInfo = registeredDecks.find(d => d.id === currentDeckId) || { name: currentDeckId };
  const questions = mergedDecks[currentDeckId] || [];
  if (previewDeckTitle) previewDeckTitle.textContent = `Xem trước: ${deckInfo.name}`;
  if (previewContent) previewContent.innerHTML = '';

  if (!questions.length) {
    previewContent.innerHTML = '<p>Đề này không có câu hỏi (hoặc đã bị ẩn).</p>';
    showScreen('preview');
    return;
  }

  questions.forEach(q => {
    const item = document.createElement('div');
    item.classList.add('preview-item');
    const optionsHTML = optionKeys.map(key => {
      const col = `option${key.toLowerCase()}`;
      const t = q[col];
      if (t && t.trim() !== '') {
        return `<div class="preview-option ${q.dapan === key ? 'correct' : ''}"><b>${key}.</b> ${t}</div>`;
      }
      return '';
    }).join('');
    item.innerHTML = `
      <div class="preview-header">
        <div class="preview-q">${q.cau}</div>
        <button class="icon-btn preview-item-edit-btn" data-id="${q.id}" title="Sửa câu này">⚙️</button>
      </div>
      <div class="preview-id">(ID: ${q.id})</div>
      <div class="preview-options">${optionsHTML}</div>
      <div class="preview-e"><b>Giải thích:</b> ${q.giaithich || 'Không có.'}</div>
    `;
    const editBtn = item.querySelector('.preview-item-edit-btn');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        openEditModal(id);
      });
    }
    previewContent.appendChild(item);
  });

  showScreen('preview');
}

// =======================================================
// =================== EDIT / MANAGE =====================
// =======================================================

/**
 * openEditModal(questionId)
 * - Lưu lại màn hình trước bằng KEY (quiz / preview / manage / ...)
 * - Nạp dữ liệu vào modal
 * - Hiện overlay modal
 */
function openEditModal(questionId) {
  // tìm màn hình active và lưu key (không lưu DOM id)
  const active = document.querySelector('.container.active');
  if (active) {
    const key = getScreenKeyByElement(active);
    if (key && key !== 'editModalBackdrop') lastActiveScreenKey = key;
  }

  currentEditQuestionId = questionId;
  const q = findQuestionById(questionId);
  if (!q) {
    alert('Lỗi: không tìm thấy câu có ID: ' + questionId);
    return;
  }

  // gán nội dung modal
  if (modalQuestionId) modalQuestionId.textContent = q.id;
  if (modalQuestionText) modalQuestionText.value = q.cau || '';
  optionKeys.forEach(k => {
    const col = `option${k.toLowerCase()}`;
    if (modalOptions[k]) modalOptions[k].value = q[col] || '';
  });
  if (modalCorrectAnswer) modalCorrectAnswer.value = q.dapan || '';
  if (modalExplanationText) modalExplanationText.value = q.giaithich || '';

  if (customData.ignored.includes(q.id)) {
    if (modalIgnoreBtn) {
      modalIgnoreBtn.textContent = 'Học lại câu này';
      modalIgnoreBtn.style.backgroundColor = '#28a745';
    }
  } else {
    if (modalIgnoreBtn) {
      modalIgnoreBtn.textContent = 'Không học câu này';
      modalIgnoreBtn.style.backgroundColor = '#ffc107';
    }
  }

  // show modal overlay
  showScreen('editModalBackdrop');
}

/**
 * closeEditModal()
 * - Ẩn modal, quay về lastActiveScreenKey (nếu hợp lệ),
 * - Nếu không hợp lệ -> fallback về 'menu'
 */
function closeEditModal() {
  currentEditQuestionId = null;

  // Nếu lastActiveScreenKey bị sai hoặc không tồn tại → quay về menu
  if (!lastActiveScreenKey || !screens[lastActiveScreenKey]) {
    lastActiveScreenKey = 'menu';
  }

  // Ẩn modal
  if (screens.editModalBackdrop) {
    screens.editModalBackdrop.style.display = 'none';
    screens.editModalBackdrop.classList.remove('active');
  }

  // Quay lại đúng màn hình trước đó
  showScreen(lastActiveScreenKey);

  // 🩹 Sửa lỗi "đứng" câu hỏi: nếu đang ở màn quiz → hiển thị lại câu hỏi hiện tại
  if (lastActiveScreenKey === 'quiz') {
    showQuestion();
  }
}


function saveEdit() {
  const id = currentEditQuestionId;
  if (!id) return alert('Không có câu để lưu.');

  const edited = {
    cau: modalQuestionText ? modalQuestionText.value : '',
    optiona: modalOptions.A ? modalOptions.A.value : '',
    optionb: modalOptions.B ? modalOptions.B.value : '',
    optionc: modalOptions.C ? modalOptions.C.value : '',
    optiond: modalOptions.D ? modalOptions.D.value : '',
    optione: modalOptions.E ? modalOptions.E.value : '',
    dapan: modalCorrectAnswer ? modalCorrectAnswer.value : '',
    giaithich: modalExplanationText ? modalExplanationText.value : ''
  };

  customData.edited[id] = edited;
  // khi lưu sửa, đảm bảo id không nằm trong ignored
  customData.ignored = customData.ignored.filter(x => x !== id);
  saveCustomData();

  // rebuild merged data
  buildMergedData(Object.keys(originalDecksData));

  alert('Đã lưu thay đổi.');
  // đóng modal và quay lại màn hình trước đó
  closeEditModal();

  // cập nhật màn hình trước đó: quiz / preview / manage
  if (lastActiveScreenKey === 'quiz') {
    // update currentQuestions nếu câu đang chơi nằm trong đó
    const idx = currentQuestions.findIndex(q => q.id === id);
    if (idx !== -1) {
      const origDeck = findOriginalQuestionById(id)?.deck || currentDeckId;
      currentQuestions[idx] = { ...edited, id, deck: origDeck };
    }
    showQuestion();
  } else if (lastActiveScreenKey === 'preview') {
    showPreview();
  } else if (lastActiveScreenKey === 'manage') {
    showManageScreen();
  }
}

function toggleIgnoreQuestion() {
  const id = currentEditQuestionId;
  if (!id) return;
  const isIgnored = customData.ignored.includes(id);
  if (isIgnored) {
    customData.ignored = customData.ignored.filter(x => x !== id);
    alert('Đã khôi phục câu này. Bạn sẽ gặp lại nó khi ôn.');
  } else {
    customData.ignored.push(id);
    alert('Đã ẩn câu này. Nó sẽ không xuất hiện khi ôn (trừ khi vào Quản lý để bật lại).');
  }
  saveCustomData();
  buildMergedData(Object.keys(originalDecksData));
  closeEditModal();

  if (lastActiveScreenKey === 'quiz') {
    currentQuestions = currentQuestions.filter(q => q.id !== id);
    showQuestion();
  } else if (lastActiveScreenKey === 'preview') {
    showPreview();
  } else if (lastActiveScreenKey === 'manage') {
    showManageScreen();
  }
}

async function showManageScreen() {
  // nạp tất cả deck data nếu chưa có
  await Promise.all(registeredDecks.map(d => fetchDeckData(d)));
  buildMergedData(Object.keys(originalDecksData));
  showScreen('manage');

  // load edited
  manageContentEdited.innerHTML = '';
  const editedIds = Object.keys(customData.edited || {});
  if (!editedIds.length) {
    manageContentEdited.innerHTML = '<p>Bạn chưa sửa câu hỏi nào.</p>';
  } else {
    editedIds.forEach(id => {
      const originalQ = findOriginalQuestionById(id) || { deck: 'N/A' };
      const editedQ = customData.edited[id];
      const item = document.createElement('div');
      item.classList.add('manage-item');
      const optionsHtml = optionKeys.map(k => {
        const col = `option${k.toLowerCase()}`;
        const t = editedQ[col];
        return t ? `<p>${k}. ${t}</p>` : '';
      }).join('');
      item.innerHTML = `
        <div class="manage-id">${id} (Từ: ${originalQ.deck})</div>
        <div class="manage-q">${editedQ.cau}</div>
        <div class="manage-data edited">
          <strong>Đáp án: ${editedQ.dapan}</strong>
          ${optionsHtml}
          <p><strong>Giải thích:</strong> ${editedQ.giaithich || ''}</p>
        </div>
        <div class="manage-actions">
          <button class="btn btn-small btn-edit" data-id="${id}" style="background-color: #007bff;">Sửa lại</button>
          <button class="btn btn-small btn-restore-edited" data-id="${id}" style="background-color: #6c757d;">Khôi phục Gốc</button>
        </div>
      `;
      manageContentEdited.appendChild(item);
    });

    // attach events
    manageContentEdited.querySelectorAll('.btn-small').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        if (e.currentTarget.classList.contains('btn-edit')) openEditModal(id);
        if (e.currentTarget.classList.contains('btn-restore-edited')) restoreQuestion(id, 'edited');
      });
    });
  }

  // load ignored
  manageContentIgnored.innerHTML = '';
  if (!customData.ignored || !customData.ignored.length) {
    manageContentIgnored.innerHTML = '<p>Bạn chưa ẩn câu hỏi nào.</p>';
  } else {
    customData.ignored.forEach(id => {
      const originalQ = findOriginalQuestionById(id);
      if (!originalQ) return;
      const item = document.createElement('div');
      item.classList.add('manage-item');
      item.innerHTML = `
        <div class="manage-id">${id} (Từ: ${originalQ.deck})</div>
        <div class="manage-q">${originalQ.cau}</div>
        <div class="manage-actions">
          <button class="btn btn-small btn-restore-ignored" data-id="${id}" style="background-color: #28a745;">Học lại (Hiện)</button>
        </div>
      `;
      manageContentIgnored.appendChild(item);
    });
    manageContentIgnored.querySelectorAll('.btn-small').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        restoreQuestion(id, 'ignored');
      });
    });
  }
}

function restoreQuestion(id, type) {
  if (type === 'edited') {
    if (!confirm(`Bạn có chắc muốn xóa thay đổi của câu ${id} và khôi phục về gốc?`)) return;
    delete customData.edited[id];
    saveCustomData();
    buildMergedData(Object.keys(originalDecksData));
    showManageScreen();
  } else if (type === 'ignored') {
    if (!confirm(`Bạn có chắc muốn HỌC LẠI câu ${id}?`)) return;
    customData.ignored = customData.ignored.filter(x => x !== id);
    saveCustomData();
    buildMergedData(Object.keys(originalDecksData));
    showManageScreen();
  }
}

function resetAllData() {
  if (!confirm(`BẠN CÓ CHẮC MUỐN RESET TOÀN BỘ MÔN ${SUBJECT_NAME}?`)) return;
  // remove resume keys + custom data key
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith(RESUME_DATA_KEY_PREFIX)) localStorage.removeItem(k);
  });
  localStorage.removeItem(CUSTOM_DATA_KEY);
  loadCustomData();
  buildMergedData(Object.keys(originalDecksData));
  alert('Đã reset dữ liệu môn học.');
  showManageScreen();
}

// =======================================================
// ================== MUSIC / UTIL ========================
// =======================================================
// === THÊM CÁC HÀM THEME ===
function applyTheme(themeName) {
  // Gán theme cho body, ví dụ: <body data-theme="dark">
  document.body.dataset.theme = themeName;
  // Lưu lựa chọn vào localStorage
  try {
    localStorage.setItem(THEME_KEY, themeName);
  } catch (e) {
    console.warn('Không lưu được theme:', e);
  }
}

function loadTheme() {
  let savedTheme = 'kst-purple'; // Mặc định
  try {
    savedTheme = localStorage.getItem(THEME_KEY) || 'kst-purple';
  } catch (e) {
    console.warn('Không tải được theme:', e);
  }
  
  if (themeSelect) {
    themeSelect.value = savedTheme;
  }
  applyTheme(savedTheme);
}
// ==========================
function updateMusicPlayer() {
  if (!musicSelect) return;
  const selected = musicSelect.value;
  if (!bgMusic) return;
  if (selected === 'none') {
    bgMusic.pause();
    bgMusic.removeAttribute('src');
    if (musicToggleBtn) {
      musicToggleBtn.textContent = 'Bật Nhạc 🎵';
      musicToggleBtn.disabled = true;
    }
    return;
  }
  musicToggleBtn.disabled = false;
  if (!bgMusic.src || !bgMusic.src.endsWith(selected)) {
    bgMusic.src = selected;
    bgMusic.load();
    const p = bgMusic.play();
    if (p !== undefined) {
      p.then(() => {
        if (musicToggleBtn) musicToggleBtn.textContent = 'Tắt Nhạc ⏸️';
      }).catch(err => {
        console.log('Tự động phát bị chặn:', err);
        if (musicToggleBtn) musicToggleBtn.textContent = 'Bật Nhạc 🎵';
      });
    }
  } else {
    if (musicToggleBtn) musicToggleBtn.textContent = bgMusic.paused ? 'Bật Nhạc 🎵' : 'Tắt Nhạc ⏸️';
  }
}
function toggleMusic() {
  if (!bgMusic) return;
  if (bgMusic.paused) {
    bgMusic.play().then(() => {
      if (musicToggleBtn) musicToggleBtn.textContent = 'Tắt Nhạc ⏸️';
    }).catch(e => {
      console.log('Không thể phát nhạc:', e);
    });
  } else {
    bgMusic.pause();
    if (musicToggleBtn) musicToggleBtn.textContent = 'Bật Nhạc 🎵';
  }
}

// =======================================================
// ================ EVENT LISTENERS BẮT ĐẦU ==============
// =======================================================

let registeredDecks = []; // sẽ lấy từ window.SUBJECT_DATA.decks (HTML/inline script cung cấp)

// attach UI listeners
function attachEventListeners() {
  // back-to-menu (những nút có class này)
  document.querySelectorAll('.back-to-menu').forEach(btn => {
    btn.addEventListener('click', () => showScreen('menu'));
  });

  if (backToDeckSelectBtn) backToDeckSelectBtn.addEventListener('click', () => showScreen('deckSelect'));
  if (startSetMenuBtn) startSetMenuBtn.addEventListener('click', () => {
    currentAction = 'start';
    deckSelectTitle.textContent = 'Chọn đề để ôn tập';
    showScreen('deckSelect');
  });
  if (previewMenuBtn) previewMenuBtn.addEventListener('click', () => {
    currentAction = 'preview';
    deckSelectTitle.textContent = 'Chọn đề để xem trước';
    showScreen('deckSelect');
  });
  if (startRandomBtn) startRandomBtn.addEventListener('click', () => {
    currentAction = 'random';
    showScreen('randomDeckSelect');
  });
  if (manageDataBtn) manageDataBtn.addEventListener('click', () => {
    showManageScreen();
  });

  if (startRandomSelectedBtn) startRandomSelectedBtn.addEventListener('click', async () => {
    const checked = Array.from(randomDeckListCheckboxes.querySelectorAll('input:checked'));
    if (!checked.length) { alert('Phải chọn ít nhất 1 đề.'); return; }
    isShuffleOptionsEnabled = !!shuffleOptionsRandom && shuffleOptionsRandom.checked;
    const deckIds = checked.map(cb => cb.value);
    const resumeKey = getResumeKey('random', deckIds);
    const state = loadGameState(resumeKey);
    if (state) {
      if (confirm(`Bạn đang ôn dở chế độ này. Tiếp tục? OK: tiếp tục, Cancel: làm lại từ đầu.`)) {
        await Promise.all(registeredDecks.map(d => fetchDeckData(d)));
        buildMergedData(deckIds);
        resumeGame(state);
        return;
      } else {
        clearGameState(resumeKey);
      }
    }
    // load deck data and build
    await Promise.all(deckIds.map(id => fetchDeckData(registeredDecks.find(d => d.id === id))));
    buildMergedData(deckIds);
    let questionsForRandom = [];
    deckIds.forEach(id => { if (mergedDecks[id]) questionsForRandom.push(...mergedDecks[id]); });
    currentAction = 'random';
    startQuiz(questionsForRandom);
  });

  if (startSequentialBtn) startSequentialBtn.addEventListener('click', () => {
    currentAction = 'deck_sequential';
    isShuffleOptionsEnabled = !!shuffleOptionsDeck && shuffleOptionsDeck.checked;
    startQuiz(mergedDecks[currentDeckId] || []);
  });
  if (startDeckRandomBtn) startDeckRandomBtn.addEventListener('click', () => {
    currentAction = 'deck_random';
    isShuffleOptionsEnabled = !!shuffleOptionsDeck && shuffleOptionsDeck.checked;
    startQuiz(mergedDecks[currentDeckId] || []);
  });

  if (nextBtn) nextBtn.addEventListener('click', () => {
    currentQuestionIndex++;
    showQuestion();
  });
  if (editQuestionBtn) editQuestionBtn.addEventListener('click', () => openEditModal(currentEditQuestionId));

  if (modalSaveBtn) modalSaveBtn.addEventListener('click', saveEdit);
  if (modalIgnoreBtn) modalIgnoreBtn.addEventListener('click', toggleIgnoreQuestion);
  if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeEditModal);

  if (resetAllDataBtn) resetAllDataBtn.addEventListener('click', resetAllData);
  if (manageTabs && manageTabs.length) manageTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      manageTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      const showEl = document.getElementById(`manage-content-${target}`);
      if (showEl) showEl.classList.add('active');
    });
  });

  if (musicSelect) musicSelect.addEventListener('change', updateMusicPlayer);
  if (musicToggleBtn) musicToggleBtn.addEventListener('click', toggleMusic);
  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
      applyTheme(e.target.value);
    });
  }
}

// =======================================================
// ================ MENU / DECK UI =======================
// =======================================================

function updateMenuUI() {
  if (!deckListButtons || !randomDeckListCheckboxes) {
    console.error('DOM thiếu: deckListButtons hoặc randomDeckListCheckboxes');
    return;
  }
  deckListButtons.innerHTML = '';
  randomDeckListCheckboxes.innerHTML = '';

  registeredDecks.forEach(deck => {
    // button để vào deck
    const btn = document.createElement('button');
    btn.classList.add('btn');
    btn.textContent = deck.name;
    btn.addEventListener('click', () => onDeckSelected(deck));
    deckListButtons.appendChild(btn);

    // checkbox cho random
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = deck.id;
    cb.id = `chk-${deck.id}`;
    label.htmlFor = cb.id;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(` ${deck.name}`));
    randomDeckListCheckboxes.appendChild(label);
  });
}

async function onDeckSelected(deckInfo) {
  currentDeckId = deckInfo.id;
  await fetchDeckData(deckInfo);
  buildMergedData([currentDeckId]);

  if (currentAction === 'start') {
    // resume keys
    const resumeSeq = getResumeKey('deck_sequential', [deckInfo.id]);
    const resumeRand = getResumeKey('deck_random', [deckInfo.id]);
    const stateSeq = loadGameState(resumeSeq);
    const stateRand = loadGameState(resumeRand);
    let confirmed = false;
    if (stateSeq) {
      if (confirm(`Bạn đang ôn dở đề "${deckInfo.name}" (Tuần tự). Tiếp tục?`)) {
        resumeGame(stateSeq); confirmed = true;
      } else {
        clearGameState(resumeSeq);
      }
    }
    if (!confirmed && stateRand) {
      if (confirm(`Bạn đang ôn dở đề "${deckInfo.name}" (Ngẫu nhiên). Tiếp tục?`)) {
        resumeGame(stateRand); confirmed = true;
      } else {
        clearGameState(resumeRand);
      }
    }
    if (!confirmed) {
      modeSelectTitle.textContent = `Chọn chế độ cho: ${deckInfo.name}`;
      showScreen('modeSelect');
    }
  } else if (currentAction === 'preview') {
    showPreview();
  }
}

// =======================================================
// ================= INIT / STARTUP ======================
// =======================================================

document.addEventListener('DOMContentLoaded', async () => {
  // registeredDecks + subject info nên được cung cấp trước trong HTML qua window.SUBJECT_DATA
  if (!window.SUBJECT_DATA || !window.SUBJECT_DATA.decks) {
    console.error('window.SUBJECT_DATA không tồn tại. Vui lòng include data script trước game_logic.js');
    // hiển lỗi trên body để dễ debug
    document.body.innerHTML = `<h1>Lỗi: Không tìm thấy dữ liệu môn học cho ${SUBJECT_NAME}.</h1>`;
    return;
  }
  registeredDecks = window.SUBJECT_DATA.decks;
  // set title
  document.title = `Ôn tập ${SUBJECT_NAME}`;
  const subjTitle = document.getElementById('subject-title');
  if (subjTitle) subjTitle.textContent = `ÔN TẬP ${SUBJECT_NAME.toUpperCase()}`;

  // load custom data
  loadCustomData();

  // build initial menu UI
  updateMenuUI();

  // attach events
  attachEventListeners();

  // update music
  if (musicSelect && musicSelect.value === 'none' && musicToggleBtn) musicToggleBtn.disabled = true;
  updateMusicPlayer();
  
  // === TẢI THEME ĐÃ LƯU ===
  loadTheme();

  // build merged data only when needed (lazy) but safe to initialize empty object
  // show menu
  showScreen('menu');

  console.log(`Đã khởi tạo xong game cho môn: ${SUBJECT_NAME}`);
});
