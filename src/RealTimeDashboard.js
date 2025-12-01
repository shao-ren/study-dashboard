import React, { useEffect, useState } from 'react';

function SensorDashboard() {
  const [presenceData, setPresenceData] = useState(null);
  const [ambientData, setAmbientData] = useState(null);

  useEffect(() => {
    const presenceSocket = new WebSocket('wss://72mbqicisa.execute-api.ap-southeast-1.amazonaws.com/production/');
    
    presenceSocket.onopen = () => {
      console.log('Connected to Live Presence Sensor Stream');
    };

    presenceSocket.onmessage = (event) => {
      console.log("Message received:", event.data);
      const data = JSON.parse(event.data);
      setPresenceData(data);
    };

    return () => presenceSocket.close();
  }, [])

  useEffect(() => {
    const ambientSocket = new WebSocket('wss://7ii4srym84.execute-api.ap-southeast-1.amazonaws.com/production/')
    
    ambientSocket.onopen = () => {
      console.log('Connected to Live Ambient Sensor Stream')
    }
    
    ambientSocket.onmessage = (event) => {
      console.log("Message received:", event.data);
      const data = JSON.parse(event.data);
      setAmbientData(data);
    };

    return () => ambientSocket.close();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h1>IoT Control Center</h1>
      <div style={{ display: 'flex', gap: '50px' }}>
        
        {/* Widget 1 */}
        <div style={{ border: '2px solid blue', padding: '20px', borderRadius: '10px' }}>
          <h2>Proximity Sensor</h2>
          {presenceData ? (
             <div>
               <p>Presence: <b>{presenceData.presence ? "Yes" : "No"}</b></p>
               <p>Distance: {presenceData.distance} cm</p>
             </div>
          ) : <p>Waiting for data...</p>}
        </div>

        {/* Widget 2 */}
        <div style={{ border: '2px solid red', padding: '20px', borderRadius: '10px' }}>
          <h2>Lighting Sensor</h2>
          {ambientData ? (
             <div>
               <p>Quality: <b>{ambientData.lighting > 100 ? "Good": "Poor"}</b></p>
               <p>Lighting: {ambientData.lighting} lux</p>
             </div>
          ) : <p>Waiting for data...</p>}
        </div>

      </div>
    </div>
  );
}

export default SensorDashboard;