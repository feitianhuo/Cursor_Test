from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.conversation import Conversation
from app.models.message import Message

router = APIRouter(prefix="/conversations", tags=["conversations"])


class ConversationBase(BaseModel):
    title: str


class ConversationCreate(BaseModel):
    title: str | None = "新对话"


class ConversationUpdate(BaseModel):
    title: str


class ConversationSchema(ConversationBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MessageSchema(BaseModel):
    id: int
    conversation_id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=List[ConversationSchema])
def list_conversations(db: Session = Depends(get_db)):
    """获取所有会话，按更新时间倒序排序。"""
    stmt = select(Conversation).order_by(desc(Conversation.updated_at))
    return db.scalars(stmt).all()


@router.post("", response_model=ConversationSchema)
def create_conversation(req: ConversationCreate, db: Session = Depends(get_db)):
    """创建新会话。"""
    print(f"Creating conversation: {req.title}")
    try:
        conv = Conversation(title=req.title or "新对话")
        db.add(conv)
        db.commit()
        db.refresh(conv)
        print(f"Created conversation: {conv.id}")
        return conv
    except Exception as e:
        print(f"Error creating conversation: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{conversation_id}", response_model=ConversationSchema)
def get_conversation(conversation_id: int, db: Session = Depends(get_db)):
    """获取单个会话详情。"""
    conv = db.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="会话不存在")
    return conv


@router.patch("/{conversation_id}", response_model=ConversationSchema)
def update_conversation(
    conversation_id: int, req: ConversationUpdate, db: Session = Depends(get_db)
):
    """更新会话标题。"""
    conv = db.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="会话不存在")
    conv.title = req.title
    db.commit()
    db.refresh(conv)
    return conv


@router.delete("/{conversation_id}")
def delete_conversation(conversation_id: int, db: Session = Depends(get_db)):
    """删除会话。"""
    conv = db.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="会话不存在")
    db.delete(conv)
    db.commit()
    return {"message": "删除成功"}


@router.get("/{conversation_id}/messages", response_model=List[MessageSchema])
def list_messages(conversation_id: int, db: Session = Depends(get_db)):
    """获取指定会话的所有消息。"""
    conv = db.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    stmt = select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at)
    return db.scalars(stmt).all()


@router.delete("/{conversation_id}/messages/{message_id}")
def delete_message(conversation_id: int, message_id: int, db: Session = Depends(get_db)):
    """删除单条消息。"""
    msg = db.get(Message, message_id)
    if not msg or msg.conversation_id != conversation_id:
        raise HTTPException(status_code=404, detail="消息不存在")
    db.delete(msg)
    db.commit()
    return {"message": "删除成功"}


@router.post("/{conversation_id}/messages/{message_id}/regenerate")
async def regenerate_message(conversation_id: int, message_id: int, db: Session = Depends(get_db)):
    """重新生成该消息（及其之后的所有消息将被删除，然后重新生成该位置的消息）。"""
    msg = db.get(Message, message_id)
    if not msg or msg.conversation_id != conversation_id:
        raise HTTPException(status_code=404, detail="消息不存在")
    
    # 获取该消息之前的所有历史
    stmt = select(Message).where(
        Message.conversation_id == conversation_id,
        Message.created_at < msg.created_at
    ).order_by(Message.created_at)
    history_msgs = db.scalars(stmt).all()
    
    # 转换为模型输入格式
    chat_history = [{"role": m.role, "content": m.content} for m in history_msgs]
    
    # 删除该消息及其之后的所有消息
    stmt_delete = select(Message).where(
        Message.conversation_id == conversation_id,
        Message.created_at >= msg.created_at
    )
    to_delete = db.scalars(stmt_delete).all()
    for d in to_delete:
        db.delete(d)
    db.commit()

    # 返回流式响应
    from app.api.chat import event_generator
    return StreamingResponse(
        event_generator(chat_history, "qwen", "You are a helpful assistant.", conversation_id, db),
        media_type="text/event-stream",
    )
