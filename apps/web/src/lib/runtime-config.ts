const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, "");
const configuredSocketUrl = import.meta.env.VITE_SOCKET_URL?.trim().replace(/\/+$/, "");

export const apiBaseUrl = configuredApiUrl || "/api";
export const socketUrl = configuredSocketUrl || (
  configuredApiUrl
    ? new URL(configuredApiUrl).origin
    : window.location.origin
);
