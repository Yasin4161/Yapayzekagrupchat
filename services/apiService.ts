
import { GoogleGenAI } from "@google/genai";
import { Message, AIPersona, ApiKeys } from "../types";

export const callAI = async (
  persona: AIPersona,
  history: Message[],
  keys: ApiKeys
): Promise<string> => {
  const { provider, modelName, systemInstruction } = persona;

  if (provider === 'google') {
    // Fix: Initialize inside the function to ensure freshest context and use correct named parameter
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const contents = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: `${msg.senderName}: ${msg.content}` }]
    }));

    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: { systemInstruction }
      });
      // response.text is a property, not a method
      return response.text || "Cevap alınamadı.";
    } catch (e) {
      console.error("Gemini Error:", e);
      return `Gemini Hatası: ${e instanceof Error ? e.message : 'Bilinmeyen hata'}`;
    }
  }

  if (provider === 'openai') {
    if (!keys.openai) return "OpenAI API Anahtarı eksik! Ayarlardan ekleyin.";
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${keys.openai}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: "system", content: systemInstruction },
            ...history.map(msg => ({
              role: msg.role === 'user' ? 'user' : 'assistant',
              content: `${msg.senderName}: ${msg.content}`
            }))
          ]
        })
      });
      const data = await response.json();
      return data.choices?.[0]?.message?.content || "GPT'den cevap alınamadı.";
    } catch (e) {
      return "OpenAI bağlantı hatası.";
    }
  }

  if (provider === 'anthropic') {
    if (!keys.anthropic) return "Anthropic API Anahtarı eksik! Ayarlardan ekleyin.";
    // Note: Standard browser fetch to Anthropic might trigger CORS errors without a proxy.
    // However, this is the requested implementation.
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": keys.anthropic,
          "anthropic-version": "2023-06-01",
          "dangerously-allow-browser": "true"
        },
        body: JSON.stringify({
          model: modelName,
          system: systemInstruction,
          max_tokens: 1024,
          messages: history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: `${msg.senderName}: ${msg.content}`
          }))
        })
      });
      const data = await response.json();
      return data.content?.[0]?.text || "Claude'dan cevap alınamadı.";
    } catch (e) {
      return "Claude bağlantı hatası (CORS kısıtlaması olabilir).";
    }
  }

  return "Geçersiz sağlayıcı.";
};
