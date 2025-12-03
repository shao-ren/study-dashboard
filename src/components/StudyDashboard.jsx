import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../styles/StudyDashboard.css';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
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
  WEBSOCKET_PRESENCE: 'wss://72mbqicisa.execute-api.ap-southeast-1.amazonaws.com/production/',
  WEBSOCKET_AMBIENT: 'wss://7ii4srym84.execute-api.ap-southeast-1.amazonaws.com/production/',
  CAMERA_API: 'https://20lv30hxm5.execute-api.ap-southeast-1.amazonaws.com/production/detections',
  REFRESH_INTERVAL: 10000, // 30 seconds for API data refresh
};

const apiService = {
  // for main page (overview)
  async fetchDashboardStats() {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/dashboard_stats`);
      if (!response.ok) throw new Error('Failed to fetch dashboard stats');
      return await response.json();
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return null;
    }
  },

  async fetchProductivityData(days = 7) {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/productivity?days=${days}`);
      if (!response.ok) throw new Error('Failed to fetch productivity data');
      return await response.json();
    } catch (error) {
      console.error('Error fetching productivity data:', error);
      return null;
    }
  },

  async fetchInsights() {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/insights`);
      if (!response.ok) throw new Error('Failed to fetch insights');
      return await response.json();
    } catch (error) {
      console.error('Error fetching insights:', error);
      return null;
    }
  },

  // for live sensors page
  async fetchLatestSensorData() {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/sensors/latest`);
      if (!response.ok) throw new Error('Failed to fetch sensor data');
      return await response.json();
    } catch (error) {
      console.error('Error fetching latest sensor data:', error);
      return null;
    }
  },

  // for study trends page
  async fetchStudyTrends(days = 7) {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/study_trends?days=${days}`);
      if (!response.ok) throw new Error('Failed to fetch study trends');
      return await response.json();
    } catch (error) {
      console.error('Error fetching study trends:', error);
      return null;
    }
  },

  // for stress analysis page
  async fetchStressHistory(hours = 6) {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/stress_history?hours=${hours}`);
      if (!response.ok) throw new Error('Failed to fetch stress history');
      return await response.json();
    } catch (error) {
      console.error('Error fetching stress history:', error);
      return null;
    }
  },

  // for sessions page
  async fetchPresenceHistory(hours = 24) {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/presence_history?hours=${hours}`);
      if (!response.ok) throw new Error('Failed to fetch presence history');
      return await response.json();
    } catch (error) {
      console.error('Error fetching presence history:', error);
      return null;
    }
  },
}

const StudyDashboard = () => {
  // Tab state
  const [activeTab, setActiveTab] = useState('overview');
  
  // Time range state (day, week, month)
  const [timeRange, setTimeRange] = useState('day');

  // Connection status
  const [connectionStatus, setConnectionStatus] = useState({
    presence: false,
    ambient: false,
    camera: false,
    api: false,
  });

  // Dashboard stats
  const [dashboardStats, setDashboardStats] = useState({
    sessionTime: '0h 0m 0s',
    focusScore: 0,
    lightLevel: null,  // null indicates unknown/offline
    lightSensorConnected: false,
    presenceDetected: false,
    emotionState: 'Calm',
    stressLevel: 0,
  });

  const [productivity, setProductivity] = useState([]);
  const [insights, setInsights] = useState([]);

  // Real-time sensor data (from WebSocket)
  const [sensorData, setSensorData] = useState({
    lightLevel: null,  // null indicates unknown/offline
    lightSensorConnected: false,
    presenceDetected: false,
    distanceCm: 0,
    emotionState: 'Calm',
    stressLevel: 0,
  });

  // Historical data
  const [studyTrends, setStudyTrends] = useState([]);
  const [studyTrendsSummary, setStudyTrendsSummary] = useState({
    averageHoursPerDay: 0,
    bestDay: null,
    bestDayHours: 0,
    bestDayFocus: 0,
    focusTrend: 0,
  });
  
  const [stressHistory, setStressHistory] = useState([]);
  const [stressSummary, setStressSummary] = useState({
    peakStress: 0,
    peakTime: 'N/A',
    averageAnxiety: 0,
    averageCalm: 100,
  })

  const [sessions, setSessions] = useState([]);

  // ============================================
  // DATA FETCHING
  // ============================================
  const fetchAllData = useCallback(async (currentTimeRange = 'day') => {
    // Determine days parameter based on time range
    // Note: Week and Month use hardcoded data, but we still fetch for 'day' view
    const daysForTrends = currentTimeRange === 'day' ? 1 : 7;
    const hoursForStress = currentTimeRange === 'day' ? 6 : 24;
    const hoursForPresence = currentTimeRange === 'day' ? 24 : 168; // 24 hours for day, 7 days for week

    try {
      const [
        dashboardStatsData,
        productivityData,
        insightsData,
        latestSensorData,
        trendsData,
        stressData,
        sessionsHistory,
      ] = await Promise.all([
        apiService.fetchDashboardStats(),
        apiService.fetchProductivityData(daysForTrends),
        apiService.fetchInsights(),
        apiService.fetchLatestSensorData(),
        apiService.fetchStudyTrends(daysForTrends),
        apiService.fetchStressHistory(hoursForStress),
        apiService.fetchPresenceHistory(hoursForPresence),
      ]);

      // In fetchAllData function
      console.log('Dashboard Stats Data:', dashboardStatsData);
      console.log('Light Level:', dashboardStatsData?.lightLevel);
      console.log('Type of lightLevel:', typeof dashboardStatsData?.lightLevel);

      // setConnectionStatus((prev) => ({ ...prev, api: true }));

      // Update dashboard stats
      if (dashboardStatsData) {
        setDashboardStats({
          sessionTime: dashboardStatsData.sessionTime || '0h 0m 0s',
          focusScore: dashboardStatsData.focusScore || 0,
          lightLevel: dashboardStatsData.lightLevel,  // Don't default to 0, keep null
          lightSensorConnected: dashboardStatsData.lightSensorConnected ?? (dashboardStatsData.lightLevel !== null && dashboardStatsData.lightLevel >= 0),
          presenceDetected: dashboardStatsData.presenceDetected || false,
          emotionState: dashboardStatsData.emotionState || 'Calm',
          stressLevel: dashboardStatsData.stressLevel || 0.0,
        });
        // console.log("dashboard stats:", dashboardStatsData)
      }

      // Update productivity data
      if (productivityData && productivityData.data) {
        setProductivity(productivityData.data);
      }

      // Update insights
      if (insightsData && insightsData.insights) {
        setInsights(insightsData.insights);
      }

      // Update sensor data from API
      if (latestSensorData) {
        setSensorData({
          lightLevel: latestSensorData.lightLevel,  // Don't default to 0, keep null
          lightSensorConnected: latestSensorData.lightSensorConnected ?? (latestSensorData.lightLevel !== null && latestSensorData.lightLevel >= 0),
          presenceDetected: latestSensorData.presenceDetected || false,
          distanceCm: latestSensorData.distanceCm || 0.0,
          emotionState: latestSensorData.emotionState || 'Calm',
          stressLevel: latestSensorData.stressLevel || 0.0,
        })
      }

      // Update study trends
      if (trendsData) {
        setStudyTrends(trendsData.trends || []);
        setStudyTrendsSummary(trendsData.summary || {});

      }

      // Update stress history
      if (stressData) {
        setStressHistory(stressData.history || []);
        setStressSummary(stressData.summary || {});
      }

      // Update sessions
      if (sessionsHistory) {
        setSessions(sessionsHistory.sessions)
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      // setConnectionStatus((prev) => ({ ...prev, api: false }));
    }
  }, []);

  // Initial data fetch and refetch when timeRange changes
  useEffect(() => {
    fetchAllData(timeRange);
  }, [fetchAllData, timeRange]);

  // Periodic data refresh
  useEffect(() => {
    const interval = setInterval(() => fetchAllData(timeRange), CONFIG.REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAllData, timeRange]);

  // ============================================
  // HARDCODED DATA FOR WEEK & MONTH VIEWS
  // ============================================
  const HARDCODED_WEEK_TRENDS = [
    { day: 'Fri', date: '2025-11-28', studyHours: 4.5, focusScore: 78, breaks: 3, sessions: 4 },
    { day: 'Sat', date: '2025-11-29', studyHours: 5.2, focusScore: 82, breaks: 4, sessions: 5 },
    { day: 'Sun', date: '2025-11-30', studyHours: 3.8, focusScore: 75, breaks: 3, sessions: 3 },
    { day: 'Mon', date: '2025-12-01', studyHours: 6.1, focusScore: 88, breaks: 5, sessions: 6 },
    { day: 'Tue', date: '2025-12-02', studyHours: 4.2, focusScore: 76, breaks: 3, sessions: 4 },
    { day: 'Wed', date: '2025-12-03', studyHours: 5.8, focusScore: 85, breaks: 4, sessions: 5 },
    { day: 'Thu', date: '2025-12-04', studyHours: 1.5, focusScore: 72, breaks: 2, sessions: 3 },
  ];
  
  const HARDCODED_WEEK_SUMMARY = {
    averageHoursPerDay: 4.4,
    totalHours: 31.1,
    bestDay: 'Mon',
    bestDayHours: 6.1,
    bestDayFocus: 88,
    focusTrend: 5,
  };
  
  const HARDCODED_MONTH_TRENDS = [
    { day: 'Week 1', date: '2025-12-01', studyHours: 21.1, focusScore: 79, breaks: 21, sessions: 22 },
    { day: 'Week 2', date: '2025-12-08', studyHours: 0, focusScore: 0, breaks: 0, sessions: 0 },
    { day: 'Week 3', date: '2025-12-15', studyHours: 0, focusScore: 0, breaks: 0, sessions: 0 },
    { day: 'Week 4', date: '2025-12-22', studyHours: 0, focusScore: 0, breaks: 0, sessions: 0 },
  ];
  
  const HARDCODED_MONTH_SUMMARY = {
    averageHoursPerDay: 5.3,
    totalHours: 21.1,
    bestDay: 'Week 1',
    bestDayHours: 21.1,
    bestDayFocus: 79,
    focusTrend: 0,
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
    // Nov 28, 2025 (Fri)
    { start: 1732780800, end: 1732788000, duration_minutes: 120 },
    { start: 1732791600, end: 1732797000, duration_minutes: 90 },
    // Nov 29, 2025 (Sat)
    { start: 1732867200, end: 1732878000, duration_minutes: 180 },
    // Nov 30, 2025 (Sun)
    { start: 1732953600, end: 1732960800, duration_minutes: 120 },
    // Dec 1, 2025 (Mon)
    { start: 1733040000, end: 1733050800, duration_minutes: 180 },
    { start: 1733054400, end: 1733061600, duration_minutes: 120 },
    // Dec 2, 2025 (Tue)
    { start: 1733126400, end: 1733133600, duration_minutes: 120 },
    // Dec 3, 2025 (Wed)
    { start: 1733212800, end: 1733223600, duration_minutes: 180 },
    // Dec 4, 2025 (Thu - Demo Day)
    { start: 1733299200, end: 1733304600, duration_minutes: 90 },
  ];
  
  const HARDCODED_MONTH_SESSIONS = [
    // Dec 1, 2025 (Mon)
    { start: 1733040000, end: 1733050800, duration_minutes: 180 },
    { start: 1733054400, end: 1733061600, duration_minutes: 120 },
    // Dec 2, 2025 (Tue)
    { start: 1733126400, end: 1733133600, duration_minutes: 120 },
    { start: 1733140800, end: 1733148000, duration_minutes: 120 },
    // Dec 3, 2025 (Wed)
    { start: 1733212800, end: 1733223600, duration_minutes: 180 },
    { start: 1733227200, end: 1733234400, duration_minutes: 120 },
    // Dec 4, 2025 (Thu - Demo Day)
    { start: 1733299200, end: 1733304600, duration_minutes: 90 },
  ];

  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  const getEmotionColor = (emotion) => {
    //fear, calm, happy, sad, surprised, angry, disgusted
    switch (emotion) {
      case 'Surprised':
        return '#4ade80';
      case 'Happy':
        return '#4ade80';
      case 'Calm':
        return '#fbbf24';
      case 'Sad':
          return '#fbbf24';
      case 'Disgusted':
        return '#ef4444';
      case 'Fear':
          return '#ef4444';
      case 'Angry':
          return '#ef4444';
      case 'Confused':
        return '#FFEA00';
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
    if (level === null || level === undefined || level < 0) {
    return { status: 'Sensor Offline', color: '#6b7280', connected: false };
    }
    if (level < 50) return { status: 'Too Dark', color: '#6b7280', connected: true };
    if (level < 200) return { status: 'Low', color: '#fbbf24', connected: true };
    if (level < 400) return { status: 'Optimal', color: '#4ade80', connected: true };
    if (level < 500) return { status: 'Bright', color: '#fbbf24', connected: true };
    return { status: 'Too Bright', color: '#ef4444', connected: true };
  };

  const lightQuality = getLightQuality(dashboardStats.lightLevel);

  const sensorLightQuality = getLightQuality(sensorData.lightLevel);

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
          dateRange: 'Nov 28 - Dec 4, 2025',
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
          dateRange: 'December 2025',
        };
      case 'day':
      default:
        return {
          trends: studyTrends,
          summary: studyTrendsSummary,
          productivity: productivity,
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

  // for the heatmap
  const getHeatmapColor = (score) => {
    if (score === 0) return '#e5e7eb'; // Grey (Empty)
    if (score < 30) return '#fcd34d';  // Yellow
    if (score < 60) return '#fbbf24';  // Orange
    if (score < 85) return '#34d399';  // Light Green
    return '#10b981';                  // Deep Green
  };
  
  const timeLabels = ['12am', '2am', '4am', '6am', '8am', '10am', '12pm', '2pm', '4pm', '6pm', '8pm', '10pm'];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  // Map "6am" display text to backend integer "6"
  const timeToHourMap = {
    '12am': 0, '2am': 2, '4am': 4,
    '6am': 6, '8am': 8, '10am': 10, '12pm': 12,
    '2pm': 14, '4pm': 16, '6pm': 18, '8pm': 20, '10pm': 22
  };
  
  const getScore = (data, day, timeLabel) => {
    if (!data) return 0;
    const targetHour = timeToHourMap[timeLabel];
    
    // Find the exact data point for this Day + Hour
    // Note: We sum targetHour + targetHour+1 to simulate 2-hour blocks if desired,
    // or just look for the specific hour. Here we look for the specific hour.
    const entry = data.find(d => d.day === day && d.hour === targetHour);
    return entry ? entry.productivity : 0;
  };

  console.log('=== RENDER DEBUG ===');
  console.log('dashboardStats state:', dashboardStats);
  console.log('dashboardStats.lightLevel:', dashboardStats.lightLevel);
  console.log('lightQuality result:', lightQuality);
  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Study Environment Dashboard</h1>
          <p>Real-time IoT sensor monitoring & productivity insights</p>
          {/* <div className="connection-status">
            <span className={`status-dot ${connectionStatus.presence ? 'connected' : 'disconnected'}`}>
              {connectionStatus.presence ? <Wifi size={14} /> : <WifiOff size={14} />}
              Presence
            </span>
            <span className={`status-dot ${connectionStatus.ambient ? 'connected' : 'disconnected'}`}>
              {connectionStatus.ambient ? <Wifi size={14} /> : <WifiOff size={14} />}
              Ambient
            </span>
            <span className={`status-dot ${connectionStatus.camera ? 'connected' : 'disconnected'}`}>
              {connectionStatus.camera ? <Wifi size={14} /> : <WifiOff size={14} />}
              Camera
            </span>
            <span className={`status-dot ${connectionStatus.api ? 'connected' : 'disconnected'}`}>
              {connectionStatus.api ? <Wifi size={14} /> : <WifiOff size={14} />}
              API
            </span>
          </div> */}
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
        {(activeTab === 'trends' || activeTab === 'stress' || activeTab === 'sessions') && <TimeRangeSelector />}
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

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="tab-content overview-tab">
            {/* KPI Cards */}
            <div className="kpi-grid">
              {/* Light Level Card */}
              <div className="kpi-card">
                <div className="kpi-header">
                  <Cloud size={24} className="kpi-icon" />
                  <span className="kpi-title">Light Level</span>
                </div>
                <div className="kpi-value">
                  {lightQuality.connected 
                    ? `${Math.round(dashboardStats.lightLevel)} lux`
                    : '-- lux'}
                </div>
                <div className="kpi-status" style={{ color: lightQuality.color }}>
                  {lightQuality.status}
                </div>
              </div>

              {/* Presence Card */}
              <div className="kpi-card">
                <div className="kpi-header">
                  <Zap size={24} className="kpi-icon" />
                  <span className="kpi-title">Presence</span>
                </div>
                <div className="kpi-value">{dashboardStats.presenceDetected ? 'Detected' : 'Away'}</div>
                <div className="kpi-status" style={{ color: dashboardStats.presenceDetected ? '#4ade80' : '#ef4444' }}>
                  {dashboardStats.presenceDetected ? 'Active' : 'Inactive'}
                </div>
              </div>

              {/* Emotion Card */}
              <div className="kpi-card">
                <div className="kpi-header">
                  <Eye size={24} className="kpi-icon" />
                  <span className="kpi-title">Emotion</span>
                </div>
                <div className="kpi-value">{dashboardStats.emotionState}</div>
                <div className="kpi-status" style={{ color: getEmotionColor(dashboardStats.emotionState) }}>
                  ● Detected
                </div>
              </div>

              {/* Stress Level Card */}
              <div className="kpi-card">
                <div className="kpi-header">
                  <Heart size={24} className="kpi-icon" />
                  <span className="kpi-title">Stress Level</span>
                </div>
                <div className="kpi-value">{Math.round(dashboardStats.stressLevel)}%</div>
                <div className="kpi-status" style={{ color: getStressColor(dashboardStats.stressLevel) }}>
                  {dashboardStats.stressLevel < 30 ? 'Low' : dashboardStats.stressLevel < 60 ? 'Moderate' : 'High'}
                </div>
              </div>
            </div>

            {/* Productivity Heatmap */}
            <div className="chart-container">
              <h2 className="chart-title">
                Productivity Heatmap {timeRange !== 'day' && `(${currentData.label})`}
              </h2>
              
              {(currentData.productivity && currentData.productivity.length > 0) ? (
                <div className="heatmap-wrapper">
                  
                  {/* 1. Time Headers */}
                  <div className="heatmap-header">
                    <div className="y-axis-spacer"></div>
                    {timeLabels.map(time => (
                      <div key={time} className="x-axis-label">{time}</div>
                    ))}
                  </div>

                  {/* 2. Grid Rows */}
                  {days.map(day => (
                    <div key={day} className="heatmap-row">
                      <div className="y-axis-label">{day}</div>
                      <div className="heatmap-cells">
                        {timeLabels.map(time => {
                          const score = getScore(currentData.productivity, day, time);
                          return (
                            <div
                              key={`${day}-${time}`}
                              className="heatmap-cell"
                              style={{ backgroundColor: getHeatmapColor(score) }}
                              title={`${day} ${time}: ${score}% Productive`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* 3. Legend */}
                  <div className="heatmap-legend">
                    <span>Less</span>
                    <div className="legend-box" style={{background: '#e5e7eb'}}></div>
                    <div className="legend-box" style={{background: '#fcd34d'}}></div>
                    <div className="legend-box" style={{background: '#fbbf24'}}></div>
                    <div className="legend-box" style={{background: '#34d399'}}></div>
                    <div className="legend-box" style={{background: '#10b981'}}></div>
                    <span>More</span>
                  </div>

                </div>
              ) : (
                <div className="no-data">No productivity data available yet.</div>
              )}
            </div>
            

            {/* Smart Insights */}
            <div className="insights-section">
              <h2 className="section-title">Smart Insights</h2>
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
                  {!sensorLightQuality.connected && (
                    <span className="sensor-offline-badge">Offline</span>
                  )}
                </div>
                <div className="sensor-reading">
                  <div className="reading-value" style={{ color: sensorLightQuality.connected ? undefined : '#6b7280' }}>
                    {sensorLightQuality.connected ? Math.round(sensorData.lightLevel) : '--'}
                  </div>
                  <div className="reading-unit">lux</div>
                </div>
                <div className="sensor-details">
                  {sensorLightQuality.connected ? (
                    <>
                      <p>
                        <strong>Status:</strong>{' '}
                        <span style={{ color: sensorLightQuality.color }}>
                          {sensorLightQuality.status},{' '}
                          {sensorData.lightLevel < 200
                            ? 'Increase brightness'
                            : sensorData.lightLevel > 500
                            ? 'Reduce brightness'
                            : 'Perfect lighting'}
                        </span>
                      </p>
                      <p><strong>Optimal Range:</strong> 200-400 lux</p>
                    </>
                  ) : (
                    <>
                      <p>
                        <strong>Status:</strong>{' '}
                        <span style={{ color: '#ef4444' }}>
                          Sensor not connected or returning invalid data
                        </span>
                      </p>
                      <p><strong>Action:</strong> Check sensor wiring and connection</p>
                    </>
                  )}
                </div>
                <div className="sensor-chart">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: sensorLightQuality.connected
                          ? `${Math.min(100, Math.max(0, (sensorData.lightLevel / 600) * 100))}%`
                          : '0%',
                        height: 10,
                        backgroundColor: sensorLightQuality.color,
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Presence Sensor */}
              <div className="sensor-card detailed">
                <div className="sensor-header">
                  <Zap size={32} className="sensor-icon" />
                  <h3>Presence Sensor</h3>
                </div>
                <div className="sensor-reading">
                  <div className="reading-value">{sensorData.presenceDetected ? '✓' : '✗'}</div>
                  <div className="reading-unit">{sensorData.presenceDetected ? 'Present' : 'Absent'}</div>
                </div>
                <div className="sensor-details">
                  <p><strong>Distance:</strong> {Number(sensorData.distanceCm || 0).toFixed(1)} cm</p>
                  <p><strong>Detection Range:</strong> 0-50 cm (present)</p>
                  <p></p>
                </div>
                <div className="sensor-chart">
                  <div className="presence-indicator" style={{
                    height: 10,
                    backgroundColor: sensorData.presenceDetected ? '#4ade80' : '#ef4444',
                  }}></div>
                </div>
              </div>

              {/* Emotion/Stress Camera */}
              <div className="sensor-card detailed">
                <div className="sensor-header">
                  <Eye size={32} className="sensor-icon" />
                  <h3>Camera</h3>
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
                  <p></p>
                </div>
                <div className="sensor-chart">
                  <div className="emotion-bar" style={{
                    backgroundColor: getEmotionColor(sensorData.emotionState),
                    width: '100%',
                    height: 10,
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
                  <p><strong>Recommendation:</strong> {sensorData.stressLevel > 60 ? 'Take a break' : 'Keep up the good work'}</p>
                  <p></p>
                </div>
                <div className="sensor-chart">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${sensorData.stressLevel}%`,
                        backgroundColor: getStressColor(sensorData.stressLevel),
                        height: 10
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
              <h2 className="chart-title">{timeRange === 'month' ? 'Monthly' : timeRange === 'week' ? 'Weekly' : 'Daily'} Study Patterns {timeRange !== 'day' && `(${currentData.dateRange})`}</h2>
              {(currentData.trends && currentData.trends.length > 0) ? (
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={currentData.trends} margin={{ top: 20, right: 60, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="day" stroke="#9ca3af" />
                    <YAxis 
                      yAxisId="left" 
                      stroke="#10b981" 
                      domain={[0, 100]} 
                      tickFormatter={(v) => `${v}%`}
                      label={{ value: 'Focus Score (%)', angle: -90, position: 'insideLeft', fill: '#10b981', fontSize: 12 }}
                    />
                    <YAxis 
                      yAxisId="right" 
                      orientation="right" 
                      stroke="#3b82f6" 
                      domain={[0, 'auto']}
                      tickFormatter={(v) => `${v}h`}
                      label={{ value: 'Hours / Breaks', angle: 90, position: 'insideRight', fill: '#3b82f6', fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                      formatter={(value, name) => {
                        if (name === 'Focus Score') return [`${value}%`, name];
                        if (name === 'Study Hours') return [`${value}h`, name];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Bar yAxisId="right" dataKey="studyHours" fill="#3b82f6" name="Study Hours" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Bar yAxisId="right" dataKey="breaks" fill="#f59e0b" name="Breaks Taken" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Line 
                      yAxisId="left" 
                      type="monotone" 
                      dataKey="focusScore" 
                      stroke="#10b981" 
                      strokeWidth={3} 
                      dot={{ fill: '#10b981', r: 6, strokeWidth: 2, stroke: '#1f2937' }} 
                      activeDot={{ r: 8, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                      name="Focus Score"
                      isAnimationActive={false}
                    />
                  </ComposedChart>
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
              <h2 className="chart-title">Stress Level Tracking {timeRange !== 'day' && `(${currentData.label})`}</h2>
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
              <h2 className="chart-title">Activity Sessions ({currentData.label}) {`- ${currentData.dateRange}`}</h2>
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
                          <td>{new Date(session.start * 1000).toLocaleString('en-GB', {
                            hour12: false,
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}</td>
                          <td>{new Date(session.end * 1000).toLocaleString('en-GB', {
                            hour12: false,
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}</td>
                          <td>{Number(session.duration_minutes || 0).toFixed(1)} minutes</td>
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
  )
};

export default StudyDashboard;