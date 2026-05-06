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
# 1. IMPORT AIMessageChunk for live tokens
from langchain_core.messages import AIMessageChunk 

# Memory
from langgraph.checkpoint.memory import MemorySaver

# 2. IMPORT FastAPI StreamingResponse
from fastapi.responses import StreamingResponse

# Initialize memory globally so it persists
memory = MemorySaver()

def stream_response_from_ai_agent(llm_id, query, allow_search, system_prompt, provider, session_id="user_123"):
    if provider == "Groq":
        # Streaming is natively supported by ChatGroq and ChatOpenAI
        llm = ChatGroq(model=llm_id)
    elif provider == "OpenAI":
        llm = ChatOpenAI(model=llm_id)
    else:
        raise ValueError(f"Unknown provider: {provider}")

    tools = [TavilySearch(max_results=2)] if allow_search else []
    
    agent = create_react_agent(
        model=llm,
        tools=tools,
        prompt=system_prompt,
        checkpointer=memory
    )
    
    state = {"messages": query}
    config = {"configurable": {"thread_id": session_id}}
    
    # 3. CREATE A GENERATOR FUNCTION
    def generate():
        # stream_mode="messages" gives us the tokens live as they are generated
        for msg, metadata in agent.stream(state, config=config, stream_mode="messages"):
            
            # 4. YIELD ONLY AI TEXT CHUNKS
            # We ignore tool calls and system messages, we only want the AI's typed text
            if isinstance(msg, AIMessageChunk) and msg.content:
                yield msg.content

    # 5. RETURN A STREAMING RESPONSE
    return StreamingResponse(generate(), media_type="text/event-stream")