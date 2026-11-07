export type BrazilStateOption = {
  id: number;
  nome: string;
  sigla: string;
};

export type BrazilCityOption = {
  id: number;
  nome: string;
};

export async function fetchBrazilStates(): Promise<BrazilStateOption[]> {
  const response = await fetch(
    "https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome",
  );

  if (!response.ok) {
    throw new Error("Não foi possível carregar os estados do IBGE.");
  }

  return (await response.json()) as BrazilStateOption[];
}

export async function fetchCitiesByState(stateUf: string): Promise<string[]> {
  const response = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${stateUf}/municipios`,
  );

  if (!response.ok) {
    throw new Error("Não foi possível carregar as cidades do IBGE.");
  }

  const cities = (await response.json()) as BrazilCityOption[];
  return cities
    .map((city) => city.nome)
    .sort((first, second) => first.localeCompare(second));
}
