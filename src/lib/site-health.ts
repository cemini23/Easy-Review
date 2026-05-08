import type { SiteHealthSnapshot } from '@/lib/types';

const TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchHttps(url: string): Promise<boolean> {
  if (!url.startsWith('https://')) return false;
  try {
    const res = await fetchWithTimeout(url, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

const LOCAL_BUSINESS_TYPES = new Set([
  'LocalBusiness', 'AnimalShelter', 'AutomotiveBusiness', 'AutoDealer', 'AutoRepair',
  'BeautySalon', 'BarberShop', 'HairSalon', 'NailSalon', 'HealthAndBeautyBusiness',
  'ChildCare', 'DryCleaningOrLaundry', 'EmergencyService', 'EmploymentAgency',
  'EntertainmentBusiness', 'FinancialService', 'FoodEstablishment', 'Bakery',
  'BarOrPub', 'CafeOrCoffeeShop', 'FastFoodRestaurant', 'IceCreamShop', 'Restaurant',
  'GovernmentOffice', 'HealthClub', 'DaySpa', 'Dentist', 'Hospital', 'MedicalClinic',
  'Optician', 'Physician', 'VeterinaryCare', 'HomeAndConstructionBusiness', 'Electrician',
  'GeneralContractor', 'HVACBusiness', 'HousePainter', 'Locksmith', 'MovingCompany',
  'Plumber', 'RoofingContractor', 'InternetCafe', 'LegalService', 'Attorney', 'Notary',
  'Library', 'LodgingBusiness', 'BedAndBreakfast', 'Hostel', 'Hotel', 'Motel',
  'ProfessionalService', 'AccountingService', 'RadioStation', 'RealEstateAgent',
  'RecyclingCenter', 'SelfStorage', 'ShoppingCenter', 'SportsActivityLocation',
  'GolfCourse', 'Gym', 'StadiumOrArena', 'Store', 'BikeStore', 'BookStore',
  'ClothingStore', 'ConvenienceStore', 'DepartmentStore', 'ElectronicsStore',
  'Florist', 'FurnitureStore', 'GardenStore', 'GroceryStore', 'HardwareStore',
  'HobbyShop', 'HomeGoodsStore', 'JewelryStore', 'LiquorStore', 'MensClothingStore',
  'MobilePhoneStore', 'MovieRentalStore', 'MusicStore', 'OfficeEquipmentStore',
  'OutletStore', 'PawnShop', 'PetStore', 'ShoeStore', 'SportingGoodsStore',
  'TireShop', 'ToyStore', 'WholesaleStore', 'TelevisionStation', 'TouristInformationCenter',
  'TravelAgency',
]);

export async function fetchSchema(url: string): Promise<{ hasLocalBusiness: boolean; types: string[] } | null> {
  try {
    const res = await fetchWithTimeout(url, { method: 'GET' });
    if (!res.ok) return null;
    const html = await res.text();
    const matches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    const types: string[] = [];
    for (const m of matches) {
      try {
        const data = JSON.parse(m[1]);
        const blocks = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
        for (const block of blocks) {
          const t = block?.['@type'];
          if (Array.isArray(t)) types.push(...t.filter((x) => typeof x === 'string'));
          else if (typeof t === 'string') types.push(t);
        }
      } catch {
        // malformed JSON-LD block — ignore
      }
    }
    const hasLocalBusiness = types.some((t) => LOCAL_BUSINESS_TYPES.has(t));
    return { hasLocalBusiness, types };
  } catch {
    return null;
  }
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url.replace(/\/.*$/, '');
  }
}

export async function fetchSitemap(url: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${originOf(url)}/sitemap.xml`, { method: 'GET' });
    if (!res.ok) return false;
    const ct = res.headers.get('content-type') ?? '';
    return ct.includes('xml');
  } catch {
    return false;
  }
}

export async function fetchRobots(url: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${originOf(url)}/robots.txt`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

export async function fetchHomepageMeta(url: string): Promise<{
  title: string;
  description: string;
  titleLength: number;
  descriptionLength: number;
} | null> {
  try {
    const res = await fetchWithTimeout(url, { method: 'GET' });
    if (!res.ok) return null;
    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i);
    const title = titleMatch ? decodeEntities(titleMatch[1].trim()) : '';
    const description = descMatch ? decodeEntities(descMatch[1].trim()) : '';
    return {
      title,
      description,
      titleLength: title.length,
      descriptionLength: description.length,
    };
  } catch {
    return null;
  }
}

type GbpFragment = NonNullable<SiteHealthSnapshot['gbp']>;

export async function fetchPlaceDetails(placeId: string, apiKey: string): Promise<GbpFragment | null> {
  const fields = [
    'place_id', 'name', 'business_status', 'rating', 'user_ratings_total',
    'photos', 'opening_hours', 'formatted_phone_number', 'website',
  ].join(',');
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${fields}&key=${encodeURIComponent(apiKey)}`;
  const empty: GbpFragment = {
    rating: null, user_ratings_total: null, photo_count: null,
    business_status: null, has_opening_hours: null, has_phone: null,
    has_website: null, error: null,
  };
  try {
    const res = await fetchWithTimeout(url, { method: 'GET' });
    if (!res.ok) return { ...empty, error: `HTTP ${res.status}` };
    const data = await res.json();
    if (data.status !== 'OK') return { ...empty, error: `${data.status}: ${data.error_message ?? 'unknown'}` };
    const r = data.result ?? {};
    return {
      rating: typeof r.rating === 'number' ? r.rating : null,
      user_ratings_total: typeof r.user_ratings_total === 'number' ? r.user_ratings_total : null,
      photo_count: Array.isArray(r.photos) ? r.photos.length : 0,
      business_status: r.business_status ?? null,
      has_opening_hours: Boolean(r.opening_hours),
      has_phone: Boolean(r.formatted_phone_number),
      has_website: Boolean(r.website),
      error: null,
    };
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : 'unknown' };
  }
}

type PsiFragment = NonNullable<SiteHealthSnapshot['pagespeed']>;

// PageSpeed responses can take 30-50s on slow sites — use a longer 60s timeout
// for this fetcher only. The shared fetchWithTimeout has a 10s budget.
const PSI_TIMEOUT_MS = 60_000;

export async function fetchPageSpeed(url: string, apiKey: string): Promise<PsiFragment | null> {
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&key=${encodeURIComponent(apiKey)}`;
  const empty: PsiFragment = { mobile_score: null, lcp_ms: null, cls: null, error: null };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PSI_TIMEOUT_MS);
  try {
    const res = await fetch(apiUrl, { signal: controller.signal });
    if (!res.ok) return { ...empty, error: `HTTP ${res.status}` };
    const data = await res.json();
    const score = data?.lighthouseResult?.categories?.performance?.score;
    const lcp = data?.lighthouseResult?.audits?.['largest-contentful-paint']?.numericValue;
    const cls = data?.lighthouseResult?.audits?.['cumulative-layout-shift']?.numericValue;
    return {
      mobile_score: typeof score === 'number' ? Math.round(score * 100) : null,
      lcp_ms: typeof lcp === 'number' ? Math.round(lcp) : null,
      cls: typeof cls === 'number' ? cls : null,
      error: null,
    };
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : 'unknown' };
  } finally {
    clearTimeout(timer);
  }
}
