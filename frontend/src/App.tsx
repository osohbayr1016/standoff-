import { useEffect, useState } from 'react';
import './App.css';

function App() {
  const [queueCount, setQueueCount] = useState(0);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [status, setStatus] = useState("Idle");

  useEffect(() => {
    // Backend WebSocket руу холбогдох
    // Note: Use wss:// for secure production connection
    const ws = new WebSocket('wss://backend.anandoctane4.workers.dev/ws');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'QUEUE_UPDATE') setQueueCount(data.count);
      if (data.type === 'MATCH_READY') {
        setStatus("MATCH FOUND! Preparing room...");
        alert("Тоглолт олдлоо! Discord-оо шалгана уу.");
      }
    };

    ws.onopen = () => {
      console.log("Connected to Matchmaking Server");
      setStatus("Connected");
    };

    setSocket(ws);
    return () => ws.close();
  }, []);

  const joinQueue = () => {
    // Generate a random ID for testing if not provided
    const userId = 'user_' + Math.floor(Math.random() * 10000);
    socket?.send(JSON.stringify({ type: 'JOIN_QUEUE', userId: userId }));
    setStatus("In Queue...");
  };

  return (
    <>
      <h1>Standoff 2 Platform</h1>
      <div style={{ padding: '20px', border: '2px solid #5865F2', borderRadius: '10px', maxWidth: '400px', margin: '0 auto' }}>
        <h3>Live Matchmaking</h3>
        <p>Одоо дараалалд: <strong>{queueCount} / 10</strong></p>
        <p>Статус: {status}</p>
        <button onClick={joinQueue} disabled={status === "In Queue..." || status === "MATCH FOUND! Preparing room..."}>
          Дараалалд орох
        </button>
      </div>
    </>
  );
}

export default App;
