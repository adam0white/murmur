import { createLab } from '@adam0white/lab-client';

// Defer initialization until the bundled modules have finished evaluating.
let instance: ReturnType<typeof createLab> | undefined;
export const lab: ReturnType<typeof createLab> = new Proxy({} as ReturnType<typeof createLab>, {
  get(_target, key) {
    instance ??= createLab({ game: 'murmur' });
    const value = Reflect.get(instance, key, instance);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
