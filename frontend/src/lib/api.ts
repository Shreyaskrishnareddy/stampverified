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

  const text = await res.text();
  return text ? JSON.parse(text) : {};
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

  updateProfile: (token: string, data: Record<string, unknown>) =>
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

  // ── Team (company workspace members) ──
  getTeamMembers: (token: string) =>
    request("/api/employer/team/", { headers: authHeaders(token) }),

  getMyMembership: (token: string) =>
    request("/api/employer/team/me", { headers: authHeaders(token) }),

  inviteTeamMember: (token: string, data: { email: string; can_post_jobs?: boolean; can_verify_claims?: boolean }) =>
    request("/api/employer/team/invite", { method: "POST", headers: authHeaders(token), body: JSON.stringify(data) }),

  updateTeamMember: (token: string, memberId: string, data: Record<string, unknown>) =>
    request(`/api/employer/team/${memberId}`, { method: "PUT", headers: authHeaders(token), body: JSON.stringify(data) }),

  deactivateTeamMember: (token: string, memberId: string) =>
    request(`/api/employer/team/${memberId}`, { method: "DELETE", headers: authHeaders(token) }),

  joinWorkspace: (token: string) =>
    request("/api/employer/team/join", { method: "POST", headers: authHeaders(token) }),

  updateNotificationPreferences: (token: string, prefs: Record<string, unknown>) =>
    request("/api/employer/team/notifications", { method: "PUT", headers: authHeaders(token), body: JSON.stringify(prefs) }),

  // ── Jobs (public) ──
  getJobFunctions: () =>
    request("/api/jobs/functions"),

  getPublicJobs: (params?: Record<string, string>) => {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/api/jobs${query}`);
  },

  getPublicJob: (jobId: string) =>
    request(`/api/jobs/${jobId}`),

  getPublicJobWithAuth: (jobId: string, token: string) =>
    request(`/api/jobs/${jobId}`, { headers: authHeaders(token) }),

  getCompanyJobs: (domain: string) =>
    request(`/api/companies/${domain}/jobs`),

  // ── Jobs (employer) ──
  extractJD: (token: string, text: string) =>
    request("/api/employer/jobs/extract", { method: "POST", headers: authHeaders(token), body: JSON.stringify({ text }) }),

  createJob: (token: string, data: Record<string, unknown>) =>
    request("/api/employer/jobs", { method: "POST", headers: authHeaders(token), body: JSON.stringify(data) }),

  getEmployerJobs: (token: string, status?: string) => {
    const query = status ? `?status=${status}` : "";
    return request(`/api/employer/jobs${query}`, { headers: authHeaders(token) });
  },

  getEmployerJob: (token: string, jobId: string) =>
    request(`/api/employer/jobs/${jobId}`, { headers: authHeaders(token) }),

  updateJob: (token: string, jobId: string, data: Record<string, unknown>) =>
    request(`/api/employer/jobs/${jobId}`, { method: "PUT", headers: authHeaders(token), body: JSON.stringify(data) }),

  closeJob: (token: string, jobId: string) =>
    request(`/api/employer/jobs/${jobId}`, { method: "DELETE", headers: authHeaders(token) }),

  // ── Job Matching ──
  matchJobsFromResume: async (token: string | null, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API_URL}/api/jobs/match`, {
      method: "POST",
      headers,
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "Failed to process resume" }));
      throw new Error(error.detail);
    }
    return res.json();
  },

  // ── Candidate Preferences ──
  getCandidatePreferences: (token: string) =>
    request("/api/candidate/preferences", { headers: authHeaders(token) }),

  updateCandidatePreferences: (token: string, data: Record<string, unknown>) =>
    request("/api/candidate/preferences", { method: "PUT", headers: authHeaders(token), body: JSON.stringify(data) }),

  uploadResume: async (token: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_URL}/api/candidate/resume`, {
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

  deleteResume: (token: string) =>
    request("/api/candidate/resume", { method: "DELETE", headers: authHeaders(token) }),

  // ── Applications ──
  applyToJob: (token: string, data: { job_id: string; cover_note?: string }) =>
    request("/api/applications", { method: "POST", headers: authHeaders(token), body: JSON.stringify(data) }),

  getMyApplications: (token: string) =>
    request("/api/applications", { headers: authHeaders(token) }),

  withdrawApplication: (token: string, applicationId: string) =>
    request(`/api/applications/${applicationId}/withdraw`, { method: "PUT", headers: authHeaders(token) }),

  // ── Saved Jobs ──
  saveJob: (token: string, jobId: string) =>
    request(`/api/jobs/${jobId}/save`, { method: "POST", headers: authHeaders(token) }),

  unsaveJob: (token: string, jobId: string) =>
    request(`/api/jobs/${jobId}/save`, { method: "DELETE", headers: authHeaders(token) }),

  getSavedJobs: (token: string) =>
    request("/api/jobs/saved", { headers: authHeaders(token) }),

  // ── Employer Applications ──
  getEmployerApplications: (token: string, jobId: string) =>
    request(`/api/employer/applications?job_id=${jobId}`, { headers: authHeaders(token) }),

  updateApplicationStatus: (token: string, applicationId: string, status: string) =>
    request(`/api/employer/applications/${applicationId}`, {
      method: "PUT", headers: authHeaders(token),
      body: JSON.stringify({ status }),
    }),

  // ── Talent Search ──
  searchTalent: (token: string, params?: Record<string, string>) => {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/api/employer/talent${query}`, { headers: authHeaders(token) });
  },

  getJobMatches: (token: string, jobId: string) =>
    request(`/api/employer/jobs/${jobId}/matches`, { headers: authHeaders(token) }),

  // ── Outreach & Messaging ──
  sendOutreach: (token: string, data: { candidate_id: string; job_id: string; message: string }) =>
    request("/api/employer/outreach", { method: "POST", headers: authHeaders(token), body: JSON.stringify(data) }),

  getConversations: (token: string, role: string) =>
    request(`/api/conversations?role=${role}`, { headers: authHeaders(token) }),

  getConversation: (token: string, conversationId: string) =>
    request(`/api/conversations/${conversationId}`, { headers: authHeaders(token) }),

  sendMessage: (token: string, conversationId: string, content: string) =>
    request(`/api/conversations/${conversationId}/messages`, {
      method: "POST", headers: authHeaders(token), body: JSON.stringify({ content }),
    }),

  declineConversation: (token: string, conversationId: string) =>
    request(`/api/conversations/${conversationId}/decline`, { method: "PUT", headers: authHeaders(token) }),

  sendApplicationMessage: (token: string, applicationId: string, content: string) =>
    request(`/api/applications/${applicationId}/message`, {
      method: "POST", headers: authHeaders(token), body: JSON.stringify({ content }),
    }),

  // ── Verification (token-based, no login required — token is the auth) ──
  getVerification: (token: string) =>
    request(`/api/verify/${token}`),

  verifyClaimByToken: (token: string) =>
    request(`/api/verify/${token}/verify`, { method: "POST" }),

  correctClaimByToken: (token: string, data: Record<string, unknown>) =>
    request(`/api/verify/${token}/correct`, { method: "POST", body: JSON.stringify(data) }),

  disputeClaimByToken: (token: string, reason: string) =>
    request(`/api/verify/${token}/dispute`, { method: "POST", body: JSON.stringify({ reason }) }),

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

  // ── Companies Directory ──
  listCompanies: (params?: Record<string, string>) => {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/api/companies${query}`);
  },

  requestCompany: (token: string, data: { company_name: string; company_domain: string; company_website?: string }) =>
    request("/api/companies/request", { method: "POST", headers: authHeaders(token), body: JSON.stringify(data) }),

  getMyCompanyRequests: (token: string) =>
    request("/api/companies/requests/mine", { headers: authHeaders(token) }),

  saveCompany: (token: string, orgId: string) =>
    request(`/api/companies/${orgId}/save`, { method: "POST", headers: authHeaders(token) }),

  unsaveCompany: (token: string, orgId: string) =>
    request(`/api/companies/${orgId}/save`, { method: "DELETE", headers: authHeaders(token) }),

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
  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    request("/api/settings/password", {
      method: "PUT", headers: authHeaders(token),
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),

  deleteAccount: (token: string, confirmation: string) =>
    request("/api/settings/account", {
      method: "DELETE", headers: authHeaders(token),
      body: JSON.stringify({ confirmation }),
    }),
};
