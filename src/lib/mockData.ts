import { Review } from '@/types';

export const mockReviews: Review[] = [
  {
    id: 1,
    author: "Sarah Jenkins",
    rating: 2,
    date: "2 days ago",
    text: "Food was okay but the service was incredibly slow. We waited 40 minutes for our appetizers.",
    source: "Google",
    sentiment: "Negative",
    draftReply: "Hi Sarah, thank you for your feedback. We apologize for the wait time—40 minutes is not our standard. We are retraining our floor staff this week to ensure faster service. We'd love another chance to show you the 5-star experience you deserve."
  },
  {
    id: 2,
    author: "Mike T.",
    rating: 5,
    date: "Yesterday",
    text: "Best pasta in Davie! The carbonara is to die for.",
    source: "Yelp",
    sentiment: "Positive",
    draftReply: "Thanks, Mike! We're thrilled you loved the Carbonara. We work hard to serve the best pasta in Davie. Can't wait to see you back for more authentic Italian cuisine soon!"
  },
  {
    id: 3,
    author: "Emily R.",
    rating: 1,
    date: "1 hour ago",
    text: "Salty pasta and rude waiter. Never coming back.",
    source: "Google",
    sentiment: "Negative",
    draftReply: "Emily, we are very sorry to hear this. We take comments about food quality and service seriously. I have already spoken to our kitchen team about the seasoning. Please contact us directly so we can make this right."
  },
  {
    id: 4,
    author: "David Chen",
    rating: 4,
    date: "3 days ago",
    text: "Great atmosphere, sea bass was delicious. A bit pricey though.",
    source: "TripAdvisor",
    sentiment: "Positive",
    draftReply: "Thank you, David! Glad you enjoyed the Sea Bass and our atmosphere. We strive to use only the freshest, high-quality ingredients for our seafood dishes. We hope to welcome you back for a special occasion soon."
  },
  {
    id: 5,
    author: "Jessica M.",
    rating: 5,
    date: "5 hours ago",
    text: "Love this place! The owner always comes by to say hi.",
    source: "Google",
    sentiment: "Positive",
    draftReply: "Thanks for the kind words, Jessica! We love connecting with our community. It's always a pleasure to have you with us. See you next time!"
  }
];
