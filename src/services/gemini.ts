import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { evaluateConstructionScenarios } from "@/lib/climate-scenarios";
import type { WeatherContext } from "@/types/chat";

import { getWeatherSummary } from "./weather";

export const AI_ANALYSIS_PROMPT_VERSION = "v1";

const riskLevelSchema = z.enum(["low", "medium", "high"]);

const alternativeStartDateSchema = z.object({
  startMonth: z.string(),
  score: z.number(),
  riskLevel: riskLevelSchema,
  rationale: z.string(),
});

const constructionAlternativeSchema = z.object({
  title: z.string(),
  description: z.string(),
  whenToConsider: z.string(),
  validationRequired: z.boolean(),
});

const stageAnalysisSchema = z.object({
  name: z.string(),
  durationMonths: z.number().int().nonnegative(),
  climateSensitivity: z.number().nonnegative(),
  summary: z.string(),
  riskLevel: riskLevelSchema,
  observedRisks: z.array(z.string()),
  recommendedActions: z.array(z.string()),
});

export const ConstructionAnalysisReportSchema = z.object({
  executiveSummary: z.string(),
  climateOverview: z.string(),
  originalPlan: z.object({
    city: z.string(),
    state: z.string(),
    propertyType: z.string(),
    constructionType: z.string(),
    builtArea: z.number(),
    startDate: z.string(),
    estimatedMonths: z.number().int().nonnegative(),
    durationByPhase: z.array(
      z.object({
        phase: z.string(),
        months: z.number().int().nonnegative(),
      }),
    ),
  }),
  stageAnalysis: z.array(stageAnalysisSchema),
  recommendations: z.array(z.string()),
  alternativeStartDates: z.array(alternativeStartDateSchema),
  constructionAlternatives: z.array(constructionAlternativeSchema),
  riskAssessment: z.object({
    overallRiskLevel: riskLevelSchema,
    keyRisks: z.array(z.string()),
    potentialDelays: z.array(z.string()),
  }),
  limitations: z.array(z.string()),
  dataSources: z.array(z.string()),
});

export type ConstructionAnalysisReport = z.infer<
  typeof ConstructionAnalysisReportSchema
>;

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
      `${preposition}\s+([A-ZÀ-Ý][A-Za-zÀ-ÿ\'\-]*(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ\'\-]*)*)`,
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
    /\b([A-ZÀ-Ý][A-Za-zÀ-ÿ\'\-]*(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ\'\-]*)*)\b/,
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

function buildProjectStagePlan(estimatedMonths: number) {
  const months = Math.max(1, Math.round(Number(estimatedMonths) || 6));
  const foundation = Math.max(1, Math.round(months * 0.35));
  const structure = Math.max(1, Math.round(months * 0.35));
  const finishing = Math.max(1, months - foundation - structure);

  return [
    { name: "Fundação", durationMonths: foundation, climateSensitivity: 1.2 },
    {
      name: "Estrutura",
      durationMonths: structure,
      climateSensitivity: 1.5,
    },
    {
      name: "Acabamento",
      durationMonths: finishing,
      climateSensitivity: 0.8,
    },
  ];
}

export async function generateConstructionAnalysisReport(input: {
  ticket: {
    city: string;
    state: string;
    propertyType: string;
    constructionType: string;
    builtArea: number;
    startDate: string;
    estimatedMonths: number;
    type?: string;
  };
  climateContext: {
    location: {
      name: string;
      state: string;
      country: string;
      latitude: number;
      longitude: number;
    };
    source: string;
    period: {
      startDate: string;
      endDate: string;
      daysAnalyzed: number;
    };
    summary: {
      precipitationAverageMm: number;
      rainyDays: number;
      averageTemperatureC: number;
      intenseHeatDays: number;
      averageHumidityPercent: number;
      maxWindKmh: number;
      strongGustDays: number;
      adverseWeatherDays: number;
    };
    notes: string;
  };
}) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada.");
  }

  const stages = buildProjectStagePlan(input.ticket.estimatedMonths);
  const scenarioSummary = evaluateConstructionScenarios({
    climateContext: input.climateContext,
    plannedStartDate: input.ticket.startDate,
    estimatedMonths: input.ticket.estimatedMonths,
    stages,
  });

  const prompt = `
## Instruções do agente
Você é um agente especializado em planejamento climático de obras de construção civil.

Regras obrigatórias:
- Não inventar informações climáticas.
- Não inventar custos de construção.
- Não inventar ganhos de produtividade.
- Não prometer redução de prazo sem evidência.
- Diferenciar dados históricos de previsões futuras.
- Identificar claramente estimativas e premissas.
- Não recomendar mudanças estruturais como decisões definitivas.
- Exigir validação de profissional habilitado para alternativas construtivas.
- Fundamentar recomendações nos dados fornecidos.
- Informar quando os dados forem insuficientes.
- Responder somente em JSON válido, sem texto extra.

## Dados da obra
- Cidade: ${input.ticket.city}
- Estado: ${input.ticket.state}
- Tipo do imóvel: ${input.ticket.propertyType}
- Tipo de construção: ${input.ticket.constructionType}
- Área construída: ${input.ticket.builtArea} m²
- Data prevista de início: ${input.ticket.startDate}
- Duração total: ${input.ticket.estimatedMonths} meses
- Etapas: ${stages
    .map(
      (stage) =>
        `${stage.name}: ${stage.durationMonths} meses, sensibilidade ${stage.climateSensitivity}`,
    )
    .join("; ")}

## Dados climáticos
- Fonte: ${input.climateContext.source}
- Período analisado: ${input.climateContext.period.startDate} até ${input.climateContext.period.endDate}
- Chuva média: ${input.climateContext.summary.precipitationAverageMm} mm
- Dias chuvosos: ${input.climateContext.summary.rainyDays}
- Temperatura média: ${input.climateContext.summary.averageTemperatureC}°C
- Dias muito quentes: ${input.climateContext.summary.intenseHeatDays}
- Umidade média: ${input.climateContext.summary.averageHumidityPercent}%
- Rajadas fortes: ${input.climateContext.summary.strongGustDays}
- Condições adversas: ${input.climateContext.summary.adverseWeatherDays}
- Observações: ${input.climateContext.notes}

## Resultados dos cálculos
- Melhor cenário: ${scenarioSummary.bestStartMonth.startMonth} (${scenarioSummary.bestStartMonth.riskLevel})
- Pior cenário: ${scenarioSummary.worstStartMonth.startMonth} (${scenarioSummary.worstStartMonth.riskLevel})
- Recomendações quantitativas: ${scenarioSummary.recommendation}
- Cenários: ${scenarioSummary.scenarios
    .map(
      (scenario) =>
        `${scenario.startMonth}: score ${scenario.score} (${scenario.riskLevel})`,
    )
    .join("; ")}

## Formato de saída
Retorne um JSON com estas chaves obrigatórias: executiveSummary, climateOverview, originalPlan, stageAnalysis, recommendations, alternativeStartDates, constructionAlternatives, riskAssessment, limitations, dataSources.

A resposta deve ser um objeto JSON estruturado, sem markdown e sem comentários.
`;

  const ai = new GoogleGenAI({ apiKey });
  const responseSchema = {
    type: "OBJECT",
    properties: {
      executiveSummary: { type: "STRING" },
      climateOverview: { type: "STRING" },
      originalPlan: {
        type: "OBJECT",
        properties: {
          city: { type: "STRING" },
          state: { type: "STRING" },
          propertyType: { type: "STRING" },
          constructionType: { type: "STRING" },
          builtArea: { type: "NUMBER" },
          startDate: { type: "STRING" },
          estimatedMonths: { type: "INTEGER" },
          durationByPhase: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                phase: { type: "STRING" },
                months: { type: "INTEGER" },
              },
              required: ["phase", "months"],
            },
          },
        },
        required: [
          "city",
          "state",
          "propertyType",
          "constructionType",
          "builtArea",
          "startDate",
          "estimatedMonths",
          "durationByPhase",
        ],
      },
      stageAnalysis: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            durationMonths: { type: "INTEGER" },
            climateSensitivity: { type: "NUMBER" },
            summary: { type: "STRING" },
            riskLevel: { type: "STRING", enum: ["low", "medium", "high"] },
            observedRisks: { type: "ARRAY", items: { type: "STRING" } },
            recommendedActions: { type: "ARRAY", items: { type: "STRING" } },
          },
          required: [
            "name",
            "durationMonths",
            "climateSensitivity",
            "summary",
            "riskLevel",
            "observedRisks",
            "recommendedActions",
          ],
        },
      },
      recommendations: { type: "ARRAY", items: { type: "STRING" } },
      alternativeStartDates: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            startMonth: { type: "STRING" },
            score: { type: "NUMBER" },
            riskLevel: { type: "STRING", enum: ["low", "medium", "high"] },
            rationale: { type: "STRING" },
          },
          required: ["startMonth", "score", "riskLevel", "rationale"],
        },
      },
      constructionAlternatives: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            description: { type: "STRING" },
            whenToConsider: { type: "STRING" },
            validationRequired: { type: "BOOLEAN" },
          },
          required: [
            "title",
            "description",
            "whenToConsider",
            "validationRequired",
          ],
        },
      },
      riskAssessment: {
        type: "OBJECT",
        properties: {
          overallRiskLevel: { type: "STRING", enum: ["low", "medium", "high"] },
          keyRisks: { type: "ARRAY", items: { type: "STRING" } },
          potentialDelays: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["overallRiskLevel", "keyRisks", "potentialDelays"],
      },
      limitations: { type: "ARRAY", items: { type: "STRING" } },
      dataSources: { type: "ARRAY", items: { type: "STRING" } },
    },
    required: [
      "executiveSummary",
      "climateOverview",
      "originalPlan",
      "stageAnalysis",
      "recommendations",
      "alternativeStartDates",
      "constructionAlternatives",
      "riskAssessment",
      "limitations",
      "dataSources",
    ],
  } as const;

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    config: {
      responseMimeType: "application/json",
      responseSchema: responseSchema as never,
      temperature: 0.2,
    },
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
  });

  const rawText =
    typeof response?.text === "string"
      ? response.text
      : (response?.candidates ?? [])
          .flatMap((candidate) => candidate?.content?.parts ?? [])
          .map((part) => part?.text ?? "")
          .join("")
          .trim();

  if (!rawText) {
    throw new Error("Gemini retornou resposta vazia.");
  }

  const parsed = JSON.parse(
    rawText
      .replace(/^```json\s*/i, "")
      .replace(/\s*```$/, "")
      .trim(),
  );

  return ConstructionAnalysisReportSchema.parse(parsed);
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
      model: "gemini-3.8-flash",
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
