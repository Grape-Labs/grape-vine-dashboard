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