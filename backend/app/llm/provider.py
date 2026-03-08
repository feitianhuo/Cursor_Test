from typing import AsyncGenerator

from openai import AsyncOpenAI

from app.config import load_config

MAX_HISTORY_ROUNDS = 10


def get_llm_client(model: str) -> AsyncOpenAI:
    config = load_config()
    model_lower = (model or "qwen").lower()

    if model_lower in ("qwen", "qwen-turbo", "qwen-plus", "qwen-max"):
        return AsyncOpenAI(
            api_key=config["qwen_api_key"],
            base_url=config["qwen_base_url"],
        )
    if model_lower in ("openai", "gpt-4", "gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"):
        return AsyncOpenAI(
            api_key=config["openai_api_key"],
            base_url=config["openai_base_url"],
        )

    return AsyncOpenAI(
        api_key=config["qwen_api_key"],
        base_url=config["qwen_base_url"],
    )


def get_model_name(model: str) -> str:
    config = load_config()
    model_lower = (model or "qwen").lower()

    if model_lower in ("qwen", "qwen-turbo", "qwen-plus", "qwen-max"):
        if model_lower == "qwen":
            return config["qwen_model"]
        return model_lower
    if model_lower in ("openai", "gpt-4", "gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"):
        if model_lower == "openai":
            return config["openai_model"]
        return model_lower

    return config["qwen_model"]


def build_messages(
    messages: list[dict],
    system_prompt: str | None = None,
    max_rounds: int = MAX_HISTORY_ROUNDS,
) -> list[dict]:
    result: list[dict] = []
    if system_prompt:
        result.append({"role": "system", "content": system_prompt})

    rounds = 0
    start_idx = 0
    for i in range(len(messages) - 1, -1, -1):
        role = messages[i].get("role", "")
        if role == "user":
            rounds += 1
            if rounds > max_rounds:
                start_idx = i + 1
                break

    for m in messages[start_idx:]:
        result.append({"role": m["role"], "content": m.get("content", "")})

    return result


async def stream_chat(
    model: str,
    messages: list[dict],
    system_prompt: str | None = "You are a helpful assistant.",
) -> AsyncGenerator[str, None]:
    client = get_llm_client(model)
    model_name = get_model_name(model)
    msgs = build_messages(messages, system_prompt)

    stream = await client.chat.completions.create(
        model=model_name,
        messages=msgs,
        stream=True,
    )

    async for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content
