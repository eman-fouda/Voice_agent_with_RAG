this an AI voice agent with RAG, built using these technologies:

## Core Technologies:
- **LiveKit** - Real-time communication platform
- **LiveKit SDK** (Python & JavaScript) - Client libraries for LiveKit
- **FastAPI** - Python web framework for the token server
- **Google Gemini Live API** (Realtime Model) - Voice AI model
- **FAISS** - Vector database for similarity search
- **React** - Frontend UI framework
- **Vite** - Frontend build tool and dev server

if you want to test it, download the project, open it using any python support editor (i was using vscode),
create a virtual enviroment (better isolation)
download the requirments.txt file in your terminal
download nodejs to be able run the frontend
after you satisfye all requirements for all imports then
open three treminals go to the voice_agent folder then paste this command uvicorn token_server:app --reload --port 8000 to start server
in the second terminal go to the voice_agent folder then type python agent.py start (if you are using venv)
in the third terminal go to the frontend folder then type npm run dev and click on the local host that will appear 
