from fastapi import FastAPI
from livekit import api
import os
import uuid
import jwt
import time
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

LIVEKIT_URL = os.getenv("LIVEKIT_URL")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")

# Debug: Print configuration on startup
print("=" * 50)
print("LiveKit Configuration:")
print(f"URL: {LIVEKIT_URL}")
print(f"API Key: {LIVEKIT_API_KEY[:10]}..." if LIVEKIT_API_KEY else "API Key: NOT SET")
print(f"API Secret: {LIVEKIT_API_SECRET[:10]}..." if LIVEKIT_API_SECRET else "API Secret: NOT SET")
print("=" * 50)

@app.get("/token")
def get_token():
    # Generate a unique identity
    identity = f"user-{uuid.uuid4()}"
    room_name = "jarvis-room"
    
    # Create token manually to ensure video grants are included
    now = int(time.time())
    exp = now + (6 * 60 * 60)  # 6 hours
    
    payload = {
        "sub": identity,
        "iss": LIVEKIT_API_KEY,
        "nbf": now,
        "exp": exp,
        "name": identity,
        "video": {
            "roomJoin": True,
            "room": room_name,
            "canPublish": True,
            "canSubscribe": True,
            "canPublishData": True,
        }
    }
    
    # Sign the token
    jwt_token = jwt.encode(payload, LIVEKIT_API_SECRET, algorithm="HS256")
    
    print(f"\n[TOKEN GENERATED]")
    print(f"Identity: {identity}")
    print(f"Room: {room_name}")
    print(f"Token (first 50 chars): {jwt_token[:50]}...")
    print(f"URL: {LIVEKIT_URL}")
    print(f"Video grants included: {payload['video']}\n")

    return {
        "token": jwt_token,
        "url": LIVEKIT_URL,
        "room": room_name
    }

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "livekit_url": LIVEKIT_URL,
        "api_key_set": bool(LIVEKIT_API_KEY),
        "api_secret_set": bool(LIVEKIT_API_SECRET)
    }