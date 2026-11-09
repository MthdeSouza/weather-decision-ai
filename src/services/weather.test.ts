import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { evaluateConstructionScenarios } from "../lib/climate-scenarios";
import { getDefaultCityForState } from "../data/brazilLocations";
import {
  geocodeLocation,
  getHistoricalClimateContext,
} from "../lib/open-meteo";
import { createProcessingDiagnostics } from "../lib/processing-diagnostics";
import {
  canAccessRole,
  canApproveTicket,
  canBeginTicketProcessing,
  canCreatePendingApprovalTicket,
  canRejectTicket,
  initialTicketStatus,
  isProcessingRunStale,
  isPrivilegedRole,
  MAX_PENDING_APPROVAL_TICKETS,
  PROCESSING_LOCK_TIMEOUT_MS,
} from "../lib/ticket-workflow";
import type { Ticket } from "../types/ticket";

import {
  analyzeDecision,
  ConstructionAnalysisReportSchema,
} from "./gemini";
import { filterAndSortTickets } from "./ticket-filters";
import { getWeatherSummary } from "./weather";

describe("getWeatherSummary", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("uses the weather API response and returns a structured summary", async () => {
    global.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("geocoding-api.open-meteo.com")) {
        return new Response(
          JSON.stringify({
            results: [
              { name: "Lisboa", latitude: 38.7223, longitude: -9.1393 },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("api.open-meteo.com")) {
        return new Response(
          JSON.stringify({
            current: {
              temperature_2m: 18.4,
              relative_humidity_2m: 72,
              wind_speed_10m: 21,
              weather_code: 1,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const result = await getWeatherSummary("Lisboa");

    assert.equal(result.city, "Lisboa");
    assert.equal(result.temperature, 18.4);
    assert.equal(result.humidity, 72);
    assert.equal(result.wind, 21);
    assert.ok(result.condition.length > 0);
  });

  it("answers a question about a city using the city name in the message", async () => {
    global.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("geocoding-api.open-meteo.com")) {
        return new Response(
          JSON.stringify({
            results: [
              { name: "Lisboa", latitude: 38.7223, longitude: -9.1393 },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("api.open-meteo.com")) {
        return new Response(
          JSON.stringify({
            current: {
              temperature_2m: 18.4,
              relative_humidity_2m: 72,
              wind_speed_10m: 21,
              weather_code: 1,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const result = await analyzeDecision("Qual é o clima em Lisboa hoje?");

    assert.ok(result);
    assert.ok(result.summary);
    assert.match(result.summary, /Lisboa/i);
    assert.ok(result.recommendation.length > 0);
  });

  it("builds a historical climate context from Open-Meteo geocoding and archive responses", async () => {
    global.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("geocoding-api.open-meteo.com")) {
        return new Response(
          JSON.stringify({
            results: [
              {
                name: "São Paulo",
                admin1: "São Paulo",
                country: "Brazil",
                latitude: -23.55,
                longitude: -46.63,
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("archive-api.open-meteo.com")) {
        return new Response(
          JSON.stringify({
            daily: {
              time: ["2023-01-01", "2023-01-02", "2023-01-03"],
              precipitation_sum: [1.2, 10.5, 0.4],
              temperature_2m_mean: [24.5, 27.0, 26.1],
              temperature_2m_max: [30, 34, 31],
              relative_humidity_2m_mean: [65, 70, 68],
              wind_speed_10m_max: [22, 18, 29],
              wind_gusts_10m_max: [38, 45, 52],
              weather_code: [0, 80, 95],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const context = await getHistoricalClimateContext({
      city: "São Paulo",
      state: "São Paulo",
      startDate: "2024-01-10",
    });

    assert.equal(context.location.name, "São Paulo");
    assert.equal(context.location.state, "São Paulo");
    assert.ok(context.summary.averageTemperatureC > 0);
    assert.ok(context.summary.rainyDays >= 1);
    assert.ok(context.source.includes("Open-Meteo"));
  });

  it("maps a Brazilian state abbreviation and rejects a city outside that state", async () => {
    global.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("geocoding-api.open-meteo.com")) {
        return new Response(
          JSON.stringify({
            results: [
              {
                name: "São José",
                admin1: "São Paulo",
                country: "Brasil",
                latitude: -23.2,
                longitude: -46.1,
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const location = await geocodeLocation("São José", "SP");
    assert.equal(location.state, "São Paulo");

    await assert.rejects(
      geocodeLocation("São José", "RJ"),
      /Cidade não encontrada no estado informado/,
    );
  });

  it("evaluates the 12 possible start months and compares scenario risk deterministically", async () => {
    const climateContext = {
      location: {
        name: "São Paulo",
        state: "São Paulo",
        country: "Brazil",
        latitude: -23.55,
        longitude: -46.63,
      },
      source: "Open-Meteo Historical Weather API (ERA5-Land)",
      period: {
        startDate: "2023-01-01",
        endDate: "2025-12-31",
        daysAnalyzed: 365,
      },
      summary: {
        precipitationAverageMm: 120,
        rainyDays: 80,
        averageTemperatureC: 22,
        intenseHeatDays: 10,
        averageHumidityPercent: 72,
        maxWindKmh: 50,
        strongGustDays: 5,
        adverseWeatherDays: 12,
      },
      notes: "Histórico climático de teste.",
    };

    const result = evaluateConstructionScenarios({
      climateContext,
      plannedStartDate: "2025-02-10",
      estimatedMonths: 6,
      stages: [
        { name: "Fundação", durationMonths: 2, climateSensitivity: 1.2 },
        { name: "Estrutura", durationMonths: 2, climateSensitivity: 1.5 },
        { name: "Acabamento", durationMonths: 2, climateSensitivity: 0.8 },
      ],
    });

    assert.ok(result.scenarios.length === 12);
    assert.ok(result.scenarios.every((scenario) => scenario.score >= 0));
    assert.ok(result.bestStartMonth);
    assert.ok(result.worstStartMonth);
    assert.ok(result.recommendation.length > 0);
  });

  it("clamps future start dates to today so Open-Meteo historical requests remain valid", async () => {
    const RealDate = Date;
    const fakeNow = new RealDate("2026-11-08T00:00:00Z");

    const FakeDate = class extends RealDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          super(fakeNow.getTime());
          return;
        }

        const value = args[0];

        if (typeof value === "string" || typeof value === "number") {
          super(value as string | number);
          return;
        }

        if (value instanceof RealDate) {
          super(value.getTime());
          return;
        }

        super();
      }

      static now() {
        return fakeNow.getTime();
      }
    } as unknown as DateConstructor;

    global.Date = FakeDate;

    try {
      global.fetch = async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("geocoding-api.open-meteo.com")) {
          return new Response(
            JSON.stringify({
              results: [
                {
                  name: "Iranduba",
                  admin1: "Amazonas",
                  country: "Brazil",
                  latitude: -3.2,
                  longitude: -60.2,
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("archive-api.open-meteo.com")) {
          assert.match(url, /end_date=2026-11-03/);
          assert.doesNotMatch(url, /end_date=2026-11-10/);

          return new Response(
            JSON.stringify({
              daily: {
                time: ["2023-11-10"],
                precipitation_sum: [15],
                temperature_2m_mean: [26],
                temperature_2m_max: [30],
                temperature_2m_min: [22],
                relative_humidity_2m_mean: [75],
                wind_speed_10m_max: [20],
                wind_gusts_10m_max: [35],
                weather_code: [0],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        throw new Error(`Unexpected URL: ${url}`);
      };

      const context = await getHistoricalClimateContext({
        city: "Iranduba",
        state: "Amazonas",
        startDate: "2026-11-10",
      });

      assert.equal(context.period.endDate, "2026-11-03");
    } finally {
      global.Date = RealDate;
    }
  });

  it("filters and sorts tickets for the admin review route", () => {
    const olderCreatedAt = Math.floor(
      new Date("2026-01-15T00:00:00Z").getTime() / 1000,
    );
    const newerCreatedAt = Math.floor(
      new Date("2026-06-10T00:00:00Z").getTime() / 1000,
    );

    const tickets: Ticket[] = [
      {
        id: "a",
        createdBy: { uid: "u2", name: "Maria", email: "maria@email.com" },
        construction: {
          city: "São Paulo",
          state: "SP",
          propertyType: "residential",
          constructionType: "masonry",
          startDate: "2026-02-10",
          estimatedMonths: 4,
          builtArea: 120,
        },
        status: "completed",
        approval: {
          approvedBy: null,
          approvedAt: null,
          rejectedBy: null,
          rejectedAt: null,
          rejectionReason: null,
        },
        iaAnalysis: null,
        aiAnalysisMeta: null,
        climateContext: null,
        createdAt: { seconds: olderCreatedAt, nanoseconds: 0 } as never,
        updatedAt: { seconds: olderCreatedAt, nanoseconds: 0 } as never,
      },
      {
        id: "b",
        createdBy: { uid: "u1", name: "João", email: "joao@email.com" },
        construction: {
          city: "Manaus",
          state: "AM",
          propertyType: "commercial",
          constructionType: "concrete",
          startDate: "2026-01-15",
          estimatedMonths: 8,
          builtArea: 350,
        },
        status: "pending_approval",
        approval: {
          approvedBy: null,
          approvedAt: null,
          rejectedBy: null,
          rejectedAt: null,
          rejectionReason: null,
        },
        iaAnalysis: null,
        aiAnalysisMeta: null,
        climateContext: null,
        createdAt: { seconds: newerCreatedAt, nanoseconds: 0 } as never,
        updatedAt: { seconds: newerCreatedAt, nanoseconds: 0 } as never,
      },
    ];

    const filtered = filterAndSortTickets({
      tickets,
      status: "pending_approval",
      userId: "u1",
      fromDate: "2025-12-01",
      toDate: "2026-12-31",
      sortBy: "oldest",
    });

    assert.deepEqual(
      filtered.map((ticket) => ticket.id),
      ["b"],
    );

    const ordered = filterAndSortTickets({
      tickets,
      status: "all",
      userId: "all",
      fromDate: "",
      toDate: "",
      sortBy: "recent",
    });

    assert.deepEqual(
      ordered.map((ticket) => ticket.id),
      ["b", "a"],
    );
  });

  it("sanitizes processing diagnostics to avoid leaking secrets or personal data", () => {
    const diagnostic = createProcessingDiagnostics(
      new Error("Gemini failed: AIzaKey123 and user@example.com"),
      "gemini",
    );

    assert.equal(diagnostic.errorType, "gemini_api_error");
    assert.ok(!diagnostic.message.includes("AIzaKey123"));
    assert.ok(!diagnostic.message.includes("user@example.com"));
    assert.ok(!diagnostic.message.includes("[redacted]"));
    assert.ok(!diagnostic.message.includes("Gemini failed"));
  });

  it("retries Open-Meteo after an upstream failure without caching the failure", async () => {
    let archiveCalls = 0;
    global.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("geocoding-api.open-meteo.com")) {
        return new Response(
          JSON.stringify({
            results: [
              {
                name: "Retry Town",
                admin1: "São Paulo",
                country: "Brazil",
                latitude: -23.5,
                longitude: -46.6,
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("archive-api.open-meteo.com")) {
        archiveCalls += 1;
        if (archiveCalls === 1) {
          return new Response("bad request", { status: 400 });
        }

        return new Response(
          JSON.stringify({
            daily: {
              time: ["2023-01-01"],
              precipitation_sum: [0],
              temperature_2m_mean: [20],
              temperature_2m_max: [25],
              temperature_2m_min: [15],
              relative_humidity_2m_mean: [60],
              wind_speed_10m_max: [10],
              wind_gusts_10m_max: [15],
              weather_code: [0],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    await assert.rejects(
      getHistoricalClimateContext({
        city: "Retry Town",
        state: "São Paulo",
        startDate: "2024-01-01",
      }),
      /Open-Meteo request failed \(400\)\./,
    );

    const result = await getHistoricalClimateContext({
      city: "Retry Town",
      state: "São Paulo",
      startDate: "2024-01-01",
    });

    assert.equal(result.location.name, "Retry Town");
    assert.equal(archiveCalls, 2);
  });

  it("validates the structured Gemini report and rejects incomplete output", () => {
    const report = {
      executiveSummary: "Resumo fundamentado nos dados fornecidos.",
      climateOverview: "Dados históricos; não são previsão.",
      originalPlan: {
        city: "São Paulo",
        state: "SP",
        propertyType: "residential",
        constructionType: "masonry",
        builtArea: 100,
        startDate: "2027-01-01",
        estimatedMonths: 6,
        durationByPhase: [{ phase: "Estrutura", months: 3 }],
      },
      stageAnalysis: [],
      recommendations: [],
      alternativeStartDates: [],
      constructionAlternatives: [],
      riskAssessment: {
        overallRiskLevel: "medium",
        keyRisks: [],
        potentialDelays: [],
      },
      limitations: [],
      dataSources: ["Open-Meteo"],
    };

    assert.equal(
      ConstructionAnalysisReportSchema.safeParse(report).success,
      true,
    );
    assert.equal(
      ConstructionAnalysisReportSchema.safeParse({
        executiveSummary: "Relatório incompleto",
      }).success,
      false,
    );
  });

  it("enforces ticket creation, approval, processing, and role transitions", () => {
    assert.equal(initialTicketStatus("basic"), "pending_approval");
    assert.equal(initialTicketStatus("approver"), "pending_ai_analysis");
    assert.equal(initialTicketStatus("admin"), "pending_ai_analysis");
    assert.equal(isPrivilegedRole("approver"), true);
    assert.equal(isPrivilegedRole("basic"), false);
    assert.equal(canApproveTicket("pending_approval"), true);
    assert.equal(canApproveTicket("completed"), false);
    assert.equal(canRejectTicket("pending_approval"), true);
    assert.equal(canRejectTicket("processing"), false);
    assert.equal(canBeginTicketProcessing("pending_ai_analysis"), true);
    assert.equal(canBeginTicketProcessing("failed"), true);
    assert.equal(canBeginTicketProcessing("completed"), true);
    assert.equal(canBeginTicketProcessing("pending_approval"), false);
    assert.equal(canBeginTicketProcessing("processing"), false);
    assert.equal(canBeginTicketProcessing("archived"), false);
  });

  it("limits users to five tickets awaiting approval", () => {
    assert.equal(MAX_PENDING_APPROVAL_TICKETS, 5);
    assert.equal(canCreatePendingApprovalTicket(4), true);
    assert.equal(canCreatePendingApprovalTicket(5), false);
    assert.equal(canCreatePendingApprovalTicket(6), false);
  });

  it("only allows recovering a processing run after its lease expires", () => {
    const now = 1_000_000;

    assert.equal(isProcessingRunStale(now - 1_000, now), false);
    assert.equal(
      isProcessingRunStale(
        { seconds: (now - 1_000) / 1000, nanoseconds: 0 },
        now,
      ),
      false,
    );
    assert.equal(
      isProcessingRunStale(now - PROCESSING_LOCK_TIMEOUT_MS, now),
      true,
    );
    assert.equal(isProcessingRunStale(null, now), true);
  });

  it("enforces the requested page roles", () => {
    assert.equal(canAccessRole("basic", ["basic", "approver", "admin"]), true);
    assert.equal(canAccessRole("approver", ["approver", "admin"]), true);
    assert.equal(canAccessRole("admin", ["approver", "admin"]), true);
    assert.equal(canAccessRole("basic", ["approver", "admin"]), false);
    assert.equal(canAccessRole("approver", ["admin"]), false);
    assert.equal(canAccessRole("admin", ["admin"]), true);
    assert.equal(canAccessRole("unknown", ["basic", "admin"]), false);

    for (const role of ["basic", "approver", "admin"] as const) {
      assert.equal(canAccessRole(role, ["basic", "approver", "admin"]), true);
    }
    assert.equal(canAccessRole("basic", ["basic"]), true);
    assert.equal(canAccessRole("approver", ["approver", "admin"]), true);
    assert.equal(canAccessRole("admin", ["admin"]), true);
  });

  it("defaults the ticket city to the selected state's capital", () => {
    assert.equal(
      getDefaultCityForState("SP", ["Campinas", "São Paulo", "Santos"]),
      "São Paulo",
    );
    assert.equal(
      getDefaultCityForState("RJ", ["Niterói", "Rio de Janeiro"]),
      "Rio de Janeiro",
    );
    assert.equal(getDefaultCityForState("SP", []), "");
  });
});
