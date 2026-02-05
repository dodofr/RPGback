/**
 * Generate a random integer between min and max (inclusive)
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random float between 0 and 1
 */
export function random(): number {
  return Math.random();
}

/**
 * Roll a dice with N sides
 */
export function rollDice(sides: number): number {
  return randomInt(1, sides);
}

/**
 * Roll multiple dice and sum the results
 */
export function rollDiceMultiple(count: number, sides: number): number {
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += rollDice(sides);
  }
  return total;
}

/**
 * Check if a random roll succeeds based on a probability (0-1)
 */
export function checkProbability(probability: number): boolean {
  return random() < probability;
}
