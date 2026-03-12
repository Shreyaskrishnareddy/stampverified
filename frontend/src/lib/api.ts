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
  // ── Profile ──
  getMyProfile: (token: string) =>
    request("/api/profile/me", { headers: authHeaders(token) }),

  createProfile: (token: string, data: { username: string; full_name: string; headline?: string; location?: string }) =>
    request("/api/profile/", { method: "POST", headers: authHeaders(token), body: JSON.stringify(data) }),

  updateProfile: (token: string, data: Record<string, string>) =>
    request("/api/profile/me", { method: "PUT", headers: authHeaders(token), body: JSON.stringify(data) }),

  getPublicProfile: (username: string) =>
    request(`/api/profile/${username}`),

  uploadAvatar: async (token: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_URL}/api/profile/avatar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(error.detail);
    }
    return res.json();
  },

  // ── Employment Claims ──
  getEmploymentClaims: (token: string) =>
    request("/api/claims/employment", { headers: authHeaders(token) }),

  createEmploymentClaim: (token: string, data: Record<string, unknown>) =>
    request("/api/claims/employment", { method: "POST", headers: authHeaders(token), body: JSON.stringify(data) }),

  updateEmploymentClaim: (token: string, id: string, data: Record<string, unknown>) =>
    request(`/api/claims/employment/${id}`, { method: "PUT", headers: authHeaders(token), body: JSON.stringify(data) }),

  deleteEmploymentClaim: (token: string, id: string) =>
    request(`/api/claims/employment/${id}`, { method: "DELETE", headers: authHeaders(token) }),

  acceptEmploymentCorrection: (token: string, id: string) =>
    request(`/api/claims/employment/${id}/accept-correction`, { method: "POST", headers: authHeaders(token) }),

  denyEmploymentCorrection: (token: string, id: string, reason: string) =>
    request(`/api/claims/employment/${id}/deny-correction`, {
      method: "POST", headers: authHeaders(token),
      body: JSON.stringify({ accept: false, denial_reason: reason }),
    }),

  resendEmploymentVerification: (token: string, id: string) =>
    request(`/api/claims/employment/${id}/resend`, { method: "POST", headers: authHeaders(token) }),

  // ── Education Claims ──
  getEducationClaims: (token: string) =>
    request("/api/claims/education", { headers: authHeaders(token) }),

  createEducationClaim: (token: string, data: Record<string, unknown>) =>
    request("/api/claims/education", { method: "POST", headers: authHeaders(token), body: JSON.stringify(data) }),

  updateEducationClaim: (token: string, id: string, data: Record<string, unknown>) =>
    request(`/api/claims/education/${id}`, { method: "PUT", headers: authHeaders(token), body: JSON.stringify(data) }),

  deleteEducationClaim: (token: string, id: string) =>
    request(`/api/claims/education/${id}`, { method: "DELETE", headers: authHeaders(token) }),

  acceptEducationCorrection: (token: string, id: string) =>
    request(`/api/claims/education/${id}/accept-correction`, { method: "POST", headers: authHeaders(token) }),

  denyEducationCorrection: (token: string, id: string, reason: string) =>
    request(`/api/claims/education/${id}/deny-correction`, {
      method: "POST", headers: authHeaders(token),
      body: JSON.stringify({ accept: false, denial_reason: reason }),
    }),

  resendEducationVerification: (token: string, id: string) =>
    request(`/api/claims/education/${id}/resend`, { method: "POST", headers: authHeaders(token) }),

  // ── Organizations ──
  registerOrganization: (token: string, data: Record<string, unknown>) =>
    request("/api/organizations/", { method: "POST", headers: authHeaders(token), body: JSON.stringify(data) }),

  getMyOrganization: (token: string) =>
    request("/api/organizations/mine", { headers: authHeaders(token) }),

  updateMyOrganization: (token: string, data: Record<string, unknown>) =>
    request("/api/organizations/mine", { method: "PUT", headers: authHeaders(token), body: JSON.stringify(data) }),

  uploadOrgLogo: async (token: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_URL}/api/organizations/mine/logo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(error.detail);
    }
    return res.json();
  },

  searchOrganizations: (query: string) =>
    request(`/api/organizations/search?q=${encodeURIComponent(query)}`),

  // ── Employer Dashboard ──
  getEmployerClaims: (token: string) =>
    request("/api/employer/claims", { headers: authHeaders(token) }),

  getEmployerEmployees: (token: string) =>
    request("/api/employer/employees", { headers: authHeaders(token) }),

  employerVerifyClaim: (token: string, claimId: string, claimType: string) =>
    request(`/api/employer/claims/${claimId}/verify?claim_type=${claimType}`, { method: "POST", headers: authHeaders(token) }),

  employerCorrectClaim: (token: string, claimId: string, claimType: string, data: Record<string, unknown>) =>
    request(`/api/employer/claims/${claimId}/correct?claim_type=${claimType}`, {
      method: "POST", headers: authHeaders(token), body: JSON.stringify(data),
    }),

  employerDisputeClaim: (token: string, claimId: string, claimType: string, reason: string) =>
    request(`/api/employer/claims/${claimId}/dispute?claim_type=${claimType}`, {
      method: "POST", headers: authHeaders(token), body: JSON.stringify({ reason }),
    }),

  employerMarkDeparted: (token: string, claimId: string, endDate: string) =>
    request(`/api/employer/employees/${claimId}/depart`, {
      method: "POST", headers: authHeaders(token), body: JSON.stringify({ end_date: endDate }),
    }),

  // ── Verification (token-based, for org admins from email links) ──
  getVerification: (token: string, authToken: string) =>
    request(`/api/verify/${token}`, { headers: authHeaders(authToken) }),

  verifyClaimByToken: (token: string, authToken: string) =>
    request(`/api/verify/${token}/verify`, { method: "POST", headers: authHeaders(authToken) }),

  correctClaimByToken: (token: string, authToken: string, data: Record<string, unknown>) =>
    request(`/api/verify/${token}/correct`, { method: "POST", headers: authHeaders(authToken), body: JSON.stringify(data) }),

  disputeClaimByToken: (token: string, authToken: string, reason: string) =>
    request(`/api/verify/${token}/dispute`, { method: "POST", headers: authHeaders(authToken), body: JSON.stringify({ reason }) }),

  // ── Notifications ──
  getNotifications: (token: string) =>
    request("/api/notifications/", { headers: authHeaders(token) }),

  getOrgNotifications: (token: string) =>
    request("/api/notifications/org", { headers: authHeaders(token) }),

  getUnreadCount: (token: string) =>
    request("/api/notifications/unread-count", { headers: authHeaders(token) }),

  markNotificationRead: (token: string, id: string) =>
    request(`/api/notifications/${id}/read`, { method: "PUT", headers: authHeaders(token) }),

  markAllNotificationsRead: (token: string) =>
    request("/api/notifications/read-all", { method: "PUT", headers: authHeaders(token) }),

  // ── Lookup ──
  searchCompanies: (query: string) =>
    request(`/api/lookup/companies?q=${encodeURIComponent(query)}`),

  searchUniversities: (query: string) =>
    request(`/api/lookup/universities?q=${encodeURIComponent(query)}`),

  // ── Invite ──
  generateInviteLink: (token: string, companyName: string, companyDomain: string) =>
    request("/api/invite/generate", {
      method: "POST", headers: authHeaders(token),
      body: JSON.stringify({ company_name: companyName, company_domain: companyDomain }),
    }),

  decodeInvite: (code: string) =>
    request(`/api/invite/decode/${code}`),

  // ── Settings ──
  changePassword: (token: string, newPassword: string) =>
    request("/api/settings/password", {
      method: "PUT", headers: authHeaders(token),
      body: JSON.stringify({ new_password: newPassword }),
    }),

  deleteAccount: (token: string) =>
    request("/api/settings/account", { method: "DELETE", headers: authHeaders(token) }),
};
