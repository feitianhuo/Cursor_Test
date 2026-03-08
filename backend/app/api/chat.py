from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import load_config
from app.database import get_db
from app.llm.provider import stream_chat
from app.models.conversation import Conversation
from app.models.message import Message

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    conversation_id: int | None = None
    messages: list[ChatMessage]
    model: str | None = "qwen"
    system_prompt: str | None = "You are a helpful assistant."


async def event_generator(
    messages: list[dict],
    model: str,
    system_prompt: str,
    conversation_id: int | None = None,
    db: Session | None = None,
):
    """生成 SSE 事件流。"""
    import json

    full_response = ""
    try:
        async for chunk in stream_chat(model, messages, system_prompt):
            full_response += chunk
            payload = json.dumps({"content": chunk}, ensure_ascii=False)
            yield f"data: {payload}\n\n"

        # 结束后保存助手的消息
        if conversation_id and db:
            assistant_msg = Message(
                conversation_id=conversation_id, role="assistant", content=full_response
            )
            db.add(assistant_msg)
            
            # 更新会话的更新时间
            conv = db.get(Conversation, conversation_id)
            if conv:
                conv.updated_at = datetime.utcnow()
                
                # 如果是第一条回复，自动生成标题（简单取前 20 个字）
                if conv.title == "新对话":
                    # 查找该会话的第一条用户消息
                    first_user_msg = next((m["content"] for m in messages if m["role"] == "user"), None)
                    if first_user_msg:
                        conv.title = first_user_msg[:20] + ("..." if len(first_user_msg) > 20 else "")
            
            db.commit()

        yield "data: " + json.dumps({"done": True}, ensure_ascii=False) + "\n\n"
    except Exception as e:
        yield "data: " + json.dumps({"error": str(e)}, ensure_ascii=False) + "\n\n"


@router.post("/stream")
async def chat_stream(req: ChatRequest, db: Session = Depends(get_db)):
    """流式对话接口。"""
    config = load_config()
    model = (req.model or "qwen").lower()

    # 如果提供了 conversation_id，先保存用户最后一条消息
    conversation_id = req.conversation_id
    if conversation_id:
        conv = db.get(Conversation, conversation_id)
        if not conv:
            raise HTTPException(status_code=404, detail="会话不存在")
        
        # 保存用户最新的一条消息
        if req.messages and req.messages[-1].role == "user":
            user_msg = Message(
                conversation_id=conversation_id,
                role="user",
                content=req.messages[-1].content
            )
            db.add(user_msg)
            db.commit()

    if model in ("qwen", "qwen-turbo", "qwen-plus", "qwen-max"):
        if not config["qwen_api_key"]:
            raise HTTPException(
                status_code=400,
                detail="请配置 Qwen API Key（DASHSCOPE_API_KEY 或 config.yaml 中的 llm.qwen.api_key）",
            )
    elif model in ("openai", "gpt-4", "gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"):
        if not config["openai_api_key"]:
            raise HTTPException(
                status_code=400,
                detail="请配置 OpenAI API Key（OPENAI_API_KEY 或 config.yaml 中的 llm.openai.api_key）",
            )
    else:
        model = "qwen"
        if not config["qwen_api_key"]:
            raise HTTPException(
                status_code=400,
                detail="请配置 Qwen API Key（DASHSCOPE_API_KEY）",
            )

    msgs = [{"role": m.role, "content": m.content} for m in req.messages]

    return StreamingResponse(
        event_generator(
            msgs,
            model,
            req.system_prompt or "You are a helpful assistant.",
            conversation_id,
            db,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/models")
async def list_models():
    """返回可用模型列表。"""
    return {
        "models": [
            {"id": "qwen", "name": "Qwen (通义千问)", "default": True},
            {"id": "qwen-turbo", "name": "Qwen Turbo"},
            {"id": "qwen-plus", "name": "Qwen Plus"},
            {"id": "qwen-max", "name": "Qwen Max"},
            {"id": "openai", "name": "OpenAI (默认)"},
            {"id": "gpt-4o-mini", "name": "GPT-4o Mini"},
            {"id": "gpt-4o", "name": "GPT-4o"},
        ]
    }
