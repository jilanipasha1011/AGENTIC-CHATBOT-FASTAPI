from pydantic import BaseModel
from typing import List
from fastapi import FastAPI
# 1. Update the import to match our new streaming function
from ai_agent import stream_response_from_ai_agent 

# Step 1: Pydantic schema
class RequestState(BaseModel):
    model_name: str
    model_provider: str
    system_prompt: str
    messages: List[str]
    allow_search: bool
    session_id: str  # <--- 2. NEW: Required to track user memory

ALLOWED_MODEL_NAMES = [
    "llama3-70b-8192",
    "mixtral-8x7b-32768",
    "llama-3.3-70b-versatile",
    "gpt-4o-mini"
]

app = FastAPI(title="LangGraph AI Agent")


# Step 2: Chat endpoint
@app.post("/chat")
def chat_endpoint(request: RequestState):
    """
    API Endpoint to interact with the Chatbot using LangGraph and search tools.
    Dynamically selects the model specified in the request.
    Now supports Chat Memory and Live Streaming!
    """
    if request.model_name not in ALLOWED_MODEL_NAMES:
        return {"error": "Invalid model name. Kindly select a valid AI model"}

    llm_id = request.model_name
    query = request.messages
    allow_search = request.allow_search
    system_prompt = request.system_prompt
    provider = request.model_provider
    session_id = request.session_id  # <--- Get the session ID

    # 3. Return the StreamingResponse directly
    return stream_response_from_ai_agent(
        llm_id=llm_id, 
        query=query, 
        allow_search=allow_search, 
        system_prompt=system_prompt, 
        provider=provider,
        session_id=session_id
    )


# Step 3: Run app
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=9999)