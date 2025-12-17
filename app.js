/**
 * APP.JS - Main Application Logic
 * File ini adalah "otak" aplikasi yang menghubungkan semua fungsi
 */

// Global state
let detectionResults = null;
let showHeatmap = false; // Toggle untuk heatmap visualization
let lastDetectionCanvas = null; // Simpan canvas original untuk re-render
let lastDetections = null; // Simpan detections untuk re-render

// Fungsi untuk mengkategorikan kerusakan jalan berdasarkan jumlah deteksi
function categorizeRoadDamage(count) {
  if (count === 0) {
    return {
      category: 'Jalan Bagus',
      severity: 'good',
      color: 'success',
      icon: 'bi-check-circle-fill',
      description: 'Tidak ada kerusakan terdeteksi',
    };
  } else if (count >= 1 && count <= 3) {
    return {
      category: 'Rusak Ringan',
      severity: 'light',
      color: 'warning',
      icon: 'bi-exclamation-triangle-fill',
      description: 'Kerusakan ringan, perlu perhatian',
    };
  } else if (count >= 4 && count <= 7) {
    return {
      category: 'Rusak Sedang',
      severity: 'moderate',
      color: 'warning',
      icon: 'bi-exclamation-triangle-fill',
      description: 'Kerusakan sedang, perlu perbaikan',
    };
  } else {
    return {
      category: 'Rusak Berat',
      severity: 'severe',
      color: 'danger',
      icon: 'bi-x-circle-fill',
      description: 'Kerusakan berat, perlu perbaikan segera',
    };
  }
}

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

// Fungsi untuk re-render canvas dengan/ tanpa heatmap
function rerenderDetectionResults() {
  if (!lastDetectionCanvas || !lastDetections) return;

  const resultCanvas = document.getElementById('resultCanvas');
  const ctx = resultCanvas.getContext('2d');

  // Clear canvas
  ctx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);

  // Draw original image
  ctx.drawImage(lastDetectionCanvas, 0, 0);

  // Draw confidence heatmap jika toggle aktif (sebelum bounding boxes)
  if (showHeatmap && lastDetections.length > 0) {
    drawConfidenceHeatmap(ctx, lastDetections, resultCanvas.width, resultCanvas.height);
  }

  // Draw bounding boxes untuk setiap deteksi
  lastDetections.forEach((detection, index) => {
    // Gunakan warna yang berbeda untuk setiap deteksi
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

  // Get result canvas
  const resultCanvas = document.getElementById('resultCanvas');
  const ctx = resultCanvas.getContext('2d');

  // Set canvas size
  resultCanvas.width = originalCanvas.width;
  resultCanvas.height = originalCanvas.height;

  // Draw original image
  ctx.drawImage(originalCanvas, 0, 0);

  // Draw confidence heatmap jika toggle aktif (sebelum bounding boxes)
  if (showHeatmap && detections.length > 0) {
    drawConfidenceHeatmap(ctx, detections, resultCanvas.width, resultCanvas.height);
  }

  // Draw bounding boxes untuk setiap deteksi
  detections.forEach((detection, index) => {
    // Gunakan warna yang berbeda untuk setiap deteksi
    const colors = ['#00FF00', '#FF6B6B', '#4ECDC4', '#FFD93D', '#6BCF7F'];
    const color = colors[index % colors.length];

    drawBoundingBox(ctx, detection.x, detection.y, detection.width, detection.height, detection.label, detection.confidence, color);
  });

  // Update info
  document.getElementById('potholeCount').textContent = detections.length;
  document.getElementById('detectionTime').textContent = formatDateTime(new Date());

  // Kategorisasi kerusakan jalan
  const damageCategory = categorizeRoadDamage(detections.length);

  // Update kategori UI
  const categoryIcon = document.getElementById('categoryIcon');
  const categoryTitle = document.getElementById('categoryTitle');
  const categoryDescription = document.getElementById('categoryDescription');
  const categoryBadge = document.getElementById('categoryBadge');
  const categoryCard = document.getElementById('categoryCard');

  if (categoryIcon && categoryTitle && categoryDescription && categoryBadge && categoryCard) {
    // Update icon
    categoryIcon.innerHTML = `<i class="bi ${damageCategory.icon} fs-1 text-${damageCategory.color}"></i>`;

    // Update title
    categoryTitle.textContent = damageCategory.category;
    categoryTitle.className = `mb-2 text-${damageCategory.color}`;

    // Update description
    categoryDescription.textContent = damageCategory.description;

    // Update badge
    categoryBadge.textContent = damageCategory.category;
    categoryBadge.className = `badge bg-${damageCategory.color} fs-6 px-4 py-2`;

    // Update card border color (optional, untuk visual yang lebih menarik)
    // Remove existing border classes
    categoryCard.classList.remove('border-success', 'border-warning', 'border-danger');
    // Add new border class
    const borderColors = {
      success: '#198754',
      warning: '#ffc107',
      danger: '#dc3545',
    };
    categoryCard.style.borderTop = `4px solid ${borderColors[damageCategory.color] || '#198754'}`;
  }

  // Get location data
  const locationData = getCurrentLocationData();
  document.getElementById('resultAddress').textContent = locationData.address || '-';
  document.getElementById('resultCoordinates').textContent = locationData.latitude && locationData.longitude ? `${locationData.latitude.toFixed(6)}, ${locationData.longitude.toFixed(6)}` : '-';

  // Update toggle button text
  updateHeatmapToggleButton();

  // Scroll to result
  resultSection.scrollIntoView({ behavior: 'smooth' });
}

// Fungsi untuk update toggle button text
function updateHeatmapToggleButton() {
  const toggleBtn = document.getElementById('toggleHeatmapBtn');
  if (toggleBtn) {
    if (showHeatmap) {
      toggleBtn.innerHTML = '<i class="bi bi-eye-slash me-2"></i>Sembunyikan Heatmap';
      toggleBtn.classList.remove('btn-secondary');
      toggleBtn.classList.add('btn-success');
    } else {
      toggleBtn.innerHTML = '<i class="bi bi-eye me-2"></i>Tampilkan Heatmap';
      toggleBtn.classList.remove('btn-success');
      toggleBtn.classList.add('btn-secondary');
    }
  }
}

// Setup event listener untuk tombol "Deteksi Lagi" dan "Toggle Heatmap"
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

  // Setup toggle heatmap button
  const toggleHeatmapBtn = document.getElementById('toggleHeatmapBtn');
  if (toggleHeatmapBtn) {
    toggleHeatmapBtn.addEventListener('click', function () {
      showHeatmap = !showHeatmap;
      updateHeatmapToggleButton();
      rerenderDetectionResults();
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
