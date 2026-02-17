'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the API with your key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function generateReply(reviewText: string, sentiment: string, reviewerName: string) {
  try {
    // Select the model
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // The "System Prompt" - This tells the AI who it is
    const prompt = `
      You are the owner of "Barone's Italian Bistro," a warm and professional restaurant.
      Write a short, polite, and SEO-friendly reply to a review from "${reviewerName}".
      
      The review sentiment is: ${sentiment}.
      The review text is: "${reviewText}"
      
      Rules:
      1. Be concise (under 280 characters).
      2. If positive, thank them and mention a specific detail they liked.
      3. If negative, apologize sincerely and ask them to email "owner@barones.com".
      4. Do not use hashtags.
      5. Sound human, not robotic.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
    
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Thank you for your feedback! We appreciate you visiting Barone's.";
  }
}
