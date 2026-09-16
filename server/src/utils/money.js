const Decimal = require("decimal.js");

// All authoritative money math must flow through Decimal instances created here,
// never native JS floating point. API responses always serialize money as fixed-2 strings.
function toDecimal(value) {
  if (value instanceof Decimal) return value;
  if (value === null || value === undefined) return new Decimal(0);
  return new Decimal(value.toString());
}

function money(value) {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

function toMoneyString(value) {
  return money(value).toFixed(2);
}

module.exports = { Decimal, toDecimal, money, toMoneyString };
