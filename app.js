// Moved from index.html <script> block
// All logic will be here for now, will modularize per page after splitting HTML

let mediaRecorder;
let recordedChunks = [];
let stream;
let isRecording = false;
let countdownInterval;
let recordingTimeout;
let recognition;
let transcriptionText = '';
let fillerWordsCount = {};

// Set today's date by default (for add.html)
if (document.getElementById('recordDate')) {
    document.getElementById('recordDate').valueAsDate = new Date();
}

// Filler words detection
const FILLER_WORDS = [
    'um', 'uh', 'er', 'ah', 'like', 'you know', 'so', 'well', 'actually', 
    'basically', 'literally', 'totally', 'really', 'just', 'kind of', 
    'sort of', 'i mean', 'right', 'okay', 'alright', 'yeah', 'yes', 'no',
    'hmm', 'huh', 'oh', 'wow', 'gosh', 'golly', 'darn', 'shoot'
];

function initializeSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        
        recognition.onresult = function(event) {
            let interimTranscript = '';
            let finalTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }
            
            transcriptionText = finalTranscript;
            updateTranscriptionDisplay(interimTranscript, finalTranscript);
        };
        
        recognition.onerror = function(event) {
            console.log('Speech recognition error:', event.error);
        };
    }
}

function startTranscription() {
    if (recognition && !isRecording) {
        transcriptionText = '';
        fillerWordsCount = {};
        recognition.start();
    }
}

function stopTranscription() {
    if (recognition) {
        recognition.stop();
    }
}

function updateTranscriptionDisplay(interim, final) {
    const transcriptionElement = document.getElementById('transcription');
    const transcriptionContainer = document.getElementById('transcription-container');
    
    if (transcriptionElement && transcriptionContainer) {
        transcriptionContainer.style.display = 'block';
        transcriptionElement.innerHTML = `
            <div class="final-transcript">${final}</div>
            <div class="interim-transcript">${interim}</div>
        `;
    }
}

function analyzeFillerWords(text) {
    const words = text.toLowerCase().split(/\s+/);
    const fillerCount = {};
    let totalFillerWords = 0;
    
    FILLER_WORDS.forEach(filler => {
        const regex = new RegExp(`\\b${filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) {
            fillerCount[filler] = matches.length;
            totalFillerWords += matches.length;
        }
    });
    
    return {
        fillerCount,
        totalFillerWords,
        totalWords: words.length,
        fillerPercentage: words.length > 0 ? (totalFillerWords / words.length * 100).toFixed(1) : 0
    };
}

function getFillerWordAnalysis(recordId) {
    const records = JSON.parse(localStorage.getItem('dailyRecords') || '[]');
    const record = records.find(record => record.id === recordId);
    
    if (record && record.transcription) {
        return analyzeFillerWords(record.transcription);
    }
    
    return null;
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

    // Start transcription
    startTranscription();

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

        // Stop transcription
        stopTranscription();

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
        // Analyze filler words from transcription
        const fillerAnalysis = analyzeFillerWords(transcriptionText);
        
        const record = {
            id: Date.now(),
            date: date,
            duration: duration,
            video: reader.result,
            timestamp: new Date().toISOString(),
            transcription: transcriptionText,
            fillerAnalysis: fillerAnalysis
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

        // Update dashboard if on home page
        if (document.getElementById('totalRecords')) {
            updateProgressDashboard();
        }

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
            <div class="record-header">
                <div class="record-date">${formatDate(record.date)}</div>
                <div class="record-duration">Duration: ${record.duration}</div>
                <div class="record-rating">
                    <span class="rating-label">Rating:</span>
                    <div class="star-rating" id="rating-${record.id}">
                        ${generateStarRating(record.rating || 0, record.id)}
                    </div>
                </div>
                ${record.fillerAnalysis ? `
                <div class="filler-analysis">
                    <div class="filler-stats">
                        <span class="filler-count">${record.fillerAnalysis.totalFillerWords} filler words</span>
                        <span class="filler-percentage">(${record.fillerAnalysis.fillerPercentage}%)</span>
                    </div>
                    <div class="filler-breakdown" id="filler-breakdown-${record.id}" style="display: none;">
                        ${generateFillerBreakdown(record.fillerAnalysis.fillerCount)}
                    </div>
                    <button class="btn btn-sm btn-outline-info" onclick="toggleFillerBreakdown(${record.id})">
                        <i class="fa-solid fa-chart-bar"></i> Details
                    </button>
                </div>
                ` : ''}
            </div>
            <div class="video-container">
                <video class="record-video" id="video-${record.id}" controls preload="metadata" poster="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjhmOWZhIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzZjNzU3ZCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIFZpZGVvIFByZXZpZXc8L3RleHQ+PC9zdmc+">
                    <source src="${record.video}" type="video/webm">
                    Your browser does not support the video tag.
                </video>
                <div class="bookmark-indicator" id="bookmark-indicator-${record.id}" style="display: none;">
                    <i class="fa-solid fa-bookmark"></i> Bookmarked at <span id="bookmark-time-${record.id}"></span>
                </div>
            </div>
            <div class="record-notes">
                <textarea class="notes-textarea" id="notes-${record.id}" placeholder="Add your notes about this recording..." onchange="saveNotes(${record.id})">${record.notes || ''}</textarea>
            </div>
            <div class="record-actions">
                <button class="btn btn-primary" onclick="toggleVideoPlayback(${record.id})" id="playBtn-${record.id}">▶️ Play</button>
                <button class="btn btn-secondary" onclick="toggleMute(${record.id})" id="muteBtn-${record.id}">🔇 Mute</button>
                <button class="btn btn-info" onclick="playAudioOnly(${record.id})">🎧 Audio Only</button>
                <button class="btn btn-warning" onclick="addBookmark(${record.id})">🔖 Bookmark</button>
                <button class="btn btn-danger" onclick="deleteRecord(${record.id})">🗑️ Delete</button>
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

function generateStarRating(rating, recordId) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        const filled = i <= rating ? 'fa-solid' : 'fa-regular';
        stars += `<i class="${filled} fa-star star" onclick="setRating(${recordId}, ${i})" data-rating="${i}"></i>`;
    }
    return stars;
}

function setRating(recordId, rating) {
    const records = JSON.parse(localStorage.getItem('dailyRecords') || '[]');
    const recordIndex = records.findIndex(record => record.id === recordId);
    
    if (recordIndex !== -1) {
        records[recordIndex].rating = rating;
        localStorage.setItem('dailyRecords', JSON.stringify(records));
        
        // Update the star display
        const starContainer = document.getElementById(`rating-${recordId}`);
        if (starContainer) {
            starContainer.innerHTML = generateStarRating(rating, recordId);
        }
        
        // Update dashboard if on home page
        if (document.getElementById('totalRecords')) {
            updateProgressDashboard();
        }
    }
}

function saveNotes(recordId) {
    const notesTextarea = document.getElementById(`notes-${recordId}`);
    const notes = notesTextarea.value;
    
    const records = JSON.parse(localStorage.getItem('dailyRecords') || '[]');
    const recordIndex = records.findIndex(record => record.id === recordId);
    
    if (recordIndex !== -1) {
        records[recordIndex].notes = notes;
        localStorage.setItem('dailyRecords', JSON.stringify(records));
    }
}

function addBookmark(recordId) {
    const video = document.getElementById(`video-${recordId}`);
    const currentTime = video.currentTime;
    
    if (currentTime > 0) {
        const records = JSON.parse(localStorage.getItem('dailyRecords') || '[]');
        const recordIndex = records.findIndex(record => record.id === recordId);
        
        if (recordIndex !== -1) {
            records[recordIndex].bookmark = currentTime;
            localStorage.setItem('dailyRecords', JSON.stringify(records));
            
            // Show bookmark indicator
            const indicator = document.getElementById(`bookmark-indicator-${recordId}`);
            const timeSpan = document.getElementById(`bookmark-time-${recordId}`);
            
            if (indicator && timeSpan) {
                const minutes = Math.floor(currentTime / 60);
                const seconds = Math.floor(currentTime % 60);
                timeSpan.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                indicator.style.display = 'block';
            }
        }
    }
}

function jumpToBookmark(recordId) {
    const records = JSON.parse(localStorage.getItem('dailyRecords') || '[]');
    const record = records.find(record => record.id === recordId);
    
    if (record && record.bookmark) {
        const video = document.getElementById(`video-${recordId}`);
        video.currentTime = record.bookmark;
        video.play();
    }
}

function generateFillerBreakdown(fillerCount) {
    const sortedFillers = Object.entries(fillerCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5); // Show top 5 filler words
    
    if (sortedFillers.length === 0) {
        return '<div class="no-fillers">Great job! No filler words detected.</div>';
    }
    
    return sortedFillers.map(([word, count]) => `
        <div class="filler-item">
            <span class="filler-word">"${word}"</span>
            <span class="filler-count">${count}x</span>
        </div>
    `).join('');
}

function toggleFillerBreakdown(recordId) {
    const breakdown = document.getElementById(`filler-breakdown-${recordId}`);
    if (breakdown) {
        breakdown.style.display = breakdown.style.display === 'none' ? 'block' : 'none';
    }
}

function toggleVideoPlayback(recordId) {
    const video = document.getElementById(`video-${recordId}`);
    const playBtn = document.getElementById(`playBtn-${recordId}`);
    
    if (video.paused) {
        video.play();
        playBtn.innerHTML = '⏸️ Pause';
        playBtn.classList.remove('btn-primary');
        playBtn.classList.add('btn-warning');
    } else {
        video.pause();
        playBtn.innerHTML = '▶️ Play';
        playBtn.classList.remove('btn-warning');
        playBtn.classList.add('btn-primary');
    }
}

function toggleMute(recordId) {
    const video = document.getElementById(`video-${recordId}`);
    const muteBtn = document.getElementById(`muteBtn-${recordId}`);
    
    video.muted = !video.muted;
    
    if (video.muted) {
        muteBtn.innerHTML = '🔊 Unmute';
        muteBtn.classList.remove('btn-secondary');
        muteBtn.classList.add('btn-outline-secondary');
    } else {
        muteBtn.innerHTML = '🔇 Mute';
        muteBtn.classList.remove('btn-outline-secondary');
        muteBtn.classList.add('btn-secondary');
    }
}

function playAudioOnly(recordId) {
    const video = document.getElementById(`video-${recordId}`);
    const playBtn = document.getElementById(`playBtn-${recordId}`);
    
    // Hide video visually but keep it playing
    video.style.opacity = '0.1';
    video.style.position = 'absolute';
    video.style.top = '-9999px';
    
    if (video.paused) {
        video.play();
        playBtn.innerHTML = '⏸️ Pause';
        playBtn.classList.remove('btn-primary');
        playBtn.classList.add('btn-warning');
    }
    
    // Show a message that audio is playing
    const audioIndicator = document.createElement('div');
    audioIndicator.className = 'audio-indicator';
    audioIndicator.innerHTML = '🎧 Playing audio only...';
    audioIndicator.style.cssText = 'text-align: center; padding: 10px; background: #e3f2fd; border-radius: 8px; margin: 10px 0; color: #1976d2;';
    
    const videoContainer = video.parentElement;
    if (!videoContainer.querySelector('.audio-indicator')) {
        videoContainer.appendChild(audioIndicator);
    }
    
    // Reset when video ends
    video.addEventListener('ended', () => {
        video.style.opacity = '1';
        video.style.position = 'static';
        video.style.top = 'auto';
        const indicator = videoContainer.querySelector('.audio-indicator');
        if (indicator) indicator.remove();
    });
}

function deleteRecord(recordId) {
    if (confirm('Are you sure you want to delete this record?')) {
        const records = JSON.parse(localStorage.getItem('dailyRecords') || '[]');
        const filteredRecords = records.filter(record => record.id !== recordId);
        localStorage.setItem('dailyRecords', JSON.stringify(filteredRecords));
        loadRecords();
        
        // Update dashboard if on home page
        if (document.getElementById('totalRecords')) {
            updateProgressDashboard();
        }
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

// Progress Dashboard Functions
function updateProgressDashboard() {
    const records = JSON.parse(localStorage.getItem('dailyRecords') || '[]');
    
    // Total Records
    document.getElementById('totalRecords').textContent = records.length;
    
    // Day Streak (now in top left corner)
    const streak = calculateStreak(records);
    document.getElementById('streak').textContent = streak;
    
    // Average Filler Words
    const recordsWithFillerAnalysis = records.filter(record => record.fillerAnalysis);
    const avgFillerWords = recordsWithFillerAnalysis.length > 0
        ? (recordsWithFillerAnalysis.reduce((sum, record) => sum + record.fillerAnalysis.totalFillerWords, 0) / recordsWithFillerAnalysis.length).toFixed(1)
        : '0.0';
    document.getElementById('avgFillerWords').textContent = avgFillerWords;
}

function calculateStreak(records) {
    if (records.length === 0) return 0;
    
    // Sort records by date (newest first)
    const sortedRecords = records.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < sortedRecords.length; i++) {
        const recordDate = new Date(sortedRecords[i].date);
        recordDate.setHours(0, 0, 0, 0);
        
        const daysDiff = Math.floor((currentDate - recordDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === streak) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
        } else if (daysDiff > streak) {
            break;
        }
    }
    
    return streak;
}

document.addEventListener('DOMContentLoaded', function() {
    setupNightToggle();
    setTimeout(setupNightToggle, 200);
    
    // Initialize speech recognition
    initializeSpeechRecognition();
    
    // Update progress dashboard if on home page
    if (document.getElementById('totalRecords')) {
        updateProgressDashboard();
    }
}); 
