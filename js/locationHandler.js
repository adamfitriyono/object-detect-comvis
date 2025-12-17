/**
 * LOCATIONHANDLER.JS - Location, Geocoding, dan Map Handler
 * File ini menghandle semua fungsi terkait lokasi
 */

// Global variables
let map = null;
let marker = null;
let currentLocation = {
    latitude: null,
    longitude: null,
    address: null
};

// Inisialisasi Map menggunakan Leaflet
function initMap() {
    // Default location: Indonesia (tengah)
    const defaultLat = -2.5489;
    const defaultLng = 118.0149;
    const defaultZoom = 5;

    // Buat map
    map = L.map('map').setView([defaultLat, defaultLng], defaultZoom);

    // Tambahkan tile layer dari OpenStreetMap (GRATIS!)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    console.log('Map initialized successfully');
}

// Fungsi untuk update map dengan koordinat baru
function updateMap(lat, lng, zoomLevel = 15) {
    if (!map) {
        console.error('Map not initialized');
        return;
    }

    // Pindahkan view map ke koordinat baru
    map.setView([lat, lng], zoomLevel);

    // Hapus marker lama (jika ada)
    if (marker) {
        map.removeLayer(marker);
    }

    // Tambahkan marker baru
    marker = L.marker([lat, lng]).addTo(map);
    marker.bindPopup(`<b>Lokasi Deteksi</b><br>Lat: ${lat.toFixed(6)}<br>Lng: ${lng.toFixed(6)}`).openPopup();
}

// Fungsi untuk geocoding (alamat → koordinat) menggunakan Nominatim OSM
async function geocodeAddress(address) {
    try {
        showLoading(true);
        
        // API Nominatim OSM (GRATIS, tanpa API key)
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&addressdetails=1&limit=5`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'PotholeDetectionApp/1.0' // Required by Nominatim
            }
        });
        
        if (!response.ok) {
            throw new Error('Geocoding request failed');
        }
        
        const data = await response.json();
        
        showLoading(false);
        
        if (data.length === 0) {
            showAlert('Alamat tidak ditemukan. Coba dengan alamat yang lebih spesifik.', 'error');
            return [];
        }
        
        return data;
    } catch (error) {
        showLoading(false);
        console.error('Geocoding error:', error);
        showAlert('Gagal mencari alamat. Periksa koneksi internet Anda.', 'error');
        return [];
    }
}

// Fungsi untuk reverse geocoding (koordinat → alamat)
async function reverseGeocode(lat, lng) {
    try {
        showLoading(true);
        
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'PotholeDetectionApp/1.0'
            }
        });
        
        if (!response.ok) {
            throw new Error('Reverse geocoding failed');
        }
        
        const data = await response.json();
        
        showLoading(false);
        
        return data;
    } catch (error) {
        showLoading(false);
        console.error('Reverse geocoding error:', error);
        showAlert('Gagal mendapatkan alamat dari koordinat.', 'error');
        return null;
    }
}

// Fungsi untuk mengisi form detail alamat
function fillAddressDetails(addressData) {
    const address = addressData.address || {};
    
    // Isi field-field alamat
    document.getElementById('street').value = address.road || address.street || '-';
    document.getElementById('village').value = address.village || address.suburb || address.neighbourhood || '-';
    document.getElementById('district').value = address.county || address.state_district || address.municipality || '-';
    document.getElementById('city').value = address.city || address.town || address.city_district || address.state || '-';
    
    // Isi koordinat
    document.getElementById('latitude').value = addressData.lat || currentLocation.latitude || '-';
    document.getElementById('longitude').value = addressData.lon || currentLocation.longitude || '-';
    
    // Update current location
    currentLocation.latitude = parseFloat(addressData.lat || currentLocation.latitude);
    currentLocation.longitude = parseFloat(addressData.lon || currentLocation.longitude);
    currentLocation.address = addressData.display_name || '-';
}

// Fungsi untuk handle autocomplete search
const handleAddressSearch = debounce(async function() {
    const input = document.getElementById('addressInput');
    const query = input.value.trim();
    const suggestionsDiv = document.getElementById('addressSuggestions');
    
    // Clear suggestions jika input kosong
    if (query.length < 3) {
        suggestionsDiv.innerHTML = '';
        suggestionsDiv.classList.remove('active');
        return;
    }
    
    // Geocode address
    const results = await geocodeAddress(query);
    
    // Tampilkan suggestions
    if (results.length > 0) {
        suggestionsDiv.innerHTML = '';
        suggestionsDiv.classList.add('active');
        
        results.forEach(result => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.textContent = result.display_name;
            
            item.addEventListener('click', function() {
                // Set input value
                input.value = result.display_name;
                
                // Fill address details
                fillAddressDetails(result);
                
                // Update map
                updateMap(parseFloat(result.lat), parseFloat(result.lon));
                
                // Clear suggestions
                suggestionsDiv.innerHTML = '';
                suggestionsDiv.classList.remove('active');
                
                showAlert('Lokasi berhasil dipilih!', 'success');
            });
            
            suggestionsDiv.appendChild(item);
        });
    } else {
        suggestionsDiv.innerHTML = '<div class="suggestion-item">Tidak ada hasil</div>';
        suggestionsDiv.classList.add('active');
    }
}, 500); // Delay 500ms setelah user berhenti mengetik

// Fungsi untuk mendapatkan lokasi saat ini dari GPS device
function getCurrentLocation() {
    if (!navigator.geolocation) {
        showAlert('Browser Anda tidak mendukung geolocation.', 'error');
        return;
    }
    
    showLoading(true);
    showAlert('Mengambil lokasi Anda...', 'info');
    
    navigator.geolocation.getCurrentPosition(
        async function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            // Update map
            updateMap(lat, lng);
            
            // Get address from coordinates
            const addressData = await reverseGeocode(lat, lng);
            
            if (addressData) {
                fillAddressDetails(addressData);
                document.getElementById('addressInput').value = addressData.display_name;
                showAlert('Lokasi berhasil didapatkan!', 'success');
            }
        },
        function(error) {
            showLoading(false);
            let message = 'Gagal mendapatkan lokasi. ';
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    message += 'Anda menolak permintaan akses lokasi.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    message += 'Informasi lokasi tidak tersedia.';
                    break;
                case error.TIMEOUT:
                    message += 'Request timeout.';
                    break;
                default:
                    message += 'Error tidak diketahui.';
            }
            
            showAlert(message, 'error');
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// Fungsi untuk handle manual address input
function handleManualAddress() {
    const manualInput = document.getElementById('manualAddress').value.trim();
    
    if (manualInput.length < 3) {
        showAlert('Masukkan alamat yang lebih detail.', 'error');
        return;
    }
    
    // Set ke address input dan trigger search
    document.getElementById('addressInput').value = manualInput;
    handleAddressSearch();
}

// Setup event listeners untuk location section
function setupLocationListeners() {
    // Address input autocomplete
    const addressInput = document.getElementById('addressInput');
    addressInput.addEventListener('input', handleAddressSearch);
    
    // Click outside to close suggestions
    document.addEventListener('click', function(e) {
        const suggestionsDiv = document.getElementById('addressSuggestions');
        if (!addressInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
            suggestionsDiv.classList.remove('active');
        }
    });
    
    // Get current location button
    const getCurrentLocationBtn = document.getElementById('getCurrentLocationBtn');
    getCurrentLocationBtn.addEventListener('click', getCurrentLocation);
    
    // Manual address input (trigger on Enter key)
    const manualInput = document.getElementById('manualAddress');
    manualInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleManualAddress();
        }
    });
}

// Fungsi untuk mendapatkan lokasi saat ini (untuk digunakan di hasil deteksi)
function getCurrentLocationData() {
    return currentLocation;
}