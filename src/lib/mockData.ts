import { Review, VipCustomer } from '@/types';

export const mockReviews: Review[] = [
  {
    id: "1",
    author: "Sarah Jenkins",
    rating: 2,
    date: "2 days ago",
    comment: "Food was okay but the service was incredibly slow.",
    source: "Google",
    sentiment: "Negative"
  },
  {
    id: "2",
    author: "Mike T.",
    rating: 5,
    date: "Yesterday",
    comment: "Best pasta in Davie! The carbonara is to die for.",
    source: "Yelp",
    sentiment: "Positive"
  },
  {
    id: "3",
    author: "David Chen",
    rating: 4,
    date: "3 days ago",
    comment: "Great atmosphere, sea bass was delicious.",
    source: "TripAdvisor",
    sentiment: "Positive"
  }
];

export const mockVips: VipCustomer[] = [
  {
    id: "v1",
    name: "Dr. Emily Stone",
    lastVisit: 45,
    totalSpend: "$3,200",
    favoriteDish: "Truffle Risotto",
    status: "At Risk"
  },
  {
    id: "v2",
    name: "Marcus Cole",
    lastVisit: 62,
    totalSpend: "$5,100",
    favoriteDish: "Tomahawk Ribeye",
    status: "Lost"
  },
  {
    id: "v3",
    name: "Linda & Tom",
    lastVisit: 38,
    totalSpend: "$2,800",
    favoriteDish: "corner table",
    status: "At Risk"
  }
];
