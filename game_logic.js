// --- BỘ NÃO CHUNG CỦA GAME (GAME_LOGIC.JS) ---

// Bọc toàn bộ code trong DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. BIẾN TRẠNG THÁI TOÀN CỤC ---
    
    const subjectMeta = document.querySelector('meta[name="subject-info"]');
    if (!subjectMeta) {
        document.body.innerHTML = '<h1>Lỗi: Không tìm thấy thẻ Meta thông tin môn học.</h1>';
        return; 
    }

    const SUBJECT_ID = subjectMeta.getAttribute('data-id'); 
    const SUBJECT_NAME = subjectMeta.getAttribute('data-name'); 
    const CUSTOM_DATA_KEY = `${SUBJECT_ID}_custom_data`; 

    if (!window.SUBJECT_DATA || !window.SUBJECT_DATA.decks) {
         document.body.innerHTML = `<h1>Lỗi: Không tải được dữ liệu môn học. File "data/${SUBJECT_ID}_data.js" có thể bị lỗi hoặc sai đường dẫn.</h1>`;
         return;
    }
    const registeredDecks = window.SUBJECT_DATA.decks; 
    const subjectInfo = window.SUBJECT_DATA.info;

    let originalDecksData = {}; 
    let customData = { edited: {}, ignored: [] };
    let mergedDecks = {}; 
    let mergedAllQuestions = []; 
    let currentQuestions = []; 
    let currentQuestionIndex = 0;
    let score = 0;
    let wrongAnswers = 0;
    let currentDeckId = null; 
    let currentAction = ''; 
    let currentEditQuestionId = null; 

    const optionKeys = ['A', 'B', 'C', 'D', 'E'];
    const optionColumns = ['optiona', 'optionb', 'optionc', 'optiond', 'optione']; 


    // --- 2. LẤY CÁC THÀNH PHẦN HTML (DOM) ---
    
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
    
    const startSetMenuBtn = document.getElementById('start-set-menu-btn');
    const startRandomBtn = document.getElementById('start-random-btn');
    const previewMenuBtn = document.getElementById('preview-menu-btn');
    const manageDataBtn = document.getElementById('manage-data-btn');
    const deckListButtons = document.getElementById('deck-list-buttons');
    const deckSelectTitle = document.getElementById('deck-select-title');
    const randomDeckListCheckboxes = document.getElementById('random-deck-list-checkboxes');
    const startRandomSelectedBtn = document.getElementById('start-random-selected-btn');
    const modeSelectTitle = document.getElementById('mode-select-title');
    const startSequentialBtn = document.getElementById('start-sequential-btn');
    const startDeckRandomBtn = document.getElementById('start-deck-random-btn');
    const backToDeckSelectBtn = document.getElementById('back-to-deck-select');
    const questionCounter = document.getElementById('question-counter');
    const questionText = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    const feedbackText = document.getElementById('feedback-text');
    const nextBtn = document.getElementById('next-btn');
    const editQuestionBtn = document.getElementById('edit-question-btn');
    const scoreText = document.getElementById('score-text');
    const previewDeckTitle = document.getElementById('preview-deck-title');
    const previewContent = document.getElementById('preview-content');
    const manageTabs = document.querySelectorAll('.manage-tabs .tab-btn');
    const manageContentEdited = document.getElementById('manage-content-edited');
    const manageContentIgnored = document.getElementById('manage-content-ignored');
    const resetAllDataBtn = document.getElementById('reset-all-data-btn');
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
    const bgMusic = document.getElementById('bg-music');
    const musicToggleBtn = document.getElementById('music-toggle-btn');
    const musicSelect = document.getElementById('music-select');


    // --- 3. LÕI LOGIC: XỬ LÝ DỮ LIỆU (CSV & LOCALSTORAGE) ---

    /**
     * (*** ĐÃ SỬA LỖI DẤU PHẨY Ở ĐÂY ***)
     * Chuyển đổi văn bản CSV thành mảng các đối tượng (object)
     * Bằng thư viện PapaParse
     */
    function parseCSV(text) {
        // Sửa lỗi ký tự BOM 'ï»¿'
        if (text.charCodeAt(0) === 0xFEFF) {
            text = text.substring(1);
        }

        // Dùng PapaParse để phân tích
        const result = Papa.parse(text, {
            header: true,       // Dòng đầu tiên là tiêu đề
            skipEmptyLines: true, // Bỏ qua dòng trống
            transformHeader: header => header.trim().toLowerCase() // Chuẩn hóa tiêu đề (quan trọng)
        });

        if (result.errors.length > 0) {
            console.error("Lỗi khi phân tích CSV:", result.errors);
            // Hiển thị lỗi đầu tiên cho người dùng
            alert(`File CSV có lỗi. Vui lòng kiểm tra Console (F12) để xem chi tiết.\nLỗi đầu tiên: ${result.errors[0].message}`);
        }

        return result.data; // Trả về mảng các đối tượng đã được phân tích
    }

    /**
     * Tải dữ liệu GỐC của 1 đề từ file .csv
     * (Đã sửa lỗi font chữ)
     */
    async function fetchDeckData(deckInfo) {
        const deckId = deckInfo.id;
        if (originalDecksData[deckId]) {
            return originalDecksData[deckId];
        }

        try {
            const response = await fetch(`data/${deckInfo.file}`); 
            if (!response.ok) {
                throw new Error(`Không thể tải file ${deckInfo.file}`);
            }
            
            // 1. Đọc file dưới dạng binary (ArrayBuffer)
            const buffer = await response.arrayBuffer();
            // 2. Chỉ định rõ là phải giải mã bằng UTF-8
            const decoder = new TextDecoder('utf-8');
            const csvText = decoder.decode(buffer);
            
            // 3. Phân tích bằng PapaParse (đã sửa)
            const questions = parseCSV(csvText);
            
            questions.forEach(q => q.deck = deckId); 

            originalDecksData[deckId] = questions; // Lưu vào bộ đệm
            console.log(`Đã tải và phân tích xong ${questions.length} câu từ ${deckInfo.file}`);
            return questions;
        } catch (error) {
            console.error(error);
            alert(`Lỗi khi tải dữ liệu đề ${deckInfo.name}: ${error.message}`);
            return [];
        }
    }

    function loadCustomData() {
        const data = localStorage.getItem(CUSTOM_DATA_KEY);
        if (data) {
            customData = JSON.parse(data);
            if (!customData.edited) customData.edited = {};
            if (!customData.ignored) customData.ignored = [];
        } else {
            customData = { edited: {}, ignored: [] };
        }
    }

    function saveCustomData() {
        localStorage.setItem(CUSTOM_DATA_KEY, JSON.stringify(customData));
    }

    function buildMergedData(deckIdsToBuild) {
        mergedDecks = {};
        mergedAllQuestions = [];
        
        const loadedDeckIds = Object.keys(originalDecksData);
        
        const targetDeckIds = deckIdsToBuild ? 
            deckIdsToBuild.filter(id => loadedDeckIds.includes(id)) : 
            loadedDeckIds;

        for (const deckId of targetDeckIds) {
            const originalData = originalDecksData[deckId];
            if (!originalData) continue;

            const mergedDeckQuestions = [];

            for (const originalQ of originalData) {
                if (customData.ignored.includes(originalQ.id)) {
                    continue; 
                }
                if (customData.edited[originalQ.id]) {
                    const editedQ = customData.edited[originalQ.id];
                    mergedDeckQuestions.push({ ...editedQ, id: originalQ.id, deck: originalQ.deck });
                } else {
                    mergedDeckQuestions.push(originalQ);
                }
            }
            
            mergedDecks[deckId] = mergedDeckQuestions;
            mergedAllQuestions.push(...mergedDeckQuestions);
        }
    }

    function findOriginalQuestionById(questionId) {
        for (const deckId in originalDecksData) {
            const found = originalDecksData[deckId].find(q => q.id === questionId);
            if (found) {
                return found;
            }
        }
        return null; 
    }

    function findQuestionById(questionId) {
        if (customData.edited[questionId]) {
            const originalQ = findOriginalQuestionById(questionId);
            return { ...customData.edited[questionId], id: questionId, deck: originalQ ? originalQ.deck : 'N/A' };
        }
        return findOriginalQuestionById(questionId);
    }


    // --- 4. CÁC HÀM XỬ LÝ GIAO DIỆN (UI) ---

    function showScreen(screenId) {
        Object.values(screens).forEach(screen => {
            if (screen) screen.classList.remove('active');
        });
        
        if (screenId === 'editModalBackdrop') {
            screens.editModalBackdrop.style.display = 'flex'; 
            screens.editModalBackdrop.classList.add('active'); 
        } else if (screens[screenId]) {
            screens[screenId].classList.add('active');
            if (screens.editModalBackdrop) {
                screens.editModalBackdrop.style.display = 'none'; 
                screens.editModalBackdrop.classList.remove('active');
            }
        }
    }

    function updateMenuUI() {
        if (!deckListButtons || !randomDeckListCheckboxes) {
            console.error("Lỗi DOM: Không tìm thấy 'deckListButtons' hoặc 'randomDeckListCheckboxes'.");
            return;
        }
        deckListButtons.innerHTML = '';
        randomDeckListCheckboxes.innerHTML = '';

        registeredDecks.forEach(deckInfo => {
            const button = document.createElement('button');
            button.textContent = deckInfo.name;
            button.classList.add('btn');
            button.onclick = () => onDeckSelected(deckInfo);
            deckListButtons.appendChild(button); 

            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = deckInfo.id;
            checkbox.id = `chk-${deckInfo.id}`;
            label.htmlFor = `chk-${deckInfo.id}`;
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(` ${deckInfo.name}`));
            randomDeckListCheckboxes.appendChild(label);
        });
    }

    async function onDeckSelected(deckInfo) {
        currentDeckId = deckInfo.id;
        
        await fetchDeckData(deckInfo);
        
        buildMergedData([currentDeckId]);

        if (currentAction === 'start') {
            modeSelectTitle.textContent = `Chọn Chế độ cho: ${deckInfo.name}`;
            showScreen('modeSelect');
        } else if (currentAction === 'preview') {
            showPreview();
        }
    }

    // --- 5. CÁC HÀM LOGIC GAME (QUIZ, PREVIEW) (ĐÃ NÂNG CẤP 5-OPTION) ---

    function startQuiz(questionsToPlay) {
        currentQuestions = [...questionsToPlay];
        
        if (currentAction === 'deck_random' || currentAction === 'random') {
            currentQuestions.sort(() => Math.random() - 0.5);
        }
        
        currentQuestionIndex = 0;
        score = 0;
        wrongAnswers = 0;
        
        if (currentQuestions.length === 0) {
            alert("Không có câu hỏi nào để ôn. Có thể bạn đã 'Ẩn' tất cả câu hỏi trong(các) đề này.");
            showScreen('menu');
            return;
        }

        showScreen('quiz');
        showQuestion();
    }

    function showQuestion() {
        feedbackText.style.display = 'none';
        nextBtn.style.display = 'none';
        optionsContainer.innerHTML = '';

        if (currentQuestionIndex < currentQuestions.length) {
            const q = currentQuestions[currentQuestionIndex];
            if (!q) {
                console.error("Câu hỏi không tồn tại tại chỉ số:", currentQuestionIndex);
                showResult();
                return;
            }
            
            currentEditQuestionId = q.id; 

            questionCounter.textContent = `Câu ${currentQuestionIndex + 1}/${currentQuestions.length}`;
            questionText.textContent = q.cau;

            // Tạo các nút đáp án (A, B, C, D, E)
            optionKeys.forEach((key, index) => {
                const optionColName = optionColumns[index]; // optiona, optionb...
                const optionText = q[optionColName];

                if (optionText && optionText.trim() !== "") {
                    const button = document.createElement('button');
                    button.textContent = `${key}. ${optionText}`;
                    button.classList.add('btn');
                    button.dataset.answer = key;
                    button.addEventListener('click', () => selectAnswer(button, key, q.dapan, q.giaithich));
                    optionsContainer.appendChild(button);
                }
            });
        } else {
            showResult();
        }
    }

    function selectAnswer(selectedButton, selectedAnswer, correctAnswer, explanation) {
        Array.from(optionsContainer.children).forEach(btn => {
            btn.disabled = true;
            if (btn.dataset.answer === correctAnswer) {
                btn.classList.add('correct');
            }
        });

        if (selectedAnswer === correctAnswer) {
            score++;
        } else {
            wrongAnswers++;
            selectedButton.classList.add('incorrect');
        }

        feedbackText.innerHTML = `<b>Đáp án đúng: ${correctAnswer}</b><br>${explanation || 'Không có giải thích.'}`;
        feedbackText.style.display = 'block';
        nextBtn.style.display = 'block';
    }

    function showResult() {
        scoreText.textContent = `Đúng: ${score} / Sai: ${wrongAnswers} (Tổng: ${currentQuestions.length})`;
        showScreen('result');
    }

    function showPreview() {
        const deckInfo = registeredDecks.find(d => d.id === currentDeckId);
        const questions = mergedDecks[currentDeckId];
        
        previewDeckTitle.textContent = `Xem trước: ${deckInfo.name}`;
        previewContent.innerHTML = ''; 

        if (!questions || questions.length === 0) {
            previewContent.innerHTML = '<p>Đề này không có câu hỏi nào (hoặc tất cả đã bị ẩn).</p>';
            showScreen('preview');
            return;
        }

        questions.forEach(q => {
            const item = document.createElement('div');
            item.classList.add('preview-item');
            
            const optionsHTML = optionKeys.map((key, index) => {
                const optionColName = optionColumns[index]; // optiona...
                const optionText = q[optionColName];
                
                if (optionText && optionText.trim() !== "") {
                    return `
                        <div class="preview-option ${q.dapan === key ? 'correct' : 'incorrect'}">
                            <b>${key}.</b> ${optionText}
                        </div>
                    `;
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
            
            item.querySelector('.preview-item-edit-btn').addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                openEditModal(id);
            });

            previewContent.appendChild(item);
        });

        showScreen('preview');
    }


    // --- 6. CÁC HÀM SỬA ⚙️ & QUẢN LÝ ❌ (ĐÃ NÂNG CẤP 5-OPTION) ---

    function openEditModal(questionId) {
        currentEditQuestionId = questionId;
        const q = findQuestionById(questionId);
        
        if (!q) {
            alert('Lỗi: Không tìm thấy câu hỏi với ID: ' + questionId);
            return;
        }

        modalQuestionId.textContent = q.id;
        modalQuestionText.value = q.cau;
        
        optionKeys.forEach(key => {
            const colName = `option${key.toLowerCase()}`; 
            if (modalOptions[key]) {
                modalOptions[key].value = q[colName] || ''; 
            }
        });
        
        modalCorrectAnswer.value = q.dapan;
        modalExplanationText.value = q.giaithich;
        
        if (customData.ignored.includes(q.id)) {
            modalIgnoreBtn.textContent = 'Học lại câu này';
            modalIgnoreBtn.style.backgroundColor = '#28a745'; 
        } else {
            modalIgnoreBtn.textContent = 'Không học câu này';
            modalIgnoreBtn.style.backgroundColor = '#ffc107'; 
        }

        showScreen('editModalBackdrop');
    }

    function closeEditModal() {
        currentEditQuestionId = null;
        const activeScreen = document.querySelector('.container.active');
        if (activeScreen) {
            showScreen(activeScreen.id); 
        } else {
            showScreen('menu'); // Fallback
        }
    }

    function saveEdit() {
        const id = currentEditQuestionId;
        if (!id) return;
        
        const editedQ = {
            cau: modalQuestionText.value,
            optiona: modalOptions.A.value,
            optionb: modalOptions.B.value,
            optionc: modalOptions.C.value,
            optiond: modalOptions.D.value,
            optione: modalOptions.E.value,
            dapan: modalCorrectAnswer.value,
            giaithich: modalExplanationText.value
        };

        customData.edited[id] = editedQ;
        customData.ignored = customData.ignored.filter(ignoredId => ignoredId !== id);
        saveCustomData();
        buildMergedData(Object.keys(originalDecksData));
        
        alert('Đã lưu thay đổi!');
        closeEditModal();

        if (screens.quiz.classList.contains('active')) {
            const index = currentQuestions.findIndex(q => q.id === id);
            if (index > -1) {
                const originalDeck = findOriginalQuestionById(id)?.deck || 'N/A';
                currentQuestions[index] = { ...editedQ, id: id, deck: originalDeck };
            }
            showQuestion(); 
        } else if (screens.preview.classList.contains('active')) {
            showPreview(); 
        } else if (screens.manage.classList.contains('active')) {
            showManageScreen(); 
        }
    }

    function toggleIgnoreQuestion() {
        const id = currentEditQuestionId;
        if (!id) return;
        
        const isIgnored = customData.ignored.includes(id);

        if (isIgnored) {
            customData.ignored = customData.ignored.filter(ignoredId => ignoredId !== id);
            alert('Đã khôi phục câu hỏi này. Bạn sẽ gặp lại nó trong lần ôn tập sau.');
        } else {
            customData.ignored.push(id);
            alert('Đã ẩn câu hỏi này. Bạn sẽ không gặp nó trong các lần ôn tập (trừ khi vào "Xem các điều chỉnh").');
        }

        saveCustomData();
        buildMergedData(Object.keys(originalDecksData));
        closeEditModal();

        if (screens.quiz.classList.contains('active')) {
            currentQuestions = currentQuestions.filter(q => q.id !== id);
            showQuestion(); 
        } else if (screens.preview.classList.contains('active')) {
            showPreview(); 
        } else if (screens.manage.classList.contains('active')) {
            showManageScreen(); 
        }
    }

    async function showManageScreen() {
        await Promise.all(registeredDecks.map(deck => fetchDeckData(deck)));
        buildMergedData(Object.keys(originalDecksData));

        showScreen('manage');
        
        // Tải tab "Đã sửa"
        manageContentEdited.innerHTML = '';
        if (Object.keys(customData.edited).length === 0) {
            manageContentEdited.innerHTML = '<p>Bạn chưa sửa câu hỏi nào.</p>';
        } else {
            for (const id in customData.edited) {
                const originalQ = findOriginalQuestionById(id); 
                const editedQ = customData.edited[id];
                
                const optionsList = optionKeys.map(key => {
                    const colName = `option${key.toLowerCase()}`; 
                    const text = editedQ[colName];
                    return text ? `<p>${key}. ${text}</p>` : ''; 
                }).join('');

                const item = document.createElement('div');
                item.classList.add('manage-item');
                item.innerHTML = `
                    <div class="manage-id">${id} (Từ: ${originalQ ? originalQ.deck : 'Không rõ'})</div>
                    <div class="manage-q">${editedQ.cau}</div>
                    <div class="manage-data edited">
                        <strong>Đáp án: ${editedQ.dapan}</strong>
                        ${optionsList}
                        <p><strong>Giải thích:</strong> ${editedQ.giaithich}</p>
                    </div>
                    <div class="manage-actions">
                        <button class="btn btn-small btn-edit" data-id="${id}" style="background-color: #007bff;">Sửa lại</button>
                        <button class="btn btn-small btn-restore-edited" data-id="${id}" style="background-color: #6c757d;">Khôi phục Gốc</button>
                    </div>
                `;
                manageContentEdited.appendChild(item);
            }
        }

        // Tải tab "Đã ẩn"
        manageContentIgnored.innerHTML = '';
        if (customData.ignored.length === 0) {
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
        }
        
        // Gắn sự kiện cho các nút "Khôi phục" / "Sửa lại"
        manageContentEdited.querySelectorAll('.btn-small').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                if (e.currentTarget.classList.contains('btn-edit')) {
                    openEditModal(id);
                } else if (e.currentTarget.classList.contains('btn-restore-edited')) {
                    restoreQuestion(id, 'edited');
                }
            });
        });
        manageContentIgnored.querySelectorAll('.btn-small').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                restoreQuestion(id, 'ignored');
            });
        });
    }

    function restoreQuestion(id, type) {
        if (type === 'edited') {
            if (confirm(`Bạn có chắc muốn xóa các thay đổi đã sửa của câu ${id}? Câu hỏi sẽ quay về trạng thái gốc.`)) {
                delete customData.edited[id];
                saveCustomData();
                buildMergedData(Object.keys(originalDecksData));
                showManageScreen(); 
            }
        } else if (type === 'ignored') {
            if (confirm(`Bạn có chắc muốn HỌC LẠI câu ${id}?`)) {
                customData.ignored = customData.ignored.filter(ignoredId => ignoredId !== id);
                saveCustomData();
                buildMergedData(Object.keys(originalDecksData));
                showManageScreen(); 
            }
        }
    }

    function resetAllData() {
        if (confirm(`BẠN CÓ CHẮC MUỐN RESET TOÀN BỘ MÔN ${SUBJECT_NAME}?\n\nTất cả các câu đã SỬA và đã ẨN sẽ quay về trạng thái gốc (như trong file CSV).`)) {
            localStorage.removeItem(CUSTOM_DATA_KEY);
            loadCustomData(); 
            buildMergedData(Object.keys(originalDecksData));
            alert('Đã reset môn học về trạng thái gốc.');
            showManageScreen(); 
        }
    }

    // --- 7. CÁC HÀM TIỆN ÍCH (NHẠC NỀN) ---

    function updateMusicPlayer() {
        if (!musicSelect) return; 
        
        const selectedFile = musicSelect.value;
        if (selectedFile === "none") {
            bgMusic.pause();
            bgMusic.removeAttribute('src');
            musicToggleBtn.textContent = 'Bật Nhạc 🎵';
            musicToggleBtn.disabled = true;
            return;
        }
        musicToggleBtn.disabled = false;
        if (!bgMusic.src || !bgMusic.src.endsWith(selectedFile)) {
            bgMusic.src = selectedFile;
            bgMusic.load(); 
            const playPromise = bgMusic.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    musicToggleBtn.textContent = 'Tắt Nhạc ⏸️';
                }).catch(error => {
                    console.log("Tự động phát bị chặn.", error);
                    musicToggleBtn.textContent = 'Bật Nhạc 🎵'; 
                });
            }
        } else {
             musicToggleBtn.textContent = bgMusic.paused ? 'Bật Nhạc 🎵' : 'Tắt Nhạc ⏸️';
        }
    }

    function toggleMusic() {
        if (!musicSelect || musicSelect.value === "none") return; 
        if (bgMusic.paused) {
            bgMusic.play().catch(e => console.log("Không thể phát nhạc: ", e));
            musicToggleBtn.textContent = 'Tắt Nhạc ⏸️';
        } else {
            bgMusic.pause();
            musicToggleBtn.textContent = 'Bật Nhạc 🎵';
        }
    }

    // --- 8. KHỞI CHẠY VÀ GẮN SỰ KIỆN ---

    function attachEventListeners() {
        // Quay lại Menu
        document.querySelectorAll('.back-to-menu').forEach(btn => {
            btn.addEventListener('click', () => showScreen('menu'));
        });
        if (backToDeckSelectBtn) {
            backToDeckSelectBtn.addEventListener('click', () => showScreen('deckSelect'));
        }

        // Nút Menu chính
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
        if (manageDataBtn) manageDataBtn.addEventListener('click', showManageScreen);

        // Nút bắt đầu (chọn nhiều đề random)
        if (startRandomSelectedBtn) startRandomSelectedBtn.addEventListener('click', async () => {
            const checkedBoxes = randomDeckListCheckboxes.querySelectorAll('input:checked');
            if (checkedBoxes.length === 0) {
                alert('Bạn phải chọn ít nhất 1 đề để ôn.');
                return;
            }

            const deckIdsToLoad = Array.from(checkedBoxes).map(cb => cb.value);
            
            await Promise.all(deckIdsToLoad.map(id => fetchDeckData(registeredDecks.find(d => d.id === id))));
            
            buildMergedData(deckIdsToLoad);
            
            let questionsForRandom = [];
            deckIdsToLoad.forEach(id => {
                if(mergedDecks[id]) {
                    questionsForRandom.push(...mergedDecks[id]);
                }
            });

            startQuiz(questionsForRandom);
        });

        // Nút chọn chế độ
        if (startSequentialBtn) startSequentialBtn.addEventListener('click', () => {
            currentAction = 'deck_sequential';
            startQuiz(mergedDecks[currentDeckId]);
        });
        if (startDeckRandomBtn) startDeckRandomBtn.addEventListener('click', () => {
            currentAction = 'deck_random';
            startQuiz(mergedDecks[currentDeckId]);
        });

        // Nút Quiz
        if (nextBtn) nextBtn.addEventListener('click', () => {
            currentQuestionIndex++;
            showQuestion();
        });
        if (editQuestionBtn) editQuestionBtn.addEventListener('click', () => {
            openEditModal(currentEditQuestionId);
        });

        // Nút Modal Sửa
        if (modalSaveBtn) modalSaveBtn.addEventListener('click', saveEdit);
        if (modalIgnoreBtn) modalIgnoreBtn.addEventListener('click', toggleIgnoreQuestion);
        if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeEditModal);

        // Nút Quản lý
        if (resetAllDataBtn) resetAllDataBtn.addEventListener('click', resetAllData);
        if (manageTabs) manageTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab; 
                manageTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                document.getElementById(`manage-content-${targetTab}`).classList.add('active');
            });
        });
        
        // Nhạc nền
        if (musicSelect) musicSelect.addEventListener('change', updateMusicPlayer);
        if (musicToggleBtn) musicToggleBtn.addEventListener('click', toggleMusic);
    }

    // --- 9. BẮT ĐẦU GAME ---

    // Cập nhật giao diện chung (tên môn học)
    document.title = `Ôn tập ${SUBJECT_NAME}`;
    const subjectTitleH1 = document.getElementById('subject-title');
    if (subjectTitleH1) subjectTitleH1.textContent = `ÔN TẬP ${SUBJECT_NAME.toUpperCase()}`;
    const manageTitleH2 = document.querySelector('#manage-data-container h2');
    if (manageTitleH2) manageTitleH2.textContent = `Quản lý các điều chỉnh (Môn ${SUBJECT_NAME})`;
    
    // Tải dữ liệu tùy chỉnh từ localStorage
    loadCustomData();
    
    // Cập nhật các nút bấm ở Menu (dựa trên file "đăng ký")
    updateMenuUI();

    // Kích hoạt tất cả các nút bấm
    attachEventListeners();

    // Khởi tạo nhạc nền
    if (musicSelect && musicSelect.value === 'none') {
        if(musicToggleBtn) musicToggleBtn.disabled = true;
    }
    updateMusicPlayer();
    
    console.log(`Đã khởi tạo xong game cho môn: ${SUBJECT_NAME}`);

}); // --- KẾT THÚC DOMCONTENTLOADED ---