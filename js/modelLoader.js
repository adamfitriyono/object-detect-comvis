/**
 * MODELLOADER.JS - YOLOv8 Support (Fixed)
 * Format: [1, 5, 8400] → transpose to [1, 8400, 5]
 */

// Global variables
let session = null;
let modelLoaded = false;
let inputMetadata = null;

// Model configuration (sesuaikan dengan model Anda)
const MODEL_CONFIG = {
    modelPath: 'models/best.onnx',
    confidenceThreshold: 0.5,  // ← Naik ke 0.5 untuk filter lebih ketat
    iouThreshold: 0.4,  // ← Diturunkan ke 0.4 untuk lebih agresif menghilangkan overlap
    classNames: ['pothole']
};

/* ===== loadModel ===== */
async function loadModel() {
    try {
        showLoading && showLoading(true);
        showAlert && showAlert('Memuat model...', 'info');

        if (typeof ort === 'undefined') {
            throw new Error('onnxruntime-web (ort) tidak ditemukan.');
        }

        // Try WASM dulu (lebih stabil dari WebGL)
        try {
            console.log('Creating session with WASM...');
            session = await ort.InferenceSession.create(MODEL_CONFIG.modelPath, { executionProviders: ['wasm'] });
        } catch (e) {
            console.warn('WASM failed, trying WebGL...');
            session = await ort.InferenceSession.create(MODEL_CONFIG.modelPath, { executionProviders: ['webgl'] });
        }

        console.log('Model loaded');
        console.log('Input names:', session.inputNames);
        console.log('Output names:', session.outputNames);

        // YOLOv8 typically expects 640x640
        inputMetadata = {
            inputName: session.inputNames[0],
            inputSize: 640  // YOLOv8 standard
        };
        console.log('Using input size: 640 (YOLOv8)');

        modelLoaded = true;
        showLoading && showLoading(false);
        showAlert && showAlert('Model YOLOv8 berhasil dimuat!', 'success');
        return true;
    } catch (err) {
        modelLoaded = false;
        console.error('loadModel error:', err);
        showLoading && showLoading(false);
        showAlert && showAlert('Gagal memuat model: ' + (err && err.message ? err.message : err), 'error');
        return false;
    }
}

/* ===== preprocess (simple resize) ===== */
function preprocessImage(canvas, targetSize) {
    const tmp = document.createElement('canvas');
    tmp.width = targetSize;
    tmp.height = targetSize;
    const ctx = tmp.getContext('2d');
    ctx.drawImage(canvas, 0, 0, targetSize, targetSize);
    const img = ctx.getImageData(0, 0, targetSize, targetSize).data;

    // CHW Float32Array
    const area = targetSize * targetSize;
    const arr = new Float32Array(3 * area);
    let px = 0;
    for (let i = 0; i < img.length; i += 4) {
        arr[px] = img[i] / 255.0;                // R
        arr[area + px] = img[i + 1] / 255.0;    // G
        arr[2 * area + px] = img[i + 2] / 255.0;// B
        px++;
    }
    return arr;
}

/* ===== PERBAIKAN: Parse YOLOv8 format [1, 5, 8400] dengan benar ===== */
function postprocessOutput(outputTensor, origWidth, origHeight) {
    const data = outputTensor.data;
    const dims = outputTensor.dims || [];
    const boxes = [];
    const inputSize = 640;

    console.log('Postprocessing YOLOv8 format');
    console.log('Output shape:', dims);
    console.log('Original image size:', origWidth, 'x', origHeight);

    if (dims.length !== 3) {
        console.warn('Expected 3D output [batch, features, num_detections]');
        return boxes;
    }

    const [batch, numFeatures, numDetections] = dims;
    console.log(`Parsed: batch=${batch}, features=${numFeatures}, detections=${numDetections}`);

    // YOLOv8 ONNX format: [1, 5, 8400]
    // Memory layout (interleaved per channel):
    // [x_all, y_all, w_all, h_all, conf_all]
    // = [x0...x8399, y0...y8399, w0...w8399, h0...h8399, conf0...conf8399]
    
    const numDets = numDetections;
    const offset_x = 0;
    const offset_y = numDets;
    const offset_w = numDets * 2;
    const offset_h = numDets * 3;
    const offset_conf = numDets * 4;

    console.log(`Memory offsets: x=${offset_x}, y=${offset_y}, w=${offset_w}, h=${offset_h}, conf=${offset_conf}`);

    const scaleX = origWidth / inputSize;
    const scaleY = origHeight / inputSize;
    console.log(`Scale: ${scaleX.toFixed(3)} x ${scaleY.toFixed(3)}`);

    let minConf = Infinity, maxConf = -Infinity;
    let validCount = 0;

    for (let i = 0; i < numDets; i++) {
        const x = data[offset_x + i];
        const y = data[offset_y + i];
        const w = data[offset_w + i];
        const h = data[offset_h + i];
        const confidence = data[offset_conf + i];

        minConf = Math.min(minConf, confidence);
        maxConf = Math.max(maxConf, confidence);

        if (i < 5) {
            console.log(`  Sample[${i}]: x=${x.toFixed(1)}, y=${y.toFixed(1)}, w=${w.toFixed(1)}, h=${h.toFixed(1)}, conf=${confidence.toFixed(4)}`);
        }

        // Filter threshold
        if (confidence < MODEL_CONFIG.confidenceThreshold) {
            continue;
        }

        validCount++;

        // Center to corner
        const x1 = (x - w / 2) * scaleX;
        const y1 = (y - h / 2) * scaleY;
        const x2 = (x + w / 2) * scaleX;
        const y2 = (y + h / 2) * scaleY;

        // Clamp
        const clampX1 = Math.max(0, Math.min(x1, origWidth));
        const clampY1 = Math.max(0, Math.min(y1, origHeight));
        const clampX2 = Math.max(0, Math.min(x2, origWidth));
        const clampY2 = Math.max(0, Math.min(y2, origHeight));

        const finalWidth = clampX2 - clampX1;
        const finalHeight = clampY2 - clampY1;

        if (finalWidth > 5 && finalHeight > 5) {
            boxes.push({
                x: clampX1,
                y: clampY1,
                width: finalWidth,
                height: finalHeight,
                confidence: confidence,
                label: MODEL_CONFIG.classNames[0] || 'pothole'
            });

            if (boxes.length <= 5) {
                console.log(`  Box[${boxes.length-1}]: conf=${(confidence*100).toFixed(1)}%, pos=(${clampX1.toFixed(0)},${clampY1.toFixed(0)}), size=${finalWidth.toFixed(0)}x${finalHeight.toFixed(0)}`);
            }
        }
    }

    console.log(`Confidence range: ${minConf.toFixed(4)} to ${maxConf.toFixed(4)}`);
    console.log(`Valid detections (conf >= ${MODEL_CONFIG.confidenceThreshold}): ${validCount}`);
    console.log(`Boxes before NMS: ${boxes.length}`);
    
    // Apply Non-Maximum Suppression (NMS) to remove overlapping boxes
    // This is critical to avoid counting the same pothole multiple times
    if (boxes.length > 0) {
        const filteredBoxes = nonMaxSuppression(boxes, MODEL_CONFIG.iouThreshold);
        console.log(`Final boxes after NMS (IoU threshold: ${MODEL_CONFIG.iouThreshold}): ${filteredBoxes.length}`);
        console.log(`Removed ${boxes.length - filteredBoxes.length} overlapping detections`);
        return filteredBoxes;
    }
    
    return boxes;
}

/* ===== detectPotholes ===== */
async function detectPotholes(canvas) {
    if (!modelLoaded || !session) {
        throw new Error('Model belum dimuat!');
    }

    try {
        const origWidth = canvas.width || 1280;
        const origHeight = canvas.height || 720;
        const inputSize = 640;
        const inputName = inputMetadata ? inputMetadata.inputName : 'images';

        showLoading && showLoading(true);
        showAlert && showAlert('Menjalankan deteksi...', 'info');

        // Preprocess
        const tensorData = preprocessImage(canvas, inputSize);
        const input = new ort.Tensor('float32', tensorData, [1, 3, inputSize, inputSize]);

        console.log('Running YOLOv8 inference...');
        // Run inference
        const outputs = await session.run({ [inputName]: input });
        console.log('Inference success');
        console.log('Output keys:', Object.keys(outputs));

        // Get output (usually named 'output0' or first available)
        const outputKey = Object.keys(outputs)[0];
        const outputTensor = outputs[outputKey];
        console.log('Using output:', outputKey, 'shape:', outputTensor.dims);

        // Postprocess
        const detections = postprocessOutput(outputTensor, origWidth, origHeight);

        showLoading && showLoading(false);
        return detections || [];
    } catch (err) {
        showLoading && showLoading(false);
        console.error('detectPotholes error:', err);
        throw err;
    }
}

function isModelReady() {
    return modelLoaded && session !== null;
}

window.loadModel = loadModel;
window.isModelReady = isModelReady;
window.detectPotholes = detectPotholes;