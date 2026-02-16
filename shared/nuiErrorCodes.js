export const NUI_ERROR_CODES = Object.freeze({
  REGISTER_BUSY: "REGISTER_BUSY",
  INVALID_ROLE: "INVALID_ROLE",
  NOT_ORG_MEMBER: "NOT_ORG_MEMBER",
  STALE_SESSION: "STALE_SESSION",
  STALE_TRANSACTION: "STALE_TRANSACTION",
  DUPLICATE_ACTION: "DUPLICATE_ACTION",
  INVALID_PAYLOAD: "INVALID_PAYLOAD",
  PRICE_MISMATCH: "PRICE_MISMATCH",
  DISCOUNT_INVALID: "DISCOUNT_INVALID",
  INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK",
  TIER_NOT_ELIGIBLE: "TIER_NOT_ELIGIBLE",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NUI_ERROR: "NUI_ERROR",
  MOCK_ERROR: "MOCK_ERROR",
  HTTP_ERROR: "HTTP_ERROR",
  TIMEOUT: "TIMEOUT",
  FETCH_ERROR: "FETCH_ERROR",
});

export const NUI_ERROR_CATALOG = Object.freeze({
  [NUI_ERROR_CODES.REGISTER_BUSY]: {
    retryable: true,
    defaultMessage: "Register is currently busy.",
  },
  [NUI_ERROR_CODES.INVALID_ROLE]: {
    retryable: false,
    defaultMessage: "Role is not valid for this action.",
  },
  [NUI_ERROR_CODES.NOT_ORG_MEMBER]: {
    retryable: false,
    defaultMessage: "Organization membership is required.",
  },
  [NUI_ERROR_CODES.STALE_SESSION]: {
    retryable: false,
    defaultMessage: "Session has expired. Reopen the register.",
  },
  [NUI_ERROR_CODES.STALE_TRANSACTION]: {
    retryable: false,
    defaultMessage: "Transaction is no longer active.",
  },
  [NUI_ERROR_CODES.DUPLICATE_ACTION]: {
    retryable: false,
    defaultMessage: "Duplicate action ignored.",
  },
  [NUI_ERROR_CODES.INVALID_PAYLOAD]: {
    retryable: false,
    defaultMessage: "Request payload is invalid.",
  },
  [NUI_ERROR_CODES.PRICE_MISMATCH]: {
    retryable: false,
    defaultMessage: "Price mismatch detected.",
  },
  [NUI_ERROR_CODES.DISCOUNT_INVALID]: {
    retryable: false,
    defaultMessage: "Discount is no longer valid.",
  },
  [NUI_ERROR_CODES.INSUFFICIENT_STOCK]: {
    retryable: false,
    defaultMessage: "Not enough stock for this item.",
  },
  [NUI_ERROR_CODES.TIER_NOT_ELIGIBLE]: {
    retryable: false,
    defaultMessage: "Register tier upgrade is not eligible.",
  },
  [NUI_ERROR_CODES.RATE_LIMITED]: {
    retryable: true,
    defaultMessage: "Rate limit exceeded. Please retry shortly.",
  },
  [NUI_ERROR_CODES.INTERNAL_ERROR]: {
    retryable: false,
    defaultMessage: "Internal server error.",
  },
  [NUI_ERROR_CODES.NUI_ERROR]: {
    retryable: false,
    defaultMessage: "NUI bridge error.",
  },
  [NUI_ERROR_CODES.MOCK_ERROR]: {
    retryable: false,
    defaultMessage: "Mock bridge error.",
  },
  [NUI_ERROR_CODES.HTTP_ERROR]: {
    retryable: true,
    defaultMessage: "NUI callback HTTP request failed.",
  },
  [NUI_ERROR_CODES.TIMEOUT]: {
    retryable: true,
    defaultMessage: "NUI callback timed out.",
  },
  [NUI_ERROR_CODES.FETCH_ERROR]: {
    retryable: true,
    defaultMessage: "NUI callback network failure.",
  },
});

export const DOC_ERROR_CODES = Object.freeze([
  NUI_ERROR_CODES.REGISTER_BUSY,
  NUI_ERROR_CODES.INVALID_ROLE,
  NUI_ERROR_CODES.NOT_ORG_MEMBER,
  NUI_ERROR_CODES.STALE_SESSION,
  NUI_ERROR_CODES.STALE_TRANSACTION,
  NUI_ERROR_CODES.DUPLICATE_ACTION,
  NUI_ERROR_CODES.INVALID_PAYLOAD,
  NUI_ERROR_CODES.PRICE_MISMATCH,
  NUI_ERROR_CODES.DISCOUNT_INVALID,
  NUI_ERROR_CODES.INSUFFICIENT_STOCK,
  NUI_ERROR_CODES.TIER_NOT_ELIGIBLE,
  NUI_ERROR_CODES.RATE_LIMITED,
  NUI_ERROR_CODES.INTERNAL_ERROR,
]);

export function isKnownNuiErrorCode(code) {
  return (
    typeof code === "string" &&
    Object.prototype.hasOwnProperty.call(NUI_ERROR_CATALOG, code)
  );
}

export function normalizeNuiErrorCode(code, fallback = NUI_ERROR_CODES.NUI_ERROR) {
  return isKnownNuiErrorCode(code) ? code : fallback;
}

export function getNuiErrorInfo(code) {
  const normalizedCode = normalizeNuiErrorCode(code);
  return NUI_ERROR_CATALOG[normalizedCode];
}
