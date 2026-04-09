type LayoutAnimationRepositoryLike = Partial<{
  configs: Record<string, unknown>;
  registerConfig: (...args: unknown[]) => void;
  removeConfig: (...args: unknown[]) => void;
}>;

type GlobalLike = {
  LayoutAnimationRepository?: LayoutAnimationRepositoryLike;
};

export function getExperimentalLayoutAnimationFlag(globalLike: GlobalLike): boolean {
  const repository = globalLike.LayoutAnimationRepository;

  return Boolean(
    repository &&
      typeof repository === 'object' &&
      repository.configs &&
      typeof repository.registerConfig === 'function' &&
      typeof repository.removeConfig === 'function'
  );
}

