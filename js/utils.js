/**
 * UTILS.JS - Helper Functions
 * File ini berisi fungsi-fungsi pembantu untuk aplikasi
 */

// Fungsi untuk menampilkan/menyembunyikan loading indicator
function showLoading(show = true) {
  const loadingIndicator = document.getElementById('loadingIndicator');
  if (loadingIndicator) {
    loadingIndicator.style.display = show ? 'block' : 'none';
  }
}

// Container untuk notifikasi
let notificationContainer = null;

// Fungsi untuk inisialisasi notification container
function initNotificationContainer() {
  if (!notificationContainer) {
    notificationContainer = document.createElement('div');
    notificationContainer.id = 'notification-container';
    notificationContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
        `;
    document.body.appendChild(notificationContainer);
  }
}

// Fungsi untuk menampilkan alert message
function showAlert(message, type = 'info') {
  // Inisialisasi container jika belum ada
  initNotificationContainer();

  // Tentukan warna berdasarkan type
  const colors = {
    error: '#dc3545',
    success: '#28a745',
    info: '#17a2b8',
    warning: '#ffc107',
  };

  const bgColor = colors[type] || colors.info;

  // Buat elemen alert
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type}`;
  alertDiv.style.cssText = `
        padding: 15px 20px;
        background: ${bgColor};
        color: white;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        max-width: 320px;
        min-width: 250px;
        pointer-events: auto;
        transform: translateX(400px);
        opacity: 0;
        transition: all 0.3s ease-out;
        font-size: 14px;
        font-weight: 500;
        word-wrap: break-word;
    `;
  alertDiv.textContent = message;

  // Tambahkan ke container
  notificationContainer.appendChild(alertDiv);

  // Trigger animation (slide in dari kanan)
  setTimeout(() => {
    alertDiv.style.transform = 'translateX(0)';
    alertDiv.style.opacity = '1';
  }, 10);

  // Hapus setelah 3 detik
  setTimeout(() => {
    // Slide out
    alertDiv.style.transform = 'translateX(400px)';
    alertDiv.style.opacity = '0';

    // Hapus dari DOM setelah animasi selesai
    setTimeout(() => {
      if (alertDiv.parentNode) {
        notificationContainer.removeChild(alertDiv);
      }

      // Bersihkan container jika kosong
      if (notificationContainer.childNodes.length === 0) {
        notificationContainer.remove();
        notificationContainer = null;
      }
    }, 300);
  }, 3000);
}

// Fungsi untuk format tanggal dan waktu
function formatDateTime(date) {
  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };
  return new Intl.DateTimeFormat('id-ID', options).format(date);
}

// Fungsi untuk resize image ke ukuran target (416x416 untuk model kita)
function resizeImage(imageData, targetWidth, targetHeight) {
  // Buat canvas temporary
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');

  tempCanvas.width = targetWidth;
  tempCanvas.height = targetHeight;

  // Resize image
  tempCtx.drawImage(imageData, 0, 0, targetWidth, targetHeight);

  return tempCanvas;
}

// Fungsi untuk preprocess image untuk model YOLO
function preprocessImage(canvas, targetWidth = 416, targetHeight = 416) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const data = imageData.data;

  // Buat array untuk input model [1, 3, 416, 416]
  // Format: [batch, channels (RGB), height, width]
  const input = new Float32Array(1 * 3 * targetHeight * targetWidth);

  // Normalisasi pixel values ke range [0, 1] dan ubah format dari RGBA ke RGB
  for (let i = 0; i < targetHeight; i++) {
    for (let j = 0; j < targetWidth; j++) {
      const pixelIndex = (i * targetWidth + j) * 4; // RGBA format
      const tensorIndex = i * targetWidth + j;

      // Red channel
      input[tensorIndex] = data[pixelIndex] / 255.0;
      // Green channel
      input[targetWidth * targetHeight + tensorIndex] = data[pixelIndex + 1] / 255.0;
      // Blue channel
      input[2 * targetWidth * targetHeight + tensorIndex] = data[pixelIndex + 2] / 255.0;
    }
  }

  return input;
}

// Fungsi untuk menggambar bounding box pada canvas
function drawBoundingBox(ctx, x, y, width, height, label, confidence, color = '#00FF00') {
  // Gambar kotak
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, width, height);

  // Buat label text
  const text = `${label} ${(confidence * 100).toFixed(1)}%`;
  ctx.font = 'bold 16px Arial';

  // Ukur text untuk background
  const textMetrics = ctx.measureText(text);
  const textHeight = 20;
  const textPadding = 5;

  // Gambar background untuk text
  ctx.fillStyle = color;
  ctx.fillRect(x, y - textHeight - textPadding, textMetrics.width + textPadding * 2, textHeight + textPadding);

  // Gambar text
  ctx.fillStyle = '#000000';
  ctx.fillText(text, x + textPadding, y - textPadding);
}

// Fungsi untuk melakukan Non-Maximum Suppression (NMS)
// NMS digunakan untuk menghilangkan bounding box yang overlapping
function nonMaxSuppression(boxes, iouThreshold = 0.5) {
  // Sort boxes by confidence (descending)
  boxes.sort((a, b) => b.confidence - a.confidence);

  const selected = [];
  const suppressed = new Set();

  for (let i = 0; i < boxes.length; i++) {
    if (suppressed.has(i)) continue;

    selected.push(boxes[i]);

    // Suppress boxes with high IoU
    for (let j = i + 1; j < boxes.length; j++) {
      if (suppressed.has(j)) continue;

      const iou = calculateIoU(boxes[i], boxes[j]);
      if (iou > iouThreshold) {
        suppressed.add(j);
      }
    }
  }

  return selected;
}

// Fungsi untuk menghitung Intersection over Union (IoU)
function calculateIoU(box1, box2) {
  const x1 = Math.max(box1.x, box2.x);
  const y1 = Math.max(box1.y, box2.y);
  const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
  const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

  const intersectionArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const box1Area = box1.width * box1.height;
  const box2Area = box2.width * box2.height;
  const unionArea = box1Area + box2Area - intersectionArea;

  return intersectionArea / unionArea;
}

// Fungsi untuk debounce (mencegah fungsi dipanggil terlalu sering)
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Fungsi untuk mendapatkan warna random untuk bounding box
function getRandomColor() {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Fungsi untuk membuat confidence heatmap overlay
// Ini adalah alternatif praktis untuk Grad-CAM yang menunjukkan area dengan confidence tinggi
function drawConfidenceHeatmap(ctx, detections, canvasWidth, canvasHeight) {
  if (!detections || detections.length === 0) return;

  // Buat temporary canvas untuk heatmap
  const heatmapCanvas = document.createElement('canvas');
  heatmapCanvas.width = canvasWidth;
  heatmapCanvas.height = canvasHeight;
  const heatmapCtx = heatmapCanvas.getContext('2d');

  // Gambar setiap deteksi sebagai radial gradient (seperti Grad-CAM)
  // Render 2 kali untuk intensitas lebih kuat
  for (let layer = 0; layer < 2; layer++) {
    detections.forEach((detection) => {
      const centerX = detection.x + detection.width / 2;
      const centerY = detection.y + detection.height / 2;

      // Radius lebih besar untuk coverage lebih luas
      const radius = Math.max(detection.width, detection.height) * 1.2;

      // Confidence score (0-1) menentukan opacity dan intensitas
      const confidence = detection.confidence;
      const opacity = Math.min(confidence * 0.9, 0.85); // Max opacity 85%

      // Warna berdasarkan confidence: merah untuk tinggi, kuning untuk sedang
      let r, g, b;
      if (confidence > 0.7) {
        // High confidence: merah terang
        r = 255;
        g = 50;
        b = 50;
      } else if (confidence > 0.5) {
        // Medium confidence: orange
        r = 255;
        g = 120;
        b = 0;
      } else {
        // Low confidence: kuning
        r = 255;
        g = 200;
        b = 50;
      }

      // Buat radial gradient
      const gradient = heatmapCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);

      // Gradient dari center (opaque) ke edge (transparent) - lebih tebal
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${opacity})`);
      gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, ${opacity * 0.8})`);
      gradient.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${opacity * 0.5})`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

      // Gambar circle dengan gradient
      heatmapCtx.fillStyle = gradient;
      heatmapCtx.beginPath();
      heatmapCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      heatmapCtx.fill();
    });
  }

  // Draw heatmap ke canvas utama dengan blend mode overlay untuk warna lebih tebal
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.drawImage(heatmapCanvas, 0, 0);
  // Tambah layer kedua dengan multiply untuk intensitas extra
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.3;
  ctx.drawImage(heatmapCanvas, 0, 0);
  ctx.restore();
}

// Export functions (akan digunakan di file lain)
// Karena kita pakai vanilla JS tanpa module bundler,
// functions otomatis tersedia secara global
