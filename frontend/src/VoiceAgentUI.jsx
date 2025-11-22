import React, { useState, useRef, useEffect } from "react";
import { Mic, Square } from "lucide-react";
import { Room, RoomEvent } from "livekit-client";

export default function VoiceAgentUI() {
  const [isListening, setIsListening] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [room, setRoom] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const isConnectingRef = useRef(false);
  const audioElementsRef = useRef([]);

  // Cleanup audio elements
  const cleanupAudioElements = () => {
    audioElementsRef.current.forEach(audio => {
      audio.pause();
      audio.srcObject = null;
    });
    audioElementsRef.current = [];
  };

  // Connect to LiveKit Room
  async function connectToRoom() {
    if (isConnectingRef.current) {
      console.log("Already connecting...");
      return null;
    }
    
    isConnectingRef.current = true;
    setError("");

    try {
      console.log("Fetching token from server...");
      const res = await fetch("http://localhost:8000/token");
      
      if (!res.ok) {
        throw new Error(`Failed to get token: ${res.status}`);
      }
      
      const { token, url, room: roomName } = await res.json();
      console.log("Token received, connecting to:", url, "Room:", roomName);

      const r = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      // Set up event listeners BEFORE connecting
      r.on(RoomEvent.Connected, () => {
        console.log("✓ Connected to room:", r.name);
        setIsConnected(true);
        setTranscript(prev => prev + "\n[System] Connected to Jarvis");
      });

      r.on(RoomEvent.Disconnected, () => {
        console.log("Disconnected from room");
        setIsConnected(false);
        setIsListening(false);
        cleanupAudioElements();
        setTranscript(prev => prev + "\n[System] Disconnected");
      });

      r.on(RoomEvent.Reconnecting, () => {
        console.log("Reconnecting...");
        setTranscript(prev => prev + "\n[System] Reconnecting...");
      });

      r.on(RoomEvent.Reconnected, () => {
        console.log("Reconnected!");
        setTranscript(prev => prev + "\n[System] Reconnected");
      });

      // Handle participant connected (agent joining)
      r.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log("Participant connected:", participant.identity);
        setTranscript(prev => prev + `\n[System] ${participant.identity} joined`);
      });

      // Handle audio track subscription
      r.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        console.log(`Track subscribed: ${track.kind} from ${participant.identity}`);
        
        if (track.kind === "audio") {
          const element = track.attach();
          element.autoplay = true;
          element.volume = 1.0;
          
          // Add to DOM and track for cleanup
          document.body.appendChild(element);
          audioElementsRef.current.push(element);
          
          element.play()
            .then(() => console.log("Audio playing from:", participant.identity))
            .catch(err => console.error("Audio play failed:", err));
        }
      });

      // Handle track unsubscribed
      r.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        console.log(`Track unsubscribed: ${track.kind} from ${participant.identity}`);
        track.detach().forEach(element => {
          element.remove();
          audioElementsRef.current = audioElementsRef.current.filter(e => e !== element);
        });
      });

      // Handle data received (for transcripts if sent)
      r.on(RoomEvent.DataReceived, (payload, participant) => {
        const text = new TextDecoder().decode(payload);
        console.log("Data received from", participant?.identity, ":", text);
        setTranscript(prev => prev + `\n${participant?.identity || 'Agent'}: ${text}`);
      });

      // Handle connection state changes
      r.on(RoomEvent.ConnectionStateChanged, (state) => {
        console.log("Connection state:", state);
      });

      // Connect to the room
      await r.connect(url, token);
      console.log("Room connection established to:", roomName || "jarvis-room");

      setRoom(r);
      isConnectingRef.current = false;
      return r;

    } catch (err) {
      console.error("Failed to connect to LiveKit room:", err);
      setError(`Connection failed: ${err.message}`);
      setTranscript(prev => prev + `\n[Error] ${err.message}`);
      isConnectingRef.current = false;
      return null;
    }
  }

  // Start microphone streaming
  async function startMic(roomInstance) {
    const activeRoom = roomInstance || room;
    
    if (!activeRoom) {
      console.log("Room not ready yet.");
      return false;
    }

    try {
      console.log("Requesting microphone access...");
      
      // Enable microphone (creates and publishes track automatically)
      await activeRoom.localParticipant.setMicrophoneEnabled(true);
      
      console.log("✓ Microphone started and published");
      setIsListening(true);
      setTranscript(prev => prev + "\n[System] Microphone enabled");
      return true;

    } catch (err) {
      console.error("Failed to start microphone:", err);
      setError(`Microphone error: ${err.message}`);
      setTranscript(prev => prev + `\n[Error] Failed to start mic: ${err.message}`);
      return false;
    }
  }

  // Stop microphone streaming
  async function stopMic() {
    if (!room) return;

    try {
      await room.localParticipant.setMicrophoneEnabled(false);
      console.log("✓ Microphone stopped");
      setIsListening(false);
      setTranscript(prev => prev + "\n[System] Microphone disabled");
    } catch (err) {
      console.error("Failed to stop microphone:", err);
    }
  }

  // Toggle listening
  const toggleListening = async () => {
    // If not connected yet, connect first
    if (!room) {
      setTranscript("[System] Connecting to Jarvis...");
      const r = await connectToRoom();
      
      if (r) {
        // Wait a bit for the connection to stabilize
        setTimeout(() => {
          startMic(r);
        }, 500);
      }
      return;
    }

    // Toggle mic on/off
    if (isListening) {
      await stopMic();
    } else {
      await startMic();
    }
  };

  // Disconnect from room
  const disconnect = async () => {
    if (room) {
      await room.disconnect();
      setRoom(null);
      setIsConnected(false);
      setIsListening(false);
      cleanupAudioElements();
      setTranscript(prev => prev + "\n[System] Manually disconnected");
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (room) {
        room.disconnect();
      }
      cleanupAudioElements();
    };
  }, [room]);

  return (
    <div className="min-h-screen bg-[#0A1733] flex flex-col items-center p-10 text-white font-sans">
      <h1 className="text-3xl font-bold mb-6">Jarvis Voice Assistant</h1>

      {/* Status Indicator */}
      <div className="mb-4 flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-500'} ${isConnected ? 'animate-pulse' : ''}`}></div>
        <span className="text-sm">
          {isConnected ? 'Connected' : 'Not connected'}
        </span>
      </div>

      {/* Error Display */}
      {error && (
        <div className="w-full max-w-2xl bg-red-900/50 border border-red-500 p-4 rounded-xl mb-4">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {/* Console UI */}
      <div className="w-full max-w-2xl bg-[#11224D] p-6 rounded-2xl shadow-lg text-left min-h-[250px]">
        <h2 className="text-xl mb-3">Console</h2>
        <div
          className="bg-[#0D1A3A] p-4 rounded-xl min-h-[150px] whitespace-pre-wrap border border-[#1E3A8A] overflow-y-auto font-mono text-sm"
          style={{ maxHeight: "300px" }}
        >
          {transcript || "Waiting for input..."}
        </div>
      </div>

      {/* Mic Button */}
      <button
        onClick={toggleListening}
        disabled={isConnectingRef.current}
        className={`mt-8 p-6 rounded-full shadow-xl transition-all ${
          isListening 
            ? 'bg-red-600 hover:bg-red-700' 
            : 'bg-[#1E3A8A] hover:bg-[#274BB5]'
        } ${isConnectingRef.current ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isListening ? (
          <Square size={42} className="text-white" />
        ) : (
          <Mic size={42} className="text-white" />
        )}
      </button>

      <p className="mt-4 opacity-70">
        {isConnectingRef.current 
          ? "Connecting..." 
          : isListening 
            ? "Listening... Click to stop" 
            : isConnected 
              ? "Click to start speaking"
              : "Click to connect and speak"}
      </p>

      {/* Disconnect Button */}
      {isConnected && (
        <button
          onClick={disconnect}
          className="mt-4 px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-all"
        >
          Disconnect
        </button>
      )}
    </div>
  );
}