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
