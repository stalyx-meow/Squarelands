// One level multiplier for every displayed building effect, matching simulation.
export function buildingStats(def, level = 1) {
  const multiply = values => Object.fromEntries(Object.entries(values || {}).map(([key,value]) => [key,value * level]));
  const input = { ...def.input };
  if (def.power) input.power = (input.power || 0) + def.power;
  return { output: multiply(def.output), input: multiply(input), workers: def.workers * level,
    housing: (def.housing || 0) * level, storage: (def.storage || 0) * level,
    comfort: (def.comfort || 0) * level, education: (def.education || 0) * level };
}
