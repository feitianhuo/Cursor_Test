import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Loader2, MessageSquare, Copy, Check, RotateCcw, Trash2, Edit } from "lucide-react";
import { apiClient } from "../api/client";
import { useChatStore } from "../store/useChatStore";
import { MarkdownRenderer } from "../components/MarkdownRenderer";

interface ModelInfo {
  id: string;
  name: string;
  default?: boolean;
}

const DEFAULT_MODEL = "qwen";
const DEFAULT_MODELS: ModelInfo[] = [
  { id: "qwen", name: "Qwen (通义千问)", default: true },
  { id: "qwen-turbo", name: "Qwen Turbo" },
  { id: "qwen-plus", name: "Qwen Plus" },
  { id: "openai", name: "OpenAI" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini" },
];

export default function Chat() {
  const { 
    messages, 
    currentConversationId, 
    addMessage, 
    updateLastMessage, 
    createConversation,
    fetchConversations,
    deleteMessage,
    setMessages,
    loading: historyLoading 
  } = useChatStore();

  const [input, setInput] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [models, setModels] = useState<ModelInfo[]>(DEFAULT_MODELS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    apiClient
      .get<{ models: ModelInfo[] }>("/chat/models")
      .then((res) => {
        if (res.data.models?.length) setModels(res.data.models);
      })
      .catch(() => {});
  }, []);

  const handleSend = async (overrideText?: string, regenerateId?: number) => {
    // 处理点击事件作为第一个参数的情况
    const text = (typeof overrideText === 'string' ? overrideText : input).trim();
    if (!text && !regenerateId) return;
    if (loading) return;

    let convId = currentConversationId;
    
    // 如果没有当前会话，先创建一个
    if (!convId) {
      try {
        convId = await createConversation(text.slice(0, 20));
      } catch (err) {
        setError("无法创建对话，请重试");
        return;
      }
    }

    setInput("");
    setError(null);

    let msgsForAPI = [];

    if (regenerateId) {
      // 重新生成逻辑
      const msgIndex = messages.findIndex(m => m.id === regenerateId);
      if (msgIndex === -1) return;
      
      // 保留该消息之前的消息
      const history = messages.slice(0, msgIndex);
      setMessages(history);
      
      // 添加助手占位
      addMessage({
        id: Date.now() + 1,
        conversation_id: convId,
        role: "assistant",
        content: "",
      });

      msgsForAPI = history.map(m => ({ role: m.role, content: m.content }));
      setLoading(true);

      abortControllerRef.current = new AbortController();

      try {
        const res = await fetch(`/api/conversations/${convId}/messages/${regenerateId}/regenerate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortControllerRef.current.signal,
        });
        processStreamResponse(res);
      } catch (err) {
        handleStreamError(err);
      } finally {
        setLoading(false);
        abortControllerRef.current = null;
      }
      return;
    }

    // 普通发送或编辑后发送逻辑
    if (overrideText && editingMessageId) {
      // 如果是编辑消息，需要删除该消息及其之后的所有消息
      const msgIndex = messages.findIndex(m => m.id === editingMessageId);
      if (msgIndex !== -1) {
        const history = messages.slice(0, msgIndex);
        setMessages(history);
        
        // 先在后端删除（这里简化处理，直接发送新请求，后端在重新生成时会处理旧消息）
        // 实际上我们可以调用一个特殊的“编辑并重新生成”接口，或者先删除再发送
      }
    }

    // 添加用户消息
    addMessage({
      id: Date.now(),
      conversation_id: convId,
      role: "user",
      content: text,
    });

    // 添加助手占位消息
    addMessage({
      id: Date.now() + 1,
      conversation_id: convId,
      role: "assistant",
      content: "",
    });

    setLoading(true);

    const currentMsgs = overrideText && editingMessageId 
      ? messages.slice(0, messages.findIndex(m => m.id === editingMessageId))
      : messages;

    msgsForAPI = [
      ...currentMsgs.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: text },
    ];

    setEditingMessageId(null);

    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: msgsForAPI, 
          model,
          conversation_id: convId 
        }),
        signal: abortControllerRef.current.signal,
      });
      processStreamResponse(res);
    } catch (err) {
      handleStreamError(err);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const processStreamResponse = async (res: Response) => {
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP ${res.status}`);
    }

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.content) {
                updateLastMessage(parsed.content);
              }
              if (parsed.done) {
                fetchConversations();
              }
            } catch (e) {
              if (e instanceof Error && e.message !== "Unexpected end of JSON input") {
                throw e;
              }
            }
          }
        }
      }
    }
  };

  const handleStreamError = (err: any) => {
    if ((err as Error).name === "AbortError") return;
    setError((err as Error).message);
  };

  const handleCopy = (id: number, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleDelete = async (id: number) => {
    if (!currentConversationId) return;
    if (confirm("确定要删除这条消息吗？")) {
      await deleteMessage(currentConversationId, id);
    }
  };

  const startEdit = (id: number, content: string) => {
    setEditingMessageId(id);
    setEditingContent(content);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent("");
  };

  const submitEdit = () => {
    if (!editingContent.trim()) return;
    handleSend(editingContent);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-transparent">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-blue-500/10 bg-[#020617]/20 px-8 py-4 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]">
            <MessageSquare size={20} />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white/90">
              {currentConversationId ? "Active Session" : "New Intelligence"}
            </h1>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
              <span className="text-[10px] font-medium uppercase tracking-widest text-gray-500">System Online</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 px-3 py-1.5 transition-all hover:bg-blue-500/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400/70">Core</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="bg-transparent text-xs font-bold text-blue-400 outline-none cursor-pointer"
              disabled={loading}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id} className="bg-[#0f172a] text-gray-300">
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-8 custom-scrollbar">
        <div className="mx-auto max-w-4xl space-y-8">
          {historyLoading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-4 text-gray-500">
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-full bg-blue-500/20"></div>
                <Loader2 className="animate-spin relative z-10" size={32} />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.2em]">Synchronizing...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-6">
              <div className="relative group">
                <div className="absolute -inset-4 rounded-full bg-blue-500/10 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500"></div>
                <div className="relative rounded-3xl bg-white/5 p-8 shadow-[0_0_50px_rgba(0,0,0,0.3)] border border-white/10 backdrop-blur-md">
                  <MessageSquare size={48} className="text-blue-500/40" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-lg font-bold tracking-tight text-white/80">How can I assist you today?</p>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">Awaiting input signal</p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((m, idx) => (
                <div
                  key={m.id || idx}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-4 duration-500`}
                >
                  <div
                    className={`group relative max-w-[85%] rounded-2xl px-5 py-4 shadow-2xl transition-all ${
                      m.role === "user"
                        ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-blue-900/20"
                        : "bg-white/5 text-gray-200 border border-white/10 backdrop-blur-xl"
                    }`}
                  >
                    {editingMessageId === m.id ? (
                      <div className="flex flex-col gap-3 min-w-[320px]">
                        <textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          className="w-full rounded-xl border border-blue-500/30 bg-white/5 p-3 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                          rows={4}
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={cancelEdit}
                            className="rounded-lg px-4 py-2 text-xs font-bold text-gray-400 hover:bg-white/5 transition-colors"
                          >
                            CANCEL
                          </button>
                          <button
                            onClick={submitEdit}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-lg shadow-blue-900/20 transition-all"
                          >
                            RE-INITIALIZE
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-[#0f172a] prose-pre:border prose-pre:border-white/5">
                          <MarkdownRenderer content={m.content} isUser={m.role === "user"} />
                          {loading && m.role === "assistant" && !m.content && (
                            <div className="flex items-center gap-1.5 py-2">
                              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></span>
                              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] [animation-delay:0.2s]"></span>
                              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] [animation-delay:0.4s]"></span>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div
                          className={`absolute -bottom-10 flex items-center gap-2 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:-bottom-9 ${
                            m.role === "user" ? "right-2" : "left-2"
                          }`}
                        >
                          <button
                            onClick={() => handleCopy(m.id, m.content)}
                            className="rounded-lg bg-[#1e293b]/80 p-2 text-gray-400 shadow-xl border border-white/5 hover:text-blue-400 backdrop-blur-md transition-colors"
                            title="Copy"
                          >
                            {copiedMessageId === m.id ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                          {m.role === "user" && (
                            <button
                              onClick={() => startEdit(m.id, m.content)}
                              className="rounded-lg bg-[#1e293b]/80 p-2 text-gray-400 shadow-xl border border-white/5 hover:text-blue-400 backdrop-blur-md transition-colors"
                              title="Edit"
                            >
                              <Edit size={14} />
                            </button>
                          )}
                          {m.role === "assistant" && (
                            <button
                              onClick={() => handleSend("", m.id)}
                              className="rounded-lg bg-[#1e293b]/80 p-2 text-gray-400 shadow-xl border border-white/5 hover:text-blue-400 backdrop-blur-md transition-colors"
                              title="Regenerate"
                              disabled={loading}
                            >
                              <RotateCcw size={14} className={loading ? "animate-spin text-blue-500" : ""} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(m.id)}
                            className="rounded-lg bg-[#1e293b]/80 p-2 text-gray-400 shadow-xl border border-white/5 hover:text-red-400 backdrop-blur-md transition-colors"
                            title="Purge"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} className="h-12" />
            </>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-blue-500/10 bg-[#020617]/40 p-6 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl">
          {error && (
            <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-xs font-bold text-red-400 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <div className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
              {error}
            </div>
          )}
          <div className="relative group">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-blue-500/20 to-purple-500/20 opacity-0 group-focus-within:opacity-100 transition-opacity blur"></div>
            <div className="relative flex items-end gap-3 rounded-2xl border border-white/10 bg-[#1e293b]/50 p-3 shadow-2xl backdrop-blur-md transition-all focus-within:border-blue-500/50">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Initialize communication signal..."
                className="max-h-64 flex-1 resize-none bg-transparent px-3 py-2 text-[15px] text-gray-100 outline-none placeholder:text-gray-500 font-medium leading-relaxed"
                rows={1}
                style={{ height: "auto", minHeight: "44px" }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = `${target.scrollHeight}px`;
                }}
                disabled={loading}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${
                  input.trim() && !loading
                    ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:scale-105 active:scale-95"
                    : "bg-white/5 text-gray-600 border border-white/5"
                }`}
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-center gap-4 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">
            <span>Neural Link Stable</span>
            <span className="h-1 w-1 rounded-full bg-gray-700"></span>
            <span>Encryption Active</span>
            <span className="h-1 w-1 rounded-full bg-gray-700"></span>
            <span>AI Verified Output</span>
          </div>
        </div>
      </div>
    </div>
  );
}
