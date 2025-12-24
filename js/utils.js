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

// Note: preprocessImage() didefinisikan di modelLoader.js untuk YOLOv8

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

// Fungsi untuk menganalisis intensitas pixel (darkness) dalam bounding box
// Lubang yang lebih dalam biasanya lebih gelap karena shadow
function analyzePotholeDepth(canvas, detection) {
  try {
    const ctx = canvas.getContext('2d');

    // Pastikan koordinat dalam batas canvas
    const x = Math.max(0, Math.floor(detection.x));
    const y = Math.max(0, Math.floor(detection.y));
    const width = Math.min(canvas.width - x, Math.floor(detection.width));
    const height = Math.min(canvas.height - y, Math.floor(detection.height));

    if (width <= 0 || height <= 0) {
      return 0.5; // Default jika area tidak valid
    }

    // Ekstrak image data dari area bounding box
    const imageData = ctx.getImageData(x, y, width, height);
    const data = imageData.data;

    // Hitung rata-rata brightness (grayscale)
    let totalBrightness = 0;
    let pixelCount = 0;

    for (let i = 0; i < data.length; i += 4) {
      // Konversi RGB ke grayscale menggunakan formula luminance
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;

      totalBrightness += brightness;
      pixelCount++;
    }

    if (pixelCount === 0) {
      return 0.5; // Default jika tidak ada pixel
    }

    const avgBrightness = totalBrightness / pixelCount;

    // Return darkness (0 = terang, 1 = gelap)
    // Invert brightness untuk mendapatkan darkness
    return 1 - avgBrightness;
  } catch (error) {
    console.error('Error analyzing pothole depth:', error);
    return 0.5; // Default jika error
  }
}

// Fungsi untuk normalisasi ukuran bounding box
// Lubang yang lebih besar mungkin lebih dalam
function normalizeBoxSize(detection, canvasWidth, canvasHeight) {
  const boxArea = detection.width * detection.height;
  const canvasArea = canvasWidth * canvasHeight;

  if (canvasArea === 0) {
    return 0;
  }

  // Normalisasi ke 0-1, dengan batas maksimal (misalnya 20% dari canvas)
  const normalizedSize = Math.min(boxArea / canvasArea, 0.2) / 0.2;

  return normalizedSize;
}

// Fungsi untuk menghitung skor kedalaman komposit
// Menggabungkan intensity (darkness), size, dan confidence
function calculateDepthScore(detection, canvas, canvasWidth, canvasHeight) {
  // Weight untuk masing-masing faktor
  const intensityWeight = 0.5; // 50% - faktor utama
  const sizeWeight = 0.3; // 30% - ukuran lubang
  const confidenceWeight = 0.2; // 20% - confidence deteksi

  // Analisis intensitas (darkness)
  const darkness = analyzePotholeDepth(canvas, detection);

  // Normalisasi ukuran
  const normalizedSize = normalizeBoxSize(detection, canvasWidth, canvasHeight);

  // Confidence score (sudah 0-1)
  const confidence = detection.confidence;

  // Hitung skor komposit
  const depthScore = intensityWeight * darkness + sizeWeight * normalizedSize + confidenceWeight * confidence;

  // Clamp ke 0-1
  return Math.max(0, Math.min(1, depthScore));
}

// Fungsi untuk mapping depthScore ke warna (biru → kuning → merah)
function getDepthColor(depthScore) {
  // Clamp depthScore ke 0-1
  const score = Math.max(0, Math.min(1, depthScore));

  let r, g, b;

  if (score < 0.33) {
    // Biru → Cyan (0.0 → 0.33)
    const t = score / 0.33;
    r = 0;
    g = Math.floor(255 * t);
    b = 255;
  } else if (score < 0.66) {
    // Cyan → Kuning (0.33 → 0.66)
    const t = (score - 0.33) / 0.33;
    r = Math.floor(255 * t);
    g = 255;
    b = Math.floor(255 * (1 - t));
  } else {
    // Kuning → Merah (0.66 → 1.0)
    const t = (score - 0.66) / 0.34;
    r = 255;
    g = Math.floor(255 * (1 - t));
    b = 0;
  }

  return { r, g, b };
}

// Helper function untuk menggambar radial gradient heatmap
function drawRadialGradientHeatmap(heatmapCtx, detection, originalCanvas, canvasWidth, canvasHeight, radiusMultiplier, opacityMultiplier, colorStops) {
  const depthScore = calculateDepthScore(detection, originalCanvas, canvasWidth, canvasHeight);
  const color = getDepthColor(depthScore);
  const centerX = detection.x + detection.width / 2;
  const centerY = detection.y + detection.height / 2;
  const radius = Math.max(detection.width, detection.height) * radiusMultiplier;
  const opacity = opacityMultiplier(depthScore);

  const gradient = heatmapCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);

  // Apply color stops
  colorStops.forEach((stop) => {
    gradient.addColorStop(stop.position, `rgba(${color.r}, ${color.g}, ${color.b}, ${stop.opacity * opacity})`);
  });

  heatmapCtx.fillStyle = gradient;
  heatmapCtx.beginPath();
  heatmapCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  heatmapCtx.fill();
}

// Fungsi untuk membuat depth heatmap overlay
// Menunjukkan intensitas kedalaman lubang dengan gradasi warna biru → kuning → merah
function drawDepthHeatmap(ctx, detections, canvasWidth, canvasHeight, originalCanvas) {
  if (!detections || detections.length === 0 || !originalCanvas) return;

  // Buat temporary canvas untuk heatmap
  const heatmapCanvas = document.createElement('canvas');
  heatmapCanvas.width = canvasWidth;
  heatmapCanvas.height = canvasHeight;
  const heatmapCtx = heatmapCanvas.getContext('2d');

  // Untuk setiap deteksi, gambar heatmap utama
  detections.forEach((detection) => {
    drawRadialGradientHeatmap(
      heatmapCtx,
      detection,
      originalCanvas,
      canvasWidth,
      canvasHeight,
      0.7, // radius multiplier
      (depthScore) => 0.4 + depthScore * 0.4, // opacity: 0.4 - 0.8
      [
        { position: 0, opacity: 1.0 },
        { position: 0.3, opacity: 0.8 },
        { position: 0.6, opacity: 0.5 },
        { position: 1, opacity: 0 },
      ]
    );
  });

  // Apply smoothing dengan multiple passes (simple blur effect)
  detections.forEach((detection) => {
    drawRadialGradientHeatmap(
      heatmapCtx,
      detection,
      originalCanvas,
      canvasWidth,
      canvasHeight,
      0.9, // radius multiplier (lebih besar untuk smoothing)
      (depthScore) => (0.2 + depthScore * 0.2) * 0.5, // opacity lebih rendah untuk smoothing
      [
        { position: 0, opacity: 1.0 },
        { position: 0.5, opacity: 0.3 },
        { position: 1, opacity: 0 },
      ]
    );
  });

  // Draw heatmap ke canvas utama dengan blend mode 'overlay' untuk efek yang lebih natural
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.drawImage(heatmapCanvas, 0, 0);
  ctx.restore();
}

// Export functions (akan digunakan di file lain)
// Karena kita pakai vanilla JS tanpa module bundler,
// functions otomatis tersedia secara global
