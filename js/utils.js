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

// ============================================================================
// DEPRECATED: OLD DEPTH ANALYSIS FUNCTIONS
// Functions below are no longer used after heatmap refactoring
// ============================================================================

/*
// Fungsi untuk menghitung kontras lokal di sekitar pixel
// Menggunakan gradient magnitude untuk edge detection
function calculateLocalContrast(imageData, x, y, width, height) {
  if (x < 1 || x >= width - 1 || y < 1 || y >= height - 1) {
    return 0; // Edge pixels, return 0
  }

  // Sobel operator untuk gradient detection
  const sobelX = [
    [-1, 0, 1],
    [-2, 0, 2],
    [-1, 0, 1],
  ];
  const sobelY = [
    [-1, -2, -1],
    [0, 0, 0],
    [1, 2, 1],
  ];

  let gx = 0;
  let gy = 0;

  // Apply Sobel operator
  for (let ky = -1; ky <= 1; ky++) {
    for (let kx = -1; kx <= 1; kx++) {
      const idx = ((y + ky) * width + (x + kx)) * 4;
      const brightness = 0.299 * imageData.data[idx] + 0.587 * imageData.data[idx + 1] + 0.114 * imageData.data[idx + 2];
      gx += brightness * sobelX[ky + 1][kx + 1];
      gy += brightness * sobelY[ky + 1][kx + 1];
    }
  }

  // Gradient magnitude
  const gradientMagnitude = Math.sqrt(gx * gx + gy * gy);
  return Math.min(255, gradientMagnitude) / 255; // Normalize to 0-1
}

// Fungsi untuk normalisasi depth map menggunakan percentile-based method
function normalizeDepthMap(depthMap) {
  // Collect all depth values
  const allDepths = [];
  depthMap.forEach((row) => {
    row.forEach((pixel) => {
      allDepths.push(pixel.depth);
    });
  });

  if (allDepths.length === 0) return depthMap;

  // Sort untuk percentile calculation
  allDepths.sort((a, b) => a - b);

  // Calculate percentiles
  const minDepth = allDepths[0];
  const maxDepth = allDepths[allDepths.length - 1];
  const p5 = allDepths[Math.floor(allDepths.length * 0.05)]; // 5th percentile
  const p95 = allDepths[Math.floor(allDepths.length * 0.95)]; // 95th percentile

  // Normalize using percentile-based method
  const range = p95 - p5;
  const normalizedMap = depthMap.map((row) => {
    return row.map((pixel) => {
      // Normalize to 0-1 range using percentiles
      let normalized = range > 0 ? (pixel.depth - p5) / range : 0;
      // Clamp and enhance contrast
      normalized = Math.min(1, Math.max(0, normalized * 1.2)); // Enhance contrast slightly
      return {
        ...pixel,
        depth: normalized,
      };
    });
  });

  return normalizedMap;
}

// Fungsi untuk menganalisis kedalaman per pixel dari gambar
// Menggunakan multi-method analysis: brightness + contrast + edge detection
function analyzePixelDepth(canvas, detection) {
  const padding = 40; // Padding untuk context area
  const roiX = Math.max(0, Math.floor(detection.x));
  const roiY = Math.max(0, Math.floor(detection.y));
  const roiWidth = Math.min(Math.floor(detection.width), canvas.width - roiX);
  const roiHeight = Math.min(Math.floor(detection.height), canvas.height - roiY);

  // Extract context area (area sekitar ROI dengan padding)
  const contextX = Math.max(0, roiX - padding);
  const contextY = Math.max(0, roiY - padding);
  const contextWidth = Math.min(canvas.width - contextX, roiWidth + padding * 2);
  const contextHeight = Math.min(canvas.height - contextY, roiHeight + padding * 2);

  // Get image data untuk ROI dan context
  const roiImageData = canvas.getContext('2d').getImageData(roiX, roiY, roiWidth, roiHeight);
  const contextImageData = canvas.getContext('2d').getImageData(contextX, contextY, contextWidth, contextHeight);

  // Hitung rata-rata brightness untuk context area
  let contextBrightnessSum = 0;
  let contextPixelCount = 0;

  // Exclude ROI area dari context untuk mendapatkan true context
  for (let y = 0; y < contextHeight; y++) {
    for (let x = 0; x < contextWidth; x++) {
      const globalX = contextX + x;
      const globalY = contextY + y;

      // Skip jika pixel berada di dalam ROI
      if (globalX >= roiX && globalX < roiX + roiWidth && globalY >= roiY && globalY < roiY + roiHeight) {
        continue;
      }

      const idx = (y * contextWidth + x) * 4;
      const r = contextImageData.data[idx];
      const g = contextImageData.data[idx + 1];
      const b = contextImageData.data[idx + 2];

      // Calculate brightness: 0.299*R + 0.587*G + 0.114*B
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      contextBrightnessSum += brightness;
      contextPixelCount++;
    }
  }

  const contextAvgBrightness = contextPixelCount > 0 ? contextBrightnessSum / contextPixelCount : 128;

  // Calculate context brightness statistics for percentile-based comparison
  const contextBrightnesses = [];
  for (let y = 0; y < contextHeight; y++) {
    for (let x = 0; x < contextWidth; x++) {
      const globalX = contextX + x;
      const globalY = contextY + y;
      if (globalX >= roiX && globalX < roiX + roiWidth && globalY >= roiY && globalY < roiY + roiHeight) {
        continue;
      }
      const idx = (y * contextWidth + x) * 4;
      const r = contextImageData.data[idx];
      const g = contextImageData.data[idx + 1];
      const b = contextImageData.data[idx + 2];
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      contextBrightnesses.push(brightness);
    }
  }
  contextBrightnesses.sort((a, b) => a - b);
  const contextP75 = contextBrightnesses[Math.floor(contextBrightnesses.length * 0.75)] || contextAvgBrightness;

  // Buat depth map untuk ROI
  const depthMap = [];
  const downsampling = 2; // Analisis setiap 2 pixel untuk performa

  for (let y = 0; y < roiHeight; y += downsampling) {
    const row = [];
    for (let x = 0; x < roiWidth; x += downsampling) {
      const idx = (y * roiWidth + x) * 4;
      const r = roiImageData.data[idx];
      const g = roiImageData.data[idx + 1];
      const b = roiImageData.data[idx + 2];

      // Method 1: Enhanced Brightness Analysis (percentile-based)
      const pixelBrightness = 0.299 * r + 0.587 * g + 0.114 * b;
      const brightnessDepth = Math.max(0, (contextP75 - pixelBrightness) / 255);

      // Method 2: Local Contrast Analysis (edge detection)
      const localContrast = calculateLocalContrast(roiImageData, x, y, roiWidth, roiHeight);

      // Method 3: Shadow/Depth Detection (gradient-based)
      // Area yang lebih gelap dari sekitarnya = shadow = depth
      const shadowDepth = Math.max(0, (contextAvgBrightness - pixelBrightness) / 255);

      // Combined depth: weighted average
      // Brightness: 50%, Contrast: 30%, Shadow: 20%
      const combinedDepth = brightnessDepth * 0.5 + localContrast * 0.3 + shadowDepth * 0.2;

      // Normalisasi awal
      const normalizedDepth = Math.min(1, Math.max(0, combinedDepth * 1.5)); // Enhance sensitivity

      row.push({
        x: x,
        y: y,
        depth: normalizedDepth,
      });
    }
    depthMap.push(row);
  }

  // Normalisasi depth map menggunakan percentile-based method
  const normalizedDepthMap = normalizeDepthMap(depthMap);

  return {
    depthMap: normalizedDepthMap,
    roiX: roiX,
    roiY: roiY,
    roiWidth: roiWidth,
    roiHeight: roiHeight,
    downsampling: downsampling,
  };
}

// Fungsi untuk mapping depth value ke color
// Color scheme: Biru → Hijau → Kuning → Orange → Merah (threshold lebih rendah untuk merah)
function depthToColor(depth) {
  // depth: 0.0 - 1.0
  let r, g, b;

  if (depth < 0.15) {
    // Biru/Ungu (0.0 - 0.15) - Kedalaman sangat rendah
    const t = depth / 0.15;
    r = Math.floor(50 * t);
    g = Math.floor(50 * t);
    b = Math.floor(200 + 55 * (1 - t));
  } else if (depth < 0.35) {
    // Biru ke Hijau (0.15 - 0.35) - Kedalaman rendah
    const t = (depth - 0.15) / 0.2;
    r = Math.floor(50 + 50 * t);
    g = Math.floor(50 + 200 * t);
    b = Math.floor(255 - 155 * t);
  } else if (depth < 0.55) {
    // Hijau ke Kuning (0.35 - 0.55) - Kedalaman sedang
    const t = (depth - 0.35) / 0.2;
    r = Math.floor(100 + 155 * t);
    g = 255;
    b = Math.floor(100 - 100 * t);
  } else if (depth < 0.75) {
    // Kuning ke Orange (0.55 - 0.75) - Kedalaman tinggi
    const t = (depth - 0.55) / 0.2;
    r = 255;
    g = Math.floor(255 - 100 * t);
    b = 0;
  } else {
    // Merah (0.75 - 1.0) - Kedalaman sangat tinggi (hotspots) - Pure Red
    r = 255;
    g = 0;
    b = 0;
  }

  return { r, g, b };
}

// DEPRECATED: Old depth heatmap function
function drawDepthHeatmap(ctx, canvas, detections, canvasWidth, canvasHeight) {
  if (!detections || detections.length === 0) return;

  // Buat temporary canvas untuk heatmap
  const heatmapCanvas = document.createElement('canvas');
  heatmapCanvas.width = canvasWidth;
  heatmapCanvas.height = canvasHeight;
  const heatmapCtx = heatmapCanvas.getContext('2d');

  // Untuk setiap deteksi, analisis dan gambar heatmap
  detections.forEach((detection) => {
    // Analisis kedalaman per pixel
    const depthAnalysis = analyzePixelDepth(canvas, detection);
    const { depthMap, roiX, roiY, roiWidth, roiHeight, downsampling } = depthAnalysis;

    // Gambar heatmap untuk setiap pixel di depth map
    depthMap.forEach((row, rowIdx) => {
      row.forEach((pixel) => {
        const { x, y, depth } = pixel;

        // Map depth ke color
        const color = depthToColor(depth);

        // Opacity berdasarkan depth (semakin dalam = semakin opaque)
        // Depth tinggi: 0.6-0.9, Depth rendah: 0.3-0.5
        const opacity = 0.5 + depth * 0.4; // 0.5 - 0.9

        // Gambar pixel dengan color dan opacity
        heatmapCtx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`;

        // Gambar square untuk downsampled pixel (untuk smooth coverage)
        heatmapCtx.fillRect(roiX + x, roiY + y, downsampling, downsampling);
      });
    });
  });

  // Draw heatmap ke canvas utama dengan blend mode yang lebih kuat
  ctx.save();
  ctx.globalCompositeOperation = 'overlay'; // Blend mode untuk kontras lebih kuat
  ctx.globalAlpha = 0.8; // Opacity lebih tinggi untuk warna lebih jelas
  ctx.drawImage(heatmapCanvas, 0, 0);
  ctx.restore();
}
*/

// ============================================================================
// NEW: DETECTION DENSITY HEATMAP IMPLEMENTATION
// Gradient-based heatmap showing WHERE detections are concentrated
// Red = highest concentration/intensity, Blue = no activity
// ============================================================================

/**
 * Hitung jarak Euclidean antara dua deteksi (center to center)
 */
function calculateDetectionDistance(det1, det2) {
  const center1X = det1.x + det1.width / 2;
  const center1Y = det1.y + det1.height / 2;
  const center2X = det2.x + det2.width / 2;
  const center2Y = det2.y + det2.height / 2;

  return Math.sqrt(Math.pow(center2X - center1X, 2) + Math.pow(center2Y - center1Y, 2));
}

/**
 * Hitung proximity weight berdasarkan jarak ke deteksi lain
 * Semakin dekat dengan deteksi lain = weight lebih tinggi (area crowded)
 */
function calculateProximityWeight(detection, allDetections) {
  if (allDetections.length <= 1) {
    return 1.0; // No other detections, weight = 1
  }

  // Hitung jarak ke semua deteksi lain
  let minDistance = Infinity;
  let avgDistance = 0;
  let count = 0;

  allDetections.forEach((other) => {
    if (other === detection) return; // Skip self

    const distance = calculateDetectionDistance(detection, other);
    minDistance = Math.min(minDistance, distance);
    avgDistance += distance;
    count++;
  });

  if (count === 0) return 1.0;

  avgDistance /= count;

  // Weight berdasarkan proximity:
  // - Jika deteksi sangat dekat (< 100px) → weight tinggi (1.5x)
  // - Jika deteksi jauh (> 500px) → weight rendah (0.7x)
  const proximityFactor = minDistance < 100 ? 1.5 : minDistance < 300 ? 1.2 : minDistance < 500 ? 1.0 : 0.7;

  return proximityFactor;
}

/**
 * Hitung weight untuk setiap deteksi berdasarkan:
 * - Confidence score (40%)
 * - Ukuran bounding box (30%)
 * - Proximity ke deteksi lain (30%)
 */
function calculateDetectionWeight(detection, allDetections, canvasWidth, canvasHeight) {
  // 1. Confidence weight (0-1, normalized)
  const confidenceWeight = detection.confidence; // Already 0-1

  // 2. Size weight (0-1, based on bbox area relative to canvas)
  const detectionArea = detection.width * detection.height;
  const canvasArea = canvasWidth * canvasHeight;
  const sizeRatio = detectionArea / canvasArea;

  // Normalize size: small detection (1% canvas) = 0.3, large (20%+ canvas) = 1.0
  const sizeWeight = Math.min(1.0, Math.max(0.3, sizeRatio / 0.2));

  // 3. Proximity weight (deteksi yang mengelompok = weight lebih tinggi)
  const proximityWeight = calculateProximityWeight(detection, allDetections);

  // Weighted combination: 40% confidence + 30% size + 30% proximity
  const finalWeight = confidenceWeight * 0.4 + sizeWeight * 0.3 + proximityWeight * 0.3;

  return finalWeight;
}

/**
 * Mapping intensity (0-1) ke color gradient: Blue → Cyan → Green → Yellow → Orange → Red
 * Menggunakan smooth HSV-like gradient untuk transisi warna natural
 */
function intensityToColor(intensity) {
  // Clamp intensity 0-1
  intensity = Math.max(0, Math.min(1, intensity));

  let r, g, b;

  if (intensity < 0.15) {
    // Blue to Cyan (0.0 - 0.15) - range lebih kecil
    const t = intensity / 0.15;
    r = 0;
    g = Math.floor(100 * t); // 0 → 100
    b = 255;
  } else if (intensity < 0.3) {
    // Cyan to Green (0.15 - 0.3)
    const t = (intensity - 0.15) / 0.15;
    r = 0;
    g = Math.floor(100 + 155 * t); // 100 → 255
    b = Math.floor(255 * (1 - t)); // 255 → 0
  } else if (intensity < 0.45) {
    // Green to Yellow (0.3 - 0.45)
    const t = (intensity - 0.3) / 0.15;
    r = Math.floor(255 * t); // 0 → 255
    g = 255;
    b = 0;
  } else if (intensity < 0.65) {
    // Yellow to Orange (0.45 - 0.65) - transisi lebih cepat
    const t = (intensity - 0.45) / 0.2;
    r = 255;
    g = Math.floor(255 - 120 * t); // 255 → 135
    b = 0;
  } else {
    // Orange to Pure Red (0.65 - 1.0) - RANGE MERAH LEBIH BESAR (35% dari total)
    const t = (intensity - 0.65) / 0.35;
    r = 255;
    g = Math.floor(135 * (1 - t)); // 135 → 0 (pure red)
    b = 0;
  }

  return { r, g, b };
}

/**
 * Kernel Density Estimation (KDE) dengan Elliptical Gaussian Kernel
 *
 * KDE adalah metode statistik untuk estimasi probability density function.
 * Formula: f(x,y) = (1/n) × Σ K((x-xi)/hx, (y-yi)/hy)
 *
 * Menggunakan elliptical kernel yang mengikuti shape bounding box:
 *   - Adaptive bandwidth berdasarkan ukuran bbox
 *   - Elliptical shape untuk natural hotspot
 *   - Confidence-weighted contribution
 *
 * @param {Float32Array} densityMap - Array 2D untuk density values
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {object} detection - Detection object {x, y, width, height, confidence}
 * @param {number} weight - Detection weight from calculateDetectionWeight()
 */
function addKDEDensity(densityMap, width, height, detection, weight) {
  // Center point dari deteksi
  const centerX = detection.x + detection.width / 2;
  const centerY = detection.y + detection.height / 2;

  // ADAPTIVE BANDWIDTH berdasarkan ukuran bounding box
  // Bandwidth menentukan seberapa spread heatmap
  // Larger bbox = larger bandwidth = more spread
  const bandwidthX = detection.width * 0.6; // Horizontal spread
  const bandwidthY = detection.height * 0.6; // Vertical spread

  // Minimum bandwidth untuk deteksi kecil
  const minBandwidth = 30;
  const hx = Math.max(bandwidthX, minBandwidth);
  const hy = Math.max(bandwidthY, minBandwidth);

  // Precompute bandwidth squared untuk efisiensi
  const hx2 = hx * hx;
  const hy2 = hy * hy;

  // Normalization factor untuk Gaussian kernel
  // K(u,v) = (1 / 2π×hx×hy) × exp(-0.5 × (u²/hx² + v²/hy²))
  const normFactor = 1 / (2 * Math.PI * hx * hy);

  // Radius pengaruh (3-sigma rule: 99.7% dalam radius)
  const radiusX = hx * 3;
  const radiusY = hy * 3;

  // Bounding box untuk iterasi
  const minX = Math.max(0, Math.floor(centerX - radiusX));
  const maxX = Math.min(width - 1, Math.ceil(centerX + radiusX));
  const minY = Math.max(0, Math.floor(centerY - radiusY));
  const maxY = Math.min(height - 1, Math.ceil(centerY + radiusY));

  // Confidence-based intensity multiplier
  const intensityMultiplier = detection.confidence * weight * 2.0;

  // Iterasi setiap pixel dalam elliptical radius
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      // Jarak dari center (normalized by bandwidth)
      const dx = x - centerX;
      const dy = y - centerY;

      // ELLIPTICAL Gaussian kernel
      // Menghasilkan shape yang mengikuti aspect ratio bounding box
      const exponent = -0.5 * ((dx * dx) / hx2 + (dy * dy) / hy2);
      const kernelValue = normFactor * Math.exp(exponent);

      // Add density contribution (cumulative untuk overlap)
      const idx = y * width + x;
      densityMap[idx] += kernelValue * intensityMultiplier;
    }
  }
}

/**
 * Apply Gaussian blur untuk smoothing intensity map
 * Menggunakan separable Gaussian kernel untuk efisiensi
 */
function gaussianBlur(intensityMap, width, height, kernelSize = 5) {
  // Generate 1D Gaussian kernel
  const sigma = kernelSize / 3;
  const kernel = [];
  let sum = 0;
  const half = Math.floor(kernelSize / 2);

  for (let i = -half; i <= half; i++) {
    const value = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel.push(value);
    sum += value;
  }

  // Normalize kernel
  for (let i = 0; i < kernel.length; i++) {
    kernel[i] /= sum;
  }

  // Temporary buffer
  const temp = new Float32Array(width * height);

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;
      for (let k = 0; k < kernel.length; k++) {
        const xx = x + k - half;
        if (xx >= 0 && xx < width) {
          value += intensityMap[y * width + xx] * kernel[k];
        }
      }
      temp[y * width + x] = value;
    }
  }

  // Vertical pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;
      for (let k = 0; k < kernel.length; k++) {
        const yy = y + k - half;
        if (yy >= 0 && yy < height) {
          value += temp[yy * width + x] * kernel[k];
        }
      }
      intensityMap[y * width + x] = value;
    }
  }
}

/**
 * Draw KDE (Kernel Density Estimation) Heatmap
 *
 * Pendekatan profesional untuk heatmap seperti sports analytics:
 *   1. Dark navy blue background
 *   2. KDE dengan elliptical Gaussian kernel
 *   3. Light blur untuk ultra-smooth gradient
 *   4. Semi-transparent overlay dengan screen blend
 *
 * Merah = area dengan density tertinggi (detection hotspot)
 */
function drawDetectionDensityHeatmap(ctx, canvas, detections, canvasWidth, canvasHeight) {
  if (!detections || detections.length === 0) return;

  console.log('[KDE Heatmap] Generating professional KDE heatmap for', detections.length, 'detections');

  // 1. Buat density map (Float32Array untuk precision)
  const densityMap = new Float32Array(canvasWidth * canvasHeight);

  // 2. Untuk setiap deteksi, tambahkan KDE density contribution
  detections.forEach((detection, idx) => {
    const weight = calculateDetectionWeight(detection, detections, canvasWidth, canvasHeight);
    console.log(`[KDE] Detection ${idx + 1}: weight=${weight.toFixed(3)}, confidence=${detection.confidence.toFixed(3)}`);
    addKDEDensity(densityMap, canvasWidth, canvasHeight, detection, weight);
  });

  // 3. Apply single-pass Gaussian blur untuk smooth (KDE sudah smooth by design)
  console.log('[KDE Heatmap] Applying light Gaussian blur...');
  gaussianBlur(densityMap, canvasWidth, canvasHeight, 9);

  // 4. Normalize density map ke range 0-1
  let maxDensity = 0;
  for (let i = 0; i < densityMap.length; i++) {
    maxDensity = Math.max(maxDensity, densityMap[i]);
  }

  if (maxDensity > 0) {
    for (let i = 0; i < densityMap.length; i++) {
      densityMap[i] /= maxDensity;
    }
  }

  console.log('[KDE Heatmap] Max density:', maxDensity.toFixed(6));

  // 5. Render heatmap ke temporary canvas
  const heatmapCanvas = document.createElement('canvas');
  heatmapCanvas.width = canvasWidth;
  heatmapCanvas.height = canvasHeight;
  const heatmapCtx = heatmapCanvas.getContext('2d');

  // 5a. DARK NAVY BLUE BACKGROUND (seperti referensi)
  heatmapCtx.fillStyle = 'rgb(15, 25, 55)';
  heatmapCtx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 5b. Render heatmap colors di atas background
  const imageData = heatmapCtx.createImageData(canvasWidth, canvasHeight);

  for (let y = 0; y < canvasHeight; y++) {
    for (let x = 0; x < canvasWidth; x++) {
      const idx = y * canvasWidth + x;
      const density = densityMap[idx];

      // Map density ke color
      const color = intensityToColor(density);

      // OPACITY BERDASARKAN WARNA (intensity level):
      // - Merah (0.65-1.0): 95%
      // - Orange-merah (0.45-0.65): 95%
      // - Kuning-orange (0.3-0.45): 90%
      // - Hijau (0.15-0.3): 85%
      // - Biru (0.0-0.15): 80% dengan smooth edge
      let opacity;
      if (density < 0.02) {
        // Very low density: smooth fade dari 0 ke 80%
        opacity = (density / 0.02) * 0.8; // 0% → 80% (smooth edge)
      } else if (density < 0.15) {
        // Biru range: 80%
        opacity = 0.8;
      } else if (density < 0.3) {
        // Hijau range: 85%
        opacity = 0.85;
      } else if (density < 0.45) {
        // Kuning-orange range: 90%
        opacity = 0.9;
      } else if (density < 0.65) {
        // Orange-merah range: 95%
        opacity = 0.95;
      } else {
        // Merah range: 95%
        opacity = 0.95;
      }

      const pixelIdx = idx * 4;
      imageData.data[pixelIdx] = color.r;
      imageData.data[pixelIdx + 1] = color.g;
      imageData.data[pixelIdx + 2] = color.b;
      imageData.data[pixelIdx + 3] = Math.floor(opacity * 255);
    }
  }

  // 5c. Composite heatmap colors over dark background
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = canvasWidth;
  colorCanvas.height = canvasHeight;
  const colorCtx = colorCanvas.getContext('2d');
  colorCtx.putImageData(imageData, 0, 0);

  // Draw colors over navy background
  heatmapCtx.drawImage(colorCanvas, 0, 0);

  // 6. Draw heatmap overlay ke canvas utama
  console.log('[KDE Heatmap] Rendering with screen blend...');

  ctx.save();
  // Screen blend mode untuk warna vibrant yang blend dengan gambar asli
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.8; // Semi-transparent untuk natural overlay
  ctx.drawImage(heatmapCanvas, 0, 0);
  ctx.restore();

  console.log('[KDE Heatmap] Professional KDE rendering complete');
}

// Fungsi untuk membuat confidence heatmap overlay (DEPRECATED - diganti dengan drawDepthHeatmap)
// Ini adalah alternatif praktis untuk Grad-CAM yang menunjukkan area dengan confidence tinggi
function drawConfidenceHeatmap(ctx, detections, canvasWidth, canvasHeight) {
  if (!detections || detections.length === 0) return;

  // Buat temporary canvas untuk heatmap
  const heatmapCanvas = document.createElement('canvas');
  heatmapCanvas.width = canvasWidth;
  heatmapCanvas.height = canvasHeight;
  const heatmapCtx = heatmapCanvas.getContext('2d');

  // Gambar setiap deteksi sebagai radial gradient (seperti Grad-CAM)
  detections.forEach((detection) => {
    const centerX = detection.x + detection.width / 2;
    const centerY = detection.y + detection.height / 2;

    // Radius berdasarkan ukuran bounding box (ambil yang lebih besar)
    const radius = Math.max(detection.width, detection.height) * 0.8;

    // Confidence score (0-1) menentukan opacity dan intensitas
    const confidence = detection.confidence;
    const opacity = confidence * 0.6; // Max opacity 60%

    // Warna berdasarkan confidence: merah untuk tinggi, kuning untuk sedang
    let r, g, b;
    if (confidence > 0.7) {
      // High confidence: merah
      r = 255;
      g = Math.floor(100 * (1 - confidence));
      b = Math.floor(100 * (1 - confidence));
    } else if (confidence > 0.5) {
      // Medium confidence: kuning-orange
      r = 255;
      g = Math.floor(165 + 90 * (confidence - 0.5));
      b = 0;
    } else {
      // Low confidence: kuning
      r = 255;
      g = 255;
      b = Math.floor(100 * (1 - confidence));
    }

    // Buat radial gradient
    const gradient = heatmapCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);

    // Gradient dari center (opaque) ke edge (transparent)
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${opacity})`);
    gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${opacity * 0.6})`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

    // Gambar circle dengan gradient
    heatmapCtx.fillStyle = gradient;
    heatmapCtx.beginPath();
    heatmapCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    heatmapCtx.fill();
  });

  // Draw heatmap ke canvas utama dengan blend mode
  ctx.save();
  ctx.globalCompositeOperation = 'screen'; // Blend mode untuk overlay
  ctx.drawImage(heatmapCanvas, 0, 0);
  ctx.restore();
}

// Fungsi untuk generate penjelasan deteksi
// Menghasilkan deskripsi yang menjelaskan mengapa model mendeteksi area sebagai jalan berlubang
function generateExplanation(detection, canvasWidth, canvasHeight) {
  const confidence = detection.confidence;
  const width = detection.width;
  const height = detection.height;
  const area = width * height;
  const totalArea = canvasWidth * canvasHeight;
  const areaPercentage = (area / totalArea) * 100;

  // Tentukan kategori confidence
  let confidenceLevel, confidenceDesc;
  if (confidence >= 0.8) {
    confidenceLevel = 'tinggi';
    confidenceDesc = 'sangat yakin';
  } else if (confidence >= 0.5) {
    confidenceLevel = 'sedang';
    confidenceDesc = 'mendeteksi kemungkinan';
  } else {
    confidenceLevel = 'rendah';
    confidenceDesc = 'mendeteksi kemungkinan kecil';
  }

  // Tentukan kategori ukuran
  let sizeCategory, sizeDesc;
  const avgSize = (width + height) / 2;
  if (avgSize > 100) {
    sizeCategory = 'besar';
    sizeDesc = 'ukuran yang cukup besar';
  } else if (avgSize >= 50) {
    sizeCategory = 'sedang';
    sizeDesc = 'ukuran sedang';
  } else {
    sizeCategory = 'kecil';
    sizeDesc = 'ukuran kecil';
  }

  // Tentukan posisi relatif
  const centerY = detection.y + height / 2;
  const relativePosition = centerY / canvasHeight;
  let positionDesc;
  if (relativePosition < 0.33) {
    positionDesc = 'di bagian depan gambar';
  } else if (relativePosition < 0.67) {
    positionDesc = 'di bagian tengah gambar';
  } else {
    positionDesc = 'di bagian belakang gambar';
  }

  // Generate penjelasan dinamis
  let explanation = `Model ${confidenceDesc} bahwa area ini adalah jalan berlubang dengan tingkat keyakinan ${(confidence * 100).toFixed(1)}%. `;

  explanation += `Deteksi ini memiliki ${sizeDesc} (${Math.round(width)}×${Math.round(height)} piksel) `;
  explanation += `dan menempati sekitar ${areaPercentage.toFixed(2)}% dari total area gambar, `;
  explanation += `dengan posisi ${positionDesc}. `;

  // Tambahkan penjelasan berdasarkan confidence
  if (confidence >= 0.8) {
    explanation += `Tingkat keyakinan yang tinggi menunjukkan bahwa model mendeteksi karakteristik visual yang sangat konsisten dengan jalan berlubang, seperti bentuk tidak beraturan, kontras warna yang signifikan dengan permukaan jalan di sekitarnya, dan pola kerusakan yang jelas.`;
  } else if (confidence >= 0.5) {
    explanation += `Meskipun model mendeteksi beberapa karakteristik jalan berlubang, tingkat keyakinan sedang menunjukkan bahwa fitur visualnya mungkin kurang jelas atau memiliki kemiripan dengan objek lain. Disarankan untuk verifikasi manual.`;
  } else {
    explanation += `Tingkat keyakinan yang rendah menunjukkan bahwa deteksi ini mungkin merupakan false positive atau memiliki karakteristik yang ambigu. Sangat disarankan untuk verifikasi manual sebelum mengambil tindakan.`;
  }

  return explanation;
}

// Export functions (akan digunakan di file lain)
// Karena kita pakai vanilla JS tanpa module bundler,
// functions otomatis tersedia secara global
