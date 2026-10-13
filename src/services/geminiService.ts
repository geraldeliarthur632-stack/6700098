import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const getGeminiResponse = async (prompt: string, history: { role: string, parts: { text: string }[] }[]) => {
  try {
    const model = ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.parts[0].text }] })),
        { role: 'user', parts: [{ text: prompt }] }
      ],
      config: {
        systemInstruction: "Você é um assistente de suporte do OffGrid Link. Seu objetivo é ajudar os usuários a entender como o app funciona, especialmente as conexões offline (Bluetooth, Wi-Fi Direct, Mesh) e a criptografia de ponta a ponta. Seja amigável e conciso. Você se lembra do contexto da conversa.",
      }
    });

    const response = await model;
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Desculpe, estou tendo problemas para processar sua solicitação agora.";
  }
};
