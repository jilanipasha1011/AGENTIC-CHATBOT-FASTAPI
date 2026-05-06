import streamlit as st
import requests
import uuid

# --- 1. INITIALIZE SESSION ID FOR MEMORY ---
# This ensures each user gets a unique memory thread that persists 
# as long as they keep the tab open.
if "session_id" not in st.session_state:
    st.session_state.session_id = str(uuid.uuid4())

# Step 1: UI Setup
st.set_page_config(page_title="LangGraph Agent UI", layout="centered")
st.title("AI Chatbot Agents 🤖")
st.write(f"Create and Interact with the AI Agents! *(Session: {st.session_state.session_id[:8]})*")

system_prompt = st.text_area(
    "Define your AI Agent:",
    height=70,
    placeholder="Type your system prompt here..."
)

MODEL_NAMES_GROQ = ["llama-3.3-70b-versatile", "mixtral-8x7b-32768"]
MODEL_NAMES_OPENAI = ["gpt-4o-mini"]

provider = st.radio("Select Provider:", ("Groq", "OpenAI"))

if provider == "Groq":
    selected_model = st.selectbox("Select Groq Model:", MODEL_NAMES_GROQ)
elif provider == "OpenAI":
    selected_model = st.selectbox("Select OpenAI Model:", MODEL_NAMES_OPENAI)

allow_web_search = st.checkbox("Allow Web Search")

user_query = st.text_area(
    "Enter your query:",
    height=150,
    placeholder="Ask Anything!"
)

API_URL = "http://127.0.0.1:9999/chat"

# Step 2: Send request to backend
if st.button("Ask Agent!"):
    if user_query.strip():
        
        # --- 2. ADD SESSION ID TO PAYLOAD ---
        payload = {
            "model_name": selected_model,
            "model_provider": provider,
            "system_prompt": system_prompt,
            "messages": [user_query],
            "allow_search": allow_web_search,
            "session_id": st.session_state.session_id  # Passed to backend memory
        }

        try:
            # --- 3. ENABLE STREAMING ---
            # stream=True tells requests not to wait for the whole response
            with requests.post(API_URL, json=payload, stream=True) as response:
                
                if response.status_code == 200:
                    st.subheader("Agent Response")
                    
                    # --- 4. CREATE A GENERATOR FOR THE STREAM ---
                    def stream_generator():
                        # Read chunks live as they come from FastAPI
                        for chunk in response.iter_content(chunk_size=None, decode_unicode=True):
                            if chunk:
                                yield chunk
                    
                    # st.write_stream automatically handles the typewriter effect!
                    st.write_stream(stream_generator())
                    
                elif response.status_code == 422:
                    st.error(f"Validation Error: Did you forget a field? Details: {response.text}")
                else:
                    st.error(f"Backend error: {response.status_code} - {response.text}")
                    
        except requests.exceptions.ConnectionError:
            st.error("Cannot connect to backend. Make sure your FastAPI backend is running on port 9999.")
    else:
        st.warning("Please enter a query before clicking Ask Agent!")