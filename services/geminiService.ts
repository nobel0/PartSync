
import { GoogleGenAI } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geminiService = {
  generatePartDescription: async (partName: string, partNumber: string, carModel: string) => {
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Provide a professional, technical one-paragraph description for an automotive part named "${partName}" (PN: ${partNumber}) specifically for the car model "${carModel}". Focus on its purpose, likely materials, and importance in vehicle performance.`,
      });
      return response.text || "No description generated.";
    } catch (error) {
      console.error("Gemini Error:", error);
      return "Unable to generate AI description at this time.";
    }
  },

  analyzePartImage: async (base64Image: string) => {
    try {
      const ai = getAI();
      const imagePart = {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image.split(',')[1] || base64Image,
        },
      };
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            imagePart,
            { text: "Identify this automotive part. Return a JSON with 'name' and 'likely_use'." }
          ]
        },
      });
      return response.text;
    } catch (error) {
      console.error("Gemini Image Analysis Error:", error);
      return null;
    }
  }
};
