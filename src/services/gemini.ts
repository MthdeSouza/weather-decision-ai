import { GoogleGenAI } from "@google/genai";

import type { WeatherContext } from "@/types/chat";

import { getWeatherSummary } from "./weather";

function extractCityFromMessage(message: string): string | null {
  const normalized = message.replace(/[?!.,]/g, " ").trim();
  const prepositions = [
    "em",
    "na",
    "no",
    "cidade de",
    "em torno de",
    "na cidade de",
    "no município de",
  ];

  for (const preposition of prepositions) {
    const pattern = new RegExp(
      `${preposition}\\s+([A-ZÀ-Ý][A-Za-zÀ-ÿ\'-]*(?:\\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ\'-]*)*)`,
      "i",
    );
    const match = normalized.match(pattern);

    if (match?.[1]) {
      const city = match[1].trim();
      if (
        !/(hoje|agora|ontem|amanhã|manhã|tarde|noite|tempo|clima|previsão|previsao|sol|chuva)/i.test(
          city,
        )
      ) {
        return city;
      }
    }
  }

  const fallback = normalized.match(
    /\b([A-ZÀ-Ý][A-Za-zÀ-ÿ\'-]*(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ\'-]*)*)\b/,
  );
  return fallback?.[1]?.trim() ?? null;
}

function parseDecisionFromText(text: string) {
  const normalizedText = text.trim();
  console.log("normalizedText", normalizedText);
  if (!normalizedText) {
    return null;
  }

  const summaryMatch = normalizedText.match(/summary\s*[:\-]\s*(.+?)(?:\n|$)/i);
  const recommendationMatch = normalizedText.match(
    /recommendation\s*[:\-]\s*(.+?)(?:\n|$)/i,
  );

  if (summaryMatch?.[1] || recommendationMatch?.[1]) {
    return {
      summary: (summaryMatch?.[1] ?? "Resumo indisponível").trim(),
      recommendation: (
        recommendationMatch?.[1] ?? "Recomendação indisponível"
      ).trim(),
    };
  }

  return {
    summary: normalizedText.slice(0, 200).trim(),
    recommendation:
      "Considere a condição climática e adie a decisão se houver risco de chuva forte ou calor extremo.",
  };
}

function buildHeuristicDecision(message: string, weather?: WeatherContext) {
  const normalizedMessage = message.trim();
  const lowerMessage = normalizedMessage.toLowerCase();

  if (!normalizedMessage) {
    return {
      summary:
        "Não foi possível analisar a decisão porque a mensagem está vazia.",
      recommendation: "Tente descrever melhor a situação e o clima esperado.",
    };
  }

  if (weather) {
    const weatherSignal = weather.condition.toLowerCase();

    if (
      weatherSignal.includes("chuva") ||
      weatherSignal.includes("garoa") ||
      weatherSignal.includes("trovoada")
    ) {
      return {
        summary: `O clima em ${weather.city} está com ${weather.condition.toLowerCase()} e pode interferir na sua decisão.`,
        recommendation:
          "Leve proteção contra a chuva ou adie a atividade ao ar livre se ela depender de conforto e segurança.",
      };
    }

    if (
      weatherSignal.includes("céu limpo") ||
      weatherSignal.includes("parcialmente nublado")
    ) {
      return {
        summary: `O clima em ${weather.city} está relativamente favorável, com ${weather.condition.toLowerCase()}.`,
        recommendation:
          "Aproveite a condição climática, mas continue atento à temperatura e à hidratação.",
      };
    }
  }

  if (
    lowerMessage.includes("chuva") ||
    lowerMessage.includes("umbrella") ||
    lowerMessage.includes("guarda-chuva")
  ) {
    return {
      summary:
        "A situação indica risco de interferência do tempo na sua decisão.",
      recommendation:
        "Leve um guarda-chuva ou adie a atividade ao ar livre se houver previsão de chuva intensa.",
    };
  }

  if (
    lowerMessage.includes("sol") ||
    lowerMessage.includes("praia") ||
    lowerMessage.includes("passeio")
  ) {
    return {
      summary: "O clima parece favorável para atividades externas.",
      recommendation:
        "Aproveite a melhor condição climática e mantenha hidratação e proteção solar.",
    };
  }

  return {
    summary:
      "A mensagem foi entendida, mas a recomendação depende do contexto do clima e da situação local.",
    recommendation:
      "Considere verificar o radar do tempo e ajustar a decisão conforme a intensidade da chuva ou do calor.",
  };
}

export async function analyzeDecision(
  message: string,
  city?: string,
  state?: string,
) {
  console.log("[gemini] message", message);
  console.log("[gemini] city", city);
  console.log("[gemini] state", state);

  const normalizedMessage = message.trim();

  if (!normalizedMessage) {
    return {
      summary:
        "Não foi possível analisar a decisão porque a mensagem está vazia.",
      recommendation: "Tente descrever melhor a situação e o clima esperado.",
    };
  }

  const detectedCity = city ?? extractCityFromMessage(normalizedMessage);
  let weather: WeatherContext | undefined;

  if (detectedCity) {
    try {
      weather = await getWeatherSummary(detectedCity);
    } catch (error) {
      console.warn("[gemini] weather lookup failed", error);
      weather = undefined;
    }
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  console.log("[gemini] apiKey configured:", Boolean(apiKey));

  if (!apiKey) {
    console.warn(
      "[gemini] GEMINI_API_KEY not found. Falling back to heuristic analysis.",
    );
    return buildHeuristicDecision(normalizedMessage, weather);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    console.log("[gemini] ai instance created");

    const prompt = `Você é um assistente que responde em português. Analise a seguinte decisão considerando o clima e o contexto do usuário. Responda em JSON com as chaves "summary" e "recommendation". Mensagem do usuário: "${normalizedMessage}". Estado relevante: ${state ?? "não informado"}. Cidade relevante: ${detectedCity ?? "não informada"}. Clima atual: ${weather ? `${weather.condition}, ${weather.temperature}°C, ${weather.humidity}% umidade, ${weather.wind} km/h` : "não disponível"}.`;
    console.log("[gemini] prompt", prompt);

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite", // high demand
      //   model: "gemini-3.8-flash", // high demand
      contents: prompt,
    });

    console.log("[gemini] response", response);

    const rawText =
      typeof response?.text === "string"
        ? response.text.trim()
        : (response?.candidates ?? [])
            .flatMap((candidate) => candidate?.content?.parts ?? [])
            .map((part) => part?.text ?? "")
            .join("")
            .trim();

    let asText = rawText;

    console.log("asText", asText);

    const cleanedText = rawText
      .replace(/^```json\s*/i, "")
      .replace(/\s*```$/, "");

    const parsed = JSON.parse(cleanedText);

    if (parsed?.summary && parsed?.recommendation) {
      asText = JSON.stringify({
        summary: parsed.summary,
        recommendation: parsed.recommendation,
      });
    }

    if (asText) {
      console.log("JSON.parse(asText)", JSON.parse(asText));
      return JSON.parse(asText);
    }
  } catch (error) {
    console.error("[gemini] SDK call failed", error);
  }

  return buildHeuristicDecision(normalizedMessage, weather);
}
