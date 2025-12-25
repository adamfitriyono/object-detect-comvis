---
name: Implementasi Heatmap Kedalaman Lubang
overview: Mengganti heatmap confidence dengan heatmap kedalaman yang menunjukkan intensitas kedalaman lubang menggunakan kombinasi analisis intensitas pixel, ukuran bounding box, dan confidence score. Heatmap menggunakan skema warna biru (rendah) → kuning (sedang) → merah (tinggi) dengan gradasi yang smooth.
todos:
  - id: analyze-intensity
    content: Buat fungsi analyzePotholeDepth() untuk analisis intensitas pixel dalam bounding box
    status: completed
  - id: normalize-size
    content: Buat fungsi normalizeBoxSize() untuk normalisasi ukuran bounding box
    status: completed
  - id: calculate-depth
    content: Buat fungsi calculateDepthScore() yang menggabungkan intensity, size, dan confidence
    status: completed
    dependencies:
      - analyze-intensity
      - normalize-size
  - id: color-mapping
    content: Implementasi fungsi getDepthColor() untuk mapping depthScore ke warna (biru→kuning→merah)
    status: completed
  - id: draw-depth-heatmap
    content: Ganti drawConfidenceHeatmap() dengan drawDepthHeatmap() yang menggunakan depthScore dan color mapping
    status: completed
    dependencies:
      - calculate-depth
      - color-mapping
  - id: update-display
    content: Update displayDetectionResults() dan rerenderDetectionResults() untuk menggunakan drawDepthHeatmap() dengan originalCanvas
    status: completed
    dependencies:
      - draw-depth-heatmap
  - id: test-heatmap
    content: Test heatmap dengan berbagai gambar dan verifikasi gradasi warna serta performa
    status: completed
    dependencies:
      - update-display
---

#Implementasi Heatmap Kedalaman Lubang

## Analisis Masalah

**Heatmap Saat Ini:**

- Menunjukkan confidence score dari deteksi YOLO
- Menggunakan radial gradient per bounding box
- Tidak mencerminkan kedalaman lubang

**Heatmap yang Diinginkan:**

- Menunjukkan **intensitas kedalaman lubang**
- Semakin gelap = semakin tinggi intensitas (kedalaman)
- Warna merah = intensitas tertinggi
- Visual dengan berbagai warna (gradasi biru → kuning → merah)

## Pendekatan Estimasi Kedalaman

Karena YOLO hanya memberikan bounding box dan confidence (tidak ada data 3D langsung), kita akan menggunakan **analisis visual** dari area bounding box:

1. **Analisis Intensitas Pixel (Brightness)**

- Lubang yang lebih dalam biasanya lebih gelap (lebih banyak shadow)
- Hitung rata-rata brightness dalam bounding box
- Normalisasi ke skala 0-1 (0 = terang, 1 = gelap)

2. **Ukuran Bounding Box**

- Lubang yang lebih besar mungkin lebih dalam
- Normalisasi ukuran relatif terhadap ukuran gambar

3. **Confidence Score**

- Sebagai faktor tambahan (lubang yang lebih jelas terdeteksi mungkin lebih dalam)
- Sudah dalam skala 0-1

4. **Skor Komposit Kedalaman**

- Formula: `depthScore = (intensityWeight * darkness) + (sizeWeight * normalizedSize) + (confidenceWeight * confidence)`
- Weight: intensity (50%), size (30%), confidence (20%)

## Implementasi

### 1. Fungsi Analisis Intensitas Pixel

**File:** `js/utils.js`

- Buat fungsi `analyzePotholeDepth(canvas, detection)` yang:
- Ekstrak area bounding box dari canvas
- Hitung rata-rata brightness (grayscale) dari pixel dalam bounding box
- Return nilai darkness (0-1, dimana 1 = paling gelap)

### 2. Fungsi Normalisasi Ukuran

**File:** `js/utils.js`

- Buat fungsi `normalizeBoxSize(detection, canvasWidth, canvasHeight)` yang:
- Hitung area bounding box
- Normalisasi terhadap total area canvas
- Return nilai 0-1

### 3. Fungsi Kalkulasi Skor Kedalaman

**File:** `js/utils.js`

- Buat fungsi `calculateDepthScore(detection, canvas, canvasWidth, canvasHeight)` yang:
- Panggil `analyzePotholeDepth()` untuk mendapatkan darkness
- Panggil `normalizeBoxSize()` untuk mendapatkan normalized size
- Ambil confidence dari detection
- Hitung skor komposit dengan weight
- Return depthScore (0-1)

### 4. Fungsi Heatmap Kedalaman Baru

**File:** `js/utils.js`

- Ganti fungsi `drawConfidenceHeatmap()` dengan `drawDepthHeatmap(ctx, detections, canvasWidth, canvasHeight, originalCanvas)` yang:
- Untuk setiap detection, hitung depthScore menggunakan `calculateDepthScore()`
- Buat temporary canvas untuk heatmap
- Untuk setiap detection:
    - Tentukan warna berdasarkan depthScore:
    - 0.0-0.33: Biru (RGB: 0, 0, 255 → 0, 255, 255 cyan)
    - 0.33-0.66: Kuning (RGB: 0, 255, 255 → 255, 255, 0)
    - 0.66-1.0: Merah (RGB: 255, 255, 0 → 255, 0, 0)
    - Buat radial gradient dari center bounding box
    - Opacity berdasarkan depthScore (semakin tinggi = semakin opaque)
    - Radius berdasarkan ukuran bounding box
- Apply Gaussian blur untuk smoothness (opsional, bisa menggunakan multiple passes)
- Draw heatmap ke canvas utama dengan blend mode 'multiply' atau 'overlay'

### 5. Update Fungsi Display Results

**File:** `app.js`

- Update `displayDetectionResults()` untuk:
- Pass `originalCanvas` ke `drawDepthHeatmap()` (untuk analisis pixel)
- Update `rerenderDetectionResults()` untuk:
- Pass `lastDetectionCanvas` ke `drawDepthHeatmap()`

### 6. Optimasi dan Smoothing

- Gunakan multiple radial gradients dengan opacity berbeda untuk efek smooth
- Atau gunakan teknik Gaussian blur manual dengan canvas operations
- Pastikan heatmap tidak terlalu opaque sehingga gambar asli masih terlihat

## Struktur Data

```javascript
// Detection object (existing)
{
  x, y, width, height, confidence, label
}

// Enhanced detection dengan depthScore (internal)
{
  x, y, width, height, confidence, label,
  depthScore: 0.0-1.0  // calculated on-the-fly
}
```



## Color Mapping

```javascript
// depthScore: 0.0 → 1.0
function getDepthColor(depthScore) {
  if (depthScore < 0.33) {
    // Biru → Cyan
    const t = depthScore / 0.33;
    return `rgb(0, ${Math.floor(255 * t)}, 255)`;
  } else if (depthScore < 0.66) {
    // Cyan → Kuning
    const t = (depthScore - 0.33) / 0.33;
    return `rgb(${Math.floor(255 * t)}, 255, ${Math.floor(255 * (1 - t))})`;
  } else {
    // Kuning → Merah
    const t = (depthScore - 0.66) / 0.34;
    return `rgb(255, ${Math.floor(255 * (1 - t))}, 0)`;
  }
}
```



## Testing

- Test dengan berbagai gambar yang memiliki lubang dengan kedalaman berbeda
- Verifikasi bahwa heatmap menunjukkan gradasi warna yang jelas