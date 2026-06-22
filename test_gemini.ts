import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_KEY || "";
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function run() {
  try {
    const result = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: "Hello, are you there?",
    });
    console.log(result.text);
  } catch(e) {
    console.error(e);
  }
}
run();
