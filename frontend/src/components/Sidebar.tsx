import { useEffect, useState, useRef } from "react";
import { Plus, MessageSquare, Trash2, Settings, Edit2, Check, X } from "lucide-react";
import { useChatStore } from "../store/useChatStore";

export default function Sidebar() {
  const { 
    conversations, 
    currentConversationId, 
    fetchConversations, 
    createConversation, 
    selectConversation,
    deleteConversation,
    updateConversation
  } = useChatStore();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (editingId !== null && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleNewChat = async () => {
    try {
      const id = await createConversation("新对话");
      selectConversation(id);
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  };

  const startEditing = (e: React.MouseEvent, id: number, title: string) => {
    e.stopPropagation();
    setEditingId(id);
    setEditingTitle(title);
  };

  const saveEditing = async (e?: React.FormEvent | React.FocusEvent) => {
    if (e) e.preventDefault();
    if (editingId === null) return;
    
    if (editingTitle.trim()) {
      await updateConversation(editingId, editingTitle.trim());
    }
    setEditingId(null);
  };

  const cancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveEditing();
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
  };

  return (
    <aside className="flex w-72 flex-col border-r border-blue-500/10 bg-[#020617]/40 backdrop-blur-xl p-4">
      <button
        onClick={handleNewChat}
        className="group mb-6 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-sm font-semibold text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)] transition-all hover:bg-blue-500/10 hover:border-blue-500/40 hover:shadow-[0_0_20px_rgba(59,130,246,0.2)] active:scale-95"
      >
        <Plus size={18} className="transition-transform group-hover:rotate-90" />
        新建对话
      </button>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <h2 className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-500/50">
          History
        </h2>
        <div className="space-y-1.5">
          {conversations.length === 0 && (
            <p className="px-3 py-8 text-center text-xs text-gray-500 italic font-light">
              No history found
            </p>
          )}
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-all cursor-pointer relative overflow-hidden ${
                currentConversationId === conv.id
                  ? "bg-blue-500/15 text-blue-400 border border-blue-500/20 shadow-[inset_0_0_10px_rgba(59,130,246,0.05)]"
                  : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
              }`}
              onClick={() => selectConversation(conv.id)}
            >
              <MessageSquare size={16} className={`shrink-0 ${currentConversationId === conv.id ? "text-blue-400" : "text-gray-500 group-hover:text-blue-400/70"}`} />
              
              {editingId === conv.id ? (
                <div className="flex flex-1 items-center gap-2 min-w-0" onClick={e => e.stopPropagation()}>
                  <input
                    ref={inputRef}
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={() => saveEditing()}
                    className="flex-1 min-w-0 rounded-lg border border-blue-500/30 bg-white/5 px-2 py-1 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  />
                </div>
              ) : (
                <>
                  <span className="flex-1 truncate font-medium">{conv.title}</span>
                  <div className="invisible flex items-center gap-1.5 group-hover:visible animate-in fade-in slide-in-from-right-2 duration-200">
                    <button
                      onClick={(e) => startEditing(e, conv.id, conv.title)}
                      className="p-1 text-gray-500 hover:text-blue-400 transition-colors"
                      title="重命名"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("确定要删除这个对话吗？")) {
                          deleteConversation(conv.id);
                        }
                      }}
                      className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                      title="删除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </>
              )}
              {currentConversationId === conv.id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[2px] bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 border-t border-blue-500/10 pt-4">
        <button className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-all active:scale-[0.98]">
          <Settings size={18} className="text-gray-500" />
          <span className="font-medium">Settings (Phase 5)</span>
        </button>
      </div>
    </aside>
  );
}
