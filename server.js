const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Хранение состояния воспроизведения
let playbackState = {
    playing: false,
    currentTime: 0,
    videoUrl: '',
    lastUpdate: Date.now()
};

// Хранение подключенных пользователей
const clients = new Set();

app.use(express.static(path.join(__dirname, 'public')));

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`Новый пользователь подключен. Всего пользователей: ${clients.size}`);

    // Отправляем текущее состояние новому пользователю
    ws.send(JSON.stringify({
        type: 'sync',
        ...playbackState
    }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleMessage(data, ws);
        } catch (error) {
            console.error('Ошибка обработки сообщения:', error);
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
        console.log(`Пользователь отключен. Осталось пользователей: ${clients.size}`);
    });
});

function handleMessage(data, sender) {
    switch (data.type) {
        case 'play':
            playbackState.playing = true;
            playbackState.currentTime = data.currentTime;
            playbackState.lastUpdate = Date.now();
            broadcast(sender, data);
            break;

        case 'pause':
            playbackState.playing = false;
            playbackState.currentTime = data.currentTime;
            playbackState.lastUpdate = Date.now();
            broadcast(sender, data);
            break;

        case 'seek':
            playbackState.currentTime = data.currentTime;
            playbackState.lastUpdate = Date.now();
            broadcast(sender, data);
            break;

        case 'urlChange':
            playbackState.videoUrl = data.videoUrl;
            playbackState.currentTime = 0;
            playbackState.playing = false;
            playbackState.lastUpdate = Date.now();
            broadcast(sender, data);
            break;

        case 'syncRequest':
            // Отправляем текущее состояние запрашивающему пользователю
            sender.send(JSON.stringify({
                type: 'sync',
                ...playbackState
            }));
            break;
    }
}

function broadcast(sender, data) {
    const message = JSON.stringify(data);

    clients.forEach((client) => {
        // Не отправляем сообщение отправителю
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Откройте http://localhost:${PORT} в браузере`);
});