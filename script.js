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
    const roomIdEl = document.getElementById('room-id');
    const userRoleEl = document.getElementById('user-role');
    const currentVideoEl = document.getElementById('current-video');
    const syncBtn = document.getElementById('sync-btn');
    const skipButtons = document.querySelectorAll('.skip-btn');
    
    // Переменные состояния
    let isPlaying = false;
    let currentPlayer = null;
    let isSeeking = false;
    let videoDuration = 0;
    let roomId = generateRoomId();
    let playerInstance = null;
    let currentVideoUrl = '';
    let currentTime = 0;
    let isLeader = true;
    let isSyncing = false;
    let syncInterval;
    let lastSyncTime = 0;
    let youtubeAPIReady = false;
    
    // Конфигурация синхронизации
    const SYNC_INTERVAL = 3000;
    const SYNC_THRESHOLD = 2;
    const MAX_DELAY = 5;
    
    // Генерация ID комнаты
    function generateRoomId() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomParam = urlParams.get('room');
        if (roomParam) {
            return roomParam;
        }
        return 'room-' + Math.random().toString(36).substr(2, 9);
    }
    
    // Инициализация синхронизации
    function initSync() {
        const urlParams = new URLSearchParams(window.location.search);
        const fromUrl = urlParams.get('room');
        
        if (fromUrl) {
            roomId = fromUrl;
            isLeader = false;
            console.log('Присоединились к комнате:', roomId);
        } else {
            console.log('Создана новая комната:', roomId);
        }
        
        // Обновляем UI
        updateRoomInfo();
        startSync();
        updateSyncStatus(true);
    }
    
    // Обновление информации о комнате
    function updateRoomInfo() {
        if (roomIdEl) roomIdEl.textContent = roomId.substring(0, 15) + '...';
        if (userRoleEl) userRoleEl.textContent = isLeader ? 'Лидер' : 'Участник';
        if (currentVideoEl) {
            const shortUrl = currentVideoUrl ? 
                currentVideoUrl.substring(0, 30) + '...' : 
                'Не загружено';
            currentVideoEl.textContent = shortUrl;
        }
    }
    
    // Запуск синхронизации
    function startSync() {
        if (syncInterval) clearInterval(syncInterval);
        
        syncInterval = setInterval(() => {
            if (currentPlayer) {
                syncPlaybackState();
            }
        }, SYNC_INTERVAL);
        
        window.addEventListener('storage', handleStorageChange);
    }
    
    // Обработка изменений в хранилище
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
    
    // Синхронизация состояния
    function syncPlaybackState() {
        if (isSyncing) return;
        
        const now = Date.now();
        if (now - lastSyncTime < 1000) return;
        
        isSyncing = true;
        lastSyncTime = now;
        
        let state = getCurrentPlaybackState();
        
        if (isLeader) {
            saveSyncState(state);
        } else {
            const leaderState = getLeaderState();
            if (leaderState && shouldSyncWithLeader(state, leaderState)) {
                applyLeaderState(leaderState);
            }
        }
        
        isSyncing = false;
    }
    
    // Получение текущего состояния
    function getCurrentPlaybackState() {
        let currentTime = 0;
        
        if (currentPlayer === 'html5') {
            currentTime = html5Player.currentTime || 0;
            isPlaying = !html5Player.paused;
        } else if (currentPlayer === 'iframe') {
            currentTime = parseFloat(seekSlider.value) || 0;
        }
        
        return {
            time: currentTime,
            playing: isPlaying,
            url: currentVideoUrl,
            timestamp: Date.now(),
            roomId: roomId,
            leader: isLeader
        };
    }
    
    // Сохранение состояния синхронизации
    function saveSyncState(state) {
        const syncData = {
            ...state,
            leader: true,
            userId: getUserId()
        };
        
        localStorage.setItem(`cinemaSync_${roomId}`, JSON.stringify(syncData));
    }
    
    // Получение состояния лидера
    function getLeaderState() {
        const data = localStorage.getItem(`cinemaSync_${roomId}`);
        if (!data) return null;
        
        try {
            return JSON.parse(data);
        } catch (e) {
            console.error('Ошибка парсинга состояния лидера:', e);
            return null;
        }
    }
    
    // Проверка необходимости синхронизации
    function shouldSyncWithLeader(myState, leaderState) {
        if (!leaderState || !leaderState.leader) return false;
        
        const timeDiff = Math.abs(myState.time - leaderState.time);
        
        return timeDiff > SYNC_THRESHOLD || 
               myState.playing !== leaderState.playing ||
               (leaderState.url && myState.url !== leaderState.url);
    }
    
    // Применение состояния лидера
    function applyLeaderState(leaderState) {
        console.log('Синхронизация с лидером:', leaderState);
        
        // Если видео другое - загружаем
        if (leaderState.url && leaderState.url !== currentVideoUrl) {
            setTimeout(() => loadVideoFromUrl(leaderState.url), 500);
            return;
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
    
    // Обновление статуса синхронизации
    function updateSyncStatus(connected) {
        if (connected) {
            syncStatusEl.textContent = isLeader ? 'Лидер (синхронизирует)' : 'Синхронизировано';
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
        console.log('Загрузка видео по URL:', url);
        
        if (!url || url.trim() === '') {
            showError('Пожалуйста, введите ссылку на видео');
            return;
        }
        
        // Очищаем предыдущее видео
        videoPlayer.src = '';
        html5Player.src = '';
        
        currentVideoUrl = url.trim();
        videoUrlInput.value = currentVideoUrl;
        
        // Обновляем информацию
        updateRoomInfo();
        
        // Если мы лидер - синхронизируем с другими
        if (isLeader) {
            const state = getCurrentPlaybackState();
            state.url = currentVideoUrl;
            saveSyncState(state);
        }
        
        // Проверяем тип URL
        if (isYouTubeUrl(currentVideoUrl)) {
            console.log('Определено как YouTube видео');
            loadYouTubeVideo(currentVideoUrl);
        } else if (isVKVideoUrl(currentVideoUrl)) {
            console.log('Определено как VK видео');
            loadVKVideo(currentVideoUrl);
        } else if (isRuTubeUrl(currentVideoUrl)) {
            console.log('Определено как RuTube видео');
            loadRuTubeVideo(currentVideoUrl);
        } else if (isVimeoUrl(currentVideoUrl)) {
            console.log('Определено как Vimeo видео');
            loadVimeoVideo(currentVideoUrl);
        } else if (isTikTokUrl(currentVideoUrl)) {
            console.log('Определено как TikTok видео');
            loadTikTokVideo(currentVideoUrl);
        } else if (isDirectVideoUrl(currentVideoUrl)) {
            console.log('Определено как прямое видео');
            loadDirectVideo(currentVideoUrl);
        } else {
            console.log('Неизвестный формат URL');
            showError('Неподдерживаемый формат ссылки. Попробуйте:<br>• YouTube: youtube.com/watch?v=...<br>• VK: vk.com/video-...<br>• RuTube: rutube.ru/video/...<br>• Прямая ссылка на видеофайл (MP4, WebM)');
            return;
        }
        
        // Сохраняем состояние
        saveVideoState();
        
        // Активируем элементы управления
        playPauseBtn.disabled = false;
        stopBtn.disabled = false;
        seekSlider.disabled = false;
        
        updatePlaybackStatus();
        updateUserCount();
    }
    
    // Проверка URL YouTube
    function isYouTubeUrl(url) {
        return url.includes('youtube.com') || url.includes('youtu.be');
    }
    
    // Проверка URL VK
    function isVKVideoUrl(url) {
        return url.includes('vk.com/video') || url.includes('vkvideo.ru') || url.includes('vkontakte.ru/video');
    }
    
    // Проверка URL RuTube
    function isRuTubeUrl(url) {
        return url.includes('rutube.ru/video') || url.includes('rutube.ru/play/embed');
    }
    
    // Проверка URL Vimeo
    function isVimeoUrl(url) {
        return url.includes('vimeo.com');
    }
    
    // Проверка URL TikTok
    function isTikTokUrl(url) {
        return url.includes('tiktok.com') || url.includes('tiktokcdn.com');
    }
    
    // Проверка на прямую ссылку на видео
    function isDirectVideoUrl(url) {
        const videoExtensions = ['.mp4', '.webm', '.ogg', '.m3u8'];
        const urlLower = url.toLowerCase();
        return videoExtensions.some(ext => urlLower.includes(ext));
    }
    
    // Загрузка YouTube видео
    function loadYouTubeVideo(url) {
        const videoId = extractYouTubeId(url);
        if (!videoId) {
            showError('Не удалось распознать YouTube видео');
            return;
        }
        
        currentPlayer = 'iframe';
        const embedUrl = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=0`;
        
        videoPlayer.src = embedUrl;
        videoPlayer.style.display = 'block';
        html5Player.style.display = 'none';
        videoPlaceholder.style.display = 'none';
        
        console.log('YouTube iframe загружен');
        
        // Устанавливаем таймер для скрытия плейсхолдера
        setTimeout(() => {
            videoPlaceholder.style.display = 'none';
        }, 1000);
    }
    
    // Извлечение ID из YouTube URL
    function extractYouTubeId(url) {
        const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }
    
    // Загрузка VK видео
    function loadVKVideo(url) {
        currentPlayer = 'iframe';
        // VK не позволяет встраивание без специальных разрешений
        showError('VK видео не поддерживает прямое встраивание. Пожалуйста, используйте YouTube, RuTube или прямые ссылки на видео.');
        
        // Альтернатива: показать инструкцию
        videoPlaceholder.style.display = 'flex';
        videoPlaceholder.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <i class="fab fa-vk" style="font-size: 3rem; color: #4C75A3; margin-bottom: 20px;"></i>
                <h3>VK Видео</h3>
                <p>Для просмотра VK видео в синхронизированном режиме:</p>
                <ol style="text-align: left; margin: 20px;">
                    <li>Найдите это же видео на YouTube или RuTube</li>
                    <li>Используйте прямую ссылку на видеофайл</li>
                    <li>Или используйте другие видеосервисы</li>
                </ol>
                <p>К сожалению, VK не поддерживает прямое встраивание видео.</p>
            </div>
        `;
    }
    
    // Загрузка RuTube видео
    function loadRuTubeVideo(url) {
        currentPlayer = 'iframe';
        // RuTube также может иметь ограничения
        showError('RuTube видео может не загружаться из-за ограничений CORS. Попробуйте YouTube или прямые ссылки на видео.');
        
        videoPlaceholder.style.display = 'flex';
        videoPlaceholder.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <i class="fas fa-film" style="font-size: 3rem; color: #4ecdc4; margin-bottom: 20px;"></i>
                <h3>RuTube Видео</h3>
                <p>RuTube может блокировать встраивание на некоторых сайтах.</p>
                <p>Рекомендуем использовать:</p>
                <ol style="text-align: left; margin: 20px;">
                    <li>YouTube для надежной работы</li>
                    <li>Прямые ссылки на видеофайлы (MP4)</li>
                    <li>Образцы видео из списка примеров</li>
                </ol>
            </div>
        `;
    }
    
    // Загрузка Vimeo видео
    function loadVimeoVideo(url) {
        currentPlayer = 'iframe';
        const videoId = extractVimeoId(url);
        if (!videoId) {
            showError('Не удалось распознать Vimeo видео');
            return;
        }
        
        const embedUrl = `https://player.vimeo.com/video/${videoId}?autoplay=0&title=0&byline=0&portrait=0`;
        videoPlayer.src = embedUrl;
        videoPlayer.style.display = 'block';
        html5Player.style.display = 'none';
        videoPlaceholder.style.display = 'none';
    }
    
    // Извлечение ID из Vimeo URL
    function extractVimeoId(url) {
        const match = url.match(/vimeo\.com\/(\d+)/) || 
                     url.match(/vimeo\.com\/video\/(\d+)/);
        return match ? match[1] : null;
    }
    
    // Загрузка TikTok видео
    function loadTikTokVideo(url) {
        currentPlayer = 'iframe';
        // TikTok не поддерживает встраивание
        showError('TikTok видео не поддерживает синхронизированный просмотр. Используйте YouTube или прямые ссылки на видео.');
        
        videoPlaceholder.style.display = 'flex';
        videoPlaceholder.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <i class="fab fa-tiktok" style="font-size: 3rem; color: #69C9D0; margin-bottom: 20px;"></i>
                <h3>TikTok Видео</h3>
                <p>TikTok не поддерживает прямое встраивание видео для синхронизации.</p>
                <p>Рекомендуем использовать:</p>
                <ol style="text-align: left; margin: 20px;">
                    <li>YouTube для надежной синхронизации</li>
                    <li>Прямые ссылки на видеофайлы</li>
                    <li>Образцы из списка примеров</li>
                </ol>
            </div>
        `;
    }
    
    // Загрузка прямого видео (надежный способ)
    function loadDirectVideo(url) {
        currentPlayer = 'html5';
        
        // Проверяем доступность видео
        testVideoUrl(url).then(isAccessible => {
            if (!isAccessible) {
                showError('Видео недоступно или заблокировано CORS. Попробуйте другой источник.');
                return;
            }
            
            videoPlayer.style.display = 'none';
            html5Player.style.display = 'block';
            videoPlaceholder.style.display = 'none';
            
            // Настройка HTML5 плеера
            html5Player.src = url;
            html5Player.load();
            
            // Обработчики событий
            html5Player.addEventListener('loadedmetadata', function() {
                videoDuration = html5Player.duration;
                durationEl.textContent = formatTime(videoDuration);
                seekSlider.max = Math.floor(videoDuration);
                console.log('Видео загружено, длительность:', videoDuration);
            });
            
            html5Player.addEventListener('timeupdate', function() {
                if (!isSeeking) {
                    const currentTime = html5Player.currentTime;
                    seekSlider.value = currentTime;
                    currentTimeEl.textContent = formatTime(currentTime);
                }
            });
            
            html5Player.addEventListener('play', function() {
                isPlaying = true;
                updatePlayPauseButton();
                updatePlaybackStatus();
            });
            
            html5Player.addEventListener('pause', function() {
                isPlaying = false;
                updatePlayPauseButton();
                updatePlaybackStatus();
            });
            
            html5Player.addEventListener('ended', function() {
                isPlaying = false;
                updatePlayPauseButton();
                updatePlaybackStatus();
            });
            
            html5Player.addEventListener('error', function(e) {
                console.error('Ошибка загрузки видео:', e);
                showError('Ошибка загрузки видео. Попробуйте другую ссылку.');
            });
            
        }).catch(error => {
            console.error('Ошибка проверки видео:', error);
            showError('Не удалось проверить доступность видео. Попробуйте другой URL.');
        });
    }
    
    // Проверка доступности видео URL
    function testVideoUrl(url) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('HEAD', url);
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                }
            };
            xhr.onerror = function() {
                resolve(false);
            };
            xhr.send();
        });
    }
    
    // Обработка команды воспроизведения
    function handlePlayCommand() {
        if (currentPlayer === 'html5') {
            html5Player.play().catch(e => {
                console.error('Ошибка воспроизведения:', e);
                showError('Не удалось воспроизвести видео');
            });
        } else if (currentPlayer === 'iframe') {
            // Для iframe используем автоплей в параметрах
            const currentSrc = videoPlayer.src;
            if (!currentSrc.includes('autoplay=1')) {
                const newSrc = currentSrc.includes('?') ? 
                    currentSrc + '&autoplay=1' : 
                    currentSrc + '?autoplay=1';
                videoPlayer.src = newSrc;
            }
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
            // Для iframe сложно поставить на паузу
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
            // Для iframe перезагружаем
            videoPlayer.src = videoPlayer.src.replace('autoplay=1', 'autoplay=0');
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
            // Для iframe не можем напрямую перематывать
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
        if (isNaN(seconds)) return '00:00';
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
        // Создаем уведомление
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-exclamation-triangle" style="color: #ffd166;"></i>
                <div>${message}</div>
            </div>
        `;
        
        notification.style.cssText = `
            background: rgba(255, 107, 107, 0.9);
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            margin-bottom: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideInRight 0.3s ease;
            max-width: 400px;
        `;
        
        const container = document.getElementById('notification-container') || createNotificationContainer();
        container.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
        
        console.error('Ошибка:', message);
    }
    
    // Создание контейнера для уведомлений
    function createNotificationContainer() {
        const container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
        `;
        document.body.appendChild(container);
        return container;
    }
    
    // Добавляем стили для анимации уведомлений
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
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
        
        // Кнопка синхронизации
        if (syncBtn) {
            syncBtn.addEventListener('click', function() {
                syncPlaybackState();
                syncBtn.classList.add('force-sync');
                setTimeout(() => syncBtn.classList.remove('force-sync'), 1000);
            });
        }
        
        // Кнопки перемотки
        skipButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const skipSeconds = parseInt(this.dataset.skip);
                if (currentPlayer === 'html5') {
                    const newTime = Math.max(0, html5Player.currentTime + skipSeconds);
                    handleSeekCommand(newTime);
                }
            });
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
        
        // Кнопка полноэкранного режима
        fullscreenBtn.addEventListener('click', function() {
            const container = document.getElementById('player-container');
            if (!document.fullscreenElement) {
                if (container.requestFullscreen) {
                    container.requestFullscreen();
                } else if (container.webkitRequestFullscreen) {
                    container.webkitRequestFullscreen();
                } else if (container.msRequestFullscreen) {
                    container.msRequestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
            }
        });
        
        // Модальное окно
        shareBtn.addEventListener('click', function() {
            const baseUrl = window.location.origin + window.location.pathname;
            const roomUrl = baseUrl + '?room=' + roomId;
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
                case 's':
                case 'S':
                    if (syncBtn) {
                        e.preventDefault();
                        syncBtn.click();
                    }
                    break;
                case 'Escape':
                    if (document.fullscreenElement) {
                        document.exitFullscreen();
                    }
                    break;
            }
        });
        
        // Добавляем обработчики для кнопок управления комнатой
        setupRoomControls();
        
        console.log('Инициализация завершена');
    }
    
    // Настройка управления комнатой
    function setupRoomControls() {
        // Кнопка новой комнаты
        const newRoomBtn = document.getElementById('new-room-btn');
        if (newRoomBtn) {
            newRoomBtn.addEventListener('click', function() {
                if (confirm('Создать новую комнату? Текущая синхронизация будет потеряна.')) {
                    window.location.href = window.location.pathname;
                }
            });
        }
        
        // Кнопка отключения от синхронизации
        const disconnectBtn = document.getElementById('disconnect-btn');
        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', function() {
                if (confirm('Отключиться от синхронизации? Вы станете независимым зрителем.')) {
                    isLeader = true;
                    isSyncing = false;
                    updateSyncStatus(false);
                    updateRoomInfo();
                    showError('Синхронизация отключена. Вы теперь лидер новой комнаты.');
                }
            });
        }
        
        // Кнопка теста синхронизации
        const testSyncBtn = document.getElementById('test-sync-btn');
        if (testSyncBtn) {
            testSyncBtn.addEventListener('click', function() {
                showError('Тест синхронизации: открывайте эту страницу в разных окнах браузера для проверки');
            });
        }
        
        // Кнопка добавления демо-пользователей
        const demoUsersBtn = document.getElementById('demo-users-btn');
        if (demoUsersBtn) {
            demoUsersBtn.addEventListener('click', function() {
                updateUserCount();
                showError('Демо-пользователь добавлен');
            });
        }
    }
    
    // Настройка примеров видео
    function setupExampleVideos() {
        const exampleVideos = [
            {
                name: 'YouTube - Короткое видео',
                url: 'https://www.youtube.com/watch?v=7NOSDKb0HlU',
                icon: 'fab fa-youtube'
            },
            {
                name: 'Образец видео 1 (MP4)',
                url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                icon: 'fas fa-film'
            },
            {
                name: 'Образец видео 2 (MP4)',
                url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
                icon: 'fas fa-video'
            },
            {
                name: 'Образец видео 3 (MP4)',
                url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
                icon: 'fas fa-play-circle'
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
                
                if (state.videoUrl) {
                    console.log('Восстановление состояния видео');
                    setTimeout(() => {
                        loadVideoFromUrl(state.videoUrl);
                        
                        if (state.isPlaying) {
                            setTimeout(() => {
                                handlePlayCommand();
                            }, 1000);
                        }
                    }, 1000);
                }
            } catch (e) {
                console.error('Ошибка загрузки состояния:', e);
            }
        }
    }
    
    // Инициализация при загрузке
    init();
});
