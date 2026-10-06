// Haversine formula for calculating great-circle distance between two geographic coordinates on WGS84 sphere (Earth)
// Matches PostGIS ST_Distance(geography, geography) / 1000

export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  
  const R = 6371; // Earth's mean radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

function toRad(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * Filter and sort jobs spatially around (lat, lng) within radius_km
 */
export function searchNearbyJobs(jobs, { lat, lng, radius_km = 10, query = '', category = '' }) {
  const originLat = parseFloat(lat);
  const originLng = parseFloat(lng);
  const radius = parseFloat(radius_km);
  const q = (query || '').trim().toLowerCase();
  const cat = (category || '').trim().toLowerCase();

  const now = new Date();

  return jobs
    .filter(job => {
      // Must be ACTIVE and not expired
      if (job.status !== 'ACTIVE') return false;
      const expiry = new Date(job.expires_at);
      if (expiry <= now) return false;

      // Filter by category if specified
      if (cat && cat !== 'all' && (job.category || '').toLowerCase() !== cat) {
        return false;
      }

      // Filter by query (title, custom_title, description, location_name)
      if (q) {
        const titleMatch = (job.title || '').toLowerCase().includes(q);
        const customMatch = (job.custom_title || '').toLowerCase().includes(q);
        const descMatch = (job.description || '').toLowerCase().includes(q);
        const locMatch = (job.location_name || '').toLowerCase().includes(q);
        if (!titleMatch && !customMatch && !descMatch && !locMatch) {
          return false;
        }
      }

      // Calculate spatial distance
      const distance = calculateDistanceKm(originLat, originLng, job.lat, job.lng);
      job.distance_km = distance;

      // Radius filter: if radius is 0 or >= 500, treat as "All India"
      if (radius > 0 && radius < 500) {
        return distance <= radius;
      }

      return true;
    })
    .sort((a, b) => a.distance_km - b.distance_km);
}
