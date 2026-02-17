export interface Review {
  id: number;
  author: string;
  rating: number;
  date: string;
  text: string;
  source: 'Google' | 'Yelp' | 'TripAdvisor';
  sentiment: 'Positive' | 'Negative' | 'Neutral';
  draftReply?: string;
}
