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
  job_title: string | null;
  other_party_name: string;
  last_message: string;
  last_message_at: string | null;
  unread_count: number;
};

type Message = {
  id: string;
  sender_type: string;
  content: string;
  sent_at: string;
};

type ConversationDetail = {
  conversation: {
    id: string;
    type: string;
    status: string;
    job: { id: string; title: string } | null;
    org_name: string;
    candidate_name: string;
    candidate_username: string;
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
  return days < 7 ? `${days}d` : `${Math.floor(days / 7)}w`;
}

export default function EmployerMessagesPage() {
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
      const convs = await api.getConversations(accessToken, "employer");
      setConversations(convs);
    } catch { router.push("/for-employers"); }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/for-employers"); return; }
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
      loadConversations(token); // refresh unread counts
    } catch { /* empty */ }
    setLoadingConv(false);
  };

  const handleSendMessage = async () => {
    if (!token || !selectedConv || !newMessage.trim()) return;
    setSending(true);
    try {
      await api.sendMessage(token, selectedConv.conversation.id, newMessage.trim());
      setNewMessage("");
      const detail = await api.getConversation(token, selectedConv.conversation.id);
      setSelectedConv(detail);
      loadConversations(token);
    } catch {
      alert("Failed to send message. Please try again.");
    }
    setSending(false);
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
          <Link href="/employer/dashboard" className="text-sm font-medium text-gray-500 hover:text-gray-900">Dashboard</Link>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden" style={{ minHeight: 500 }}>
          <div className="flex h-full" style={{ minHeight: 500 }}>
            {/* Conversation list */}
            <div className="w-80 border-r border-gray-100 flex-shrink-0 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-gray-400">No messages yet. Messages appear here when candidates apply or you reach out.</p>
                  <Link href="/employer/talent" className="text-xs text-blue-600 hover:text-blue-700 mt-2 inline-block">Search talent to reach out</Link>
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
                        {conv.other_party_name}
                      </p>
                      {conv.job_title && <p className="text-xs text-gray-400 truncate">{conv.job_title} · {conv.type === "outreach" ? "Outreach" : "Application"}</p>}
                      <p className="text-xs text-gray-400 mt-1 truncate">{conv.last_message}</p>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      {conv.last_message_at && <span className="text-[10px] text-gray-300">{timeAgo(conv.last_message_at)}</span>}
                      {conv.unread_count > 0 && (
                        <span className="mt-1 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">{conv.unread_count}</span>
                      )}
                    </div>
                  </div>
                  {conv.status === "declined" && <p className="text-[10px] text-red-400 mt-1">Declined</p>}
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
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{selectedConv.conversation.candidate_name}</p>
                        <Link href={`/${selectedConv.conversation.candidate_username}`} className="text-xs text-gray-400 hover:text-gray-600">View profile</Link>
                      </div>
                      <p className="text-xs text-gray-400">
                        {selectedConv.conversation.job ? selectedConv.conversation.job.title : ""}
                        {selectedConv.conversation.type === "outreach" ? " · Outreach" : " · Application"}
                      </p>
                    </div>
                    {selectedConv.conversation.status === "declined" && (
                      <span className="text-xs text-red-400 font-medium">Declined</span>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {selectedConv.messages.map(msg => {
                      const isMine = msg.sender_type === "employer";
                      return (
                        <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm ${isMine ? "bg-[#0A0A0A] text-white" : "bg-gray-100 text-gray-800"}`}>
                            <p>{msg.content}</p>
                            <p className="text-[10px] mt-1 text-gray-400">{timeAgo(msg.sent_at)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

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
