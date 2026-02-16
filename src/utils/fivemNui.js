import {
  NUI_ERROR_CODES,
  normalizeNuiErrorCode,
} from "../../shared/nuiErrorCodes";
const hasWindow = typeof window !== "undefined";
const DEFAULT_TIMEOUT_MS = 5000;

// True when running inside FiveM NUI (not regular browser dev mode).
export const isFiveM = () =>
  hasWindow && typeof window.GetParentResourceName === "function";

const isMockEnabled = () => {
  if (!hasWindow || isFiveM()) return false;
  return String(import.meta.env?.VITE_NUI_MOCK || "false").toLowerCase() === "true";
};

const getResourceName = () => {
  if (!isFiveM()) return "nui-dev";
  return window.GetParentResourceName();
};

const getMockBridge = () => {
  if (!hasWindow) return null;
  return window.__NUI_MOCK__ ?? null;
};

export function normalizeNuiError(
  error,
  fallbackCode = NUI_ERROR_CODES.NUI_ERROR,
) {
  if (!error) {
    return { code: fallbackCode, message: "Unknown NUI error" };
  }
  if (typeof error === "string") {
    return { code: fallbackCode, message: error };
  }
  return {
    code: normalizeNuiErrorCode(error.code, fallbackCode),
    message: error.message ?? "Unknown NUI error",
  };
}

export async function postNui(eventName, payload = {}, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Browser-only mock mode for frontend iteration without opening FiveM client.
  if (isMockEnabled()) {
    const bridge = getMockBridge();
    if (bridge && typeof bridge.onPost === "function") {
      try {
        const data = await bridge.onPost(eventName, payload);
        return { ok: true, data, source: "mock" };
      } catch (error) {
        return {
          ok: false,
          error: normalizeNuiError(error, NUI_ERROR_CODES.MOCK_ERROR),
        };
      }
    }
    return { ok: true, data: null, source: "mock" };
  }

  if (!isFiveM()) {
    return { ok: true, data: null, source: "browser" };
  }

  const resourceName = getResourceName();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`https://${resourceName}/${eventName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        error: {
          code: NUI_ERROR_CODES.HTTP_ERROR,
          message: `NUI callback failed (${response.status})`,
        },
      };
    }

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    return { ok: true, data, source: "fivem" };
  } catch (error) {
    const isTimeout = error?.name === "AbortError";
    return {
      ok: false,
      error: normalizeNuiError(
        isTimeout ? "NUI callback timeout" : error,
        isTimeout ? NUI_ERROR_CODES.TIMEOUT : NUI_ERROR_CODES.FETCH_ERROR,
      ),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export function onNuiMessage(handler) {
  if (!hasWindow) return () => {};
  // FiveM sends NUI data via `window.postMessage`; keep one normalized listener API.
  const wrapped = (event) => handler(event.data ?? {});
  window.addEventListener("message", wrapped);
  return () => window.removeEventListener("message", wrapped);
}

export function emitNuiMessage(data) {
  if (!hasWindow) return;
  // Dev utility to simulate inbound FiveM events.
  window.dispatchEvent(new MessageEvent("message", { data }));
}
