const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export const api = {
  // Profile
  getMyProfile: (token: string) =>
    request("/api/profile/me", { headers: authHeaders(token) }),

  createProfile: (token: string, data: { username: string; full_name: string; headline?: string; location?: string }) =>
    request("/api/profile/", { method: "POST", headers: authHeaders(token), body: JSON.stringify(data) }),

  updateProfile: (token: string, data: Record<string, string>) =>
    request("/api/profile/me", { method: "PUT", headers: authHeaders(token), body: JSON.stringify(data) }),

  getPublicProfile: (username: string) =>
    request(`/api/profile/${username}`),

  // Employment claims
  getEmploymentClaims: (token: string) =>
    request("/api/claims/employment", { headers: authHeaders(token) }),

  createEmploymentClaim: (token: string, data: Record<string, unknown>) =>
    request("/api/claims/employment", { method: "POST", headers: authHeaders(token), body: JSON.stringify(data) }),

  deleteEmploymentClaim: (token: string, id: string) =>
    request(`/api/claims/employment/${id}`, { method: "DELETE", headers: authHeaders(token) }),

  // Education claims
  getEducationClaims: (token: string) =>
    request("/api/claims/education", { headers: authHeaders(token) }),

  createEducationClaim: (token: string, data: Record<string, unknown>) =>
    request("/api/claims/education", { method: "POST", headers: authHeaders(token), body: JSON.stringify(data) }),

  deleteEducationClaim: (token: string, id: string) =>
    request(`/api/claims/education/${id}`, { method: "DELETE", headers: authHeaders(token) }),

  // Verification
  getVerification: (token: string) =>
    request(`/api/verify/${token}`),

  submitVerification: (token: string, action: string, reason?: string) =>
    request(`/api/verify/${token}`, { method: "POST", body: JSON.stringify({ action, reason }) }),
};
