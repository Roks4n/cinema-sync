document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен, скрипт запущен');
    
    // Элементы DOM
    const videoUrlInput = document.getElementById('video-url');
    const loadVideoBtn = document.getElementById('load-video-btn');
    const videoPlaceholder = document.getElementById('video-placeholder');
    const videoPlayer = document.getElementById('video-player');
    const html5Player = document.getElementById('html5-player');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const stopBtn = document.getElementById('stop-btn');
    const seekSlider = document.getElementById('seek-slider');
    const currentTimeEl = document.getElementById('current-time');
    const durationEl = document.getElementById('duration');
    const userCountEl = document.getElementById('user-count');
    const playbackStatusEl = document.getElementById('playback-status');
    const syncStatusEl = document.getElementById('sync-status');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const shareBtn = document.getElementById('share-btn');
    const shareModal = document.getElementById('share-modal');
    const closeModal = document.querySelector('.close-modal');
    const roomUrlInput = document.getElementById('room-url');
    const copyLinkBtn = document.getElementById('copy-link-btn');
    
    // Переменные состояния
    let isPlaying = false;
    let currentPlayer = null;
    let isSeeking = false;
    let videoDuration = 600;
    let roomId = generateRoomId();
    let playerInstance = null;
    let currentVideoUrl = '';
    let currentTime = 0;
    let isLeader = true; // Лидер комнаты (первый пользователь)
    let isSyncing = false;
    let syncInterval;
    let lastSyncTime = 0;
    
    // Конфигурация синхронизации
    const SYNC_INTERVAL = 3000; // Синхронизация каждые 3 секунды
    const SYNC_THRESHOLD = 2; // Разница во времени для синхронизации (секунды)
    const MAX_DELAY = 5; // Максимальная задержка перед принудительной синхронизацией
    
    // Генерация ID комнаты
    function generateRoomId() {
        // Проверяем URL на наличие комнаты
        const urlParams = new URLSearchParams(window.location.search);
        const roomParam = urlParams.get('room');
        if (roomParam) {
            return roomParam;
        }
        return 'room-' + Math.random().toString(36).substr(2, 9);
    }
    
    // Инициализация синхронизации
    function initSync() {
        // Для демонстрации будем использовать localStorage для синхронизации
        // В реальном проекте нужно использовать WebSocket сервер
        
        // Читаем настройки из URL
        const urlParams = new URLSearchParams(window.location.search);
        const fromUrl = urlParams.get('room');
        
        if (fromUrl) {
            roomId = fromUrl;
            isLeader = false; // Если зашли по ссылке - не лидер
            console.log('Присоединились к комнате:', roomId);
        } else {
            console.log('Создана новая комната:', roomId);
        }
        
        // Запускаем синхронизацию
        startSync();
        
        // Обновляем статус
        updateSyncStatus(true);
    }
    
    // Запуск синхронизации
    function startSync() {
        // Очищаем старый интервал
        if (syncInterval) clearInterval(syncInterval);
        
        // Запускаем синхронизацию
        syncInterval = setInterval(() => {
            if (currentPlayer) {
                syncPlaybackState();
            }
        }, SYNC_INTERVAL);
        
        // Слушаем изменения в localStorage
        window.addEventListener('storage', handleStorageChange);
        
        // Также слушаем свои сообщения (для демо)
        window.addEventListener('syncEvent', handleSyncEvent);
    }
    
    // Синхронизация состояния воспроизведения
    function syncPlaybackState() {
        if (isSyncing) return; // Предотвращаем рекурсию
        
        const now = Date.now();
        if (now - lastSyncTime < 1000) return; // Не чаще чем раз в секунду
        
        isSyncing = true;
        lastSyncTime = now;
        
        // Получаем текущее состояние
        let state = getCurrentPlaybackState();
        
        // Если мы лидер - сохраняем состояние
        if (isLeader) {
            saveSyncState(state);
        } else {
            // Если не лидер - получаем состояние от лидера
            const leaderState = getLeaderState();
            if (leaderState && shouldSyncWithLeader(state, leaderState)) {
                applyLeaderState(leaderState);
            }
        }
        
        isSyncing = false;
    }
    
    // Получение текущего состояния воспроизведения
    function getCurrentPlaybackState() {
        let currentTime = 0;
        
        if (currentPlayer === 'html5') {
            currentTime = html5Player.currentTime || 0;
            isPlaying = !html5Player.paused;
        } else if (currentPlayer === 'iframe') {
            // Для iframe можем только оценить
            currentTime = parseFloat(seekSlider.value) || 0;
        }
        
        return {
            time: currentTime,
            playing: isPlaying,
            url: currentVideoUrl,
            timestamp: Date.now(),
            roomId: roomId
        };
    }
    
    // Сохранение состояния синхронизации
    function saveSyncState(state) {
        const syncData = {
            ...state,
            leader: true,
            userId: getUserId()
        };
        
        // Сохраняем в localStorage
        localStorage.setItem(`cinemaSync_${roomId}`, JSON.stringify(syncData));
        
        // Также отправляем событие (для демо в одном браузере)
        const event = new CustomEvent('syncEvent', { detail: syncData });
        window.dispatchEvent(event);
    }
    
    // Получение состояния лидера
    function getLeaderState() {
        // Получаем из localStorage
        const data = localStorage.getItem(`cinemaSync_${roomId}`);
        if (!data) return null;
        
        try {
            return JSON.parse(data);
        } catch (e) {
            console.error('Ошибка парсинга состояния лидера:', e);
            return null;
        }
    }
    
    // Проверка необходимости синхронизации с лидером
    function shouldSyncWithLeader(myState, leaderState) {
        if (!leaderState || !leaderState.leader) return false;
        
        // Проверяем разницу во времени
        const timeDiff = Math.abs(myState.time - leaderState.time);
        
        // Если разница больше порога или состояние воспроизведения отличается
        return timeDiff > SYNC_THRESHOLD || 
               myState.playing !== leaderState.playing ||
               (leaderState.url && myState.url !== leaderState.url);
    }
    
    // Применение состояния лидера
    function applyLeaderState(leaderState) {
        console.log('Синхронизация с лидером:', leaderState);
        
        // Если видео другое - загружаем
        if (leaderState.url && leaderState.url !== currentVideoUrl) {
            loadVideoFromUrl(leaderState.url);
        }
        
        // Синхронизируем время
        if (Math.abs(currentTime - leaderState.time) > SYNC_THRESHOLD) {
            handleSeekCommand(leaderState.time);
        }
        
        // Синхронизируем воспроизведение
        if (leaderState.playing !== isPlaying) {
            if (leaderState.playing) {
                handlePlayCommand();
            } else {
                handlePauseCommand();
            }
        }
        
        updateSyncStatus(true);
    }
    
    // Обработчик изменений в хранилище
    function handleStorageChange(e) {
        if (e.key === `cinemaSync_${roomId}` && !isLeader) {
            try {
                const leaderState = JSON.parse(e.newValue);
                if (leaderState && leaderState.leader) {
                    applyLeaderState(leaderState);
                }
            } catch (err) {
                console.error('Ошибка обработки синхронизации:', err);
            }
        }
    }
    
    // Обработчик событий синхронизации
    function handleSyncEvent(e) {
        if (!isLeader && e.detail && e.detail.leader) {
            applyLeaderState(e.detail);
        }
    }
    
    // Обновление статуса синхронизации
    function updateSyncStatus(connected) {
        if (connected) {
            syncStatusEl.textContent = isLeader ? 'Лидер комнаты' : 'Синхронизировано';
            syncStatusEl.className = 'stat-value connected';
        } else {
            syncStatusEl.textContent = 'Не синхронизировано';
            syncStatusEl.className = 'stat-value disconnected';
        }
    }
    
    // Генерация ID пользователя
    function getUserId() {
        let userId = localStorage.getItem('cinemaUserId');
        if (!userId) {
            userId = 'user-' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('cinemaUserId', userId);
        }
        return userId;
    }
    
    // Загрузка видео по URL
    function loadVideoFromUrl(url) {
        console.log('Попытка загрузить видео по URL:', url);
        
        if (!url) {
            showError('Пожалуйста, введите ссылку на видео');
            return;
        }
        
        currentVideoUrl = url;
        videoUrlInput.value = url;
        
        // Если мы лидер - синхронизируем с другими
        if (isLeader) {
            const state = getCurrentPlaybackState();
            state.url = url;
            saveSyncState(state);
        }
        
        // Показываем загрузку
        videoPlaceholder.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div class="loading" style="width: 50px; height: 50px; margin: 20px auto;"></div>
                <p>Загрузка видео...</p>
            </div>
        `;
        videoPlaceholder.style.display = 'flex';
        
        // Скрываем другие плееры
        videoPlayer.style.display = 'none';
        html5Player.style.display = 'none';
        
        // Проверяем тип URL
        if (isYouTubeUrl(url)) {
            console.log('Определено как YouTube видео');
            loadYouTubeVideo(url);
        } else if (isTikTokUrl(url)) {
            console.log('Определено как TikTok видео');
            loadTikTokVideo(url);
        } else if (isVKVideoUrl(url)) {
            console.log('Определено как VK видео');
            loadVKVideo(url);
        } else if (isRuTubeUrl(url)) {
            console.log('Определено как RuTube видео');
            loadRuTubeVideo(url);
        } else if (isVimeoUrl(url)) {
            console.log('Определено как Vimeo видео');
            loadVimeoVideo(url);
        } else if (isDirectVideoUrl(url)) {
            console.log('Определено как прямое видео');
            loadDirectVideo(url);
        } else {
            console.log('Неизвестный формат URL');
            showError('Неподдерживаемый формат ссылки. Попробуйте YouTube, TikTok, VK, RuTube или прямую ссылку на видео');
            return;
        }
        
        // Сохраняем в localStorage
        saveVideoState();
        
        // Активируем элементы управления
        playPauseBtn.disabled = false;
        stopBtn.disabled = false;
        seekSlider.disabled = false;
        
        updatePlaybackStatus();
        updateUserCount();
    }
    
    // Обработка команды воспроизведения
    function handlePlayCommand() {
        if (currentPlayer === 'html5') {
            html5Player.play();
        } else if (currentPlayer === 'iframe') {
            // Для iframe не можем управлять напрямую
        }
        isPlaying = true;
        updatePlayPauseButton();
        updatePlaybackStatus();
        
        // Синхронизируем
        if (isLeader) {
            syncPlaybackState();
        }
    }
    
    // Обработка команды паузы
    function handlePauseCommand() {
        if (currentPlayer === 'html5') {
            html5Player.pause();
        } else if (currentPlayer === 'iframe') {
            // Для iframe не можем управлять напрямую
        }
        isPlaying = false;
        updatePlayPauseButton();
        updatePlaybackStatus();
        
        // Синхронизируем
        if (isLeader) {
            syncPlaybackState();
        }
    }
    
    // Обработка команды остановки
    function handleStopCommand() {
        if (currentPlayer === 'html5') {
            html5Player.pause();
            html5Player.currentTime = 0;
        } else if (currentPlayer === 'iframe') {
            // Для iframe не можем управлять напрямую
        }
        isPlaying = false;
        updatePlayPauseButton();
        updatePlaybackStatus();
        currentTimeEl.textContent = '00:00';
        seekSlider.value = 0;
        
        // Синхронизируем
        if (isLeader) {
            syncPlaybackState();
        }
    }
    
    // Обработка перемотки
    function handleSeekCommand(time) {
        if (currentPlayer === 'html5') {
            html5Player.currentTime = time;
        } else if (currentPlayer === 'iframe') {
            // Для iframe не можем управлять напрямую
        }
        currentTimeEl.textContent = formatTime(time);
        seekSlider.value = time;
        currentTime = time;
        
        // Синхронизируем
        if (isLeader) {
            syncPlaybackState();
        }
    }
    
    // Форматирование времени
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    // Обновление кнопки Play/Pause
    function updatePlayPauseButton() {
        if (isPlaying) {
            playPauseBtn.innerHTML = '<i class="fas fa-pause"></i> Пауза';
            playPauseBtn.classList.add('playing');
        } else {
            playPauseBtn.innerHTML = '<i class="fas fa-play"></i> Воспроизвести';
            playPauseBtn.classList.remove('playing');
        }
    }
    
    // Обновление статуса воспроизведения
    function updatePlaybackStatus() {
        playbackStatusEl.textContent = isPlaying ? 'Воспроизведение' : 'Остановлено';
        playbackStatusEl.className = isPlaying ? 'stat-value connected' : 'stat-value';
    }
    
    // Обновление счетчика пользователей
    function updateUserCount() {
        // Демо-режим: случайное число пользователей
        const baseCount = 1;
        const randomCount = Math.floor(Math.random() * 5);
        const totalCount = baseCount + randomCount;
        
        userCountEl.textContent = totalCount;
        userCountEl.classList.add('user-count-updated');
        
        setTimeout(() => {
            userCountEl.classList.remove('user-count-updated');
        }, 500);
    }
    
    // Показ ошибок
    function showError(message) {
        // Используем более красивый alert
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff6b6b;
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            z-index: 1000;
            max-width: 300px;
            animation: slideIn 0.3s ease;
        `;
        errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => errorDiv.remove(), 300);
        }, 3000);
        
        console.error(message);
    }
    
    // Добавляем стили для анимации ошибок
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    // Инициализация
    function init() {
        console.log('Инициализация приложения');
        
        // Инициализация синхронизации
        initSync();
        
        // Настройка примеров видео
        setupExampleVideos();
        
        // Загрузка сохраненного состояния
        loadVideoState();
        
        // Обновление счетчика каждые 30 секунд
        setInterval(updateUserCount, 30000);
        
        // Кнопка загрузки видео
        loadVideoBtn.addEventListener('click', function() {
            console.log('Кнопка загрузки нажата');
            loadVideoFromUrl(videoUrlInput.value);
        });
        
        // Ввод по Enter
        videoUrlInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                loadVideoFromUrl(videoUrlInput.value);
            }
        });
        
        // Кнопки управления
        playPauseBtn.addEventListener('click', function() {
            if (currentPlayer) {
                if (isPlaying) {
                    handlePauseCommand();
                } else {
                    handlePlayCommand();
                }
            }
        });
        
        stopBtn.addEventListener('click', function() {
            if (currentPlayer) {
                handleStopCommand();
            }
        });
        
        // Ползунок перемотки
        seekSlider.addEventListener('input', function() {
            isSeeking = true;
            const time = this.value;
            currentTimeEl.textContent = formatTime(time);
        });
        
        seekSlider.addEventListener('change', function() {
            isSeeking = false;
            const time = this.value;
            handleSeekCommand(time);
        });
        
        // Модальное окно
        shareBtn.addEventListener('click', function() {
            const roomUrl = window.location.origin + window.location.pathname + '?room=' + roomId;
            roomUrlInput.value = roomUrl;
            shareModal.style.display = 'flex';
        });
        
        closeModal.addEventListener('click', function() {
            shareModal.style.display = 'none';
        });
        
        window.addEventListener('click', function(event) {
            if (event.target === shareModal) {
                shareModal.style.display = 'none';
            }
        });
        
        copyLinkBtn.addEventListener('click', function() {
            roomUrlInput.select();
            document.execCommand('copy');
            
            // Показываем подтверждение
            const originalHtml = copyLinkBtn.innerHTML;
            copyLinkBtn.innerHTML = '<i class="fas fa-check"></i> Скопировано!';
            copyLinkBtn.style.background = '#4ecdc4';
            
            setTimeout(() => {
                copyLinkBtn.innerHTML = originalHtml;
                copyLinkBtn.style.background = '';
            }, 2000);
        });
        
        // Горячие клавиши
        document.addEventListener('keydown', function(e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            switch(e.key) {
                case ' ':
                    e.preventDefault();
                    if (playPauseBtn && !playPauseBtn.disabled) {
                        playPauseBtn.click();
                    }
                    break;
                case 'f':
                case 'F':
                    if (fullscreenBtn) {
                        e.preventDefault();
                        fullscreenBtn.click();
                    }
                    break;
                case 'Escape':
                    if (document.fullscreenElement) {
                        document.exitFullscreen();
                    }
                    break;
            }
        });
        
        // Добавляем подсказки для кнопок
        addButtonTooltips();
        
        console.log('Инициализация завершена');
    }
    
    // Добавление подсказок для кнопок
    function addButtonTooltips() {
        const buttons = [
            { id: 'play-pause-btn', text: 'Пробел' },
            { id: 'fullscreen-btn', text: 'F' },
            { id: 'share-btn', text: 'Поделиться комнатой' }
        ];
        
        buttons.forEach(btn => {
            const element = document.getElementById(btn.id);
            if (element) {
                element.setAttribute('title', btn.text);
            }
        });
    }
    
    // Настройка примеров видео
    function setupExampleVideos() {
        const exampleVideos = [
            {
                name: 'YouTube (пример)',
                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                icon: 'fab fa-youtube'
            },
            {
                name: 'RuTube (пример)',
                url: 'https://rutube.ru/video/7fc6a5950b9a643adc8d7e280f722a7d/',
                icon: 'fas fa-film'
            },
            {
                name: 'VK Видео (пример)',
                url: 'https://vk.com/video-220754053_456244901',
                icon: 'fab fa-vk'
            },
            {
                name: 'Образец MP4',
                url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                icon: 'fas fa-video'
            }
        ];
        
        // Добавляем примеры в подсказку
        const examplesHTML = exampleVideos.map(video => `
            <a href="#" class="example-link" data-url="${video.url}">
                <i class="${video.icon}"></i> ${video.name}
            </a>
        `).join('');
        
        const exampleLinks = document.querySelector('.example-links');
        if (exampleLinks) {
            exampleLinks.innerHTML = examplesHTML;
            
            // Обработчики для примеров
            document.querySelectorAll('.example-link').forEach(link => {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    const url = this.getAttribute('data-url');
                    videoUrlInput.value = url;
                    loadVideoFromUrl(url);
                });
            });
        }
    }
    
    // Сохранение состояния видео
    function saveVideoState() {
        const state = {
            videoUrl: currentVideoUrl,
            currentTime: currentPlayer === 'html5' ? (html5Player.currentTime || 0) : 0,
            isPlaying: isPlaying,
            roomId: roomId,
            timestamp: Date.now()
        };
        
        localStorage.setItem('cinemaSyncState', JSON.stringify(state));
    }
    
    // Загрузка состояния видео
    function loadVideoState() {
        const saved = localStorage.getItem('cinemaSyncState');
        if (saved) {
            try {
                const state = JSON.parse(saved);
                
                // Если комната та же, восстанавливаем
                if (state.roomId === roomId && state.videoUrl) {
                    console.log('Восстановление состояния видео');
                    setTimeout(() => {
                        loadVideoFromUrl(state.videoUrl);
                        
                        if (state.isPlaying) {
                            setTimeout(() => {
                                handlePlayCommand();
                            }, 1000);
                        }
                    }, 500);
                }
            } catch (e) {
                console.error('Ошибка загрузки состояния:', e);
            }
        }
    }
    
    // Инициализация при загрузке
    init();
});
