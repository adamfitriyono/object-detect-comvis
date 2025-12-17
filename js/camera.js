/**
 * CAMERA.JS - Camera Handler
 * File ini menghandle akses kamera dan capture frame
 */

// Global variables
let videoStream = null;
let isCameraActive = false;

// Fungsi untuk start camera
async function startCamera() {
    try {
        const videoElement = document.getElementById('videoElement');
        
        // Cek apakah browser support getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showAlert('Browser Anda tidak mendukung akses kamera.', 'error');
            return false;
        }
        
        showLoading(true);
        showAlert('Mengakses kamera...', 'info');
        
        // Request akses kamera
        // facingMode: 'environment' = kamera belakang (untuk mobile)
        // facingMode: 'user' = kamera depan
        const constraints = {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'environment' // Gunakan kamera belakang jika ada
            }
        };
        
        videoStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Set video source ke stream
        videoElement.srcObject = videoStream;
        
        // Tunggu video ready
        await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                videoElement.play();
                resolve();
            };
        });
        
        isCameraActive = true;
        showLoading(false);
        showAlert('Kamera berhasil diaktifkan!', 'success');
        
        // Update button states
        updateCameraButtons(true);
        
        return true;
    } catch (error) {
        showLoading(false);
        console.error('Camera error:', error);
        
        let message = 'Gagal mengakses kamera. ';
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            message += 'Anda menolak permintaan akses kamera. Silakan berikan izin di pengaturan browser.';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            message += 'Kamera tidak ditemukan di perangkat Anda.';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            message += 'Kamera sedang digunakan oleh aplikasi lain.';
        } else {
            message += error.message;
        }
        
        showAlert(message, 'error');
        return false;
    }
}

// Fungsi untuk stop camera
function stopCamera() {
    const videoElement = document.getElementById('videoElement');
    
    if (videoStream) {
        // Stop all tracks
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    
    // Clear video element
    if (videoElement) {
        videoElement.srcObject = null;
    }
    
    isCameraActive = false;
    
    // Update button states
    updateCameraButtons(false);
    
    showAlert('Kamera dihentikan.', 'info');
}

// Fungsi untuk capture frame dari video
function captureFrame() {
    if (!isCameraActive) {
        showAlert('Kamera belum diaktifkan!', 'error');
        return null;
    }
    
    const videoElement = document.getElementById('videoElement');
    const canvas = document.getElementById('videoCanvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size sesuai video
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    
    // Draw video frame ke canvas
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    return canvas;
}

// Fungsi untuk update button states
function updateCameraButtons(cameraActive) {
    const startBtn = document.getElementById('startCameraBtn');
    const stopBtn = document.getElementById('stopCameraBtn');
    const captureBtn = document.getElementById('captureBtn');
    
    if (cameraActive) {
        startBtn.disabled = true;
        stopBtn.disabled = false;
        captureBtn.disabled = false;
    } else {
        startBtn.disabled = false;
        stopBtn.disabled = true;
        captureBtn.disabled = true;
    }
}

// Setup event listeners untuk camera section
function setupCameraListeners() {
    const startBtn = document.getElementById('startCameraBtn');
    const stopBtn = document.getElementById('stopCameraBtn');
    const captureBtn = document.getElementById('captureBtn');
    
    // Start camera button
    startBtn.addEventListener('click', async function() {
        await startCamera();
    });
    
    // Stop camera button
    stopBtn.addEventListener('click', function() {
        stopCamera();
    });
    
    // Capture button (akan di-handle di app.js untuk trigger deteksi)
    captureBtn.addEventListener('click', async function() {
        // Cek apakah lokasi sudah diisi
        const lat = document.getElementById('latitude').value;
        const lng = document.getElementById('longitude').value;
        
        if (!lat || lat === '-' || !lng || lng === '-') {
            showAlert('Mohon isi lokasi terlebih dahulu sebelum melakukan deteksi!', 'error');
            return;
        }
        
        // Capture frame
        const canvas = captureFrame();
        
        if (!canvas) {
            showAlert('Gagal mengambil gambar dari kamera.', 'error');
            return;
        }
        
        // Jalankan deteksi (fungsi ini akan didefinisikan di app.js)
        await runDetection(canvas);
    });
}

// Fungsi untuk switch camera (depan/belakang) - opsional
async function switchCamera() {
    if (!isCameraActive) {
        showAlert('Kamera belum diaktifkan!', 'error');
        return;
    }
    
    // Stop current camera
    stopCamera();
    
    // Start dengan facing mode berbeda
    // TODO: Implement logic untuk toggle antara 'user' dan 'environment'
    await startCamera();
}

// Fungsi helper untuk cek apakah device punya kamera
async function checkCameraAvailability() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        return videoDevices.length > 0;
    } catch (error) {
        console.error('Error checking camera:', error);
        return false;
    }
}

// Cleanup saat page di-close
window.addEventListener('beforeunload', function() {
    if (isCameraActive) {
        stopCamera();
    }
});