export interface Review {
  id: string;
  author: string;
  rating: number;
  date: string;
  comment: string;
  source: string;
  sentiment: 'Positive' | 'Negative' | 'Neutral';
  draftReply?: string;
}

export interface VipCustomer {
  id: string;
  name: string;
  lastVisit: number; // Days ago
  totalSpend: string; // e.g. "$4,500"
  favoriteDish: string;
  status: 'At Risk' | 'Lost';
}
