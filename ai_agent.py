import os
from dotenv import load_dotenv

load_dotenv()

# API Keys
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# LLM
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI

# Search Tool
from langchain_tavily import TavilySearch

# Agent & Messages
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import AIMessageChunk

# Memory
from langgraph.checkpoint.memory import MemorySaver

# FastAPI StreamingResponse
from fastapi.responses import StreamingResponse

# Initialize memory globally so it persists across requests
memory = MemorySaver()


def stream_response_from_ai_agent(
    llm_id: str,
    query,
    allow_search: bool,
    system_prompt: str,
    provider: str,
    session_id: str = "user_123"
):
    if provider == "Groq":
        llm = ChatGroq(model=llm_id)
    elif provider == "OpenAI":
        llm = ChatOpenAI(model=llm_id)
    else:
        raise ValueError(f"Unknown provider: {provider}")

    tools = [TavilySearch(max_results=2)] if allow_search else []

    # `prompt` is the correct kwarg in langgraph >=1.0 (replaces old `state_modifier`)
    agent = create_react_agent(
        model=llm,
        tools=tools,
        prompt=system_prompt,
        checkpointer=memory
    )

    state = {"messages": query}
    config = {"configurable": {"thread_id": session_id}}

    def generate():
        for msg, metadata in agent.stream(state, config=config, stream_mode="messages"):
            if isinstance(msg, AIMessageChunk) and msg.content:
                yield msg.content

    return StreamingResponse(generate(), media_type="text/event-stream")