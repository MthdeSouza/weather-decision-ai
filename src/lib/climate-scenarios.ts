export type ClimateRiskStage = {
  name: string;
  durationMonths: number;
  climateSensitivity: number;
};

export type ClimateSummary = {
  precipitationAverageMm: number;
  rainyDays: number;
  averageTemperatureC: number;
  intenseHeatDays: number;
  averageHumidityPercent: number;
  maxWindKmh: number;
  strongGustDays: number;
  adverseWeatherDays: number;
};

export type ClimateContextSnapshot = {
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
  summary: ClimateSummary;
  notes: string;
};

export type ScenarioEvaluationInput = {
  climateContext: ClimateContextSnapshot;
  plannedStartDate: string;
  estimatedMonths: number;
  stages: ClimateRiskStage[];
};

export type StageExposure = {
  stage: string;
  score: number;
  riskLevel: "low" | "medium" | "high";
  months: string[];
};

export type ScenarioResult = {
  startMonth: string;
  score: number;
  riskLevel: "low" | "medium" | "high";
  comparisonToPlanned: number;
  stageExposure: StageExposure[];
  favorableMonths: string[];
  unfavorableMonths: string[];
  justification: string;
};

const MONTHLY_SEASONAL_WEIGHT = [
  1.05, 0.95, 0.9, 0.8, 0.75, 0.82, 0.88, 0.92, 0.95, 1.02, 1.08, 1.12,
] as const;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const monthNumberToLabel = (monthIndex: number) => {
  const monthNames = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];

  return monthNames[monthIndex];
};

const getRiskLevel = (score: number): "low" | "medium" | "high" => {
  if (score < 35) {
    return "low";
  }

  if (score < 70) {
    return "medium";
  }

  return "high";
};

const getMonthStart = (year: number, monthIndex: number) =>
  new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));

export function evaluateConstructionScenarios({
  climateContext,
  plannedStartDate,
  estimatedMonths,
  stages,
}: ScenarioEvaluationInput) {
  const normalizedStages = stages.length
    ? stages
    : [
        {
          name: "Obra",
          durationMonths: estimatedMonths || 6,
          climateSensitivity: 1,
        },
      ];

  const summary = climateContext.summary;
  const rainPressure = (summary.rainyDays / 365) * 100;
  const heatPressure = (summary.intenseHeatDays / 365) * 100;
  const windPressure = (summary.strongGustDays / 365) * 100;
  const humidityPressure = clamp(summary.averageHumidityPercent, 0, 100);
  const adversePressure = (summary.adverseWeatherDays / 365) * 100;

  const plannedDate = new Date(`${plannedStartDate}T00:00:00Z`);
  const plannedMonthKey = `${plannedDate.getUTCFullYear()}-${String(plannedDate.getUTCMonth() + 1).padStart(2, "0")}`;

  const calculateScenarioScore = (
    startMonthIndex: number,
    startYear: number,
  ) => {
    const monthSequence: string[] = [];
    const stageExposure: StageExposure[] = [];
    let totalRisk = 0;

    let cursorMonth = startMonthIndex;
    let cursorYear = startYear;

    for (const stage of normalizedStages) {
      const stageMonths: string[] = [];
      let stageRisk = 0;

      for (
        let monthOffset = 0;
        monthOffset < stage.durationMonths;
        monthOffset += 1
      ) {
        const monthLabel = monthNumberToLabel(cursorMonth);
        const monthKey = `${cursorYear}-${String(cursorMonth + 1).padStart(2, "0")}`;
        const seasonalMultiplier = MONTHLY_SEASONAL_WEIGHT[cursorMonth];

        const monthRainRisk = rainPressure * seasonalMultiplier * 0.42;
        const monthHeatRisk = heatPressure * seasonalMultiplier * 0.2;
        const monthWindRisk = windPressure * seasonalMultiplier * 0.22;
        const monthHumidityRisk = humidityPressure * seasonalMultiplier * 0.15;
        const monthAdverseRisk = adversePressure * seasonalMultiplier * 0.3;

        const exposure =
          (monthRainRisk +
            monthHeatRisk +
            monthWindRisk +
            monthHumidityRisk +
            monthAdverseRisk) *
          stage.climateSensitivity;

        stageRisk += exposure;
        monthSequence.push(`${monthKey} (${monthLabel})`);
        stageMonths.push(`${monthKey} (${monthLabel})`);

        cursorMonth += 1;
        if (cursorMonth === 12) {
          cursorMonth = 0;
          cursorYear += 1;
        }
      }

      stageExposure.push({
        stage: stage.name,
        score: Number((stageRisk / stage.durationMonths).toFixed(2)),
        riskLevel: getRiskLevel(stageRisk / stage.durationMonths),
        months: stageMonths,
      });

      totalRisk += stageRisk / stage.durationMonths;
    }

    const averageScenarioRisk = totalRisk / normalizedStages.length;

    return {
      totalRisk: Number(averageScenarioRisk.toFixed(2)),
      stageExposure,
      months: monthSequence,
    };
  };

  const baseYear = new Date(`${plannedStartDate}T00:00:00Z`).getUTCFullYear();
  const scenarios: ScenarioResult[] = Array.from(
    { length: 12 },
    (_, monthIndex) => {
      const startDate = getMonthStart(baseYear, monthIndex);
      const scenario = calculateScenarioScore(monthIndex, baseYear);
      const favorableMonths = scenario.months.filter((period) => {
        const exposure = scenario.stageExposure.reduce((sum, stage) => {
          const matched = stage.months.includes(period);
          return sum + (matched ? stage.score : 0);
        }, 0);
        return exposure < 35;
      });

      const unfavorableMonths = scenario.months.filter((period) => {
        const exposure = scenario.stageExposure.reduce((sum, stage) => {
          const matched = stage.months.includes(period);
          return sum + (matched ? stage.score : 0);
        }, 0);
        return exposure > 55;
      });

      const startMonth = `${startDate.getUTCFullYear()}-${String(startDate.getUTCMonth() + 1).padStart(2, "0")}`;
      const riskLabel = getRiskLevel(scenario.totalRisk);

      return {
        startMonth,
        score: scenario.totalRisk,
        riskLevel: riskLabel,
        comparisonToPlanned: 0,
        stageExposure: scenario.stageExposure,
        favorableMonths: [...new Set(favorableMonths)],
        unfavorableMonths: [...new Set(unfavorableMonths)],
        justification: `${riskLabel === "low" ? "Baixo" : riskLabel === "medium" ? "Médio" : "Alto"} risco climático para a execução programada, com foco em ${scenario.stageExposure[0]?.stage ?? "obra"} e expondo ${unfavorableMonths.length} meses mais sensíveis ao clima.`,
      };
    },
  );

  const plannedScenarioScore =
    scenarios.find((scenario) => scenario.startMonth === plannedMonthKey)
      ?.score ?? scenarios[0].score;

  for (const scenario of scenarios) {
    scenario.comparisonToPlanned = Number(
      (scenario.score - plannedScenarioScore).toFixed(2),
    );
  }

  const bestStartMonth = scenarios.reduce((best, current) =>
    current.score < best.score ? current : best,
  );

  const worstStartMonth = scenarios.reduce((worst, current) =>
    current.score > worst.score ? current : worst,
  );

  const recommendation = `O cenário mais favorável é ${bestStartMonth.startMonth}, com pontuação ${bestStartMonth.score.toFixed(2)} e nível ${bestStartMonth.riskLevel}. O pior cenário é ${worstStartMonth.startMonth}, com pontuação ${worstStartMonth.score.toFixed(2)}. A decisão deve considerar o calendário completo das etapas, e não apenas o início, porque a sensibilidade climática varia ao longo da obra.`;

  return {
    scenarios,
    bestStartMonth: {
      startMonth: bestStartMonth.startMonth,
      score: bestStartMonth.score,
      riskLevel: bestStartMonth.riskLevel,
    },
    worstStartMonth: {
      startMonth: worstStartMonth.startMonth,
      score: worstStartMonth.score,
      riskLevel: worstStartMonth.riskLevel,
    },
    recommendation,
    assumptions: [
      "Classificação de risco feita com base no histórico climático agregado e na sensibilidade das etapas.",
      "Os limites são configuráveis e devem ser revisados conforme a metodologia do empreendimento.",
      "O histórico não substitui a previsão meteorológica e não garante ausência de risco em meses classificados como favoráveis.",
    ],
  };
}
