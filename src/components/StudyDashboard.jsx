import React, { useState, useEffect, useCallback } from 'react';
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
  Wifi,
  WifiOff,
} from 'lucide-react';

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  API_BASE_URL: 'http://localhost:5000/api',
  DEVICE_ID: 'ESP32-lamp',
  WEBSOCKET_PRESENCE: 'wss://72mbqicisa.execute-api.ap-southeast-1.amazonaws.com/production/',
  WEBSOCKET_AMBIENT: 'wss://7ii4srym84.execute-api.ap-southeast-1.amazonaws.com/production/',
  REFRESH_INTERVAL: 30000, // 30 seconds for API data refresh
};

// ============================================
// API SERVICE
// ============================================
const apiService = {
  async fetchDashboardStats() {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/dashboard_stats?deviceId=${CONFIG.DEVICE_ID}`);
      if (!response.ok) throw new Error('Failed to fetch dashboard stats');
      return await response.json();
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return null;
    }
  },

  async fetchLatestSensorData() {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/sensors/latest?deviceId=${CONFIG.DEVICE_ID}`);
      if (!response.ok) throw new Error('Failed to fetch sensor data');
      return await response.json();
    } catch (error) {
      console.error('Error fetching latest sensor data:', error);
      return null;
    }
  },

  async fetchStudyTrends(days = 7) {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/study_trends?deviceId=${CONFIG.DEVICE_ID}&days=${days}`);
      if (!response.ok) throw new Error('Failed to fetch study trends');
      return await response.json();
    } catch (error) {
      console.error('Error fetching study trends:', error);
      return null;
    }
  },

  async fetchProductivityData(days = 7) {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/productivity?deviceId=${CONFIG.DEVICE_ID}&days=${days}`);
      if (!response.ok) throw new Error('Failed to fetch productivity data');
      return await response.json();
    } catch (error) {
      console.error('Error fetching productivity data:', error);
      return null;
    }
  },

  async fetchStressHistory(hours = 4) {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/stress_history?deviceId=${CONFIG.DEVICE_ID}&hours=${hours}`);
      if (!response.ok) throw new Error('Failed to fetch stress history');
      return await response.json();
    } catch (error) {
      console.error('Error fetching stress history:', error);
      return null;
    }
  },

  async fetchInsights() {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/insights?deviceId=${CONFIG.DEVICE_ID}`);
      if (!response.ok) throw new Error('Failed to fetch insights');
      return await response.json();
    } catch (error) {
      console.error('Error fetching insights:', error);
      return null;
    }
  },

  async fetchPresenceHistory(hours = 24) {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/presence_history?deviceId=${CONFIG.DEVICE_ID}&hours=${hours}`);
      if (!response.ok) throw new Error('Failed to fetch presence history');
      return await response.json();
    } catch (error) {
      console.error('Error fetching presence history:', error);
      return null;
    }
  },
};

// ============================================
// HARDCODED DATA FOR WEEK & MONTH VIEWS
// ============================================

const HARDCODED_WEEK_TRENDS = [
  { day: 'Mon', date: '2025-01-20', studyHours: 4.5, focusScore: 78, breaks: 3, sessions: 4 },
  { day: 'Tue', date: '2025-01-21', studyHours: 5.2, focusScore: 82, breaks: 4, sessions: 5 },
  { day: 'Wed', date: '2025-01-22', studyHours: 3.8, focusScore: 75, breaks: 3, sessions: 3 },
  { day: 'Thu', date: '2025-01-23', studyHours: 6.1, focusScore: 88, breaks: 5, sessions: 6 },
  { day: 'Fri', date: '2025-01-24', studyHours: 4.2, focusScore: 76, breaks: 3, sessions: 4 },
  { day: 'Sat', date: '2025-01-25', studyHours: 5.8, focusScore: 85, breaks: 4, sessions: 5 },
  { day: 'Sun', date: '2025-01-26', studyHours: 3.5, focusScore: 72, breaks: 2, sessions: 3 },
];

const HARDCODED_WEEK_SUMMARY = {
  averageHoursPerDay: 4.7,
  totalHours: 33.1,
  bestDay: 'Thu',
  bestDayHours: 6.1,
  bestDayFocus: 88,
  focusTrend: 5,
};

const HARDCODED_MONTH_TRENDS = [
  { day: 'Week 1', date: '2025-01-01', studyHours: 28.5, focusScore: 74, breaks: 18, sessions: 22 },
  { day: 'Week 2', date: '2025-01-08', studyHours: 32.1, focusScore: 79, breaks: 21, sessions: 26 },
  { day: 'Week 3', date: '2025-01-15', studyHours: 35.8, focusScore: 82, breaks: 24, sessions: 29 },
  { day: 'Week 4', date: '2025-01-22', studyHours: 33.1, focusScore: 80, breaks: 22, sessions: 27 },
];

const HARDCODED_MONTH_SUMMARY = {
  averageHoursPerDay: 4.3,
  totalHours: 129.5,
  bestDay: 'Week 3',
  bestDayHours: 35.8,
  bestDayFocus: 82,
  focusTrend: 8,
};

const HARDCODED_WEEK_PRODUCTIVITY = [
  { time: '6am', productivity: 15 },
  { time: '8am', productivity: 55 },
  { time: '10am', productivity: 82 },
  { time: '12pm', productivity: 68 },
  { time: '2pm', productivity: 62 },
  { time: '4pm', productivity: 71 },
  { time: '6pm', productivity: 48 },
  { time: '8pm', productivity: 38 },
  { time: '10pm', productivity: 25 },
];

const HARDCODED_MONTH_PRODUCTIVITY = [
  { time: '6am', productivity: 12 },
  { time: '8am', productivity: 52 },
  { time: '10am', productivity: 78 },
  { time: '12pm', productivity: 65 },
  { time: '2pm', productivity: 58 },
  { time: '4pm', productivity: 68 },
  { time: '6pm', productivity: 45 },
  { time: '8pm', productivity: 35 },
  { time: '10pm', productivity: 22 },
];

const HARDCODED_WEEK_STRESS = [
  { time: '9:00', stress: 25, anxiety: 10, calm: 65 },
  { time: '9:30', stress: 32, anxiety: 15, calm: 53 },
  { time: '10:00', stress: 35, anxiety: 20, calm: 45 },
  { time: '10:30', stress: 38, anxiety: 22, calm: 40 },
  { time: '11:00', stress: 42, anxiety: 25, calm: 33 },
  { time: '11:30', stress: 35, anxiety: 18, calm: 47 },
  { time: '12:00', stress: 28, anxiety: 12, calm: 60 },
  { time: '12:30', stress: 30, anxiety: 14, calm: 56 },
  { time: '1:00', stress: 26, anxiety: 11, calm: 63 },
  { time: '1:30', stress: 33, anxiety: 16, calm: 51 },
  { time: '2:00', stress: 38, anxiety: 20, calm: 42 },
];

const HARDCODED_WEEK_STRESS_SUMMARY = {
  peakStress: 42,
  peakTime: '11:00 AM',
  averageAnxiety: 17,
  averageCalm: 50,
};

const HARDCODED_MONTH_STRESS = [
  { time: 'Week 1', stress: 38, anxiety: 20, calm: 42 },
  { time: 'Week 2', stress: 32, anxiety: 15, calm: 53 },
  { time: 'Week 3', stress: 28, anxiety: 12, calm: 60 },
  { time: 'Week 4', stress: 35, anxiety: 18, calm: 47 },
];

const HARDCODED_MONTH_STRESS_SUMMARY = {
  peakStress: 38,
  peakTime: 'Week 1',
  averageAnxiety: 16,
  averageCalm: 51,
};

const HARDCODED_WEEK_SESSIONS = [
  { start: 1737352800, end: 1737360000, duration_minutes: 120 },
  { start: 1737363600, end: 1737369000, duration_minutes: 90 },
  { start: 1737439200, end: 1737450000, duration_minutes: 180 },
  { start: 1737525600, end: 1737532800, duration_minutes: 120 },
  { start: 1737536400, end: 1737543600, duration_minutes: 120 },
  { start: 1737612000, end: 1737622800, duration_minutes: 180 },
  { start: 1737698400, end: 1737705600, duration_minutes: 120 },
  { start: 1737784800, end: 1737795600, duration_minutes: 180 },
  { start: 1737871200, end: 1737878400, duration_minutes: 120 },
];

const HARDCODED_MONTH_SESSIONS = [
  { start: 1735689600, end: 1735700400, duration_minutes: 180 },
  { start: 1735776000, end: 1735783200, duration_minutes: 120 },
  { start: 1735862400, end: 1735873200, duration_minutes: 180 },
  { start: 1735948800, end: 1735956000, duration_minutes: 120 },
  { start: 1736035200, end: 1736046000, duration_minutes: 180 },
  { start: 1736121600, end: 1736128800, duration_minutes: 120 },
  { start: 1736208000, end: 1736218800, duration_minutes: 180 },
  { start: 1736294400, end: 1736305200, duration_minutes: 180 },
  { start: 1736380800, end: 1736388000, duration_minutes: 120 },
  { start: 1736467200, end: 1736478000, duration_minutes: 180 },
  { start: 1736553600, end: 1736564400, duration_minutes: 180 },
  { start: 1736640000, end: 1736647200, duration_minutes: 120 },
  { start: 1736726400, end: 1736737200, duration_minutes: 180 },
  { start: 1736812800, end: 1736820000, duration_minutes: 120 },
  { start: 1736899200, end: 1736910000, duration_minutes: 180 },
  { start: 1736985600, end: 1736996400, duration_minutes: 180 },
  { start: 1737072000, end: 1737079200, duration_minutes: 120 },
  { start: 1737158400, end: 1737169200, duration_minutes: 180 },
  { start: 1737244800, end: 1737252000, duration_minutes: 120 },
  { start: 1737331200, end: 1737342000, duration_minutes: 180 },
];

// ============================================
// MAIN COMPONENT
// ============================================
const StudyDashboard = () => {
  // Tab state
  const [activeTab, setActiveTab] = useState('overview');
  
  // Time range state (day, week, month)
  const [timeRange, setTimeRange] = useState('day');

  // Connection status
  const [connectionStatus, setConnectionStatus] = useState({
    presence: false,
    ambient: false,
    api: false,
  });

  // Real-time sensor data (from WebSocket)
  const [sensorData, setSensorData] = useState({
    lightLevel: 0,
    presenceDetected: false,
    distanceCm: 0,
    emotionState: 'neutral',
    stressLevel: 30,
  });

  // Dashboard stats
  const [dashboardStats, setDashboardStats] = useState({
    sessionTime: '0h 0m',
    focusScore: 0,
  });

  // Historical data
  const [stressHistory, setStressHistory] = useState([]);
  const [stressSummary, setStressSummary] = useState({
    peakStress: 0,
    peakTime: 'N/A',
    averageAnxiety: 0,
    averageCalm: 100,
  });

  const [studyTrends, setStudyTrends] = useState([]);
  const [studyTrendsSummary, setStudyTrendsSummary] = useState({
    averageHoursPerDay: 0,
    bestDay: null,
    bestDayHours: 0,
    bestDayFocus: 0,
    focusTrend: 0,
  });

  const [productivityData, setProductivityData] = useState([]);
  const [insights, setInsights] = useState([]);
  const [sessions, setSessions] = useState([]);

  // Loading states
  const [loading, setLoading] = useState(true);

  // ============================================
  // WEBSOCKET CONNECTIONS
  // ============================================
  useEffect(() => {
    let presenceSocket = null;
    let ambientSocket = null;
    let reconnectTimeout = null;

    const connectPresenceSocket = () => {
      try {
        presenceSocket = new WebSocket(CONFIG.WEBSOCKET_PRESENCE);

        presenceSocket.onopen = () => {
          console.log('✅ Connected to Presence Sensor WebSocket');
          setConnectionStatus((prev) => ({ ...prev, presence: true }));
        };

        presenceSocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('Presence data received:', data);
            setSensorData((prev) => ({
              ...prev,
              presenceDetected: data.presence ?? prev.presenceDetected,
              distanceCm: data.distance ?? data.distanceCm ?? prev.distanceCm,
            }));
          } catch (err) {
            console.error('Error parsing presence data:', err);
          }
        };

        presenceSocket.onclose = () => {
          console.log('❌ Presence WebSocket closed, reconnecting...');
          setConnectionStatus((prev) => ({ ...prev, presence: false }));
          reconnectTimeout = setTimeout(connectPresenceSocket, 5000);
        };

        presenceSocket.onerror = (error) => {
          console.error('Presence WebSocket error:', error);
        };
      } catch (error) {
        console.error('Failed to connect to Presence WebSocket:', error);
      }
    };

    const connectAmbientSocket = () => {
      try {
        ambientSocket = new WebSocket(CONFIG.WEBSOCKET_AMBIENT);

        ambientSocket.onopen = () => {
          console.log('✅ Connected to Ambient Sensor WebSocket');
          setConnectionStatus((prev) => ({ ...prev, ambient: true }));
        };

        ambientSocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('Ambient data received:', data);
            setSensorData((prev) => ({
              ...prev,
              lightLevel: data.lighting ?? data.lightLevel ?? prev.lightLevel,
            }));
          } catch (err) {
            console.error('Error parsing ambient data:', err);
          }
        };

        ambientSocket.onclose = () => {
          console.log('❌ Ambient WebSocket closed, reconnecting...');
          setConnectionStatus((prev) => ({ ...prev, ambient: false }));
          reconnectTimeout = setTimeout(connectAmbientSocket, 5000);
        };

        ambientSocket.onerror = (error) => {
          console.error('Ambient WebSocket error:', error);
        };
      } catch (error) {
        console.error('Failed to connect to Ambient WebSocket:', error);
      }
    };

    // Connect to both WebSockets
    connectPresenceSocket();
    connectAmbientSocket();

    // Cleanup on unmount
    return () => {
      if (presenceSocket) presenceSocket.close();
      if (ambientSocket) ambientSocket.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // ============================================
  // DATA FETCHING
  // ============================================
  const fetchAllData = useCallback(async () => {
    setLoading(true);

    try {
      // Fetch all data in parallel
      const [
        statsData,
        latestSensorData,
        trendsData,
        productivityDataResult,
        stressData,
        insightsData,
        presenceData,
      ] = await Promise.all([
        apiService.fetchDashboardStats(),
        apiService.fetchLatestSensorData(),
        apiService.fetchStudyTrends(),
        apiService.fetchProductivityData(),
        apiService.fetchStressHistory(),
        apiService.fetchInsights(),
        apiService.fetchPresenceHistory(),
      ]);

      setConnectionStatus((prev) => ({ ...prev, api: true }));

      // Update dashboard stats
      if (statsData) {
        setDashboardStats({
          sessionTime: statsData.sessionTime || '0h 0m',
          focusScore: statsData.focusScore || 0,
        });
      }

      // Update sensor data from API (fallback if WebSocket not connected)
      if (latestSensorData) {
        setSensorData((prev) => ({
          ...prev,
          lightLevel: prev.lightLevel || latestSensorData.lightLevel || 0,
          presenceDetected: prev.presenceDetected || latestSensorData.presence || false,
          distanceCm: prev.distanceCm || latestSensorData.distanceCm || 0,
        }));
      }

      // Update study trends
      if (trendsData) {
        setStudyTrends(trendsData.trends || []);
        setStudyTrendsSummary(trendsData.summary || {});
      }

      // Update productivity data
      if (productivityDataResult && productivityDataResult.data) {
        setProductivityData(productivityDataResult.data);
      }

      // Update stress history
      if (stressData) {
        setStressHistory(stressData.history || []);
        setStressSummary(stressData.summary || {});
      }

      // Update insights
      if (insightsData && insightsData.insights) {
        setInsights(insightsData.insights);
      }

      // Update sessions
      if (presenceData && presenceData.sessions) {
        setSessions(presenceData.sessions);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setConnectionStatus((prev) => ({ ...prev, api: false }));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Periodic data refresh
  useEffect(() => {
    const interval = setInterval(fetchAllData, CONFIG.REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  // ============================================
  // HELPER FUNCTIONS
  // ============================================
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
    if (level < 100) return { status: 'Too Dark', color: '#6b7280' };
    if (level < 300) return { status: 'Low', color: '#fbbf24' };
    if (level < 500) return { status: 'Optimal', color: '#4ade80' };
    if (level < 1000) return { status: 'Bright', color: '#fbbf24' };
    return { status: 'Too Bright', color: '#ef4444' };
  };

  const lightQuality = getLightQuality(sensorData.lightLevel);

  // Calculate session activity percentage
  const calculateSessionActivity = () => {
    if (!sessions || sessions.length === 0) return 0;
    const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
    // Assume 8-hour work day = 480 minutes
    return Math.min(Math.round((totalMinutes / 480) * 100), 100);
  };

  // Get data based on selected time range
  const getTimeRangeData = () => {
    switch (timeRange) {
      case 'week':
        return {
          trends: HARDCODED_WEEK_TRENDS,
          summary: HARDCODED_WEEK_SUMMARY,
          productivity: HARDCODED_WEEK_PRODUCTIVITY,
          stress: HARDCODED_WEEK_STRESS,
          stressSummary: HARDCODED_WEEK_STRESS_SUMMARY,
          sessions: HARDCODED_WEEK_SESSIONS,
          label: 'This Week',
          dateRange: 'Jan 20 - Jan 26, 2025',
        };
      case 'month':
        return {
          trends: HARDCODED_MONTH_TRENDS,
          summary: HARDCODED_MONTH_SUMMARY,
          productivity: HARDCODED_MONTH_PRODUCTIVITY,
          stress: HARDCODED_MONTH_STRESS,
          stressSummary: HARDCODED_MONTH_STRESS_SUMMARY,
          sessions: HARDCODED_MONTH_SESSIONS,
          label: 'This Month',
          dateRange: 'January 2025',
        };
      case 'day':
      default:
        return {
          trends: studyTrends,
          summary: studyTrendsSummary,
          productivity: productivityData,
          stress: stressHistory,
          stressSummary: stressSummary,
          sessions: sessions,
          label: 'Today',
          dateRange: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        };
    }
  };

  const currentData = getTimeRangeData();

  // Time Range Selector Component
  const TimeRangeSelector = () => (
    <div className="time-range-selector">
      <button
        className={`range-btn ${timeRange === 'day' ? 'active' : ''}`}
        onClick={() => setTimeRange('day')}
      >
        Day
      </button>
      <button
        className={`range-btn ${timeRange === 'week' ? 'active' : ''}`}
        onClick={() => setTimeRange('week')}
      >
        Week
      </button>
      <button
        className={`range-btn ${timeRange === 'month' ? 'active' : ''}`}
        onClick={() => setTimeRange('month')}
      >
        Month
      </button>
    </div>
  );

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <h1>📚 Study Environment Dashboard</h1>
          <p>Real-time IoT sensor monitoring & productivity insights</p>
          <div className="connection-status">
            <span className={`status-dot ${connectionStatus.presence ? 'connected' : 'disconnected'}`}>
              {connectionStatus.presence ? <Wifi size={14} /> : <WifiOff size={14} />}
              Presence
            </span>
            <span className={`status-dot ${connectionStatus.ambient ? 'connected' : 'disconnected'}`}>
              {connectionStatus.ambient ? <Wifi size={14} /> : <WifiOff size={14} />}
              Ambient
            </span>
            <span className={`status-dot ${connectionStatus.api ? 'connected' : 'disconnected'}`}>
              {connectionStatus.api ? <Wifi size={14} /> : <WifiOff size={14} />}
              API
            </span>
          </div>
        </div>
        <div className="header-stats">
          <div className="stat-badge">
            <span className="stat-label">Session Time</span>
            <span className="stat-value">{dashboardStats.sessionTime}</span>
          </div>
          <div className="stat-badge">
            <span className="stat-label">Focus Score</span>
            <span className="stat-value">{dashboardStats.focusScore}%</span>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="tab-navigation">
        <div className="tab-buttons">
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
            Study Trends
          </button>
          <button
            className={`tab-button ${activeTab === 'stress' ? 'active' : ''}`}
            onClick={() => setActiveTab('stress')}
          >
            Stress Analysis
          </button>
          <button
            className={`tab-button ${activeTab === 'sessions' ? 'active' : ''}`}
            onClick={() => setActiveTab('sessions')}
          >
            Sessions
          </button>
        </div>
        <TimeRangeSelector />
      </nav>

      {/* Time Range Info Banner */}
      {timeRange !== 'day' && (
        <div className="time-range-banner">
          <Clock size={16} />
          <span>Viewing: <strong>{currentData.label}</strong> ({currentData.dateRange})</span>
        </div>
      )}

      {/* Dashboard Content */}
      <div className="dashboard-content">
        {loading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Loading dashboard data...</p>
          </div>
        )}

        {/* OVERVIEW TAB */}
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
              <h2 className="chart-title">⏰ Productivity by Time of Day {timeRange !== 'day' && `(${currentData.label})`}</h2>
              {(currentData.productivity && currentData.productivity.length > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={currentData.productivity} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
              ) : (
                <div className="no-data">No productivity data available yet. Start studying to see your patterns!</div>
              )}
            </div>

            {/* Smart Insights */}
            <div className="insights-section">
              <h2 className="section-title">💡 Smart Insights</h2>
              <div className="insights-grid">
                {insights.length > 0 ? (
                  insights.map((insight) => (
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
                  ))
                ) : (
                  <div className="no-data">Insights will appear as you accumulate study data.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SENSORS TAB */}
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
                  <p><strong>Distance:</strong> {Number(sensorData.distanceCm || 0).toFixed(1)} cm</p>
                  <p><strong>Detection Range:</strong> 0-50 cm (present)</p>
                  <p><strong>Status:</strong> <span style={{ color: sensorData.presenceDetected ? '#4ade80' : '#ef4444' }}>
                    {sensorData.presenceDetected ? 'Active & Tracking' : 'Not Detected'}
                  </span></p>
                  <p><strong>Session Activity:</strong> {calculateSessionActivity()}% presence this session</p>
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

        {/* TRENDS TAB */}
        {activeTab === 'trends' && (
          <div className="tab-content trends-tab">
            <div className="chart-container">
              <h2 className="chart-title">📊 {timeRange === 'month' ? 'Monthly' : timeRange === 'week' ? 'Weekly' : 'Daily'} Study Patterns {timeRange !== 'day' && `(${currentData.dateRange})`}</h2>
              {(currentData.trends && currentData.trends.length > 0) ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={currentData.trends} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
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
              ) : (
                <div className="no-data">No data available yet. Study trends will appear after you start using the system.</div>
              )}
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <TrendingUp size={24} className="stat-card-icon" />
                <h3>{timeRange === 'month' ? 'Monthly' : 'Weekly'} Average</h3>
                <p className="stat-card-value">{currentData.summary?.averageHoursPerDay || 0} hours</p>
                <p className="stat-card-label">Study time per {timeRange === 'month' ? 'day' : 'day'}</p>
              </div>
              <div className="stat-card">
                <TrendingUp size={24} className="stat-card-icon" />
                <h3>Best {timeRange === 'month' ? 'Week' : 'Day'}</h3>
                <p className="stat-card-value">{currentData.summary?.bestDay || 'N/A'}</p>
                <p className="stat-card-label">{currentData.summary?.bestDayHours || 0} hours, {currentData.summary?.bestDayFocus || 0}% focus</p>
              </div>
              <div className="stat-card">
                <TrendingUp size={24} className="stat-card-icon" />
                <h3>Focus Trend</h3>
                <p className="stat-card-value">
                  {(currentData.summary?.focusTrend || 0) > 0 ? '↑' : (currentData.summary?.focusTrend || 0) < 0 ? '↓' : '→'} {Math.abs(currentData.summary?.focusTrend || 0)}%
                </p>
                <p className="stat-card-label">{(currentData.summary?.focusTrend || 0) >= 0 ? 'Improvement' : 'Decline'} this {timeRange}</p>
              </div>
              {timeRange !== 'day' && (
                <div className="stat-card">
                  <Clock size={24} className="stat-card-icon" />
                  <h3>Total Hours</h3>
                  <p className="stat-card-value">{currentData.summary?.totalHours || 0}</p>
                  <p className="stat-card-label">This {timeRange}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STRESS TAB */}
        {activeTab === 'stress' && (
          <div className="tab-content stress-tab">
            <div className="chart-container">
              <h2 className="chart-title">📈 Stress Level Tracking {timeRange !== 'day' && `(${currentData.label})`}</h2>
              {(currentData.stress && currentData.stress.length > 0) ? (
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={currentData.stress} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
              ) : (
                <div className="no-data">No stress data available. Stress tracking will begin once sensor data is collected.</div>
              )}
            </div>

            <div className="stress-summary">
              <h2 className="section-title">{currentData.label} Stress Summary</h2>
              <div className="summary-grid">
                <div className="summary-card stress">
                  <h3>Peak Stress</h3>
                  <p className="summary-value">{currentData.stressSummary?.peakStress || 0}%</p>
                  <p className="summary-time">at {currentData.stressSummary?.peakTime || 'N/A'}</p>
                </div>
                <div className="summary-card anxiety">
                  <h3>Average Anxiety</h3>
                  <p className="summary-value">{currentData.stressSummary?.averageAnxiety || 0}%</p>
                  <p className="summary-time">{(currentData.stressSummary?.averageAnxiety || 0) < 30 ? 'Low levels' : 'Moderate levels'}</p>
                </div>
                <div className="summary-card calm">
                  <h3>Calm Periods</h3>
                  <p className="summary-value">{currentData.stressSummary?.averageCalm || 0}%</p>
                  <p className="summary-time">{(currentData.stressSummary?.averageCalm || 0) > 50 ? 'Most of ' + timeRange : 'Limited calm time'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SESSIONS TAB */}
        {activeTab === 'sessions' && (
          <div className="tab-content sessions-tab">
            <div className="chart-container">
              <h2 className="chart-title">📋 Activity Sessions ({currentData.label}) {timeRange !== 'day' && `- ${currentData.dateRange}`}</h2>
              {(currentData.sessions && currentData.sessions.length > 0) ? (
                <div className="sessions-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Start Time</th>
                        <th>End Time</th>
                        <th>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentData.sessions.map((session, index) => (
                        <tr key={index}>
                          <td>{new Date(session.start * 1000).toLocaleString()}</td>
                          <td>{new Date(session.end * 1000).toLocaleString()}</td>
                          <td>{Number(session.duration_minutes || 0).toFixed(1)} mins</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="no-data">No study sessions detected for {currentData.label.toLowerCase()}.</div>
              )}
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <Clock size={24} className="stat-card-icon" />
                <h3>Total Sessions</h3>
                <p className="stat-card-value">{currentData.sessions?.length || 0}</p>
                <p className="stat-card-label">{currentData.label}</p>
              </div>
              <div className="stat-card">
                <TrendingUp size={24} className="stat-card-icon" />
                <h3>Total Study Time</h3>
                <p className="stat-card-value">
                  {((currentData.sessions || []).reduce((sum, s) => sum + s.duration_minutes, 0) / 60).toFixed(1)} hours
                </p>
                <p className="stat-card-label">Cumulative</p>
              </div>
              <div className="stat-card">
                <Clock size={24} className="stat-card-icon" />
                <h3>Avg Session Length</h3>
                <p className="stat-card-value">
                  {(currentData.sessions?.length || 0) > 0
                    ? ((currentData.sessions || []).reduce((sum, s) => sum + s.duration_minutes, 0) / currentData.sessions.length).toFixed(1)
                    : 0} mins
                </p>
                <p className="stat-card-label">Per session</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudyDashboard;
