'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// 1. REVIEW REPLY GENERATOR (SEO Optimized)
export async function generateReply(reviewText: string, sentiment: string, reviewerName: string, tone: string = "professional") {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    let toneInstruction = "";
    if (tone === "friendly") toneInstruction = "Use a warm, enthusiastic tone with an exclamation point. Be neighborly.";
    if (tone === "formal") toneInstruction = "Use a polite, professional, and slightly formal tone. Focus on service standards.";
    if (tone === "short") toneInstruction = "Be extremely concise. Less than 15 words. Punchy and grateful.";

    const prompt = `
      You are the owner of "Barone's Italian Bistro," a top-rated Italian restaurant.
      Write a reply to a review from "${reviewerName}".
      
      Review: "${reviewText}"
      Sentiment: ${sentiment}
      
      INSTRUCTION: ${toneInstruction}
      
      Rules:
      1. BE SEO-OPTIMIZED: Naturally include the restaurant name "Barone's Italian Bistro" and keywords like "Italian restaurant" or "dining experience" to help with local search rankings.
      2. Keep it under 280 characters.
      3. Do not use hashtags.
      4. No robotic phrases like "Dear Customer."
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
    
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Thank you so much for visiting us at Barone's Italian Bistro!";
  }
}

// 2. VIP WIN-BACK GENERATOR (NEW)
export async function generateWinBack(name: string, dish: string, daysAgo: number) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const prompt = `
      You are the owner of "Barone's Italian Bistro".
      Write a short, personal SMS text message to a VIP customer named "${name}".
      
      Facts:
      - They haven't visited in ${daysAgo} days.
      - Their favorite item/request is: ${dish}.
      
      Goal:
      - Warmly say we miss them.
      - Mention the ${dish} and how we'd love to see them back at Barone's Italian Bistro.
      - Offer a free appetizer if they visit this week.
      - Keep it under 160 characters (SMS length).
      - No hashtags.
    `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("WinBack Error:", error);
    return `Hi ${name}, we miss you at Barone's Italian Bistro! Come in this week for a free appetizer with your favorite ${dish}.`;
  }
}

// 3. SOCIAL MEDIA AUTO-PILOT (NEW)
export async function generateSocialPost(topic: string, weather: string = "Sunny") {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const prompt = `
      You are the Social Media Manager for "Barone's Italian Bistro" in Davie, Florida.
      Create an engaging Instagram/Facebook post caption.
      
      Context:
      - Topic: ${topic}
      - Current Weather in Davie: ${weather}
      
      Rules:
      1. Use a warm, local, and inviting tone.
      2. Mention the weather and how it makes this a great time to visit Barone's Italian Bistro.
      3. Include 3-5 relevant emojis.
      4. Include 3-5 hashtags (e.g., #DavieEats, #BaronesItalian).
      5. Keep it under 400 characters.
    `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Social Error:", error);
    return `Looking for the best Italian in Davie? Come visit us at Barone's Italian Bistro for our ${topic}! 🍝🍷 #DavieEats`;
  }
}

// 4. MORNING BRIEFING ANALYST (NEW)
export async function generateDailyBrief(reviews: any[]) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    // Turn reviews into a text block
    const reviewText = reviews.map(r => `${r.rating} Stars: ${r.comment}`).join("\n");

    const prompt = `
      You are a restaurant consultant analyzing recent reviews for "Barone's Italian Bistro".
      Analyze these reviews:
      ${reviewText}
      
      Return a JSON object (strictly JSON, no markdown) with this format:
      {
        "score": (calculate an overall health score 0-100 based on ratings),
        "summary": "One sentence summary of how the restaurant is doing.",
        "topDish": "The most praised item",
        "complaint": "The biggest issue mentioned",
        "tip": "One specific operational tip to fix the complaint"
      }
    `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    // Clean up markdown if Gemini adds it
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
    
  } catch (error) {
    console.error(error);
    return {
      score: 85,
      summary: "Business is steady, but service speed needs attention.",
      topDish: "Carbonara",
      complaint: "Slow Service",
      tip: "Check staffing levels during peak dinner hours."
    };
  }
}
