import {
  DependencyCheckProvider,
  DependencyCheckQuery,
  DependencyCheckResult,
  sanitizeDependencyCheck
} from "./types";

export class DependencyCheckRegistry {
  constructor(private readonly providers: DependencyCheckProvider[]) {}

  async list(query: DependencyCheckQuery = {}): Promise<DependencyCheckResult[]> {
    const selected = this.providers.filter((provider) => (
      (!query.category || provider.category === query.category) &&
      (!query.ids || query.ids.includes(provider.id))
    ));
    const checks = await Promise.all(selected.map((provider) => provider.check()));
    return checks
      .filter((check) => !query.requiredFor || check.requiredFor.includes(query.requiredFor))
      .map(sanitizeDependencyCheck)
      .sort((left, right) => left.category.localeCompare(right.category) || left.label.localeCompare(right.label));
  }
}
