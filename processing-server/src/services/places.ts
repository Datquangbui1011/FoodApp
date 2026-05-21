import axios from 'axios';

export interface PlaceResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
  placeId: string;
  rating?: number;
  userRatingsTotal?: number;
  photos?: string[];
  types?: string[];
}

/**
 * Look up a restaurant using OpenStreetMap Nominatim (free, no API key required).
 * Falls back to a simple geocode if the structured search returns nothing.
 */
export async function lookupPlace(name: string, city: string): Promise<PlaceResult[]> {
  const query = `${name}, ${city}`;
  
  try {
    // Primary: free-text search via Nominatim
    const response = await axios.get(
      'https://nominatim.openstreetmap.org/search',
      {
        params: {
          q: query,
          format: 'json',
          addressdetails: 1,
          limit: 3,
        },
        headers: {
          // Nominatim requires a descriptive User-Agent
          'User-Agent': 'FoodMapAI/1.0 (food-video-processor)',
          'Accept': 'application/json',
        },
      }
    );

    const results = response.data;

    if (!results || results.length === 0) {
      console.log(`Nominatim returned 0 results for "${query}". Trying city-only fallback...`);
      return cityFallback(name, city);
    }

    return results.map((place: any) => ({
      name: place.name || name,
      address: place.display_name,
      lat: parseFloat(place.lat),
      lng: parseFloat(place.lon),
      placeId: place.osm_id?.toString() || place.place_id?.toString(),
      types: place.type ? [place.type] : [],
    }));
  } catch (error: any) {
    console.error('Nominatim search error:', error.message);
    return cityFallback(name, city);
  }
}

/**
 * Fallback: search for just the city to at least get approximate coordinates,
 * then attach the restaurant name from our AI inference.
 */
async function cityFallback(name: string, city: string): Promise<PlaceResult[]> {
  try {
    const response = await axios.get(
      'https://nominatim.openstreetmap.org/search',
      {
        params: {
          q: city,
          format: 'json',
          limit: 1,
        },
        headers: {
          'User-Agent': 'FoodMapAI/1.0 (food-video-processor)',
          'Accept': 'application/json',
        },
      }
    );

    const results = response.data;
    if (!results || results.length === 0) return [];

    return [{
      name: name,
      address: `${name}, ${results[0].display_name}`,
      lat: parseFloat(results[0].lat),
      lng: parseFloat(results[0].lon),
      placeId: results[0].osm_id?.toString() || 'fallback',
      types: ['restaurant'],
    }];
  } catch {
    return [];
  }
}
