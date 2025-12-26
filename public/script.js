document.addEventListener('DOMContentLoaded', function() {
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
    
    // Генерация ID комнаты
    function generateRoomId() {
        return 'room-' + Math.random().toString(36).substr(2, 9);
    }
    
    // Загрузка видео по URL
    function loadVideoFromUrl(url) {
        if (!url) {
            showError('Пожалуйста, введите ссылку на видео');
            return;
        }
        
        videoUrlInput.value = url;
        videoPlaceholder.style.display = 'none';
        
        // Проверяем тип URL
        if (isYouTubeUrl(url)) {
            loadYouTubeVideo(url);
        } else if (isTikTokUrl(url)) {
            loadTikTokVideo(url);
        } else if (isVKVideoUrl(url)) {
            loadVKVideo(url);
        } else if (isRuTubeUrl(url)) {
            loadRuTubeVideo(url);
        } else if (isVimeoUrl(url)) {
            loadVimeoVideo(url);
        } else if (isDirectVideoUrl(url)) {
            loadDirectVideo(url);
        } else {
            showError('Неподдерживаемый формат ссылки. Попробуйте YouTube, TikTok, VK или прямую ссылку на видео');
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
    
    // Показ ошибок
    function showError(message) {
        alert(message);
        console.error(message);
    }
    
    // Проверка URL TikTok
    function isTikTokUrl(url) {
        return url.includes('tiktok.com') || url.includes('tiktokcdn.com');
    }
    
    // Загрузка TikTok видео
    function loadTikTokVideo(url) {
        // TikTok не поддерживает прямой embed
        // Можно использовать сервисы-прокси или показать инструкцию
        videoPlaceholder.style.display = 'flex';
        videoPlaceholder.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <i class="fab fa-tiktok" style="font-size: 3rem; color: #69C9D0; margin-bottom: 20px;"></i>
                <h3>TikTok видео</h3>
                <p>Для просмотра TikTok видео в синхронизированном режиме:</p>
                <ol style="text-align: left; margin: 20px;">
                    <li>Откройте видео в TikTok</li>
                    <li>Нажмите "Поделиться" → "Копировать ссылку"</li>
                    <li>Вставьте ссылку в поле выше</li>
                </ol>
                <p>Или используйте другие видеосервисы.</p>
            </div>
        `;
        
        // Альтернатива: использовать iframe с TikTok embed
        // currentPlayer = 'iframe';
        // videoPlayer.src = `https://www.tiktok.com/embed/v2/${extractTikTokId(url)}`;
        // videoPlayer.style.display = 'block';
        // html5Player.style.display = 'none';
    }
    
    // Извлечение ID из TikTok URL
    function extractTikTokId(url) {
        const match = url.match(/\/video\/(\d+)/);
        return match ? match[1] : null;
    }
    
    // Сохранение состояния видео
    function saveVideoState() {
        const state = {
            videoUrl: videoUrlInput.value,
            currentTime: currentPlayer === 'html5' ? html5Player.currentTime : 0,
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
                    setTimeout(() => {
                        loadVideoFromUrl(state.videoUrl);
                        
                        if (currentPlayer === 'html5') {
                            html5Player.currentTime = state.currentTime || 0;
                        }
                        
                        if (state.isPlaying) {
                            handlePlayCommand();
                            isPlaying = true;
                        }
                        
                        updatePlaybackStatus();
                    }, 500);
                }
            } catch (e) {
                console.error('Ошибка загрузки состояния:', e);
            }
        }
    }
    
    // Обновление счетчика пользователей (демо)
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
    
    // Инициализация
    function init() {
        // Настройка примеров видео
        setupExampleVideos();
        
        // Загрузка сохраненного состояния
        loadVideoState();
        
        // Обновление счетчика каждые 30 секунд
        setInterval(updateUserCount, 30000);
        
        // Настройка статуса синхронизации (демо)
        syncStatusEl.textContent = 'Демо-режим';
        syncStatusEl.className = 'stat-value connected';
        
        // Установка URL для шаринга
        shareBtn.addEventListener('click', function() {
            roomUrlInput.value = window.location.href + '?room=' + roomId;
            shareModal.style.display = 'flex';
        });
    }
    
    // Настройка примеров видео
    function setupExampleVideos() {
        const exampleVideos = [
            {
                name: 'YouTube',
                url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                icon: 'fab fa-youtube'
            },
            {
                name: 'Образец MP4',
                url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                icon: 'fas fa-film'
            },
            {
                name: 'VK Видео',
                url: 'https://vkvideo.ru/playlist/-220754053_84/video-220754053_456244901',
                icon: 'fab fa-vk'
            },
            {
                name: 'Еще образец',
                url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
                icon: 'fas fa-video'
            }
        ];
        
        // Добавляем примеры в подсказку
        const examplesHTML = exampleVideos.map(video => `
            <a href="#" class="example-link" data-url="${video.url}">
                <i class="${video.icon}"></i> ${video.name}
            </a>
        `).join('');
        
        document.querySelector('.example-links').innerHTML = examplesHTML;
        
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
    
    // Остальные функции (handlePlayCommand, handlePauseCommand, и т.д.)
    // остаются такими же, как в предыдущей версии, но без WebSocket
    
    // Инициализация при загрузке
    init();
    
    // Горячие клавиши
    document.addEventListener('keydown', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        switch(e.key) {
            case ' ':
                e.preventDefault();
                playPauseBtn.click();
                break;
            case 'f':
            case 'F':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    fullscreenBtn.click();
                }
                break;
        }
    });
});
