import logging
logging.getLogger("livekit").setLevel(logging.DEBUG)
from dotenv import load_dotenv
import livekit.agents as agents
from livekit.agents import AgentSession, Agent, RoomInputOptions, llm
from livekit.plugins import noise_cancellation, google
from prompts import AGENT_INSTRUCTION, SESSION_INSTRUCTION
from RAG import INDEX_PATH, retrieve_top_k, build_embeddings
from typing import Annotated
import os

load_dotenv()

# Debug: Print configuration
print("=" * 50)
print("Agent Configuration:")
print(f"LIVEKIT_URL: {os.getenv('LIVEKIT_URL')}")
print(f"LIVEKIT_API_KEY: {os.getenv('LIVEKIT_API_KEY')[:10]}..." if os.getenv('LIVEKIT_API_KEY') else "NOT SET")
print(f"LIVEKIT_API_SECRET: {os.getenv('LIVEKIT_API_SECRET')[:10]}..." if os.getenv('LIVEKIT_API_SECRET') else "NOT SET")
print("=" * 50)


@llm.function_tool
async def query_hr_policies(
    question: Annotated[str, "HR or policy question that needs factual context from the handbook"]
) -> str:
    """Query the HR policies knowledge base"""
    print(f"[TOOL] query_hr_policies called with: {question}")
    docs = retrieve_top_k(question, k=3)
    if not docs:
        return "NO_DOCUMENTS_FOUND"
    merged = "\n\n---\n\n".join(doc.page_content for doc in docs)
    print(f"[TOOL] Retrieved {len(docs)} documents")
    return merged


class Assistant(Agent):
    def __init__(self):
        super().__init__(
            instructions=AGENT_INSTRUCTION, 
            tools=[query_hr_policies]
        )

            
async def entrypoint(ctx: agents.JobContext):
    """Main entrypoint for the voice agent"""
    
    print(f"\n[AGENT] Job received for room: {ctx.room.name}")
    
    await ctx.connect()
    print(f"[AGENT] Connected to room: {ctx.room.name}")
    
    
    print("[AGENT] Waiting for participant to join...")
    participant = await ctx.wait_for_participant()
    print(f"[AGENT] Participant joined: {participant.identity}")
    
    
    session = AgentSession(
        llm=google.beta.realtime.RealtimeModel(
            voice="charon",
            temperature=0.0, 
        )
    )
    
   
    assistant = Assistant()
    
    # Start the session
    await session.start(
        room=ctx.room,
        agent=assistant,
        room_input_options=RoomInputOptions(
            noise_cancellation=noise_cancellation.BVC(),
        )
    )
    
    print("[AGENT] Session started successfully")
    
    
    try:
        intro_response = await session.generate_reply(
            instructions=SESSION_INSTRUCTION
        )
        print(f"[AGENT] Intro response generated")
    except Exception as e:
        print(f"[ERROR] Failed to generate intro: {e}")

    
if __name__ == "__main__":
    
    if not os.path.exists(INDEX_PATH):
        print("[DEBUG] Building FAISS index...")
        build_embeddings()
    else:
        print(f"[DEBUG] FAISS index already exists at {INDEX_PATH}")

    
    agents.cli.run_app(
        agents.WorkerOptions(
            entrypoint_fnc=entrypoint,
        )
    )