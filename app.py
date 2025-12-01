from flask import Flask, jsonify, request
import boto3
from boto3.dynamodb.conditions import Key, Attr
from datetime import datetime, timedelta, timezone
from flask_cors import CORS
from decimal import Decimal
import json
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# CORS Configuration
cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(',')
CORS(app, origins=cors_origins)

# Custom JSON encoder to handle Decimal types from DynamoDB
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

app.json_encoder = DecimalEncoder

# DynamoDB Configuration from environment variables
dynamodb = boto3.resource(
    'dynamodb',
    region_name=os.getenv('AWS_REGION', 'ap-southeast-1'),
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
)

# Tables
TABLE_NAME = os.getenv('DYNAMODB_TABLE_NAME', 'ProximitySensorData')
presence_table = dynamodb.Table(TABLE_NAME)

# Try to access other tables if they exist
try:
    ambient_table = dynamodb.Table('AmbientSensorData')
except:
    ambient_table = None

try:
    stress_table = dynamodb.Table('StressSensorData')
except:
    stress_table = None


# ============================================
# HELPER FUNCTIONS
# ============================================

def decimal_to_float(obj):
    """Convert Decimal objects to float for JSON serialization"""
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, dict):
        return {k: decimal_to_float(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [decimal_to_float(i) for i in obj]
    return obj


def calculate_sessions(raw_data, timeout_threshold=60):
    """Calculate study sessions from presence data"""
    if not raw_data:
        return []
    
    active_moments = []
    for item in raw_data:
        if item.get('presence') is True:
            temp_item = {
                'presence': item.get('presence'),
                'distanceCM': float(item.get('distanceCm', 0)) if item.get('distanceCm') else 0,
                'unixTimestamp': int(item.get('unixTimestamp', 0)) if item.get('unixTimestamp') else 0
            }
            active_moments.append(temp_item)
    
    active_moments.sort(key=lambda x: x['unixTimestamp'])

    if not active_moments:
        return []

    sessions = []
    current_session = {
        'start': active_moments[0]['unixTimestamp'],
        'end': active_moments[0]['unixTimestamp'],
    }

    for i in range(1, len(active_moments)):
        current = active_moments[i]['unixTimestamp']
        prev = active_moments[i-1]['unixTimestamp']

        if (current - prev) <= timeout_threshold:
            current_session['end'] = current
        else:
            duration_min = (current_session['end'] - current_session['start']) / 60
            current_session['duration_minutes'] = round(duration_min, 2)
            sessions.append(current_session)
            current_session = {
                'start': current,
                'end': current
            }
    
    duration_min = (current_session['end'] - current_session['start']) / 60
    current_session['duration_minutes'] = round(duration_min, 2)
    sessions.append(current_session)

    return sessions


def calculate_focus_score(sessions, total_time_hours):
    """Calculate focus score based on session consistency"""
    if not sessions or total_time_hours == 0:
        return 0
    
    total_study_minutes = sum(s.get('duration_minutes', 0) for s in sessions)
    total_available_minutes = total_time_hours * 60
    
    # Base score from presence percentage
    presence_ratio = min(total_study_minutes / total_available_minutes, 1.0)
    
    # Bonus for longer continuous sessions (fewer breaks)
    avg_session_length = total_study_minutes / len(sessions) if sessions else 0
    session_bonus = min(avg_session_length / 60, 0.2)  # Max 20% bonus for 60+ min sessions
    
    focus_score = (presence_ratio * 80) + (session_bonus * 100)
    return min(round(focus_score), 100)


def get_light_quality(lux_level):
    """Determine light quality based on lux level"""
    if lux_level < 100:
        return {'status': 'Too Dark', 'color': '#6b7280', 'optimal': False}
    elif lux_level < 300:
        return {'status': 'Low', 'color': '#fbbf24', 'optimal': False}
    elif lux_level < 500:
        return {'status': 'Optimal', 'color': '#4ade80', 'optimal': True}
    elif lux_level < 1000:
        return {'status': 'Bright', 'color': '#fbbf24', 'optimal': True}
    else:
        return {'status': 'Too Bright', 'color': '#ef4444', 'optimal': False}


def generate_insights(sensor_data, sessions, study_trends):
    """Generate smart insights based on sensor data and patterns"""
    insights = []
    insight_id = 1
    
    # Light level insight
    if sensor_data.get('lightLevel'):
        light_quality = get_light_quality(sensor_data['lightLevel'])
        if light_quality['optimal']:
            insights.append({
                'id': insight_id,
                'type': 'success',
                'title': 'Lighting Conditions Optimal',
                'description': f"Current light level ({sensor_data['lightLevel']} lux) is perfect for focus. Maintain this environment.",
                'icon': 'check'
            })
        else:
            insights.append({
                'id': insight_id,
                'type': 'warning',
                'title': 'Lighting Adjustment Recommended',
                'description': f"Light level is {light_quality['status'].lower()}. Adjust for better focus.",
                'icon': 'alert'
            })
        insight_id += 1
    
    # Presence/session insight
    if sessions:
        total_study_time = sum(s.get('duration_minutes', 0) for s in sessions)
        presence_percentage = min(round((total_study_time / (24 * 60)) * 100 * 10), 100)  # Scaled for display
        
        if presence_percentage > 80:
            insights.append({
                'id': insight_id,
                'type': 'success',
                'title': 'Excellent Presence Consistency',
                'description': f'You maintained {presence_percentage}% presence this session. Great focus and engagement!',
                'icon': 'check'
            })
        elif presence_percentage > 50:
            insights.append({
                'id': insight_id,
                'type': 'info',
                'title': 'Good Presence Detected',
                'description': f'You were present {presence_percentage}% of the time. Try to minimize distractions.',
                'icon': 'check'
            })
        else:
            insights.append({
                'id': insight_id,
                'type': 'warning',
                'title': 'Low Presence Detected',
                'description': 'Consider finding a quieter study space to improve focus.',
                'icon': 'alert'
            })
        insight_id += 1
    
    # Study pattern insight
    if study_trends:
        best_day = max(study_trends, key=lambda x: x.get('focusScore', 0))
        insights.append({
            'id': insight_id,
            'type': 'success',
            'title': 'Optimal Study Time Identified',
            'description': f"You perform best on {best_day.get('day', 'weekdays')}. Schedule challenging tasks for this day.",
            'icon': 'check'
        })
        insight_id += 1
    
    # Stress insight
    if sensor_data.get('stressLevel'):
        if sensor_data['stressLevel'] > 60:
            insights.append({
                'id': insight_id,
                'type': 'warning',
                'title': 'Stress Peak Detected',
                'description': 'Your stress levels are elevated. Consider taking a 5-minute break.',
                'icon': 'alert'
            })
        elif sensor_data['stressLevel'] < 30:
            insights.append({
                'id': insight_id,
                'type': 'success',
                'title': 'Low Stress Levels',
                'description': 'You are in a calm state. Great time for deep focus work!',
                'icon': 'check'
            })
    
    return insights


# ============================================
# API ENDPOINTS
# ============================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()})


@app.route('/api/presence_history', methods=['GET'])
def get_presence_history():
    """Get presence history and calculated sessions"""
    device_id = request.args.get('deviceId', 'ESP32-lamp')
    hours = int(request.args.get('hours', 24))
    cutoff_dt = datetime.now(timezone.utc) - timedelta(hours=hours)
    cutoff_iso_string = cutoff_dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')

    try:
        response = presence_table.query(
            KeyConditionExpression=Key('deviceId').eq(device_id) & Key('timestamp').gte(cutoff_iso_string)
        )
        items = response.get('Items', [])
        items = decimal_to_float(items)
        
        calculated_sessions = calculate_sessions(items)

        return jsonify({
            "count": len(items),
            "sessions": calculated_sessions,
            "totalStudyMinutes": sum(s.get('duration_minutes', 0) for s in calculated_sessions)
        })
        
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/sensors/latest', methods=['GET'])
def get_latest_sensor_data():
    """Get the most recent readings from all sensors"""
    device_id = request.args.get('deviceId', 'ESP32-lamp')
    
    result = {
        'lightLevel': 0,
        'lightQuality': 'unknown',
        'presence': False,
        'distanceCm': 0,
        'emotionState': 'neutral',
        'stressLevel': 0,
        'timestamp': None
    }
    
    try:
        # Get latest presence data
        presence_response = presence_table.query(
            KeyConditionExpression=Key('deviceId').eq(device_id),
            ScanIndexForward=False,
            Limit=1
        )
        
        if presence_response.get('Items'):
            latest = decimal_to_float(presence_response['Items'][0])
            result['presence'] = latest.get('presence', False)
            result['distanceCm'] = latest.get('distanceCm', 0)
            result['timestamp'] = latest.get('timestamp')
            
            # If ambient data is in same table
            if 'lighting' in latest or 'lightLevel' in latest:
                result['lightLevel'] = latest.get('lighting') or latest.get('lightLevel', 0)
                quality = get_light_quality(result['lightLevel'])
                result['lightQuality'] = quality['status']
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error fetching latest sensor data: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/sensors/history', methods=['GET'])
def get_sensor_history():
    """Get historical sensor readings"""
    device_id = request.args.get('deviceId', 'ESP32-lamp')
    sensor_type = request.args.get('type', 'all')  # presence, light, stress, all
    hours = int(request.args.get('hours', 24))
    
    cutoff_dt = datetime.now(timezone.utc) - timedelta(hours=hours)
    cutoff_iso_string = cutoff_dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')
    
    try:
        response = presence_table.query(
            KeyConditionExpression=Key('deviceId').eq(device_id) & Key('timestamp').gte(cutoff_iso_string)
        )
        items = decimal_to_float(response.get('Items', []))
        
        # Format data based on sensor type
        if sensor_type == 'presence':
            data = [{'timestamp': i.get('timestamp'), 'presence': i.get('presence'), 'distance': i.get('distanceCm')} for i in items]
        elif sensor_type == 'light':
            data = [{'timestamp': i.get('timestamp'), 'lightLevel': i.get('lighting') or i.get('lightLevel', 0)} for i in items]
        else:
            data = items
        
        return jsonify({"count": len(data), "data": data})
        
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/study_trends', methods=['GET'])
def get_study_trends():
    """Get weekly study patterns"""
    device_id = request.args.get('deviceId', 'ESP32-lamp')
    days = int(request.args.get('days', 7))
    
    try:
        # Get data for the past week
        trends = []
        day_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        
        for i in range(days):
            day_offset = days - 1 - i
            target_date = datetime.now(timezone.utc) - timedelta(days=day_offset)
            start_of_day = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
            end_of_day = target_date.replace(hour=23, minute=59, second=59, microsecond=999999)
            
            start_iso = start_of_day.strftime('%Y-%m-%dT%H:%M:%S.000Z')
            end_iso = end_of_day.strftime('%Y-%m-%dT%H:%M:%S.999Z')
            
            response = presence_table.query(
                KeyConditionExpression=Key('deviceId').eq(device_id) & 
                    Key('timestamp').between(start_iso, end_iso)
            )
            
            items = decimal_to_float(response.get('Items', []))
            sessions = calculate_sessions(items)
            
            total_study_minutes = sum(s.get('duration_minutes', 0) for s in sessions)
            study_hours = round(total_study_minutes / 60, 1)
            focus_score = calculate_focus_score(sessions, 8)  # Assume 8 hour study window
            breaks = len(sessions) - 1 if len(sessions) > 0 else 0
            
            day_name = day_names[target_date.weekday()]
            
            trends.append({
                'day': day_name,
                'date': target_date.strftime('%Y-%m-%d'),
                'studyHours': study_hours,
                'focusScore': focus_score,
                'breaks': max(breaks, 0),
                'sessions': len(sessions)
            })
        
        # Calculate summary stats
        total_hours = sum(t['studyHours'] for t in trends)
        avg_hours = round(total_hours / len(trends), 1) if trends else 0
        best_day = max(trends, key=lambda x: x['focusScore']) if trends else None
        
        # Calculate focus trend (compare first half vs second half of week)
        if len(trends) >= 4:
            first_half_avg = sum(t['focusScore'] for t in trends[:len(trends)//2]) / (len(trends)//2)
            second_half_avg = sum(t['focusScore'] for t in trends[len(trends)//2:]) / (len(trends) - len(trends)//2)
            focus_trend = round(second_half_avg - first_half_avg)
        else:
            focus_trend = 0
        
        return jsonify({
            'trends': trends,
            'summary': {
                'averageHoursPerDay': avg_hours,
                'totalHours': round(total_hours, 1),
                'bestDay': best_day['day'] if best_day else None,
                'bestDayHours': best_day['studyHours'] if best_day else 0,
                'bestDayFocus': best_day['focusScore'] if best_day else 0,
                'focusTrend': focus_trend
            }
        })
        
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/productivity', methods=['GET'])
def get_productivity_by_hour():
    """Get productivity data by time of day"""
    device_id = request.args.get('deviceId', 'ESP32-lamp')
    days = int(request.args.get('days', 7))
    
    try:
        # Initialize hourly buckets
        hourly_presence = {hour: {'total': 0, 'present': 0} for hour in range(24)}
        
        cutoff_dt = datetime.now(timezone.utc) - timedelta(days=days)
        cutoff_iso_string = cutoff_dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')
        
        response = presence_table.query(
            KeyConditionExpression=Key('deviceId').eq(device_id) & Key('timestamp').gte(cutoff_iso_string)
        )
        
        items = decimal_to_float(response.get('Items', []))
        
        for item in items:
            try:
                timestamp = item.get('timestamp', '')
                if timestamp:
                    dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    hour = dt.hour
                    hourly_presence[hour]['total'] += 1
                    if item.get('presence', False):
                        hourly_presence[hour]['present'] += 1
            except:
                continue
        
        # Calculate productivity percentage for each hour
        productivity_data = []
        time_labels = ['12am', '2am', '4am', '6am', '8am', '10am', '12pm', '2pm', '4pm', '6pm', '8pm', '10pm']
        
        for i, label in enumerate(time_labels):
            hour = i * 2
            total = hourly_presence[hour]['total'] + hourly_presence[hour + 1]['total']
            present = hourly_presence[hour]['present'] + hourly_presence[hour + 1]['present']
            
            productivity = round((present / total) * 100) if total > 0 else 0
            productivity_data.append({
                'time': label,
                'productivity': productivity,
                'dataPoints': total
            })
        
        return jsonify({'data': productivity_data})
        
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/stress_history', methods=['GET'])
def get_stress_history():
    """Get stress level history for the current session"""
    device_id = request.args.get('deviceId', 'ESP32-lamp')
    hours = int(request.args.get('hours', 4))  # Default to last 4 hours for session view
    
    try:
        cutoff_dt = datetime.now(timezone.utc) - timedelta(hours=hours)
        cutoff_iso_string = cutoff_dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')
        
        response = presence_table.query(
            KeyConditionExpression=Key('deviceId').eq(device_id) & Key('timestamp').gte(cutoff_iso_string)
        )
        
        items = decimal_to_float(response.get('Items', []))
        
        # Group by 30-minute intervals
        stress_data = []
        interval_data = {}
        
        for item in items:
            try:
                timestamp = item.get('timestamp', '')
                if timestamp:
                    dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    # Round to 30-minute interval
                    interval_key = dt.replace(minute=30 if dt.minute >= 30 else 0, second=0, microsecond=0)
                    time_label = interval_key.strftime('%H:%M')
                    
                    if time_label not in interval_data:
                        interval_data[time_label] = {
                            'stress_values': [],
                            'presence_count': 0,
                            'total_count': 0
                        }
                    
                    interval_data[time_label]['total_count'] += 1
                    if item.get('presence', False):
                        interval_data[time_label]['presence_count'] += 1
                        # Simulate stress based on session duration (in real implementation, use actual stress data)
                        # For now, calculate based on continuous presence
                        stress_values = interval_data[time_label]['stress_values']
                        base_stress = 20 + (len(stress_values) * 2)  # Stress increases over time
                        stress_values.append(min(base_stress, 80))
            except:
                continue
        
        # Convert to output format
        for time_label in sorted(interval_data.keys()):
            data = interval_data[time_label]
            if data['stress_values']:
                avg_stress = sum(data['stress_values']) / len(data['stress_values'])
            else:
                avg_stress = 0
            
            # Calculate anxiety and calm from stress
            anxiety = max(0, avg_stress - 15)
            calm = max(0, 100 - avg_stress - anxiety)
            
            stress_data.append({
                'time': time_label,
                'stress': round(avg_stress),
                'anxiety': round(anxiety),
                'calm': round(calm)
            })
        
        # Calculate summary
        if stress_data:
            peak_stress = max(stress_data, key=lambda x: x['stress'])
            avg_anxiety = sum(d['anxiety'] for d in stress_data) / len(stress_data)
            avg_calm = sum(d['calm'] for d in stress_data) / len(stress_data)
        else:
            peak_stress = {'stress': 0, 'time': 'N/A'}
            avg_anxiety = 0
            avg_calm = 100
        
        return jsonify({
            'history': stress_data,
            'summary': {
                'peakStress': peak_stress['stress'],
                'peakTime': peak_stress['time'],
                'averageAnxiety': round(avg_anxiety),
                'averageCalm': round(avg_calm)
            }
        })
        
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/dashboard_stats', methods=['GET'])
def get_dashboard_stats():
    """Get main dashboard statistics"""
    device_id = request.args.get('deviceId', 'ESP32-lamp')
    
    try:
        # Get today's sessions
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_iso = today_start.strftime('%Y-%m-%dT%H:%M:%S.000Z')
        
        response = presence_table.query(
            KeyConditionExpression=Key('deviceId').eq(device_id) & Key('timestamp').gte(today_iso)
        )
        
        items = decimal_to_float(response.get('Items', []))
        sessions = calculate_sessions(items)
        
        # Calculate session time
        total_minutes = sum(s.get('duration_minutes', 0) for s in sessions)
        hours = int(total_minutes // 60)
        minutes = int(total_minutes % 60)
        session_time = f"{hours}h {minutes}m"
        
        # Calculate focus score
        focus_score = calculate_focus_score(sessions, 8)
        
        # Get current sensor status
        latest_response = presence_table.query(
            KeyConditionExpression=Key('deviceId').eq(device_id),
            ScanIndexForward=False,
            Limit=1
        )
        
        current_presence = False
        current_light = 0
        if latest_response.get('Items'):
            latest = decimal_to_float(latest_response['Items'][0])
            current_presence = latest.get('presence', False)
            current_light = latest.get('lighting') or latest.get('lightLevel', 0)
        
        return jsonify({
            'sessionTime': session_time,
            'totalMinutes': round(total_minutes, 1),
            'focusScore': focus_score,
            'sessionsToday': len(sessions),
            'currentPresence': current_presence,
            'currentLight': current_light,
            'lightQuality': get_light_quality(current_light)
        })
        
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/insights', methods=['GET'])
def get_insights():
    """Get smart insights based on sensor data"""
    device_id = request.args.get('deviceId', 'ESP32-lamp')
    
    try:
        # Get recent sensor data
        hours = 24
        cutoff_dt = datetime.now(timezone.utc) - timedelta(hours=hours)
        cutoff_iso_string = cutoff_dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')
        
        response = presence_table.query(
            KeyConditionExpression=Key('deviceId').eq(device_id) & Key('timestamp').gte(cutoff_iso_string)
        )
        
        items = decimal_to_float(response.get('Items', []))
        sessions = calculate_sessions(items)
        
        # Get latest sensor reading
        latest_response = presence_table.query(
            KeyConditionExpression=Key('deviceId').eq(device_id),
            ScanIndexForward=False,
            Limit=1
        )
        
        sensor_data = {}
        if latest_response.get('Items'):
            latest = decimal_to_float(latest_response['Items'][0])
            sensor_data = {
                'lightLevel': latest.get('lighting') or latest.get('lightLevel', 0),
                'presence': latest.get('presence', False),
                'stressLevel': latest.get('stressLevel', 30)  # Default moderate stress
            }
        
        # Get study trends for insights
        study_trends_response = get_study_trends_internal(device_id, 7)
        
        insights = generate_insights(sensor_data, sessions, study_trends_response.get('trends', []))
        
        return jsonify({'insights': insights})
        
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e), "insights": []})


def get_study_trends_internal(device_id, days):
    """Internal function to get study trends"""
    try:
        trends = []
        day_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        
        for i in range(days):
            day_offset = days - 1 - i
            target_date = datetime.now(timezone.utc) - timedelta(days=day_offset)
            start_of_day = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
            end_of_day = target_date.replace(hour=23, minute=59, second=59, microsecond=999999)
            
            start_iso = start_of_day.strftime('%Y-%m-%dT%H:%M:%S.000Z')
            end_iso = end_of_day.strftime('%Y-%m-%dT%H:%M:%S.999Z')
            
            response = presence_table.query(
                KeyConditionExpression=Key('deviceId').eq(device_id) & 
                    Key('timestamp').between(start_iso, end_iso)
            )
            
            items = decimal_to_float(response.get('Items', []))
            sessions = calculate_sessions(items)
            
            total_study_minutes = sum(s.get('duration_minutes', 0) for s in sessions)
            study_hours = round(total_study_minutes / 60, 1)
            focus_score = calculate_focus_score(sessions, 8)
            
            day_name = day_names[target_date.weekday()]
            
            trends.append({
                'day': day_name,
                'studyHours': study_hours,
                'focusScore': focus_score
            })
        
        return {'trends': trends}
    except:
        return {'trends': []}


# ============================================
# WEBSOCKET ENDPOINTS INFO
# ============================================

@app.route('/api/websocket_info', methods=['GET'])
def get_websocket_info():
    """Return WebSocket connection URLs for real-time data"""
    return jsonify({
        'presence': os.getenv('WEBSOCKET_PRESENCE_URL', 'wss://72mbqicisa.execute-api.ap-southeast-1.amazonaws.com/production/'),
        'ambient': os.getenv('WEBSOCKET_AMBIENT_URL', 'wss://7ii4srym84.execute-api.ap-southeast-1.amazonaws.com/production/'),
        'instructions': 'Connect to these WebSocket URLs for real-time sensor updates'
    })


if __name__ == '__main__':
    debug_mode = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
    port = int(os.getenv('FLASK_PORT', 5000))
    app.run(debug=debug_mode, port=port, host='0.0.0.0')