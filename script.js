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
    let playerInstance = null;
    let currentVideoUrl = '';
    
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
        
        currentVideoUrl = url;
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
    
    // Проверка URL YouTube
    function isYouTubeUrl(url) {
        return url.includes('youtube.com') || url.includes('youtu.be');
    }
    
    // Проверка URL VK
    function isVKVideoUrl(url) {
        return url.includes('vk.com') || url.includes('vkvideo.ru') || url.includes('vkontakte.ru');
    }
    
    // Проверка URL RuTube
    function isRuTubeUrl(url) {
        return url.includes('rutube.ru');
    }
    
    // Проверка URL Vimeo
    function isVimeoUrl(url) {
        return url.includes('vimeo.com');
    }
    
    // Проверка на прямую ссылку на видео
    function isDirectVideoUrl(url) {
        const videoExtensions = ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.m3u8'];
        const urlLower = url.toLowerCase();
        return videoExtensions.some(ext => urlLower.includes(ext)) || 
               urlLower.includes('video/') || 
               urlLower.includes('stream/') ||
               urlLower.includes('.m3u8');
    }
    
    // Загрузка YouTube видео
    function loadYouTubeVideo(url) {
        const videoId = extractYouTubeId(url);
        if (!videoId) {
            showError('Не удалось распознать YouTube видео');
            return;
        }
        
        currentPlayer = 'iframe';
        videoPlayer.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}`;
        videoPlayer.style.display = 'block';
        html5Player.style.display = 'none';
        
        // Загрузка YouTube API если еще не загружен
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        }
        
        // Инициализация YouTube плеера
        window.onYouTubeIframeAPIReady = function() {
            playerInstance = new YT.Player('video-player', {
                events: {
                    'onReady': onPlayerReady,
                    'onStateChange': onPlayerStateChange
                }
            });
        };
    }
    
    // Извлечение ID из YouTube URL
    function extractYouTubeId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }
    
    // Загрузка VK видео
    function loadVKVideo(url) {
        // Для VK используем iframe с плеером
        currentPlayer = 'iframe';
        videoPlayer.src = `https://vk.com/video_ext.php?${extractVKParams(url)}`;
        videoPlayer.style.display = 'block';
        html5Player.style.display = 'none';
    }
    
    // Извлечение параметров из VK URL
    function extractVKParams(url) {
        // Пытаемся извлечь owner_id и video_id
        const matches = url.match(/video(-?\d+_\d+)/);
        if (matches && matches[1]) {
            const [owner, video] = matches[1].split('_');
            return `oid=${owner}&id=${video}&hash=`;
        }
        
        // Альтернативный формат
        const altMatch = url.match(/[?&]z=video(-?\d+_\d+)/);
        if (altMatch && altMatch[1]) {
            const [owner, video] = altMatch[1].split('_');
            return `oid=${owner}&id=${video}&hash=`;
        }
        
        return '';
    }
    
    // Загрузка RuTube видео
    function loadRuTubeVideo(url) {
        const videoId = extractRuTubeId(url);
        if (!videoId) {
            showError('Не удалось распознать RuTube видео');
            return;
        }
        
        currentPlayer = 'iframe';
        videoPlayer.src = `https://rutube.ru/play/embed/${videoId}`;
        videoPlayer.style.display = 'block';
        html5Player.style.display = 'none';
    }
    
    // Извлечение ID из RuTube URL
    function extractRuTubeId(url) {
        const match = url.match(/rutube\.ru\/video\/([a-zA-Z0-9]+)/) || 
                     url.match(/rutube\.ru\/play\/embed\/([a-zA-Z0-9]+)/) ||
                     url.match(/rutube\.ru\/video\/([a-zA-Z0-9]+)\//);
        return match ? match[1] : null;
    }
    
    // Загрузка Vimeo видео
    function loadVimeoVideo(url) {
        const videoId = extractVimeoId(url);
        if (!videoId) {
            showError('Не удалось распознать Vimeo видео');
            return;
        }
        
        currentPlayer = 'iframe';
        videoPlayer.src = `https://player.vimeo.com/video/${videoId}`;
        videoPlayer.style.display = 'block';
        html5Player.style.display = 'none';
    }
    
    // Извлечение ID из Vimeo URL
    function extractVimeoId(url) {
        const match = url.match(/vimeo\.com\/(\d+)/) || 
                     url.match(/vimeo\.com\/video\/(\d+)/);
        return match ? match[1] : null;
    }
    
    // Загрузка прямого видео
    function loadDirectVideo(url) {
        currentPlayer = 'html5';
        videoPlayer.style.display = 'none';
        html5Player.style.display = 'block';
        
        html5Player.src = url;
        html5Player.load();
        
        // Установка обработчиков для HTML5 видео
        html5Player.addEventListener('loadedmetadata', function() {
            videoDuration = html5Player.duration;
            durationEl.textContent = formatTime(videoDuration);
            seekSlider.max = Math.floor(videoDuration);
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
    }
    
    // Проверка URL TikTok
    function isTikTokUrl(url) {
        return url.includes('tiktok.com') || url.includes('tiktokcdn.com');
    }
    
    // Загрузка TikTok видео
    function loadTikTokVideo(url) {
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
    }
    
    // Извлечение ID из TikTok URL
    function extractTikTokId(url) {
        const match = url.match(/\/video\/(\d+)/);
        return match ? match[1] : null;
    }
    
    // Обработчики для YouTube API
    function onPlayerReady(event) {
        videoDuration = playerInstance.getDuration();
        durationEl.textContent = formatTime(videoDuration);
        seekSlider.max = Math.floor(videoDuration);
    }
    
    function onPlayerStateChange(event) {
        switch(event.data) {
            case YT.PlayerState.PLAYING:
                isPlaying = true;
                updatePlayPauseButton();
                updatePlaybackStatus();
                break;
            case YT.PlayerState.PAUSED:
            case YT.PlayerState.ENDED:
                isPlaying = false;
                updatePlayPauseButton();
                updatePlaybackStatus();
                break;
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
        const icon = playPauseBtn.querySelector('i');
        const text = playPauseBtn.querySelector('span');
        
        if (isPlaying) {
            icon.className = 'fas fa-pause';
            playPauseBtn.classList.add('playing');
            playPauseBtn.innerHTML = '<i class="fas fa-pause"></i> Пауза';
        } else {
            icon.className = 'fas fa-play';
            playPauseBtn.classList.remove('playing');
            playPauseBtn.innerHTML = '<i class="fas fa-play"></i> Воспроизвести';
        }
    }
    
    // Обновление статуса воспроизведения
    function updatePlaybackStatus() {
        playbackStatusEl.textContent = isPlaying ? 'Воспроизведение' : 'Остановлено';
        playbackStatusEl.className = isPlaying ? 'stat-value connected' : 'stat-value';
    }
    
    // Обработка команды воспроизведения
    function handlePlayCommand() {
        if (currentPlayer === 'html5') {
            html5Player.play();
        } else if (currentPlayer === 'iframe' && playerInstance) {
            playerInstance.playVideo();
        }
        isPlaying = true;
        updatePlayPauseButton();
        updatePlaybackStatus();
    }
    
    // Обработка команды паузы
    function handlePauseCommand() {
        if (currentPlayer === 'html5') {
            html5Player.pause();
        } else if (currentPlayer === 'iframe' && playerInstance) {
            playerInstance.pauseVideo();
        }
        isPlaying = false;
        updatePlayPauseButton();
        updatePlaybackStatus();
    }
    
    // Обработка команды остановки
    function handleStopCommand() {
        if (currentPlayer === 'html5') {
            html5Player.pause();
            html5Player.currentTime = 0;
        } else if (currentPlayer === 'iframe' && playerInstance) {
            playerInstance.stopVideo();
        }
        isPlaying = false;
        updatePlayPauseButton();
        updatePlaybackStatus();
        currentTimeEl.textContent = '00:00';
        seekSlider.value = 0;
    }
    
    // Обработка перемотки
    function handleSeekCommand(time) {
        if (currentPlayer === 'html5') {
            html5Player.currentTime = time;
        } else if (currentPlayer === 'iframe' && playerInstance) {
            playerInstance.seekTo(time, true);
        }
        currentTimeEl.textContent = formatTime(time);
        seekSlider.value = time;
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
                    setTimeout(() => {
                        loadVideoFromUrl(state.videoUrl);
                        
                        if (currentPlayer === 'html5') {
                            html5Player.currentTime = state.currentTime || 0;
                        }
                        
                        if (state.isPlaying) {
                            setTimeout(() => {
                                handlePlayCommand();
                                isPlaying = true;
                            }, 1000);
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
    
    // Показ ошибок
    function showError(message) {
        alert(message);
        console.error(message);
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
            roomUrlInput.value = window.location.href.split('?')[0] + '?room=' + roomId;
            shareModal.style.display = 'flex';
        });
        
        // Кнопка загрузки видео
        loadVideoBtn.addEventListener('click', function() {
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
            copyLinkBtn.innerHTML = '<i class="fas fa-check"></i> Скопировано!';
            setTimeout(() => {
                copyLinkBtn.innerHTML = '<i class="far fa-copy"></i> Копировать';
            }, 2000);
        });
        
        // Обработка параметров URL
        const urlParams = new URLSearchParams(window.location.search);
        const roomParam = urlParams.get('room');
        if (roomParam) {
            roomId = roomParam;
        }
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
            case 'Escape':
                if (document.fullscreenElement) {
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    }
                }
                break;
        }
    });
});
