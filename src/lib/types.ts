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
