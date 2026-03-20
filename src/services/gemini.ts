import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function transcribeAudio(base64Audio: string, mimeType: string, prompt: string = "Transcribe this audio to text."): Promise<string> {
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Audio,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });

    return response.text || "No transcription available.";
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
}

export async function transcribeWithSpeakers(base64Audio: string, mimeType: string): Promise<string> {
  const prompt = "Transcribe this audio recording and label each speaker (e.g., Speaker 1, Speaker 2). Provide the transcription in a clear, readable format.";
  return transcribeAudio(base64Audio, mimeType, prompt);
}
