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
      return abbreviateNumber(val, precision);
    } else {
      return val.toFixed(precision);
    }
  }
  return "0";
};
