// WorkLoco Interactive Proximity Radar Map (Leaflet.js)

class RadarMapController {
  constructor(mapContainerId = 'leaflet-map') {
    this.containerId = mapContainerId;
    this.map = null;
    this.userMarker = null;
    this.radarCircle = null;
    this.jobMarkersLayer = null;
    this.currentCenter = [16.3067, 80.4365]; // Default Guntur center
    this.currentRadiusKm = 10;
  }

  init() {
    if (this.map) return;

    // Initialize Leaflet map
    this.map = L.map(this.containerId, {
      center: this.currentCenter,
      zoom: 13,
      zoomControl: false
    });

    // Add high-clarity CartoDB Positron / OSM tiles for crisp street-level visibility
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
      maxZoom: 19
    }).addTo(this.map);

    L.control.zoom({ position: 'topright' }).addTo(this.map);

    // Layer group for dynamic job pins
    this.jobMarkersLayer = L.layerGroup().addTo(this.map);

    this.renderUserPin();
    this.updateRadarCircle(this.currentRadiusKm);
  }

  setCenter(lat, lng, zoom = null) {
    this.currentCenter = [lat, lng];
    if (this.map) {
      this.map.setView(this.currentCenter, zoom || this.calculateZoom(this.currentRadiusKm));
      this.renderUserPin();
      this.updateRadarCircle(this.currentRadiusKm);
    }
  }

  renderUserPin() {
    if (!this.map) return;

    if (this.userMarker) {
      this.map.removeLayer(this.userMarker);
    }

    // Custom pulsing SVG pin for candidate/user GPS origin
    const userIcon = L.divIcon({
      className: 'user-radar-pin',
      html: `
        <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background: rgba(217, 74, 38, 0.25); animation: pulse-radar 2s infinite ease-out;"></div>
          <div style="position: relative; width: 16px; height: 16px; border-radius: 50%; background: #D94A26; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    this.userMarker = L.marker(this.currentCenter, { icon: userIcon, zIndexOffset: 1000 }).addTo(this.map);
    this.userMarker.bindTooltip('📍 Your Current Radar Center', { direction: 'top', offset: [0, -14] });
  }

  updateRadarCircle(radiusKm) {
    this.currentRadiusKm = radiusKm;
    if (!this.map) return;

    if (this.radarCircle) {
      this.map.removeLayer(this.radarCircle);
    }

    // Geofenced radius circle (in meters)
    const radiusMeters = radiusKm * 1000;
    this.radarCircle = L.circle(this.currentCenter, {
      radius: radiusMeters,
      color: '#D94A26',
      weight: 2,
      dashArray: '6, 6',
      fillColor: '#D94A26',
      fillOpacity: 0.08
    }).addTo(this.map);

    // Auto-fit bounds if radius changed significantly
    if (radiusKm <= 50) {
      const bounds = this.radarCircle.getBounds();
      this.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    }
  }

  calculateZoom(radiusKm) {
    if (radiusKm <= 2) return 15;
    if (radiusKm <= 5) return 14;
    if (radiusKm <= 10) return 13;
    if (radiusKm <= 25) return 11;
    if (radiusKm <= 50) return 10;
    return 6;
  }

  renderJobPins(jobs, onSelectJob) {
    if (!this.jobMarkersLayer) return;
    this.jobMarkersLayer.clearLayers();

    jobs.forEach(job => {
      if (!job.lat || !job.lng) return;

      const categoryColor = this.getCategoryColor(job.category);
      const isUrgent = (job.days_remaining || 5) <= 3;

      const jobIcon = L.divIcon({
        className: 'job-radar-pin',
        html: `
          <div style="background: ${categoryColor}; color: white; padding: 4px 8px; border-radius: 12px; font-weight: 700; font-size: 11px; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 4px 10px rgba(0,0,0,0.25); border: 2px solid white; white-space: nowrap; cursor: pointer; transition: transform 0.2s;"
               onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'">
            <span>${this.getCategoryEmoji(job.category)}</span>
            <span>₹${(job.salary_min / 1000).toFixed(0)}k</span>
          </div>
        `,
        iconSize: [60, 24],
        iconAnchor: [30, 12]
      });

      const marker = L.marker([job.lat, job.lng], { icon: jobIcon });

      const popupContent = `
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; min-width: 200px; padding: 4px;">
          <h4 style="font-size: 13px; font-weight: 700; color: #1E293B; margin-bottom: 4px;">${job.title}</h4>
          <p style="font-size: 11px; color: #64748B; margin-bottom: 6px;">📍 ${job.location_name}</p>
          <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; margin-bottom: 8px;">
            <span style="color: #059669;">💰 ₹${job.salary_min.toLocaleString()} - ₹${job.salary_max.toLocaleString()}</span>
            <span style="color: #D94A26;">📏 ${job.distance_km || 0} km</span>
          </div>
          <button id="pin-apply-${job.job_id}" style="width: 100%; background: #D94A26; color: white; border: none; border-radius: 6px; padding: 5px; font-size: 11px; font-weight: 700; cursor: pointer;">
            Quick Apply
          </button>
        </div>
      `;

      marker.bindPopup(popupContent);

      marker.on('click', () => {
        if (onSelectJob) onSelectJob(job);
        setTimeout(() => {
          const btn = document.getElementById(`pin-apply-${job.job_id}`);
          if (btn && onSelectJob) {
            btn.addEventListener('click', () => onSelectJob(job, true));
          }
        }, 100);
      });

      this.jobMarkersLayer.addLayer(marker);
    });
  }

  getCategoryColor(category) {
    switch (category) {
      case 'Creative & Media': return '#D94A26'; // Terracotta
      case 'Hospitality & Food': return '#F59E0B'; // Saffron Gold
      case 'Logistics & Delivery': return '#2563EB'; // Royal Blue
      case 'Finance & Accounts': return '#059669'; // Emerald
      case 'Manufacturing': return '#7C3AED'; // Purple
      default: return '#1E293B';
    }
  }

  getCategoryEmoji(category) {
    switch (category) {
      case 'Creative & Media': return '🎬';
      case 'Hospitality & Food': return '🍳';
      case 'Logistics & Delivery': return '🛵';
      case 'Finance & Accounts': return '📊';
      case 'Manufacturing': return '⚙️';
      default: return '💼';
    }
  }
}

export const radarMap = new RadarMapController();
