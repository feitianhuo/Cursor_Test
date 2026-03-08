import { create } from "zustand";
import { apiClient } from "../api/client";

export interface Conversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number | string;
  conversation_id: number;
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: string;
}

interface ChatState {
  conversations: Conversation[];
  currentConversationId: number | null;
  messages: Message[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchConversations: () => Promise<void>;
  createConversation: (title?: string) => Promise<number>;
  selectConversation: (id: number | null) => Promise<void>;
  updateConversation: (id: number, title: string) => Promise<void>;
  deleteConversation: (id: number) => Promise<void>;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateLastMessage: (content: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],
  loading: false,
  error: null,

  fetchConversations: async () => {
    try {
      const res = await apiClient.get<Conversation[]>("/conversations");
      set({ conversations: res.data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  createConversation: async (title?: string) => {
    try {
      const res = await apiClient.post<Conversation>("/conversations", { title });
      set((state) => ({
        conversations: [res.data, ...state.conversations],
        currentConversationId: res.data.id,
        messages: [],
      }));
      return res.data.id;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  selectConversation: async (id: number | null) => {
    if (id === null) {
      set({ currentConversationId: null, messages: [] });
      return;
    }
    set({ currentConversationId: id, loading: true });
    try {
      const res = await apiClient.get<Message[]>(`/conversations/${id}/messages`);
      set({ messages: res.data, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  updateConversation: async (id: number, title: string) => {
    try {
      await apiClient.patch(`/conversations/${id}`, { title });
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, title } : c
        ),
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteConversation: async (id: number) => {
    try {
      await apiClient.delete(`/conversations/${id}`);
      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        currentConversationId: state.currentConversationId === id ? null : state.currentConversationId,
        messages: state.currentConversationId === id ? [] : state.messages,
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteMessage: async (convId: number, msgId: number) => {
    try {
      await apiClient.delete(`/conversations/${convId}/messages/${msgId}`);
      set((state) => ({
        messages: state.messages.filter((m) => m.id !== msgId),
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  clearMessages: () => set({ messages: [] }),

  setMessages: (messages) => set({ messages }),
  
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  
  updateLastMessage: (content) => set((state) => {
    const next = [...state.messages];
    if (next.length > 0 && next[next.length - 1].role === "assistant") {
      next[next.length - 1] = { ...next[next.length - 1], content: next[next.length - 1].content + content };
    }
    return { messages: next };
  }),
}));
