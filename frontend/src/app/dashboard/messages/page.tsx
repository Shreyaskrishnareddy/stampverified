"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import Link from "next/link";

type Conversation = {
  id: string;
  type: string;
  status: string;
  job_id: string | null;
  job_title: string | null;
  org_name: string | null;
  org_domain: string | null;
  other_party_name: string;
  last_message: string;
  last_message_at: string | null;
  last_message_sender: string | null;
  unread_count: number;
};

type Message = {
  id: string;
  sender_type: string;
  content: string;
  sent_at: string;
  read_at: string | null;
};

type ConversationDetail = {
  conversation: {
    id: string;
    type: string;
    status: string;
    job: { id: string; title: string; salary_min: number; salary_max: number; salary_currency: string; location: string; location_type: string } | null;
    org_name: string;
    org_domain: string;
    org_logo_url: string | null;
    candidate_name: string;
    member_name: string;
  };
  messages: Message[];
  is_candidate: boolean;
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

export default function CandidateMessagesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [token, setToken] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingConv, setLoadingConv] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  const loadConversations = useCallback(async (accessToken: string) => {
    try {
      const convs = await api.getConversations(accessToken, "candidate");
      setConversations(convs);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/?auth=signin"); return; }
      setToken(session.access_token);
      loadConversations(session.access_token);
    });
  }, [router, loadConversations, supabase.auth]);

  const openConversation = async (convId: string) => {
    if (!token) return;
    setLoadingConv(true);
    try {
      const detail = await api.getConversation(token, convId);
      setSelectedConv(detail);
    } catch { /* empty */ }
    setLoadingConv(false);
  };

  const handleSendMessage = async () => {
    if (!token || !selectedConv || !newMessage.trim()) return;
    setSending(true);
    try {
      await api.sendMessage(token, selectedConv.conversation.id, newMessage.trim());
      setNewMessage("");
      // Reload conversation
      const detail = await api.getConversation(token, selectedConv.conversation.id);
      setSelectedConv(detail);
      loadConversations(token);
    } catch { /* empty */ }
    setSending(false);
  };

  const handleDecline = async () => {
    if (!token || !selectedConv) return;
    try {
      await api.declineConversation(token, selectedConv.conversation.id);
      const detail = await api.getConversation(token, selectedConv.conversation.id);
      setSelectedConv(detail);
      loadConversations(token);
    } catch { /* empty */ }
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

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          <Link href="/dashboard" className="text-sm font-medium text-gray-500 hover:text-gray-900">Dashboard</Link>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden" style={{ minHeight: 500 }}>
          <div className="flex h-full" style={{ minHeight: 500 }}>
            {/* Conversation list */}
            <div className="w-80 border-r border-gray-100 flex-shrink-0 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-gray-400">No messages yet</p>
                </div>
              ) : conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => openConversation(conv.id)}
                  className={`w-full text-left px-4 py-4 border-b border-gray-50 hover:bg-gray-50 transition-colors ${selectedConv?.conversation.id === conv.id ? "bg-blue-50" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${conv.unread_count > 0 ? "text-gray-900" : "text-gray-700"}`}>
                        {conv.org_name} {conv.type === "outreach" ? "· Outreach" : ""}
                      </p>
                      {conv.job_title && <p className="text-xs text-gray-400 truncate">{conv.job_title}</p>}
                      <p className="text-xs text-gray-400 mt-1 truncate">{conv.last_message}</p>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      {conv.last_message_at && <span className="text-[10px] text-gray-300">{timeAgo(conv.last_message_at)}</span>}
                      {conv.unread_count > 0 && (
                        <span className="mt-1 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">{conv.unread_count}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Message thread */}
            <div className="flex-1 flex flex-col">
              {loadingConv ? (
                <div className="flex items-center justify-center flex-1">
                  <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                </div>
              ) : !selectedConv ? (
                <div className="flex items-center justify-center flex-1 text-sm text-gray-400">
                  Select a conversation
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-gray-100">
                    <p className="font-semibold text-gray-900">{selectedConv.conversation.org_name}</p>
                    <p className="text-xs text-gray-400">
                      {selectedConv.conversation.member_name}
                      {selectedConv.conversation.job ? ` · ${selectedConv.conversation.job.title}` : ""}
                      {selectedConv.conversation.type === "outreach" ? " · Outreach" : " · Application"}
                    </p>
                    {selectedConv.conversation.status === "declined" && (
                      <p className="text-xs text-red-400 mt-1">This conversation has been declined</p>
                    )}
                  </div>

                  {/* Outreach context (if this is the first view of an outreach) */}
                  {selectedConv.conversation.type === "outreach" && selectedConv.conversation.job && selectedConv.conversation.status === "active" && (
                    <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                      <div className="text-xs text-blue-700">
                        <span className="font-medium">{selectedConv.conversation.org_name}</span> reached out about{" "}
                        <Link href={`/jobs/${selectedConv.conversation.job.id}`} className="font-medium underline">{selectedConv.conversation.job.title}</Link>
                      </div>
                      <button onClick={handleDecline} className="text-xs text-red-500 hover:text-red-700 font-medium">
                        Not Interested
                      </button>
                    </div>
                  )}

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {selectedConv.messages.map(msg => {
                      const isMine = msg.sender_type === "candidate";
                      return (
                        <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm ${isMine ? "bg-[#0A0A0A] text-white" : "bg-gray-100 text-gray-800"}`}>
                            <p>{msg.content}</p>
                            <p className={`text-[10px] mt-1 ${isMine ? "text-gray-400" : "text-gray-400"}`}>
                              {timeAgo(msg.sent_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Input */}
                  {selectedConv.conversation.status === "active" && (
                    <div className="px-6 py-4 border-t border-gray-100">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newMessage}
                          onChange={e => setNewMessage(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                          placeholder="Type a message..."
                          className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                        />
                        <button
                          onClick={handleSendMessage}
                          disabled={sending || !newMessage.trim()}
                          className="px-4 py-2.5 bg-[#0A0A0A] text-white rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
