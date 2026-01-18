
import { AIPersona } from './types';

export const INITIAL_MODELS: AIPersona[] = [
  {
    id: 'gemini-flash',
    name: "Gemini 3 Flash",
    provider: 'google',
    modelName: 'gemini-3-flash-preview',
    description: "Hızlı ve pratik zeka",
    color: "blue",
    icon: "⚡",
    isActive: true,
    systemInstruction: "Sen 'Gemini Flash' isminde bir yapay zeka asistanısın. Grubun en hızlı üyesisin. Kısa ve net cevaplar verirsin."
  },
  {
    id: 'gemini-pro',
    name: "Gemini 3 Pro",
    provider: 'google',
    modelName: 'gemini-3-pro-preview',
    description: "Derin düşünür ve analizci",
    color: "indigo",
    icon: "🧠",
    isActive: true,
    systemInstruction: "Sen 'Gemini Pro' isminde derin analizler yapan bir yapay zekasın. Mantıklı ve kapsamlı açıklamalar yaparsın."
  },
  {
    id: 'gpt-4o',
    name: "ChatGPT (GPT-4o)",
    provider: 'openai',
    modelName: 'gpt-4o',
    description: "Popüler ve çok yönlü",
    color: "green",
    icon: "🤖",
    isActive: false,
    systemInstruction: "Sen ChatGPT (GPT-4o) modelisin. Yardımsever ve akıllı bir asistan gibi davran."
  },
  {
    id: 'claude-3-5',
    name: "Claude 3.5 Sonnet",
    provider: 'anthropic',
    modelName: 'claude-3-5-sonnet-20240620',
    description: "Zarif ve güvenilir",
    color: "orange",
    icon: "🎩",
    isActive: false,
    systemInstruction: "Sen Claude 3.5 Sonnet modelisin. Dürüst, yardımsever ve zarif bir dil kullan."
  }
];
