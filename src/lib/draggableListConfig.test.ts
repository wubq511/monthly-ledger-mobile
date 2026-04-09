import { describe, expect, it } from 'vitest';

import { getExperimentalLayoutAnimationFlag } from './draggableListConfig';

describe('getExperimentalLayoutAnimationFlag', () => {
  it('returns false when layout animation repository is missing', () => {
    expect(getExperimentalLayoutAnimationFlag({})).toBe(false);
  });

  it('returns false when layout animation repository is incomplete', () => {
    expect(
      getExperimentalLayoutAnimationFlag({
        LayoutAnimationRepository: {
          configs: {},
        },
      })
    ).toBe(false);
  });

  it('returns true when layout animation repository exposes required APIs', () => {
    expect(
      getExperimentalLayoutAnimationFlag({
        LayoutAnimationRepository: {
          configs: {},
          registerConfig: () => undefined,
          removeConfig: () => undefined,
        },
      })
    ).toBe(true);
  });
});
