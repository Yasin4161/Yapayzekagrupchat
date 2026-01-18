
import { GoogleGenAI } from "@google/genai";
import { Message, AIPersona } from "../types";

// getAIResponse provides an alternative way to call Gemini, though callAI in apiService is primary.
export const getAIResponse = async (
  persona: AIPersona,
  history: Message[]
): Promise<string> => {
  // Fix: Use persona.modelName directly or fallback to IDs defined in constants.tsx
  const modelName = persona.modelName || (persona.id === 'gemini-pro' ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview');

  // Fix: Always initialize GoogleGenAI with a named parameter and direct process.env.API_KEY
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Format history for Gemini
  // We include previous AI messages as 'model' turns to maintain context of the group chat
  const contents = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: `${msg.senderName}: ${msg.content}` }]
  }));

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: contents,
      config: {
        systemInstruction: persona.systemInstruction,
        temperature: 0.8,
        topP: 0.95,
        topK: 40,
      }
    });

    // Fix: Access .text property directly (not a method)
    return response.text || "Üzgünüm, şu an cevap veremiyorum.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Bir hata oluştu. Lütfen tekrar deneyin.";
  }
};
