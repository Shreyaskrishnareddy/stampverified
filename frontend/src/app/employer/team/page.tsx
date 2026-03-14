"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";

type Member = {
  id: string;
  email: string;
  role: string;
  can_post_jobs: boolean;
  can_verify_claims: boolean;
  status: string;
  joined_at: string | null;
  created_at: string;
};

type Membership = Member & {
  org_name: string;
  org_domain: string;
};

type Toast = { id: number; message: string; type: "success" | "error" };

export default function TeamPage() {
  const router = useRouter();
  const supabase = createClient();

  const [token, setToken] = useState<string | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCanPost, setInviteCanPost] = useState(false);
  const [inviteCanVerify, setInviteCanVerify] = useState(false);
  const [inviting, setInviting] = useState(false);

  // Edit member
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCanPost, setEditCanPost] = useState(false);
  const [editCanVerify, setEditCanVerify] = useState(false);
  const [editRole, setEditRole] = useState("member");
  const [saving, setSaving] = useState(false);

  const addToast = (message: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const loadData = useCallback(async (accessToken: string) => {
    try {
      const [me, team] = await Promise.all([
        api.getMyMembership(accessToken),
        api.getTeamMembers(accessToken),
      ]);
      setMembership(me);
      setMembers(team);
    } catch {
      router.push("/for-employers");
      return;
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/for-employers"); return; }
      setToken(session.access_token);
      loadData(session.access_token);
    });
  }, [router, loadData, supabase.auth]);

  const isAdmin = membership?.role === "admin";

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      await api.inviteTeamMember(token, {
        email: inviteEmail.trim().toLowerCase(),
        can_post_jobs: inviteCanPost,
        can_verify_claims: inviteCanVerify,
      });
      addToast(`Invited ${inviteEmail}`);
      setShowInvite(false);
      setInviteEmail("");
      setInviteCanPost(false);
      setInviteCanVerify(false);
      loadData(token);
    } catch (err: unknown) {
      addToast((err as Error).message, "error");
    }
    setInviting(false);
  };

  const startEdit = (member: Member) => {
    setEditingId(member.id);
    setEditCanPost(member.can_post_jobs);
    setEditCanVerify(member.can_verify_claims);
    setEditRole(member.role);
  };

  const handleUpdate = async (memberId: string) => {
    if (!token) return;
    setSaving(true);
    try {
      await api.updateTeamMember(token, memberId, {
        can_post_jobs: editCanPost,
        can_verify_claims: editCanVerify,
        role: editRole,
      });
      addToast("Permissions updated");
      setEditingId(null);
      loadData(token);
    } catch (err: unknown) {
      addToast((err as Error).message, "error");
    }
    setSaving(false);
  };

  const handleDeactivate = async (memberId: string, email: string) => {
    if (!token) return;
    if (!confirm(`Remove ${email} from the workspace?`)) return;
    try {
      await api.deactivateTeamMember(token, memberId);
      addToast(`${email} removed`);
      loadData(token);
    } catch (err: unknown) {
      addToast((err as Error).message, "error");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA]">
        <Navbar />
        <div className="flex items-center justify-center pt-32">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const activeMembers = members.filter(m => m.status === "active");
  const invitedMembers = members.filter(m => m.status === "invited");

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className={`toast-enter flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium ${t.type === "success" ? "bg-white border-emerald-200" : "bg-white border-red-200"}`}>
            {t.message}
          </div>
        ))}
      </div>

      <Navbar />

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Team</h1>
            <p className="text-sm text-gray-500 mt-1">
              {membership?.org_name} &middot; {activeMembers.length} member{activeMembers.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/employer/dashboard")}
              className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              Back to dashboard
            </button>
            {isAdmin && (
              <button
                onClick={() => setShowInvite(true)}
                className="bg-[#0A0A0A] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors"
              >
                Invite member
              </button>
            )}
          </div>
        </div>

        {/* Invite form */}
        {showInvite && (
          <form onSubmit={handleInvite} className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 animate-fade-in">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Invite a team member</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  required
                  placeholder={`name@${membership?.org_domain || "company.com"}`}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Must be an @{membership?.org_domain} email</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Permissions</p>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={inviteCanPost} onChange={e => setInviteCanPost(e.target.checked)} className="rounded border-gray-300" />
                  <span className="text-sm text-gray-600">Can post jobs</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={inviteCanVerify} onChange={e => setInviteCanVerify(e.target.checked)} className="rounded border-gray-300" />
                  <span className="text-sm text-gray-600">Can verify claims</span>
                </label>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={inviting} className="px-4 py-2 text-sm font-semibold text-white bg-[#0A0A0A] hover:bg-gray-800 rounded-lg disabled:opacity-50">
                  {inviting ? "Inviting..." : "Send invite"}
                </button>
                <button type="button" onClick={() => setShowInvite(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Your membership */}
        {!isAdmin && membership && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6 text-sm text-blue-800">
            You are a <strong>member</strong> of this workspace.
            {!membership.can_post_jobs && !membership.can_verify_claims && (
              <> You don&apos;t have any permissions yet. Ask an admin to grant you access.</>
            )}
            {membership.can_post_jobs && <> You can post jobs.</>}
            {membership.can_verify_claims && <> You can verify claims.</>}
          </div>
        )}

        {/* Active members */}
        <div className="space-y-3">
          {activeMembers.map(member => (
            <div key={member.id} className="bg-white rounded-2xl border border-gray-200 p-5">
              {editingId === member.id ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900">{member.email}</p>
                    <span className="text-xs text-gray-400">Editing</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                      <select
                        value={editRole}
                        onChange={e => setEditRole(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    {editRole !== "admin" && (
                      <div className="space-y-2">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" checked={editCanPost} onChange={e => setEditCanPost(e.target.checked)} className="rounded border-gray-300" />
                          <span className="text-sm text-gray-600">Can post jobs</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" checked={editCanVerify} onChange={e => setEditCanVerify(e.target.checked)} className="rounded border-gray-300" />
                          <span className="text-sm text-gray-600">Can verify claims</span>
                        </label>
                      </div>
                    )}
                    {editRole === "admin" && (
                      <p className="text-xs text-gray-400">Admins automatically have all permissions.</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdate(member.id)} disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-[#0A0A0A] hover:bg-gray-800 rounded-lg disabled:opacity-50">
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button onClick={() => setEditingId(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 truncate">{member.email}</p>
                      {member.id === membership?.id && (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">You</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${member.role === "admin" ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                        {member.role}
                      </span>
                      {member.can_post_jobs && (
                        <span className="text-[10px] font-medium text-gray-400">Post jobs</span>
                      )}
                      {member.can_verify_claims && (
                        <span className="text-[10px] font-medium text-gray-400">Verify claims</span>
                      )}
                      {!member.can_post_jobs && !member.can_verify_claims && member.role !== "admin" && (
                        <span className="text-[10px] font-medium text-gray-300">No permissions</span>
                      )}
                    </div>
                  </div>
                  {isAdmin && member.id !== membership?.id && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => startEdit(member)}
                        className="text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeactivate(member.id, member.email)}
                        className="text-xs font-medium text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pending invites */}
        {invitedMembers.length > 0 && (
          <>
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mt-8 mb-3">
              Pending Invites ({invitedMembers.length})
            </h3>
            <div className="space-y-3">
              {invitedMembers.map(member => (
                <div key={member.id} className="bg-white rounded-2xl border border-dashed border-gray-200 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-600">{member.email}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Invited &middot; Waiting for signup
                        {member.can_post_jobs && " · Post jobs"}
                        {member.can_verify_claims && " · Verify claims"}
                      </p>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeactivate(member.id, member.email)}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* How members join */}
        <div className="mt-8 bg-gray-50 rounded-2xl border border-gray-100 p-6">
          <h3 className="text-sm font-bold text-gray-700 mb-2">How people join your workspace</h3>
          <ul className="text-sm text-gray-500 space-y-1.5">
            <li>Anyone with an @{membership?.org_domain} email can sign up and auto-join.</li>
            <li>New members start with no permissions until you grant them.</li>
            <li>You can also invite specific people by email above.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
