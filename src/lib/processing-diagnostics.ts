export function createProcessingDiagnostics(error: unknown, stage: string) {
  const errorType = error instanceof Error ? error.name : "UnknownError";

  return {
    stage,
    errorType: stage.includes("clima")
      ? "climate_api_error"
      : stage.includes("gemini")
        ? "gemini_api_error"
        : "processing_error",
    causeType: errorType.slice(0, 80),
    message: stage.includes("clima")
      ? "A consulta climática não pôde ser concluída."
      : stage.includes("gemini")
        ? "A análise da IA não pôde ser concluída."
        : "O processamento não pôde ser concluído.",
    createdAt: new Date().toISOString(),
  };
}
