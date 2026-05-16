export type Vertical =
  | 'barbershop'
  | 'dental'
  | 'salon'
  | 'gym'
  | 'retail'
  | 'restaurant'
  | 'auto'
  | 'other';

export type Category =
  | '5star_specific'
  | '5star_generic'
  | '4star'
  | '3star_mixed'
  | '1_2star_complaint'
  | '1star_fake';

export type DraftStatus =
  | 'pending'
  | 'edited'
  | 'approved'
  | 'posted'
  | 'skipped'
  | 'obsolete';

export type Source = 'Google' | 'Yelp' | 'TripAdvisor' | 'Facebook' | 'Manual';

export interface Review {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: string;
  source: Source;
}

export interface Operator {
  id: string;
  email: string;
  business_name: string;
  vertical: Vertical;
  sign_off?: string;
  services: string[];
  staff_names: string[];
  active: boolean;
  website_url?: string;
  gbp_place_id?: string;
}

export interface DraftRow {
  id: string;
  operator_id: string;
  gbp_review_id: string;
  review_author: string;
  review_rating: number;
  review_text: string;
  review_date: string;
  category: Category;
  suggested_template_id: string;
  ai_draft: string;
  operator_edited_text: string | null;
  status: DraftStatus;
}

export interface AuditLogRow {
  id: string;
  operator_id: string;
  gbp_review_id: string;
  review_snapshot: Pick<Review, 'author' | 'rating' | 'text' | 'date'>;
  posted_text: string;
  category: Category;
  posted_at: string;
  brief_path: string;
  brief_status: 'committed' | 'failed' | 'pending_retry';
}

export interface TemplateRule {
  text: string;
}

export interface CategoryTemplate {
  example_inbound: string;
  example_response: string;
  rules: string[];
}

export interface CategoryDef {
  id: Category;
  label: string;
  trigger: { rating: number | number[]; has_specific_praise?: boolean };
  response_goal: string;
  templates: CategoryTemplate[];
}

export interface TemplatesJson {
  version: string;
  source: string;
  categories: CategoryDef[];
}

export interface SiteHealthSnapshot {
  id: string;
  operator_id: string;
  fetched_at: string;
  website: {
    https: boolean | null;
    schema: { hasLocalBusiness: boolean; types: string[] } | null;
    sitemap: boolean | null;
    robots: boolean | null;
    homepage: {
      title: string;
      description: string;
      titleLength: number;
      descriptionLength: number;
    } | null;
    error: string | null;
  };
  gbp: {
    rating: number | null;
    user_ratings_total: number | null;
    photo_count: number | null;
    business_status: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY' | null;
    has_opening_hours: boolean | null;
    has_phone: boolean | null;
    has_website: boolean | null;
    error: string | null;
  } | null;
  pagespeed: {
    mobile_score: number | null;
    lcp_ms: number | null;
    cls: number | null;
    error: string | null;
  } | null;
}

// --- Schema markup generator ---------------------------------------------

/** Days of the week, in the order the form renders them. */
export type Weekday =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

/** One open/close span for a set of days, or a closed day. */
export interface OpeningHoursEntry {
  day: Weekday;
  closed: boolean;
  opens: string; // "HH:MM" 24h
  closes: string; // "HH:MM" 24h
}

/** A single service offered, optionally priced. */
export interface SchemaService {
  name: string;
  description?: string;
  price?: string; // e.g. "35.00" — no currency symbol
}

/** A single FAQ question/answer pair for FAQPage schema. */
export interface SchemaFaq {
  question: string;
  answer: string;
}

/** Everything needed to generate a LocalBusiness + FAQPage JSON-LD block. */
export interface SchemaProfile {
  businessName: string;
  /** schema.org @type, e.g. "BarberShop". Derived from vertical, overridable. */
  schemaType: string;
  url: string;
  telephone?: string;
  priceRange?: string; // "$" | "$$" | "$$$" | "$$$$"
  imageUrls: string[];
  street?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country: string; // ISO 2-letter, default "US"
  latitude?: number;
  longitude?: number;
  hours: OpeningHoursEntry[];
  /** GBP place_id — used to build the canonical Google Maps sameAs URL. */
  placeId?: string;
  /** Extra sameAs URLs (Instagram, Facebook, Yelp, …). */
  socialUrls: string[];
  services: SchemaService[];
  faqs: SchemaFaq[];
}

// --- GEO/AEO citability checker ------------------------------------------

/** Status of one citability signal — reuses the site-health vocabulary. */
export type CitabilityStatus = 'ok' | 'warn' | 'fail' | 'info';

/** One analyzed signal: what was measured, and how to improve it. */
export interface CitabilitySignal {
  key: string;
  label: string;
  status: CitabilityStatus;
  /** What the analyzer found. */
  detail: string;
  /** Concrete recommendation for the operator. */
  fix: string;
}

/** Full result of analyzing one page for AI-engine citability. */
export interface CitabilityReport {
  url: string;
  /** Composite 0-100 citability score. */
  score: number;
  signals: CitabilitySignal[];
  fetchedAt: string;
  /** Set when the page could not be fetched/analyzed; signals will be empty. */
  error: string | null;
}
