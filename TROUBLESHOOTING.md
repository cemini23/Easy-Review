# 🛠 EasyReview Troubleshooting Guide

This guide is designed for business owners and managers. You don't need to be a "techie" to fix these common issues!

---

## 🛑 The "It's Not Working" Checklist

### 1. The AI is spinning or saying "Error"
**Symptoms:** You click "Regenerate" or "Generate Post" and it stays loading forever or shows a red error message.
*   **Check your Internet:** AI requires a stable connection to talk to Google.
*   **API Key Missing:** Ensure your `GEMINI_API_KEY` is correctly pasted into the `.env.local` file. If the key is expired or deleted in Google AI Studio, the "Brain" won't work.
*   **Limit Reached:** If you are using a "Free" AI key, Google may occasionally slow you down if you click the button too many times in one minute. Wait 60 seconds and try again.

### 2. My Reviews or VIPs aren't showing up
**Symptoms:** You see "All Clear!" or "VIPs are Happy!" even though you know there should be data.
*   **Database Connection:** This app uses **Supabase** to remember your data. Check if your `NEXT_PUBLIC_SUPABASE_URL` is set up.
*   **Database Table:** Make sure you have run the "SQL Schema" (the list of commands) in your Supabase dashboard to create the `reviews` table. Without that table, the app has nowhere to look for "Memory."

### 3. I can't see the "Posted!" message
**Symptoms:** You click "Post Reply" but nothing happens.
*   **Google Connection:** For the "Post" button to actually send a reply to the real Google Maps, you must be connected via the **Settings** tab. 
*   **Mock Mode:** If you are in "Demo Mode," the button will simply show "Copied to Clipboard" so you can manually paste it into Google.

### 4. The screen looks weird on my phone
**Symptoms:** Buttons are overlapping or text is cut off.
*   **Refresh:** Sometimes a quick refresh fixes layout glitches.
*   **Browser:** This app is optimized for Safari (iPhone) and Chrome (Android/Desktop). Ensure your browser is up to date.

---

## 💡 Pro-Tips for Better AI
*   **Be Specific:** When using the **Marketing** tab, instead of typing "Food," type "Homemade Lasagna with Grandma's sauce." The more detail you give, the better the AI post will be.
*   **Check the Tone:** If the AI sounds too robotic, try clicking the **😊 Friendly** button. It adds warmth and emojis automatically.

---

## 📞 Still Need Help?
If you've checked the list above and it's still stuck:
1.  **Restart the Server:** In your terminal, press `Ctrl + C` and type `npm run dev` again.
2.  **Check Logs:** Look at the `dev.log` file in the main folder for specific error codes to share with a developer.
