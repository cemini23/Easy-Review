"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "@/lib/supabase";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export interface Review {
  id: string;
  author: string;
  rating: number;
  comment: string;
  date?: string;
  source: string;
  status?: string;
  draftReply?: string;
}

export interface ReviewResponseOptions {
  empathetic: string;
  professional: string;
  brief: string;
}

export async function getReviews(): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching reviews:", error);
    return [];
  }

  return data as Review[];
}

export async function updateReviewStatus(id: string, status: 'replied' | 'skipped') {
  const { error } = await supabase
    .from('reviews')
    .update({ status })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function generateResponses(review: Review): Promise<ReviewResponseOptions> {
  if (!process.env.GEMINI_API_KEY) {
    // Fallback to mock if no API key is provided
    return {
      empathetic: "GEMINI_API_KEY is missing. Please add it to .env.local.",
      professional: "GEMINI_API_KEY is missing. Please add it to .env.local.",
      brief: "GEMINI_API_KEY is missing. Please add it to .env.local."
    };
  }

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    You are a professional restaurant manager. Write three different responses to the following customer review.
    
    Review from ${review.author}:
    Rating: ${review.rating} stars
    Comment: "${review.comment}"
    
    Provide exactly three responses in the following JSON format:
    {
      "empathetic": "A warm, personal response that validates their feelings.",
      "professional": "A polite, standard business response.",
      "brief": "A short, concise response (under 15 words)."
    }
    
    Return ONLY the JSON object.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean up potential markdown formatting from Gemini
    const cleanText = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanText) as ReviewResponseOptions;
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    return {
      empathetic: "Sorry, I couldn't generate a response right now.",
      professional: "Service temporarily unavailable.",
      brief: "Error generating reply."
    };
  }
}
