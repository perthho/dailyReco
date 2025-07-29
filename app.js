// Moved from index.html <script> block
// All logic will be here for now, will modularize per page after splitting HTML

let mediaRecorder;
let recordedChunks = [];
let stream;
let isRecording = false;
let countdownInterval;
let recordingTimeout;

// Set today's date by default (for add.html)
if (document.getElementById('recordDate')) {
    document.getElementById('recordDate').valueAsDate = new Date();
}

// Navigation (not needed with separate pages, but keep for reference)
function navigateTo(page) {
    // No-op in multi-page version
}

// Camera setup (for record.html)
async function setupCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: true
        });
        document.getElementById('preview').srcObject = stream;
        document.getElementById('preview').style.display = 'block';
        document.getElementById('status').textContent = 'Camera ready';
        document.getElementById('status').className = 'recording-status ready';
    } catch (err) {
        console.error('Error accessing camera:', err);
        document.getElementById('status').textContent = 'Camera access denied';
        document.getElementById('status').className = 'recording-status';
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    if (document.getElementById('preview')) {
        document.getElementById('preview').style.display = 'none';
    }
}

// Recording functionality (for record.html)
function toggleRecording() {
    if (!isRecording) {
        startRecording();
    } else {
        stopRecording();
    }
}

function startRecording() {
    if (!stream) {
        alert('Camera not available');
        return;
    }

    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = saveRecording;

    // Get duration from storage (set in add.html)
    let duration = parseInt(localStorage.getItem('recordDuration') || '180');

    mediaRecorder.start();
    isRecording = true;

    document.getElementById('startBtn').textContent = '⏹️ Stop Recording';
    document.getElementById('startBtn').classList.add('danger');
    document.getElementById('status').textContent = 'Recording...';
    document.getElementById('status').className = 'recording-status recording';

    startCountdown(duration);

    // Auto-stop after selected duration
    recordingTimeout = setTimeout(() => {
        if (isRecording) {
            stopRecording();
        }
    }, duration * 1000);
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;

        document.getElementById('startBtn').textContent = '🎥 Start Recording';
        document.getElementById('startBtn').classList.remove('danger');
        document.getElementById('status').textContent = 'Processing...';
        document.getElementById('status').className = 'recording-status';

        clearInterval(countdownInterval);
        clearTimeout(recordingTimeout);
        document.getElementById('countdown').style.display = 'none';
    }
}

function startCountdown(duration) {
    let timeLeft = duration;
    const countdownEl = document.getElementById('countdown');
    countdownEl.style.display = 'flex';

    function updateCountdown() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        countdownEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        if (timeLeft <= 0) {
            clearInterval(countdownInterval);
            countdownEl.style.display = 'none';
        } else {
            timeLeft--;
        }
    }

    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
}

function saveRecording() {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const date = localStorage.getItem('recordDate') || new Date().toISOString().slice(0,10);
    const duration = localStorage.getItem('recordDurationText') || '3 Minutes';

    // Convert blob to base64 for storage
    const reader = new FileReader();
    reader.onloadend = function() {
        const record = {
            id: Date.now(),
            date: date,
            duration: duration,
            video: reader.result,
            timestamp: new Date().toISOString()
        };

        // Get existing records
        const records = JSON.parse(localStorage.getItem('dailyRecords') || '[]');
        records.unshift(record);

        // Keep only last 50 records to prevent storage issues
        if (records.length > 50) {
            records.splice(50);
        }

        localStorage.setItem('dailyRecords', JSON.stringify(records));

        document.getElementById('status').textContent = 'Recording saved!';
        document.getElementById('status').className = 'recording-status ready';

        setTimeout(() => {
            window.location.href = 'records.html';
        }, 1500);
    };
    reader.readAsDataURL(blob);
}

// Load and display records (for records.html)
function loadRecords() {
    const records = JSON.parse(localStorage.getItem('dailyRecords') || '[]');
    const recordsList = document.getElementById('recordsList');

    if (!recordsList) return;

    if (records.length === 0) {
        recordsList.innerHTML = '<div class="no-records">No records found. Create your first recording!</div>';
        return;
    }

    recordsList.innerHTML = records.map(record => `
        <div class="record-card">
            <div class="record-date">${formatDate(record.date)}</div>
            <div class="record-duration">Duration: ${record.duration}</div>
            <video class="record-video" id="video-${record.id}" controls style="display: none;">
                <source src="${record.video}" type="video/webm">
            </video>
            <div class="record-actions">
                <button class="btn" onclick="playVideo(${record.id})">▶️ Play</button>
                <button class="btn secondary" onclick="toggleMute(${record.id})">🔇 Mute</button>
                <button class="btn" onclick="playAudio(${record.id})">🎧 Audio</button>
                <button class="btn danger" onclick="deleteRecord(${record.id})">🗑️ Delete</button>
            </div>
        </div>
    `).join('');
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function playVideo(recordId) {
    const video = document.getElementById(`video-${recordId}`);
    if (video.style.display === 'none') {
        video.style.display = 'block';
        video.play();
    } else {
        video.style.display = 'none';
        video.pause();
    }
}

function toggleMute(recordId) {
    const video = document.getElementById(`video-${recordId}`);
    video.muted = !video.muted;
}

function playAudio(recordId) {
    const video = document.getElementById(`video-${recordId}`);
    video.style.display = 'block';
    video.style.width = '100px';
    video.style.height = '50px';
    video.play();
}

function deleteRecord(recordId) {
    if (confirm('Are you sure you want to delete this record?')) {
        const records = JSON.parse(localStorage.getItem('dailyRecords') || '[]');
        const filteredRecords = records.filter(record => record.id !== recordId);
        localStorage.setItem('dailyRecords', JSON.stringify(filteredRecords));
        loadRecords();
    }
}

// PWA Installation
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Show install button
    const installBtn = document.createElement('button');
    installBtn.textContent = '📱 Install App';
    installBtn.className = 'btn secondary';
    installBtn.onclick = () => {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            }
            deferredPrompt = null;
            installBtn.remove();
        });
    };

    if (document.getElementById('home')) {
        document.getElementById('home').appendChild(installBtn);
    }
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        const swCode = `
            const CACHE_NAME = 'daily-record-v1';
            const urlsToCache = ['/'];

            self.addEventListener('install', (event) => {
                event.waitUntil(
                    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
                );
            });

            self.addEventListener('fetch', (event) => {
                event.respondWith(
                    caches.match(event.request).then((response) => {
                        return response || fetch(event.request);
                    })
                );
            });
        `;

        const blob = new Blob([swCode], { type: 'application/javascript' });
        const swUrl = URL.createObjectURL(blob);

        navigator.serviceWorker.register(swUrl)
            .then((registration) => console.log('SW registered'))
            .catch((error) => console.log('SW registration failed'));
    });
}

// Night mode toggle logic
function setNightMode(enabled) {
    document.body.classList.toggle('night-mode', enabled);
    const icon = document.querySelector('#nightModeToggle i');
    const toggleBtn = document.getElementById('nightModeToggle');
    if (toggleBtn && icon) {
        if (enabled) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
            toggleBtn.classList.add('toggled');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
            toggleBtn.classList.remove('toggled');
        }
    }
}

function setupNightToggle() {
    const toggle = document.getElementById('nightModeToggle');
    if (toggle) {
        // Set initial state from localStorage, default to night mode
        let night = localStorage.getItem('nightMode');
        if (night === null) {
            night = 'true';
            localStorage.setItem('nightMode', 'true');
        }
        const isNight = night === 'true';
        setNightMode(isNight);
        toggle.onclick = function() {
            const enabled = !document.body.classList.contains('night-mode');
            setNightMode(enabled);
            localStorage.setItem('nightMode', enabled);
        };
    }
}

document.addEventListener('DOMContentLoaded', function() {
    setupNightToggle();
    setTimeout(setupNightToggle, 200);
}); 