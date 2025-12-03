import { randomBytes, randomInt } from 'crypto';

export const getFormattedNumberToLocale = (value: any, digits = 0) => {
  const converted = parseFloat(value.toString());
  const formatted = new Intl.NumberFormat("en-US", {
    minimumSignificantDigits: 1,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(converted);
  return formatted || "";
};


export const formatAmount = (
  val: number,
  precision: number = 6,
  abbr: boolean = false
) => {
  if (val) {
    if (abbr) {
      return val / 10 ** precision;//abbreviateNumber(val, precision);
    } else {
      return val.toFixed(precision);
    }
  }
  return "0";
};


/*
export function weightedRandomChoice(items: { address: string; balance: string }[], exclude: string[]) {
  // Filter items with balance greater than 0
  const rmvExcluded = items.filter((item) => !exclude.includes(item.address))
  const filteredArray = rmvExcluded.filter(item => parseFloat(item.balance) > 0);
  // Calculate total balance for weighting
  const totalBalance = filteredArray.reduce((acc, item) => acc + parseFloat(item.balance), 0);

  // Generate a random number between 0 and totalBalance
  const randomNumber = Math.random() * totalBalance;

  // Select item based on weighted random number
  let cumulativeBalance = 0;
  for (const item of filteredArray) {
    cumulativeBalance += parseFloat(item.balance);
    if (randomNumber <= cumulativeBalance) {
      return item;
    }
  }

  // This should not be reached, but just in case
  return null;
}
*/

/**
 * Weighted random selector.
 *
 * Fairness formula:
 *    P(wallet wins) = wallet.balance / sum(all eligible balances)
 *
 * Excluded wallets (treasury, governance, system) are removed
 * before computing weights.
 */

export function weightedRandomChoice(
  items: { address: string; balance: string }[],
  exclude: string[]
) {
  // Single-pass build of eligible items + weights
  const eligibleIndexes: number[] = [];
  const weights: number[] = [];
  let totalWeight = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || !item.address) continue;

    // Skip excluded wallets
    if (exclude.includes(item.address)) continue;

    // Parse balance once, safely
    const weight = Number(item.balance);

    // Skip non-finite, NaN, or non-positive balances
    if (!Number.isFinite(weight) || weight <= 0) continue;

    eligibleIndexes.push(i);
    weights.push(weight);
    totalWeight += weight;
  }

  // No eligible items → fail safely
  if (eligibleIndexes.length === 0 || totalWeight <= 0) {
    return null;
  }

  // Draw a random point on the [0, totalWeight) line
  let r = Math.random() * totalWeight;

  // Walk through the weights until we cross r
  for (let j = 0; j < eligibleIndexes.length; j++) {
    const w = weights[j];
    if (r < w) {
      const idx = eligibleIndexes[j];
      return items[idx]; // return original item (address + balance)
    }
    r -= w;
  }

  // Fallback: due to any floating-point edge case, return the last eligible item
  const lastIdx = eligibleIndexes[eligibleIndexes.length - 1];
  return items[lastIdx] ?? null;
}