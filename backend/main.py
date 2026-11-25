
import os

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Literal
from dotenv import load_dotenv
from litellm import acompletion

from database import engine, Base, SessionLocal
import models

load_dotenv()

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Lumina AI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class MessageInput(BaseModel):
    role: Literal["user", "assistant"]
    content: str


@app.get("/")
def home():
    return {
        "message": "Welcome to Lumina AI API",
        "status": "running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "application": "Lumina AI",
        "database": "connected"
    }


@app.post("/chats")
def create_chat(db: Session = Depends(get_db)):
    chat = models.ChatSession()
    db.add(chat)
    db.commit()
    db.refresh(chat)

    return {
        "id": chat.id,
        "title": chat.title
    }


@app.get("/chats")
def get_chats(db: Session = Depends(get_db)):
    chats = db.query(models.ChatSession).order_by(
        models.ChatSession.created_at.desc()
    ).all()

    return [
        {"id": chat.id, "title": chat.title}
        for chat in chats
    ]


@app.get("/chats/{chat_id}")
def get_chat(chat_id: int, db: Session = Depends(get_db)):
    chat = db.query(models.ChatSession).filter(
        models.ChatSession.id == chat_id
    ).first()

    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    return {
        "id": chat.id,
        "title": chat.title,
        "messages": [
            {
                "id": message.id,
                "role": message.role,
                "content": message.content
            }
            for message in chat.messages
        ]
    }


@app.post("/chats/{chat_id}/messages")
def add_message(
    chat_id: int,
    data: MessageInput,
    db: Session = Depends(get_db)
):
    chat = db.query(models.ChatSession).filter(
        models.ChatSession.id == chat_id
    ).first()

    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    message = models.ChatMessage(
        session_id=chat_id,
        role=data.role,
        content=data.content
    )

    db.add(message)

    if data.role == "user" and chat.title == "New conversation":
        chat.title = data.content[:60]

    db.commit()
    db.refresh(message)

    return {
        "id": message.id,
        "role": message.role,
        "content": message.content
    }


@app.post("/chats/{chat_id}/generate")
async def generate_response(
    chat_id: int,
    db: Session = Depends(get_db)
):
    chat = db.query(models.ChatSession).filter(
        models.ChatSession.id == chat_id
    ).first()

    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    messages = [
        {
            "role": message.role,
            "content": message.content
        }
        for message in chat.messages
    ]

    if not messages:
        raise HTTPException(
            status_code=400,
            detail="No messages found"
        )

    api_keys = [
        os.getenv("GEMINI_API_KEY"),
        os.getenv("GEMINI_API_KEY_2")
    ]

    api_keys = [key for key in api_keys if key]

    if not api_keys:
        raise HTTPException(
            status_code=500,
            detail="No Gemini API keys configured"
        )

    last_error = None

    for api_key in api_keys:
        try:
            response = await acompletion(
                model="gemini/gemini-3.5-flash-lite",
                messages=messages,
                api_key=api_key
            )

            answer = response.choices[0].message.content

            if not answer:
                raise ValueError("Empty AI response")

            assistant_message = models.ChatMessage(
                session_id=chat_id,
                role="assistant",
                content=answer
            )

            db.add(assistant_message)
            db.commit()
            db.refresh(assistant_message)

            return {
                "id": assistant_message.id,
                "role": "assistant",
                "content": answer
            }

        except Exception as error:
            db.rollback()
            last_error = error

    raise HTTPException(
        status_code=502,
        detail=f"Gemini request failed: {str(last_error)}"
    )


@app.delete("/chats/{chat_id}")
def delete_chat(chat_id: int, db: Session = Depends(get_db)):
    chat = db.query(models.ChatSession).filter(
        models.ChatSession.id == chat_id
    ).first()

    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    db.delete(chat)
    db.commit()

    return {
        "message": "Chat deleted successfully"
    }
