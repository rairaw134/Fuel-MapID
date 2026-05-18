let konsumsi = 40;
let map = null;
let markerAwal = null;
let markerTujuan = null;
let routeLayer = null;
let targetInput = "";
let jarakGlobal = 0;

// =====================
// UPDATE HASIL OTOMATIS
// =====================
function updateHasil() {
  if (jarakGlobal === 0) return;
  let bbm = jarakGlobal / konsumsi;
  let harga = parseFloat(document.getElementById("bbm").value);
  let biaya = bbm * harga;
  document.getElementById("jarak").innerText = jarakGlobal.toFixed(2) + " Km";
  document.getElementById("bbmHasil").innerText = bbm.toFixed(2) + " Liter";
  document.getElementById("biaya").innerText = "Rp " + Math.round(biaya).toLocaleString('id-ID');
}

function pilihKendaraan(km, el) {
  konsumsi = km;
  document.querySelectorAll(".vehicle button").forEach(btn => btn.classList.remove("active"));
  el.classList.add("active");
  updateHasil(); 
}

// =====================
// MAP MODAL & INIT
// =====================
function openMap(target) {
  document.getElementById("mapModal").style.display = "flex";
  targetInput = target;
  
  if (!map) initMap();
  
  setTimeout(() => {
    map.invalidateSize();
    
    // Auto-Center Peta ke koordinat yang sudah dicari sebelumnya
    let latId = target === 'awal' ? "latAwal" : "latTujuan";
    let lonId = target === 'awal' ? "longAwal" : "longTujuan";
    let lat = document.getElementById(latId).value;
    let lon = document.getElementById(lonId).value;
    
    if (lat && lon && target !== 'hasil') {
      map.setView([lat, lon], 14); // Pindahkan kamera peta ke lokasi tersebut
    }
  }, 200);
}

function closeMap() {
  document.getElementById("mapModal").style.display = "none";
}

function initMap() {
  map = L.map('map').setView([-7.25, 112.75], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(map);

  // EVENT SAAT PETA DIKLIK
  map.on("click", async function(e) {
    if (targetInput === "hasil") return; 

    let lat = e.latlng.lat;
    let lng = e.latlng.lng;

    let inputId = targetInput === "awal" ? "searchAwal" : "searchTujuan";
    let latId = targetInput === "awal" ? "latAwal" : "latTujuan";
    let lonId = targetInput === "awal" ? "longAwal" : "longTujuan";

    // 1. Tambah Marker
    if (targetInput === "awal") {
      if (markerAwal) map.removeLayer(markerAwal);
      markerAwal = L.marker([lat, lng]).addTo(map);
    } else {
      if (markerTujuan) map.removeLayer(markerTujuan);
      markerTujuan = L.marker([lat, lng]).addTo(map);
    }

    // 2. Update Koordinat
    document.getElementById(latId).value = lat.toFixed(6);
    document.getElementById(lonId).value = lng.toFixed(6);

    // 3. REVERSE GEOCODING (Ubah Titik Klik jadi Nama Tempat)
    document.getElementById(inputId).value = "Mencari nama jalan...";
    try {
      let response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      let data = await response.json();
      document.getElementById(inputId).value = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch (error) {
      document.getElementById(inputId).value = "Gagal mengambil nama jalan";
    }

    setTimeout(() => closeMap(), 600);
  });
}

// =====================
// PENCARIAN DENGAN REKOMENDASI (AUTOCOMPLETE)
// =====================
let searchTimeout; // Timer untuk mencegah spam ke server

// 1. Buat kotak dropdown secara otomatis ke dalam HTML saat halaman dimuat
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("searchAwal").parentElement.insertAdjacentHTML('beforeend', '<div id="sugAwal" class="suggestions-box"></div>');
  document.getElementById("searchTujuan").parentElement.insertAdjacentHTML('beforeend', '<div id="sugTujuan" class="suggestions-box"></div>');
});

// 2. Fungsi yang berjalan setiap kali user mengetik 1 huruf
function onTyping(target) {
  clearTimeout(searchTimeout); // Reset timer agar tidak jalan sebelum user selesai ngetik
  
  let inputId = (target === 'awal') ? "searchAwal" : "searchTujuan";
  let boxId = (target === 'awal') ? "sugAwal" : "sugTujuan";
  
  let query = document.getElementById(inputId).value.trim();
  let box = document.getElementById(boxId);

  // Jika ketikan kurang dari 3 huruf, sembunyikan dropdown
  if (query.length < 3) {
    box.style.display = "none";
    return;
  }

  // Beri jeda 600ms setelah user berhenti mengetik, baru cari datanya (Teknik Debounce)
  searchTimeout = setTimeout(() => fetchRekomendasi(query, target, boxId), 600);
}

// 3. Menarik 5 Rekomendasi Teratas dari Server
async function fetchRekomendasi(query, target, boxId) {
  let box = document.getElementById(boxId);
  box.innerHTML = `<div class="suggestion-item"><i>Mencari rekomendasi...</i></div>`;
  box.style.display = "block";

  try {
    let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=id`;
    let response = await fetch(url, { headers: { "Accept-Language": "id-ID,id;q=0.9" } });
    let data = await response.json();

    if (data.length > 0) {
      box.innerHTML = ""; // Hapus tulisan loading
      
      // Masukkan hasil rekomendasi ke dalam list dropdown
      data.forEach(item => {
        let div = document.createElement("div");
        div.className = "suggestion-item";
        div.innerText = item.display_name; // Nama alamat lengkap
        
        // Apa yang terjadi kalau list ini diklik?
        div.onclick = () => pilihRekomendasi(item, target, boxId);
        
        box.appendChild(div);
      });
    } else {
      box.innerHTML = `<div class="suggestion-item"><i>Lokasi tidak ditemukan</i></div>`;
      setTimeout(() => box.style.display = "none", 2000);
    }
  } catch (error) {
    box.innerHTML = `<div class="suggestion-item"><i>Gagal memuat jaringan</i></div>`;
  }
}

// 4. Mengeksekusi Rekomendasi yang Diklik
function pilihRekomendasi(data, target, boxId) {
  let inputId = (target === 'awal') ? "searchAwal" : "searchTujuan";
  let latId = (target === 'awal') ? "latAwal" : "latTujuan";
  let lonId = (target === 'awal') ? "longAwal" : "longTujuan";

  let lat = parseFloat(data.lat);
  let lon = parseFloat(data.lon);

  // Isi teks di kotak pencarian
  document.getElementById(inputId).value = data.display_name;
  
  // Isi Koordinat di latar belakang
  document.getElementById(latId).value = lat.toFixed(6);
  document.getElementById(lonId).value = lon.toFixed(6);

  // Tutup kotak dropdown
  document.getElementById(boxId).style.display = "none";

  // Tandai Peta (Marker)
  if (!map) initMap();
  if (target === 'awal') {
     if (markerAwal) map.removeLayer(markerAwal);
     markerAwal = L.marker([lat, lon]).addTo(map);
  } else {
     if (markerTujuan) map.removeLayer(markerTujuan);
     markerTujuan = L.marker([lat, lon]).addTo(map);
  }
}

// =====================
// PEMICU EVENT LISTENER
// =====================
// Jalankan fungsi onTyping HANYA saat ada input/huruf yang diketik
document.getElementById("searchAwal").addEventListener("input", () => onTyping('awal'));
document.getElementById("searchTujuan").addEventListener("input", () => onTyping('tujuan'));

// Menutup dropdown secara otomatis kalau user mengeklik tempat sembarangan di luar kotak
document.addEventListener("click", function(e) {
  if (!e.target.closest('.search')) {
    if(document.getElementById("sugAwal")) document.getElementById("sugAwal").style.display = "none";
    if(document.getElementById("sugTujuan")) document.getElementById("sugTujuan").style.display = "none";
  }
});

// =====================
// PEMICU OTOMATIS (TRIGGER)
// =====================
// 1. Jika user menekan tombol Enter di keyboard
document.getElementById("searchAwal").addEventListener("keypress", function(e) {
  if (e.key === "Enter") { e.preventDefault(); inputEl.blur(); cariLokasi('awal'); }
});
document.getElementById("searchTujuan").addEventListener("keypress", function(e) {
  if (e.key === "Enter") { e.preventDefault(); inputEl.blur(); cariLokasi('tujuan'); }
});

// 2. Jika user mengetik lalu pindah mengeklik kolom lain (tanpa Enter)
document.getElementById("searchAwal").addEventListener("change", function() {
  cariLokasi('awal');
});
document.getElementById("searchTujuan").addEventListener("change", function() {
  cariLokasi('tujuan');
});

// Event Enter agar auto-search saat keyboard ditekan enter
document.getElementById("searchAwal").addEventListener("keypress", function(e) {
  if (e.key === "Enter") { e.preventDefault(); cariLokasi('awal'); }
});
document.getElementById("searchTujuan").addEventListener("keypress", function(e) {
  if (e.key === "Enter") { e.preventDefault(); cariLokasi('tujuan'); }
});

// =====================
// HITUNG JARAK & RUTE
// =====================
async function hitungBBM() {
  let lat1 = document.getElementById("latAwal").value;
  let lon1 = document.getElementById("longAwal").value;
  let lat2 = document.getElementById("latTujuan").value;
  let lon2 = document.getElementById("longTujuan").value;

  if (!lat1 || !lat2) return alert("Tentukan lokasi awal dan tujuan terlebih dahulu!");

  let btn = document.querySelector(".btn");
  let textLama = btn.innerText;
  btn.innerText = "Mencari Rute...";

  let url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`;

  try {
    let response = await fetch(url);
    let data = await response.json();
    btn.innerText = textLama;

    if (data.code === "Ok") {
      jarakGlobal = data.routes[0].distance / 1000;
      let geometry = data.routes[0].geometry;

      updateHasil();
      openMap('hasil');
      
      // Bersihkan marker lama
      if (markerAwal) map.removeLayer(markerAwal);
      if (markerTujuan) map.removeLayer(markerTujuan);
      if (routeLayer) map.removeLayer(routeLayer);
      
      // Gambar rute
      routeLayer = L.geoJSON(geometry, { style: { color: '#2f8d61', weight: 5 } }).addTo(map);
      
      // Pasang ulang marker di ujung rute
      markerAwal = L.marker([lat1, lon1]).addTo(map);
      markerTujuan = L.marker([lat2, lon2]).addTo(map);

      map.fitBounds(routeLayer.getBounds());
    } else {
      alert("Rute jalan tidak ditemukan.");
    }
  } catch (error) {
    btn.innerText = textLama;
    alert("Gagal menghitung rute.");
  }
}

document.getElementById("bbm").addEventListener("change", function() {
  document.getElementById("hargaBBM").innerText = "Rp " + parseInt(this.value).toLocaleString('id-ID') + "/Ltr";
  updateHasil(); 
});
