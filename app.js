/**
 * APP.JS - Main Application Logic
 * File ini adalah "otak" aplikasi yang menghubungkan semua fungsi
 */

// Global state
let detectionResults = null;
let lastDetectionCanvas = null; // Simpan canvas original untuk re-render
let lastDetections = null; // Simpan detections untuk re-render

// Fungsi utama yang dijalankan saat halaman selesai load
document.addEventListener('DOMContentLoaded', async function () {
  console.log('Application started');

  try {
    // 1. Inisialisasi Map
    console.log('Initializing map...');
    initMap();

    // 2. Setup event listeners untuk Location
    console.log('Setting up location listeners...');
    setupLocationListeners();

    // 3. Setup event listeners untuk Camera
    console.log('Setting up camera listeners...');
    setupCameraListeners();

    // 4. Load ONNX Model
    console.log('Loading ONNX model...');
    const modelLoadSuccess = await loadModel();

    if (!modelLoadSuccess) {
      throw new Error('Gagal memuat model ONNX');
    }

    console.log('Application initialized successfully!');
    showAlert('Aplikasi siap digunakan!', 'success');
  } catch (error) {
    console.error('Initialization error:', error);
    showAlert('Gagal menginisialisasi aplikasi: ' + error.message, 'error');
  }
});

// Fungsi untuk run detection (dipanggil dari camera.js saat tombol capture diklik)
async function runDetection(canvas) {
  console.log('Starting detection...', { canvas });

  try {
    if (!canvas) {
      throw new Error('Canvas tidak ditemukan. Pastikan camera.capture mengirimkan elemen canvas.');
    }
    if (typeof isModelReady !== 'function') {
      throw new Error('isModelReady tidak didefinisikan.');
    }
    if (!isModelReady()) {
      throw new Error('Model belum siap. Mohon tunggu atau refresh halaman.');
    }

    showLoading(true);
    showAlert('Mendeteksi jalan berlubang...', 'info');

    let detections;
    try {
      detections = await detectPotholes(canvas);
    } catch (innerErr) {
      console.error('Error saat memanggil detectPotholes:', innerErr);
      throw new Error('Kesalahan saat menjalankan model: ' + (innerErr.message || innerErr));
    }

    if (!Array.isArray(detections)) {
      console.warn('detectPotholes mengembalikan bukan array:', detections);
      throw new Error('Format hasil deteksi tidak valid.');
    }

    displayDetectionResults(canvas, detections);
    showLoading(false);

    if (detections.length === 0) {
      showAlert('Tidak ada lubang terdeteksi.', 'info');
    } else {
      showAlert(`Deteksi selesai! Ditemukan ${detections.length} lubang.`, 'success');
    }
  } catch (error) {
    showLoading(false);
    console.error('Detection error:', error);
    showAlert('Gagal melakukan deteksi: ' + (error.message || error), 'error');
  }
}

// Fungsi untuk re-render canvas (tidak lagi diperlukan toggle, tapi tetap ada untuk konsistensi)
function rerenderDetectionResults() {
  if (!lastDetectionCanvas || !lastDetections) return;

  const resultCanvas = document.getElementById('resultCanvas');
  const ctx = resultCanvas.getContext('2d');

  // Clear canvas
  ctx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);

  // Draw original image
  ctx.drawImage(lastDetectionCanvas, 0, 0);

  // Draw bounding boxes untuk setiap deteksi
  lastDetections.forEach((detection, index) => {
    const colors = ['#00FF00', '#FF6B6B', '#4ECDC4', '#FFD93D', '#6BCF7F'];
    const color = colors[index % colors.length];

    drawBoundingBox(ctx, detection.x, detection.y, detection.width, detection.height, detection.label, detection.confidence, color);
  });
}

// Fungsi untuk update step indicator
function updateStepIndicator(activeStep) {
  const stepItems = document.querySelectorAll('.step-item');
  stepItems.forEach((item, index) => {
    if (index + 1 <= activeStep) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

// Fungsi untuk display hasil deteksi
function displayDetectionResults(originalCanvas, detections) {
  console.log('Displaying results:', detections);

  // Simpan untuk re-render
  lastDetectionCanvas = originalCanvas;
  lastDetections = detections;

  // Hide camera section
  const cameraSection = document.getElementById('camera-section');
  if (cameraSection) {
    cameraSection.style.display = 'none';
  }

  // Show result section
  const resultSection = document.getElementById('result-section');
  if (resultSection) {
    resultSection.style.display = 'block';
  }

  // Update step indicator to step 3
  updateStepIndicator(3);

  // === CANVAS 1: Bounding Box Detection ===
  const resultCanvas = document.getElementById('resultCanvas');
  const ctx = resultCanvas.getContext('2d');

  // Set canvas size
  resultCanvas.width = originalCanvas.width;
  resultCanvas.height = originalCanvas.height;

  // Draw original image
  ctx.drawImage(originalCanvas, 0, 0);

  // Draw bounding boxes untuk setiap deteksi
  detections.forEach((detection, index) => {
    // Gunakan warna yang berbeda untuk setiap deteksi
    const colors = ['#00FF00', '#FF6B6B', '#4ECDC4', '#FFD93D', '#6BCF7F'];
    const color = colors[index % colors.length];

    drawBoundingBox(ctx, detection.x, detection.y, detection.width, detection.height, detection.label, detection.confidence, color);
  });

  // === CANVAS 2: Heatmap Visualization ===
  const heatmapCanvas = document.getElementById('heatmapCanvas');
  const heatmapCtx = heatmapCanvas.getContext('2d');

  // Set canvas size sama dengan original
  heatmapCanvas.width = originalCanvas.width;
  heatmapCanvas.height = originalCanvas.height;

  // Draw original image sebagai background
  heatmapCtx.drawImage(originalCanvas, 0, 0);

  // Draw heatmap overlay jika ada deteksi
  if (detections.length > 0) {
    drawConfidenceHeatmap(heatmapCtx, detections, heatmapCanvas.width, heatmapCanvas.height);
  }

  // === Generate Cropped Images Gallery ===
  generateCroppedImages(originalCanvas, detections);

  // Update info
  document.getElementById('potholeCount').textContent = detections.length;
  document.getElementById('detectionTime').textContent = formatDateTime(new Date());

  // Get location data
  const locationData = getCurrentLocationData();
  document.getElementById('resultAddress').textContent = locationData.address || '-';
  document.getElementById('resultCoordinates').textContent = locationData.latitude && locationData.longitude ? `${locationData.latitude.toFixed(6)}, ${locationData.longitude.toFixed(6)}` : '-';

  // Scroll to result
  resultSection.scrollIntoView({ behavior: 'smooth' });
}

// Fungsi untuk generate cropped images dari setiap deteksi
function generateCroppedImages(originalCanvas, detections) {
  const gallery = document.getElementById('croppedGallery');
  const noDetectionMsg = document.getElementById('noDetectionMsg');

  // Clear existing content
  gallery.innerHTML = '';

  if (detections.length === 0) {
    // Tampilkan pesan tidak ada deteksi
    gallery.innerHTML = '<p class="text-muted text-center mb-0">Tidak ada lubang terdeteksi</p>';
    return;
  }

  // Loop setiap deteksi dan buat cropped image
  detections.forEach((detection, index) => {
    // Buat canvas untuk crop
    const cropCanvas = document.createElement('canvas');
    const cropCtx = cropCanvas.getContext('2d');

    // Tambah padding untuk context
    const padding = 20;
    const cropX = Math.max(0, detection.x - padding);
    const cropY = Math.max(0, detection.y - padding);
    const cropWidth = Math.min(detection.width + padding * 2, originalCanvas.width - cropX);
    const cropHeight = Math.min(detection.height + padding * 2, originalCanvas.height - cropY);

    cropCanvas.width = cropWidth;
    cropCanvas.height = cropHeight;

    // Crop dari original canvas
    cropCtx.drawImage(
      originalCanvas,
      cropX,
      cropY,
      cropWidth,
      cropHeight, // source
      0,
      0,
      cropWidth,
      cropHeight // destination
    );

    // Convert ke data URL
    const croppedDataUrl = cropCanvas.toDataURL('image/png');

    // Tentukan warna badge berdasarkan confidence
    let badgeClass = 'bg-success';
    if (detection.confidence < 0.5) {
      badgeClass = 'bg-warning text-dark';
    } else if (detection.confidence < 0.7) {
      badgeClass = 'bg-info';
    }

    // Buat card element
    const cropCard = document.createElement('div');
    cropCard.className = 'crop-card';
    cropCard.innerHTML = `
      <div class="crop-card-inner">
        <img src="${croppedDataUrl}" alt="Deteksi ${index + 1}" class="crop-image" />
        <div class="crop-overlay">
          <span class="crop-number">#${index + 1}</span>
          <span class="badge ${badgeClass} crop-confidence">${(detection.confidence * 100).toFixed(1)}%</span>
        </div>
        <div class="crop-hover-overlay">
          <i class="bi bi-zoom-in"></i>
          <span>Klik untuk zoom</span>
        </div>
      </div>
    `;

    // Add click event untuk modal zoom
    cropCard.addEventListener('click', function () {
      showCropZoomModal(croppedDataUrl, detection.confidence, index + 1);
    });

    gallery.appendChild(cropCard);
  });
}

// Fungsi untuk menampilkan modal zoom
function showCropZoomModal(imageUrl, confidence, detectionNumber) {
  const modal = new bootstrap.Modal(document.getElementById('cropZoomModal'));
  const modalImage = document.getElementById('cropZoomImage');
  const modalTitle = document.getElementById('cropZoomModalLabel');
  const modalConfidence = document.getElementById('cropZoomConfidence');

  modalImage.src = imageUrl;
  modalTitle.innerHTML = `<i class="bi bi-zoom-in me-2"></i>Detail Deteksi #${detectionNumber}`;
  modalConfidence.textContent = `Confidence: ${(confidence * 100).toFixed(1)}%`;

  modal.show();
}

// Setup event listener untuk tombol "Deteksi Lagi"
document.addEventListener('DOMContentLoaded', function () {
  const detectAgainBtn = document.getElementById('detectAgainBtn');

  if (detectAgainBtn) {
    detectAgainBtn.addEventListener('click', function () {
      // Hide result section
      const resultSection = document.getElementById('result-section');
      if (resultSection) {
        resultSection.style.display = 'none';
      }

      // Show camera section
      const cameraSection = document.getElementById('camera-section');
      if (cameraSection) {
        cameraSection.style.display = 'block';
        // Update step indicator to step 2
        updateStepIndicator(2);
        // Scroll to camera section
        cameraSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }
});

// Add CSS animation for alerts
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
