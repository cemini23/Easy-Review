"use server";

import reviewsData from "@/data/mock-reviews.json";

export interface Review {
  id: string;
  author: string;
  rating: number;
  comment: string;
  date: string;
  source: string;
}

export interface ReviewResponseOptions {
  empathetic: string;
  professional: string;
  brief: string;
}

export async function getReviews(): Promise<Review[]> {
  return reviewsData;
}

export async function generateResponses(review: Review): Promise<ReviewResponseOptions> {
  // Mocking Gemini Flash delay
  await new Promise((resolve) => setTimeout(resolve, 800));

  if (review.rating >= 4) {
    return {
      empathetic: `Hi ${review.author}, we're so happy you enjoyed your visit! It means the world to us that you liked the ${review.comment.includes("steak") ? "steak" : "experience"}. We can't wait to see you again soon!`,
      professional: `Dear ${review.author}, thank you for your positive feedback. We are pleased to hear that you had a satisfactory experience at our establishment. We look forward to welcoming you back.`,
      brief: `Thanks for the 5 stars, ${review.author}! See you next time.`
    };
  } else {
    return {
      empathetic: `Hi ${review.author}, I'm so sorry to hear about your experience. We clearly missed the mark this time. We'd love to make it right—could you please reach out to us directly?`,
      professional: `Dear ${review.author}, thank you for bringing this to our attention. We apologize for the issues you encountered. We are reviewing this with our team to ensure it doesn't happen again.`,
      brief: `We're sorry for the experience, ${review.author}. We'll do better next time.`
    };
  }
}
