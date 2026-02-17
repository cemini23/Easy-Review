# EasyReview by Cemini 🚀

**The All-In-One "Business Owner's Operating System" (BOS)**

EasyReview is a high-end Micro-SaaS designed to take the "busy work" off a restaurant owner's plate. Built for high-performance and simplicity, it turns complex data into simple, one-tap actions.

---

## 🛠 Core Features

### 1. The Review Command Center (Defense)
*   **AI-Powered Replies:** Uses Google Gemini 1.5 Flash to draft perfect, SEO-optimized responses.
*   **One-Tap Tone Control:** Instantly rewrite replies to be **😊 Friendly**, **👔 Formal**, or **⚡ Short**.
*   **SEO Booster:** Automatically weaves in your business name and local keywords to help you rank higher on Google Maps.

### 2. The VIP Re-Engager (Retention)
*   **The "Magnet" Logic:** Automatically identifies "At Risk" regulars who haven't visited in 30+ days.
*   **Revenue Rescue:** Generates personalized SMS win-back messages mentioning the guest's favorite dish and offering a "Welcome Back" incentive.

### 3. Social Media Auto-Pilot (Offense)
*   **Weather-Aware Marketing:** Gemini checks the local weather in Davie and crafts Instagram/Facebook captions that feel timely and relevant.
*   **Zero-Friction Posting:** Type a simple topic (e.g., "Taco Tuesday"), and get a professional, emoji-rich post ready to copy and ship.

### 4. The Morning Brief (Intelligence)
*   **AI Consultant:** Every morning, the "Health Scorecard" analyzes all recent reviews.
*   **Trend Spotting:** Identifies what people are loving (Trending Dish) and what needs fixing (Main Issue).
*   **Operational Tips:** Provides a specific "Consultant Tip" to help you improve your business immediately.

---

## 🏗 Tech Stack
*   **Framework:** Next.js 15 (App Router)
*   **Brain:** Google Gemini AI (1.5 Flash & Pro)
*   **Memory:** Supabase (PostgreSQL)
*   **Styling:** Tailwind CSS (Mobile-First)

---

## 🚀 Getting Started

1.  **Clone & Install:**
    ```bash
    npm install
    ```
2.  **Set up Keys:** Create a `.env.local` file with:
    *   `GEMINI_API_KEY` (From Google AI Studio)
    *   `NEXT_PUBLIC_SUPABASE_URL` & `ANON_KEY`
3.  **Run Development:**
    ```bash
    npm run dev
    ```

---

## 📁 Project Structure
*   `src/app/actions.ts`: The "Brain" - All AI logic and generators.
*   `src/components/`: The "Building Blocks" - UI components for Reviews, VIPs, and Marketing.
*   `src/lib/supabase.ts`: The "Memory" - Database connection.
*   `src/data/`: Mock data for demonstrations.
