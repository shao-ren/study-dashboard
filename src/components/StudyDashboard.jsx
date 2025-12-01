import React, { useState, useEffect } from 'react';
import '../styles/StudyDashboard.css';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Cloud,
  Zap,
  Eye,
  Heart,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

const StudyDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [sensorData, setSensorData] = useState({
    lightLevel: 380,
    presenceDetected: true,
    emotionState: 'positive',
    stressLevel: 35,
  });

  const [stressHistory, setStressHistory] = useState([
    { time: '9:00', stress: 25, anxiety: 10, calm: 65 },
    { time: '9:30', stress: 32, anxiety: 15, calm: 53 },
    { time: '10:00', stress: 35, anxiety: 20, calm: 45 },
    { time: '10:30', stress: 38, anxiety: 22, calm: 40 },
    { time: '11:00', stress: 42, anxiety: 25, calm: 33 },
    { time: '11:30', stress: 35, anxiety: 18, calm: 47 },
    { time: '12:00', stress: 28, anxiety: 12, calm: 60 },
  ]);

  const [studyTrends, setStudyTrends] = useState([
    { day: 'Mon', studyHours: 4.5, focusScore: 78, breaks: 3 },
    { day: 'Tue', studyHours: 5.2, focusScore: 82, breaks: 4 },
    { day: 'Wed', studyHours: 3.8, focusScore: 75, breaks: 3 },
    { day: 'Thu', studyHours: 6.1, focusScore: 88, breaks: 5 },
    { day: 'Fri', studyHours: 4.2, focusScore: 76, breaks: 3 },
    { day: 'Sat', studyHours: 5.8, focusScore: 85, breaks: 4 },
    { day: 'Sun', studyHours: 3.5, focusScore: 72, breaks: 2 },
  ]);

  const [productivityData, setProductivityData] = useState([
    { time: '6am', productivity: 20 },
    { time: '8am', productivity: 60 },
    { time: '10am', productivity: 85 },
    { time: '12pm', productivity: 70 },
    { time: '2pm', productivity: 65 },
    { time: '4pm', productivity: 75 },
    { time: '6pm', productivity: 55 },
    { time: '8pm', productivity: 45 },
    { time: '10pm', productivity: 35 },
  ]);

  const [insights, setInsights] = useState([
    {
      id: 1,
      type: 'success',
      title: 'Optimal Study Time Identified',
      description: 'You are most productive between 10am-12pm. Schedule challenging tasks during this window.',
      icon: 'check',
    },
    {
      id: 2,
      type: 'warning',
      title: 'Stress Peak Detected',
      description: 'Your stress levels spike around 11am. Consider taking a 5-minute break.',
      icon: 'alert',
    },
    {
      id: 3,
      type: 'info',
      title: 'Lighting Adjustment Recommended',
      description: 'Current light level (380 lux) is optimal for focus. Maintain this environment.',
      icon: 'check',
    },
    {
      id: 4,
      type: 'success',
      title: 'Excellent Presence Consistency',
      description: 'You maintained 92% presence this session. Great focus and engagement!',
      icon: 'check',
    },
  ]);

  // Simulate real-time sensor updates
  useEffect(() => {
    const interval = setInterval(() => {
      setSensorData((prev) => ({
        lightLevel: Math.max(200, Math.min(600, prev.lightLevel + (Math.random() - 0.5) * 20)),
        presenceDetected: Math.random() > 0.1,
        emotionState: ['positive', 'neutral', 'stressed'][Math.floor(Math.random() * 3)],
        stressLevel: Math.max(0, Math.min(100, prev.stressLevel + (Math.random() - 0.5) * 10)),
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getEmotionColor = (emotion) => {
    switch (emotion) {
      case 'positive':
        return '#4ade80';
      case 'neutral':
        return '#fbbf24';
      case 'stressed':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getStressColor = (level) => {
    if (level < 30) return '#4ade80';
    if (level < 60) return '#fbbf24';
    return '#ef4444';
  };

  const getLightQuality = (level) => {
    if (level < 300) return { status: 'Too Dark', color: '#6b7280' };
    if (level < 500) return { status: 'Optimal', color: '#4ade80' };
    return { status: 'Too Bright', color: '#fbbf24' };
  };

  const lightQuality = getLightQuality(sensorData.lightLevel);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>📚 Study Environment Dashboard</h1>
          <p>Real-time IoT sensor monitoring & productivity insights</p>
        </div>
        <div className="header-stats">
          <div className="stat-badge">
            <span className="stat-label">Session Time</span>
            <span className="stat-value">2h 35m</span>
          </div>
          <div className="stat-badge">
            <span className="stat-label">Focus Score</span>
            <span className="stat-value">82%</span>
          </div>
        </div>
      </header>

      <nav className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-button ${activeTab === 'sensors' ? 'active' : ''}`}
          onClick={() => setActiveTab('sensors')}
        >
          Live Sensors
        </button>
        <button
          className={`tab-button ${activeTab === 'trends' ? 'active' : ''}`}
          onClick={() => setActiveTab('trends')}
        >
          Weekly Trends
        </button>
        <button
          className={`tab-button ${activeTab === 'stress' ? 'active' : ''}`}
          onClick={() => setActiveTab('stress')}
        >
          Stress Analysis
        </button>
      </nav>

      <div className="dashboard-content">
        {activeTab === 'overview' && (
          <div className="tab-content overview-tab">
            {/* KPI Cards */}
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-header">
                  <Cloud size={24} className="kpi-icon" />
                  <span className="kpi-title">Light Level</span>
                </div>
                <div className="kpi-value">{Math.round(sensorData.lightLevel)} lux</div>
                <div className="kpi-status" style={{ color: lightQuality.color }}>
                  {lightQuality.status}
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-header">
                  <Zap size={24} className="kpi-icon" />
                  <span className="kpi-title">Presence</span>
                </div>
                <div className="kpi-value">{sensorData.presenceDetected ? 'Detected' : 'Away'}</div>
                <div className="kpi-status" style={{ color: sensorData.presenceDetected ? '#4ade80' : '#ef4444' }}>
                  {sensorData.presenceDetected ? 'Active' : 'Inactive'}
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-header">
                  <Eye size={24} className="kpi-icon" />
                  <span className="kpi-title">Emotion</span>
                </div>
                <div className="kpi-value">{sensorData.emotionState.charAt(0).toUpperCase() + sensorData.emotionState.slice(1)}</div>
                <div className="kpi-status" style={{ color: getEmotionColor(sensorData.emotionState) }}>
                  ● Detected
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-header">
                  <Heart size={24} className="kpi-icon" />
                  <span className="kpi-title">Stress Level</span>
                </div>
                <div className="kpi-value">{Math.round(sensorData.stressLevel)}%</div>
                <div className="kpi-status" style={{ color: getStressColor(sensorData.stressLevel) }}>
                  {sensorData.stressLevel < 30 ? 'Low' : sensorData.stressLevel < 60 ? 'Moderate' : 'High'}
                </div>
              </div>
            </div>

            {/* Productivity Heatmap */}
            <div className="chart-container">
              <h2 className="chart-title">⏰ Productivity by Time of Day</h2>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={productivityData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorProductivity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="productivity"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorProductivity)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Smart Insights */}
            <div className="insights-section">
              <h2 className="section-title">💡 Smart Insights</h2>
              <div className="insights-grid">
                {insights.map((insight) => (
                  <div key={insight.id} className={`insight-card ${insight.type}`}>
                    <div className="insight-icon">
                      {insight.icon === 'check' ? (
                        <CheckCircle size={20} />
                      ) : (
                        <AlertCircle size={20} />
                      )}
                    </div>
                    <div className="insight-content">
                      <h3>{insight.title}</h3>
                      <p>{insight.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sensors' && (
          <div className="tab-content sensors-tab">
            <div className="sensor-grid">
              {/* Light Sensor */}
              <div className="sensor-card detailed">
                <div className="sensor-header">
                  <Cloud size={32} className="sensor-icon" />
                  <h3>Light Level Sensor</h3>
                </div>
                <div className="sensor-reading">
                  <div className="reading-value">{Math.round(sensorData.lightLevel)}</div>
                  <div className="reading-unit">lux</div>
                </div>
                <div className="sensor-details">
                  <p><strong>Status:</strong> <span style={{ color: lightQuality.color }}>{lightQuality.status}</span></p>
                  <p><strong>Optimal Range:</strong> 300-500 lux</p>
                  <p><strong>Recommendation:</strong> {sensorData.lightLevel < 300 ? 'Increase brightness' : sensorData.lightLevel > 500 ? 'Reduce brightness' : 'Perfect lighting condition'}</p>
                </div>
                <div className="sensor-chart">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.min(100, (sensorData.lightLevel / 600) * 100)}%`,
                        backgroundColor: lightQuality.color,
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Presence Sensor */}
              <div className="sensor-card detailed">
                <div className="sensor-header">
                  <Zap size={32} className="sensor-icon" />
                  <h3>Ultrasonic Presence Sensor</h3>
                </div>
                <div className="sensor-reading">
                  <div className="reading-value">{sensorData.presenceDetected ? '✓' : '✗'}</div>
                  <div className="reading-unit">{sensorData.presenceDetected ? 'Present' : 'Absent'}</div>
                </div>
                <div className="sensor-details">
                  <p><strong>Detection Range:</strong> 0-2 meters</p>
                  <p><strong>Status:</strong> <span style={{ color: sensorData.presenceDetected ? '#4ade80' : '#ef4444' }}>
                    {sensorData.presenceDetected ? 'Active & Tracking' : 'Not Detected'}
                  </span></p>
                  <p><strong>Session Activity:</strong> 92% presence this session</p>
                </div>
                <div className="sensor-chart">
                  <div className="presence-indicator" style={{
                    backgroundColor: sensorData.presenceDetected ? '#4ade80' : '#ef4444',
                  }}></div>
                </div>
              </div>

              {/* Emotion/Stress Camera */}
              <div className="sensor-card detailed">
                <div className="sensor-header">
                  <Eye size={32} className="sensor-icon" />
                  <h3>Facial Recognition Camera</h3>
                </div>
                <div className="sensor-reading">
                  <div className="reading-value">{sensorData.emotionState.slice(0, 3).toUpperCase()}</div>
                  <div className="reading-unit">Emotion State</div>
                </div>
                <div className="sensor-details">
                  <p><strong>Current Emotion:</strong> <span style={{ color: getEmotionColor(sensorData.emotionState) }}>
                    {sensorData.emotionState.charAt(0).toUpperCase() + sensorData.emotionState.slice(1)}
                  </span></p>
                  <p><strong>Stress Level:</strong> {Math.round(sensorData.stressLevel)}%</p>
                  <p><strong>Privacy:</strong> On-device processing, no data stored</p>
                </div>
                <div className="sensor-chart">
                  <div className="emotion-bar" style={{
                    backgroundColor: getEmotionColor(sensorData.emotionState),
                    width: '100%',
                    height: '30px',
                    borderRadius: '6px',
                  }}></div>
                </div>
              </div>

              {/* Stress Level Details */}
              <div className="sensor-card detailed">
                <div className="sensor-header">
                  <Heart size={32} className="sensor-icon" />
                  <h3>Stress Level Monitor</h3>
                </div>
                <div className="sensor-reading">
                  <div className="reading-value" style={{ color: getStressColor(sensorData.stressLevel) }}>
                    {Math.round(sensorData.stressLevel)}%
                  </div>
                  <div className="reading-unit">Current Stress</div>
                </div>
                <div className="sensor-details">
                  <p><strong>Level:</strong> <span style={{ color: getStressColor(sensorData.stressLevel) }}>
                    {sensorData.stressLevel < 30 ? 'Low' : sensorData.stressLevel < 60 ? 'Moderate' : 'High'}
                  </span></p>
                  <p><strong>Trend:</strong> Stable</p>
                  <p><strong>Recommendation:</strong> {sensorData.stressLevel > 60 ? 'Take a break' : 'Keep up the good work'}</p>
                </div>
                <div className="sensor-chart">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${sensorData.stressLevel}%`,
                        backgroundColor: getStressColor(sensorData.stressLevel),
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trends' && (
          <div className="tab-content trends-tab">
            <div className="chart-container">
              <h2 className="chart-title">📊 Weekly Study Patterns</h2>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={studyTrends} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="studyHours" fill="#3b82f6" name="Study Hours" />
                  <Bar dataKey="focusScore" fill="#10b981" name="Focus Score" />
                  <Bar dataKey="breaks" fill="#f59e0b" name="Breaks Taken" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <TrendingUp size={24} className="stat-card-icon" />
                <h3>Weekly Average</h3>
                <p className="stat-card-value">4.8 hours</p>
                <p className="stat-card-label">Study time per day</p>
              </div>
              <div className="stat-card">
                <TrendingUp size={24} className="stat-card-icon" />
                <h3>Best Day</h3>
                <p className="stat-card-value">Thursday</p>
                <p className="stat-card-label">6.1 hours, 88% focus</p>
              </div>
              <div className="stat-card">
                <TrendingUp size={24} className="stat-card-icon" />
                <h3>Focus Trend</h3>
                <p className="stat-card-value">↑ 5%</p>
                <p className="stat-card-label">Improvement this week</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stress' && (
          <div className="tab-content stress-tab">
            <div className="chart-container">
              <h2 className="chart-title">📈 Stress Level Tracking Throughout Session</h2>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={stressHistory} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorStress" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorAnxiety" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCalm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="stress"
                    stroke="#ef4444"
                    fillOpacity={0.7}
                    fill="url(#colorStress)"
                    name="Stress"
                  />
                  <Area
                    type="monotone"
                    dataKey="anxiety"
                    stroke="#f59e0b"
                    fillOpacity={0.7}
                    fill="url(#colorAnxiety)"
                    name="Anxiety"
                  />
                  <Area
                    type="monotone"
                    dataKey="calm"
                    stroke="#10b981"
                    fillOpacity={0.7}
                    fill="url(#colorCalm)"
                    name="Calm"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="stress-summary">
              <h2 className="section-title">Session Stress Summary</h2>
              <div className="summary-grid">
                <div className="summary-card stress">
                  <h3>Peak Stress</h3>
                  <p className="summary-value">42%</p>
                  <p className="summary-time">at 11:00 AM</p>
                </div>
                <div className="summary-card anxiety">
                  <h3>Average Anxiety</h3>
                  <p className="summary-value">18%</p>
                  <p className="summary-time">Moderate levels</p>
                </div>
                <div className="summary-card calm">
                  <h3>Calm Periods</h3>
                  <p className="summary-value">47%</p>
                  <p className="summary-time">Most of session</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudyDashboard;
