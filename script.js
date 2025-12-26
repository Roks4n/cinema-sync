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
    let ws;
    let isPlaying = false;
    let currentPlayer = null; // 'iframe' или 'html5'
    let isSeeking = false;
    let lastSyncTime = 0;
    let userCount = 1;
    let videoDuration = 600; // 10 минут по умолчанию
    
    // Инициализация WebSocket
    function initWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        ws = new WebSocket(wsUrl);
        
        ws.onopen = function() {
            console.log('WebSocket подключен');
            syncStatusEl.textContent = 'Активна';
            syncStatusEl.className = 'stat-value connected';
            
            // Запрос синхронизации
            ws.send(JSON.stringify({ type: 'syncRequest' }));
        };
        
        ws.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            } catch (error) {
                console.error('Ошибка обработки сообщения WebSocket:', error);
            }
        };
        
        ws.onclose = function() {
            console.log('WebSocket отключен');
            syncStatusEl.textContent = 'Неактивна';
            syncStatusEl.className = 'stat-value disconnected';
            
            // Попытка переподключения через 3 секунды
            setTimeout(initWebSocket, 3000);
        };
        
        ws.onerror = function(error) {
            console.error('WebSocket ошибка:', error);
        };
    }
    
    // Обработка сообщений WebSocket
    function handleWebSocketMessage(data) {
        console.log('Получено сообщение WebSocket:', data.type);
        
        switch (data.type) {
            case 'play':
                handlePlayCommand();
                isPlaying = true;
                updatePlaybackStatus();
                break;
                
            case 'pause':
                handlePauseCommand();
                isPlaying = false;
                updatePlaybackStatus();
                break;
                
            case 'seek':
                handleSeekCommand(data.currentTime || 0);
                break;
                
            case 'urlChange':
                loadVideoFromUrl(data.videoUrl);
                break;
                
            case 'sync':
                // Полная синхронизация состояния
                if (data.videoUrl && data.videoUrl !== videoUrlInput.value) {
                    loadVideoFromUrl(data.videoUrl);
                }
                
                if (data.playing) {
                    handlePlayCommand();
                    isPlaying = true;
                } else {
                    handlePauseCommand();
                    isPlaying = false;
                }
                
                // Синхронизация времени
                setTimeout(() => {
                    handleSeekCommand(data.currentTime || 0);
                }, 1000);
                
                updatePlaybackStatus();
                break;
        }
    }
    
    // Команда воспроизведения
    function handlePlayCommand() {
        if (currentPlayer === 'iframe') {
            // Для iframe YouTube
            if (videoPlayer.src.includes('youtube.com')) {
                videoPlayer.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
            }
            // Для RuTube
            else if (videoPlayer.src.includes('rutube.ru')) {
                // RuTube не поддерживает управление через postMessage
                // Перезагружаем iframe с autoplay
                const src = videoPlayer.src;
                if (!src.includes('autoplay=1')) {
                    videoPlayer.src = src + (src.includes('?') ? '&' : '?') + 'autoplay=1';
                }
            }
            // Для VK
            else if (videoPlayer.src.includes('vk.com') || videoPlayer.src.includes('vkvideo.ru')) {
                // VK не поддерживает управление через postMessage
                // Перезагружаем iframe с autoplay
                const src = videoPlayer.src;
                const separator = src.includes('?') ? '&' : '?';
                videoPlayer.src = src + separator + 'autoplay=1';
            }
            // Для Vimeo
            else if (videoPlayer.src.includes('vimeo.com')) {
                // Vimeo API
                videoPlayer.contentWindow.postMessage('{"method":"play"}', '*');
            }
        } else if (currentPlayer === 'html5') {
            html5Player.play();
        }
    }
    
    // Команда паузы
    function handlePauseCommand() {
        if (currentPlayer === 'iframe') {
            // Для iframe YouTube
            if (videoPlayer.src.includes('youtube.com')) {
                videoPlayer.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
            }
            // Для RuTube и VK - перезагружаем без autoplay
            else if (videoPlayer.src.includes('rutube.ru') || videoPlayer.src.includes('vk.com') || videoPlayer.src.includes('vkvideo.ru')) {
                const src = videoPlayer.src.replace(/[?&]autoplay=1/g, '');
                videoPlayer.src = src;
            }
            // Для Vimeo
            else if (videoPlayer.src.includes('vimeo.com')) {
                videoPlayer.contentWindow.postMessage('{"method":"pause"}', '*');
            }
        } else if (currentPlayer === 'html5') {
            html5Player.pause();
        }
    }
    
    // Команда перемотки
    function handleSeekCommand(time) {
        console.log('Seek команда:', time, 'секунд');
        
        if (currentPlayer === 'iframe') {
            // Для iframe YouTube
            if (videoPlayer.src.includes('youtube.com')) {
                videoPlayer.contentWindow.postMessage(`{"event":"command","func":"seekTo","args":[${time}, true]}`, '*');
            }
            // Для RuTube
            else if (videoPlayer.src.includes('rutube.ru')) {
                const baseUrl = videoPlayer.src.split('#t=')[0].split('?')[0];
                const params = new URLSearchParams(videoPlayer.src.split('?')[1] || '');
                params.set('start', Math.floor(time));
                videoPlayer.src = `${baseUrl}?${params.toString()}`;
            }
            // Для VK
            else if (videoPlayer.src.includes('vk.com') || videoPlayer.src.includes('vkvideo.ru')) {
                const baseUrl = videoPlayer.src.split('?')[0];
                const params = new URLSearchParams(videoPlayer.src.split('?')[1] || '');
                params.set('t', `${Math.floor(time)}s`);
                videoPlayer.src = `${baseUrl}?${params.toString()}`;
            }
            // Для Vimeo
            else if (videoPlayer.src.includes('vimeo.com')) {
                videoPlayer.contentWindow.postMessage(`{"method":"setCurrentTime","value":${time}}`, '*');
            }
        } else if (currentPlayer === 'html5') {
            html5Player.currentTime = time;
        }
        
        // Обновляем UI
        updateTimeDisplay(time);
    }
    
    // Обновление отображения времени
    function updateTimeDisplay(time) {
        currentTimeEl.textContent = formatTime(time);
        if (videoDuration > 0) {
            const progress = (time / videoDuration) * 100;
            seekSlider.value = progress;
        }
    }
    
    // Загрузка видео по URL
    function loadVideoFromUrl(url) {
        if (!url) return;
        
        videoUrlInput.value = url;
        videoPlaceholder.style.display = 'none';
        
        // Проверяем тип URL
        if (isYouTubeUrl(url)) {
            loadYouTubeVideo(url);
        } else if (isRuTubeUrl(url)) {
            loadRuTubeVideo(url);
        } else if (isVKVideoUrl(url)) {
            loadVKVideo(url);
        } else if (isVimeoUrl(url)) {
            loadVimeoVideo(url);
        } else if (isDirectVideoUrl(url)) {
            loadDirectVideo(url);
        } else {
            alert('Неподдерживаемый формат ссылки. Поддерживаются: YouTube, RuTube, VK Видео, Vimeo, прямые ссылки на видео');
            return;
        }
        
        // Отправляем изменение URL всем пользователям
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'urlChange',
                videoUrl: url
            }));
        }
        
        // Активируем элементы управления
        playPauseBtn.disabled = false;
        stopBtn.disabled = false;
        seekSlider.disabled = false;
        
        updatePlaybackStatus();
    }
    
    // Проверка URL YouTube
    function isYouTubeUrl(url) {
        return url.includes('youtube.com') || url.includes('youtu.be');
    }
    
    // Проверка URL RuTube
    function isRuTubeUrl(url) {
        return url.includes('rutube.ru');
    }
    
    // Проверка URL VK Видео
    function isVKVideoUrl(url) {
        return url.includes('vk.com/video') || 
               url.includes('vk.com/videos') || 
               url.includes('vkvideo.ru');
    }
    
    // Проверка URL Vimeo
    function isVimeoUrl(url) {
        return url.includes('vimeo.com');
    }
    
    // Проверка прямой ссылки на видео
    function isDirectVideoUrl(url) {
        return url.match(/\.(mp4|webm|ogg|mov|avi|mkv|flv|wmv|m4v|mpg|mpeg|3gp)$/i) || 
               url.startsWith('blob:') || 
               url.startsWith('data:video/');
    }
    
    // Загрузка YouTube видео
    function loadYouTubeVideo(url) {
        currentPlayer = 'iframe';
        videoPlayer.src = formatYouTubeUrl(url);
        videoPlayer.style.display = 'block';
        html5Player.style.display = 'none';
        
        // Сброс состояния
        videoDuration = 600;
        durationEl.textContent = formatTime(videoDuration);
        currentTimeEl.textContent = '00:00';
        seekSlider.value = 0;
        
        // Добавляем обработчик загрузки YouTube iframe
        videoPlayer.onload = function() {
            if (videoPlayer.src.includes('youtube.com')) {
                setTimeout(() => {
                    videoPlayer.contentWindow.postMessage('{"event":"listening","id":1}', '*');
                }, 1000);
            }
        };
    }
    
    // Загрузка RuTube видео
    function loadRuTubeVideo(url) {
        currentPlayer = 'iframe';
        videoPlayer.src = formatRuTubeUrl(url);
        videoPlayer.style.display = 'block';
        html5Player.style.display = 'none';
        
        // Сброс состояния
        videoDuration = 600;
        durationEl.textContent = formatTime(videoDuration);
        currentTimeEl.textContent = '00:00';
        seekSlider.value = 0;
    }
    
    // Загрузка VK видео
    function loadVKVideo(url) {
        currentPlayer = 'iframe';
        const vkUrl = formatVKVideoUrl(url);
        console.log('Загрузка VK видео:', vkUrl);
        videoPlayer.src = vkUrl;
        videoPlayer.style.display = 'block';
        html5Player.style.display = 'none';
        
        // Сброс состояния
        videoDuration = 600;
        durationEl.textContent = formatTime(videoDuration);
        currentTimeEl.textContent = '00:00';
        seekSlider.value = 0;
        
        // Обработчик загрузки VK iframe
        videoPlayer.onload = function() {
            console.log('VK iframe загружен');
        };
    }
    
    // Загрузка Vimeo видео
    function loadVimeoVideo(url) {
        currentPlayer = 'iframe';
        videoPlayer.src = formatVimeoUrl(url);
        videoPlayer.style.display = 'block';
        html5Player.style.display = 'none';
        
        // Сброс состояния
        videoDuration = 600;
        durationEl.textContent = formatTime(videoDuration);
        currentTimeEl.textContent = '00:00';
        seekSlider.value = 0;
    }
    
    // Загрузка прямого видео
    function loadDirectVideo(url) {
        currentPlayer = 'html5';
        html5Player.src = url;
        videoPlayer.style.display = 'none';
        html5Player.style.display = 'block';
        setupHTML5PlayerEvents();
        
        // Сброс состояния
        currentTimeEl.textContent = '00:00';
        seekSlider.value = 0;
    }
    
    // Форматирование URL YouTube
    function formatYouTubeUrl(url) {
        let videoId = '';
        
        if (url.includes('youtube.com/embed/')) {
            return url.split('?')[0] + '?enablejsapi=1&origin=' + window.location.origin;
        } else if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1].split('?')[0];
        } else if (url.includes('youtube.com/watch?v=')) {
            videoId = url.split('v=')[1].split('&')[0];
        } else if (url.includes('youtube.com/shorts/')) {
            videoId = url.split('shorts/')[1].split('?')[0];
        }
        
        return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}&rel=0&modestbranding=1`;
    }
    
    // Форматирование URL RuTube
    function formatRuTubeUrl(url) {
        let videoId = '';
        
        // Разные форматы RuTube ссылок
        if (url.includes('rutube.ru/video/embed/')) {
            return url;
        } else if (url.includes('rutube.ru/video/')) {
            videoId = url.split('rutube.ru/video/')[1].split('/')[0];
        } else if (url.includes('rutube.ru/play/embed/')) {
            videoId = url.split('rutube.ru/play/embed/')[1].split('/')[0];
        } else if (url.includes('rutube.ru/play/')) {
            videoId = url.split('rutube.ru/play/')[1].split('/')[0];
        }
        
        if (videoId) {
            return `https://rutube.ru/video/embed/${videoId}/?sTitle=false&sAuthor=false`;
        }
        
        return url;
    }
    
    // Форматирование URL VK Видео
    function formatVKVideoUrl(url) {
        console.log('Форматирование VK URL:', url);
        
        // Извлекаем owner_id и video_id из URL VK
        let ownerId = '';
        let videoId = '';
        let hash = Date.now(); // Для предотвращения кэширования
        
        // Пытаемся извлечь из различных форматов
        
        // Формат 1: video-ownerId_videoId (самый распространенный)
        const match1 = url.match(/video-(\d+)_(\d+)/);
        
        // Формат 2: videos-ownerId?z=video-ownerId_videoId
        const match2 = url.match(/videos-(\d+).*video-(\d+)_(\d+)/);
        
        // Формат 3: vkvideo.ru/.../video-ownerId_videoId
        const match3 = url.match(/vkvideo\.ru\/.*\/video-(\d+)_(\d+)/);
        
        // Формат 4: vkvideo.ru/playlist/-ownerId_playlistId/video-ownerId_videoId
        const match4 = url.match(/vkvideo\.ru\/playlist\/-(\d+)_\d+\/video-(\d+)_(\d+)/);
        
        // Формат 5: vk.com/video-ownerId_videoId?list=...
        const match5 = url.match(/vk\.com\/video-(\d+)_(\d+)/);
        
        if (match1) {
            ownerId = match1[1];
            videoId = match1[2];
            console.log('Формат 1 найден:', ownerId, videoId);
        } else if (match2) {
            ownerId = match2[2];
            videoId = match2[3];
            console.log('Формат 2 найден:', ownerId, videoId);
        } else if (match3) {
            ownerId = match3[1];
            videoId = match3[2];
            console.log('Формат 3 найден:', ownerId, videoId);
        } else if (match4) {
            ownerId = match4[2];
            videoId = match4[3];
            console.log('Формат 4 найден:', ownerId, videoId);
        } else if (match5) {
            ownerId = match5[1];
            videoId = match5[2];
            console.log('Формат 5 найден:', ownerId, videoId);
        }
        
        if (ownerId && videoId) {
            // VK embed URL формат
            const embedUrl = `https://vk.com/video_ext.php?oid=${ownerId}&id=${videoId}&hash=${hash}`;
            console.log('Сформирован embed URL:', embedUrl);
            return embedUrl;
        }
        
        // Если не удалось распарсить, пробуем извлечь другим способом
        console.log('Попытка альтернативного парсинга...');
        
        // Ищем любые цифры, разделенные подчеркиванием после "video-"
        const videoMatch = url.match(/video-([^?&\s]+)/);
        if (videoMatch) {
            const parts = videoMatch[1].split('_');
            if (parts.length >= 2) {
                ownerId = parts[0];
                videoId = parts[1];
                const embedUrl = `https://vk.com/video_ext.php?oid=${ownerId}&id=${videoId}&hash=${hash}`;
                console.log('Альтернативный парсинг удался:', embedUrl);
                return embedUrl;
            }
        }
        
        // Если все попытки не удались, пытаемся создать iframe с оригинальным URL
        console.log('Все попытки парсинга не удались, используем оригинальный URL');
        return url;
    }
    
    // Форматирование URL Vimeo
    function formatVimeoUrl(url) {
        let videoId = '';
        
        if (url.includes('vimeo.com/')) {
            videoId = url.split('vimeo.com/')[1].split('?')[0];
        }
        
        return `https://player.vimeo.com/video/${videoId}`;
    }
    
    // Настройка событий для HTML5 видео
    function setupHTML5PlayerEvents() {
        html5Player.addEventListener('timeupdate', function() {
            if (!isSeeking) {
                const progress = (html5Player.currentTime / html5Player.duration) * 100;
                seekSlider.value = progress || 0;
                
                currentTimeEl.textContent = formatTime(html5Player.currentTime);
                durationEl.textContent = formatTime(html5Player.duration);
                videoDuration = html5Player.duration;
            }
        });
        
        html5Player.addEventListener('loadedmetadata', function() {
            durationEl.textContent = formatTime(html5Player.duration);
            videoDuration = html5Player.duration;
            console.log('Длительность видео:', videoDuration, 'секунд');
        });
        
        html5Player.addEventListener('play', function() {
            isPlaying = true;
            updatePlaybackStatus();
            sendPlaybackState();
        });
        
        html5Player.addEventListener('pause', function() {
            isPlaying = false;
            updatePlaybackStatus();
            sendPlaybackState();
        });
        
        html5Player.addEventListener('seeked', function() {
            sendPlaybackState();
        });
        
        html5Player.addEventListener('volumechange', function() {
            // Сохраняем громкость в localStorage
            localStorage.setItem('videoVolume', html5Player.volume);
            localStorage.setItem('videoMuted', html5Player.muted);
        });
        
        // Восстанавливаем громкость
        const savedVolume = localStorage.getItem('videoVolume');
        const savedMuted = localStorage.getItem('videoMuted');
        if (savedVolume !== null) {
            html5Player.volume = parseFloat(savedVolume);
        }
        if (savedMuted !== null) {
            html5Player.muted = savedMuted === 'true';
        }
    }
    
    // Отправка состояния воспроизведения
    function sendPlaybackState() {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        
        let currentTime = 0;
        
        if (currentPlayer === 'html5') {
            currentTime = html5Player.currentTime;
        } else {
            // Для iframe используем примерное время на основе положения слайдера
            currentTime = (seekSlider.value / 100) * videoDuration;
        }
        
        const message = {
            type: isPlaying ? 'play' : 'pause',
            currentTime: currentTime
        };
        
        console.log('Отправка состояния:', message);
        ws.send(JSON.stringify(message));
    }
    
    // Отправка команды перемотки
    function sendSeekCommand(time) {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        
        console.log('Отправка команды перемотки:', time);
        ws.send(JSON.stringify({
            type: 'seek',
            currentTime: time
        }));
    }
    
    // Обновление статуса воспроизведения
    function updatePlaybackStatus() {
        if (isPlaying) {
            playbackStatusEl.textContent = 'Воспроизведение';
            playPauseBtn.innerHTML = '<i class="fas fa-pause"></i> Пауза';
            playPauseBtn.classList.add('playing');
        } else {
            playbackStatusEl.textContent = 'Остановлено';
            playPauseBtn.innerHTML = '<i class="fas fa-play"></i> Воспроизвести';
            playPauseBtn.classList.remove('playing');
        }
    }
    
    // Форматирование времени (секунды -> MM:SS или HH:MM:SS)
    function formatTime(seconds) {
        if (isNaN(seconds) || seconds === 0) return '00:00';
        
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }
    
    // Обработчики событий
    loadVideoBtn.addEventListener('click', function() {
        const url = videoUrlInput.value.trim();
        if (url) {
            loadVideoFromUrl(url);
        } else {
            alert('Пожалуйста, введите ссылку на видео');
        }
    });
    
    videoUrlInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            loadVideoBtn.click();
        }
    });
    
    // Примеры ссылок для быстрой загрузки
    function setupExampleLinks() {
        // Добавляем примеры ссылок под полем ввода
        const examplesContainer = document.createElement('div');
        examplesContainer.className = 'examples-container';
        examplesContainer.innerHTML = `
            <p style="margin-top: 10px; font-size: 0.9rem; color: #888;">
                Примеры: 
                <a href="#" class="example-link" data-url="https://www.youtube.com/embed/dQw4w9WgXcQ">YouTube</a> • 
                <a href="#" class="example-link" data-url="https://rutube.ru/video/cb5bea92b3b9c7ac9fdde8b7a87a5a52/">RuTube</a> • 
                <a href="#" class="example-link" data-url="https://vkvideo.ru/playlist/-220754053_84/video-220754053_456244901?linked=1">VK Video</a>
            </p>
        `;
        
        videoUrlInput.parentNode.appendChild(examplesContainer);
        
        // Обработчики для примеров ссылок
        document.querySelectorAll('.example-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const url = this.getAttribute('data-url');
                videoUrlInput.value = url;
                loadVideoFromUrl(url);
            });
        });
    }
    
    playPauseBtn.addEventListener('click', function() {
        if (!currentPlayer) return;
        
        if (isPlaying) {
            // Пауза
            handlePauseCommand();
            
            if (ws && ws.readyState === WebSocket.OPEN) {
                let currentTime = 0;
                if (currentPlayer === 'html5') {
                    currentTime = html5Player.currentTime;
                } else {
                    currentTime = (seekSlider.value / 100) * videoDuration;
                }
                
                ws.send(JSON.stringify({
                    type: 'pause',
                    currentTime: currentTime
                }));
            }
        } else {
            // Воспроизведение
            handlePlayCommand();
            
            if (ws && ws.readyState === WebSocket.OPEN) {
                let currentTime = 0;
                if (currentPlayer === 'html5') {
                    currentTime = html5Player.currentTime;
                } else {
                    currentTime = (seekSlider.value / 100) * videoDuration;
                }
                
                ws.send(JSON.stringify({
                    type: 'play',
                    currentTime: currentTime
                }));
            }
        }
        
        isPlaying = !isPlaying;
        updatePlaybackStatus();
    });
    
    stopBtn.addEventListener('click', function() {
        if (!currentPlayer) return;
        
        if (currentPlayer === 'iframe') {
            // Для YouTube
            if (videoPlayer.src.includes('youtube.com')) {
                videoPlayer.contentWindow.postMessage('{"event":"command","func":"stopVideo","args":""}', '*');
            }
            // Для других - перезагружаем iframe
            else {
                const src = videoPlayer.src;
                videoPlayer.src = src;
            }
        } else if (currentPlayer === 'html5') {
            html5Player.pause();
            html5Player.currentTime = 0;
        }
        
        isPlaying = false;
        updatePlaybackStatus();
        updateTimeDisplay(0);
        
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'pause',
                currentTime: 0
            }));
        }
    });
    
    seekSlider.addEventListener('input', function() {
        isSeeking = true;
        
        if (currentPlayer === 'html5' && html5Player.duration) {
            const time = (seekSlider.value / 100) * html5Player.duration;
            currentTimeEl.textContent = formatTime(time);
        } else {
            const time = (seekSlider.value / 100) * videoDuration;
            currentTimeEl.textContent = formatTime(time);
        }
    });
    
    seekSlider.addEventListener('change', function() {
        isSeeking = false;
        
        if (!currentPlayer) return;
        
        const time = (seekSlider.value / 100) * videoDuration;
        
        // Выполняем перемотку
        handleSeekCommand(time);
        
        // Отправляем команду перемотки на сервер
        sendSeekCommand(time);
    });
    
    // Быстрые кнопки перемотки
    function setupSkipButtons() {
        const skipContainer = document.createElement('div');
        skipContainer.className = 'skip-buttons';
        skipContainer.style.marginTop = '10px';
        skipContainer.style.display = 'flex';
        skipContainer.style.gap = '5px';
        skipContainer.style.justifyContent = 'center';
        
        skipContainer.innerHTML = `
            <button class="skip-btn" data-seconds="-10">← 10с</button>
            <button class="skip-btn" data-seconds="-30">← 30с</button>
            <button class="skip-btn" data-seconds="30">30с →</button>
            <button class="skip-btn" data-seconds="60">60с →</button>
        `;
        
        // Добавляем после слайдера
        seekSlider.parentNode.insertBefore(skipContainer, seekSlider.nextSibling);
        
        // Обработчики для кнопок перемотки
        skipContainer.querySelectorAll('.skip-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const seconds = parseInt(this.getAttribute('data-seconds'));
                let newTime = 0;
                
                if (currentPlayer === 'html5') {
                    newTime = html5Player.currentTime + seconds;
                    if (newTime < 0) newTime = 0;
                    if (newTime > html5Player.duration) newTime = html5Player.duration;
                    html5Player.currentTime = newTime;
                } else {
                    // Для iframe
                    const currentProgress = seekSlider.value / 100;
                    newTime = (currentProgress * videoDuration) + seconds;
                    if (newTime < 0) newTime = 0;
                    if (newTime > videoDuration) newTime = videoDuration;
                    
                    const newProgress = (newTime / videoDuration) * 100;
                    seekSlider.value = newProgress;
                    currentTimeEl.textContent = formatTime(newTime);
                    
                    handleSeekCommand(newTime);
                }
                
                // Отправляем команду перемотки
                sendSeekCommand(newTime);
            });
        });
    }
    
    fullscreenBtn.addEventListener('click', function() {
        const playerContainer = document.getElementById('player-container');
        
        if (!document.fullscreenElement) {
            if (playerContainer.requestFullscreen) {
                playerContainer.requestFullscreen();
            } else if (playerContainer.webkitRequestFullscreen) {
                playerContainer.webkitRequestFullscreen();
            } else if (playerContainer.msRequestFullscreen) {
                playerContainer.msRequestFullscreen();
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
    
    shareBtn.addEventListener('click', function() {
        roomUrlInput.value = window.location.href;
        shareModal.style.display = 'flex';
    });
    
    closeModal.addEventListener('click', function() {
        shareModal.style.display = 'none';
    });
    
    copyLinkBtn.addEventListener('click', function() {
        roomUrlInput.select();
        roomUrlInput.setSelectionRange(0, 99999);
        
        try {
            navigator.clipboard.writeText(roomUrlInput.value).then(() => {
                const originalText = copyLinkBtn.innerHTML;
                copyLinkBtn.innerHTML = '<i class="fas fa-check"></i> Скопировано!';
                
                setTimeout(() => {
                    copyLinkBtn.innerHTML = originalText;
                }, 2000);
            });
        } catch (err) {
            document.execCommand('copy');
            const originalText = copyLinkBtn.innerHTML;
            copyLinkBtn.innerHTML = '<i class="fas fa-check"></i> Скопировано!';
            
            setTimeout(() => {
                copyLinkBtn.innerHTML = originalText;
            }, 2000);
        }
    });
    
    // Закрытие модального окна при клике вне его
    window.addEventListener('click', function(event) {
        if (event.target === shareModal) {
            shareModal.style.display = 'none';
        }
    });
    
    // Обновление счетчика пользователей
    function updateUserCount() {
        // В реальном приложении это значение должно приходить с сервера
        // Здесь используем случайное число для демонстрации
        userCount = Math.max(1, Math.floor(Math.random() * 8));
        userCountEl.textContent = userCount;
    }
    
    // Инициализация
    initWebSocket();
    setupExampleLinks();
    setupSkipButtons();
    
    // Установка примера URL
    videoUrlInput.placeholder = "Вставьте ссылку YouTube, RuTube, VK Video или Vimeo";
    videoUrlInput.value = 'https://vkvideo.ru/playlist/-220754053_84/video-220754053_456244901?linked=1';
    
    // Автоматическая загрузка примера при загрузке страницы
    setTimeout(() => {
        if (videoUrlInput.value && !currentPlayer) {
            loadVideoFromUrl(videoUrlInput.value);
        }
    }, 1000);
    
    // Обновляем счетчик пользователей каждые 10 секунд
    setInterval(updateUserCount, 10000);
    updateUserCount();
    
    // Обработка сообщений от iframe (для YouTube API)
    window.addEventListener('message', function(event) {
        // Обработка сообщений от YouTube iframe
        try {
            const data = JSON.parse(event.data);
            if (data.event === 'infoDelivery' && data.info) {
                // Получили информацию от YouTube
                if (data.info.currentTime !== undefined) {
                    const progress = (data.info.currentTime / data.info.duration) * 100;
                    seekSlider.value = progress || 0;
                    
                    currentTimeEl.textContent = formatTime(data.info.currentTime);
                    durationEl.textContent = formatTime(data.info.duration);
                    videoDuration = data.info.duration;
                }
            }
        } catch (e) {
            // Не JSON сообщение, игнорируем
        }
    });
    
    // Обработка клавиатурных сочетаний
    document.addEventListener('keydown', function(e) {
        // Пропускаем, если фокус в поле ввода
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        switch(e.key) {
            case ' ':
            case 'Spacebar':
                e.preventDefault();
                playPauseBtn.click();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (e.shiftKey) {
                    // Shift + стрелка влево = -60 секунд
                    simulateSkipClick(-60);
                } else if (e.ctrlKey) {
                    // Ctrl + стрелка влево = -10 секунд
                    simulateSkipClick(-10);
                } else {
                    // Стрелка влево = -5 секунд
                    simulateSkipClick(-5);
                }
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (e.shiftKey) {
                    // Shift + стрелка вправо = +60 секунд
                    simulateSkipClick(60);
                } else if (e.ctrlKey) {
                    // Ctrl + стрелка вправо = +10 секунд
                    simulateSkipClick(10);
                } else {
                    // Стрелка вправо = +5 секунд
                    simulateSkipClick(5);
                }
                break;
            case 'f':
            case 'F':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    fullscreenBtn.click();
                }
                break;
            case '0':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    // Ctrl+0 - перемотка в начало
                    seekSlider.value = 0;
                    seekSlider.dispatchEvent(new Event('change'));
                }
                break;
        }
    });
    
    function simulateSkipClick(seconds) {
        const skipBtn = document.querySelector(`.skip-btn[data-seconds="${seconds}"]`);
        if (skipBtn) {
            skipBtn.click();
        } else {
            // Если кнопки нет, выполняем перемотку программно
            let newTime = 0;
            
            if (currentPlayer === 'html5') {
                newTime = html5Player.currentTime + seconds;
                if (newTime < 0) newTime = 0;
                if (newTime > html5Player.duration) newTime = html5Player.duration;
                html5Player.currentTime = newTime;
            } else {
                const currentProgress = seekSlider.value / 100;
                newTime = (currentProgress * videoDuration) + seconds;
                if (newTime < 0) newTime = 0;
                if (newTime > videoDuration) newTime = videoDuration;
                
                const newProgress = (newTime / videoDuration) * 100;
                seekSlider.value = newProgress;
                currentTimeEl.textContent = formatTime(newTime);
                
                handleSeekCommand(newTime);
            }
            
            sendSeekCommand(newTime);
        }
    }
    
    // Добавляем стили для кнопок перемотки
    const style = document.createElement('style');
    style.textContent = `
        .skip-btn {
            padding: 5px 10px;
            background-color: rgba(78, 205, 196, 0.2);
            color: #4ecdc4;
            border: 1px solid #4ecdc4;
            border-radius: 5px;
            cursor: pointer;
            font-size: 0.8rem;
            transition: all 0.3s;
        }
        .skip-btn:hover {
            background-color: rgba(78, 205, 196, 0.4);
        }
        .example-link {
            color: #4ecdc4;
            text-decoration: none;
            border-bottom: 1px dashed #4ecdc4;
            cursor: pointer;
        }
        .example-link:hover {
            color: #ff6b6b;
            border-bottom-color: #ff6b6b;
        }
        .playing {
            background-color: #ff6b6b !important;
        }
        .playing:hover {
            background-color: #ff5252 !important;
        }
    `;
    document.head.appendChild(style);
});