import React, { useEffect, useState } from 'react';

function PresenceHistoryDashboard() {
  const [sessions, setSessions] = useState([]);

  const fetchHistory = async () => {
    try {
      // Replace with your actual Flask URL
      const response = await fetch('http://localhost:5000/api/presence_history?hours=24');
      const data = await response.json();
      setSessions(data.sessions);
    } catch (error) {
      console.error("Failed to fetch history:", error);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h2>Activity Sessions (Last 24 Hours)</h2>
      
      {sessions.length === 0 ? (
        <p>No activity detected.</p>
      ) : (
        <table border="1" cellPadding="10">
          <thead>
            <tr>
              <th>Start Time</th>
              <th>End Time</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session, index) => (
              <tr key={index}>
                {/* Convert Unix Timestamp to Readable String */}
                <td>{new Date(session.start*1000).toLocaleString()}</td>
                <td>{new Date(session.end*1000).toLocaleString()}</td>
                <td>{session.duration_minutes} mins</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default PresenceHistoryDashboard;