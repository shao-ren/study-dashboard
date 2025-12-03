from flask import Flask, jsonify, request
import boto3
from boto3.dynamodb.conditions import Key, Attr
from datetime import datetime, timedelta, timezone
from flask_cors import CORS
from decimal import Decimal
import json
import os
from dotenv import load_dotenv
import time

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
presence_table = dynamodb.Table('ProximitySensorData')
ambient_table = dynamodb.Table('AmbientSensorData')
stress_table = dynamodb.Table('FaceDetections')

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

def sanitize_light_level(value):
    """Ensure light level is valid (non-negative). Returns None if invalid."""
    if value is None:
        return None
    try:
        float_val = float(value)
        if float_val < 0:
            return None
        return float_val
    except (TypeError, ValueError):
        return None

def get_light_quality(lux_level):
    """Determine light quality based on lux level"""
    # Handle invalid readings (negative or None)
    if lux_level is None or lux_level < 0:
        return {'status': 'Sensor Offline', 'color': '#6b7280', 'optimal': False, 'connected': False}
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

def calculate_sessions(raw_data, timeout_threshold=900): # 15min timeout
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

def generate_insights(sensor_data, sessions, study_trends):
    """Generate smart insights based on sensor data and patterns"""
    insights = []
    insight_id = 1
    
    light_level = sensor_data.get('lightLevel')
    light_connected = sensor_data.get('lightSensorConnected', light_level is not None)
    
    if not light_connected or light_level is None:
        insights.append({
            'id': insight_id,
            'type': 'warning',
            'title': 'Light Sensor Offline',
            'description': 'Unable to read light levels. Please check the sensor connection.',
            'icon': 'alert'
        })
        insight_id += 1
    elif light_level is not None:
        light_quality = get_light_quality(light_level)
        if light_quality['optimal']:
            insights.append({
                'id': insight_id,
                'type': 'success',
                'title': 'Lighting Conditions Optimal',
                'description': f"Current light level ({int(light_level)} lux) is perfect for focus. Maintain this environment.",
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

# done
@app.route('/api/dashboard_stats', methods=['GET'])
def get_dashboard_stats():
    """Get main dashboard statistics"""
    hours = int(request.args.get('hours', 24))
    cutoff_dt = datetime.now(timezone.utc) - timedelta(hours=hours)
    cutoff_iso_string = cutoff_dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')
    
    items = []
    try:
        # Get today's sessions
        query_kwargs = {
            'KeyConditionExpression': Key('deviceId').eq('esp32-ultrasonic') & Key('timestamp').gte(cutoff_iso_string),
            'ScanIndexForward': True,
        }
        while True:
            response = presence_table.query(**query_kwargs)
            # print(response)
            items.extend(response.get('Items', []))

            last_key = response.get('LastEvaluatedKey')
            if not last_key:
                break
            query_kwargs['ExclusiveStartKey'] = last_key

        sessions = calculate_sessions(items)
        
        # Calculate session time
        latest_start_time = sessions[-1]['start']
        latest_end_time = sessions[-1]['end']
        time_now = int(time.time())

        if (time_now - latest_end_time) <= 150:
            total_seconds = time_now - latest_start_time
            # print(latest_start_time, time_now, total_seconds)
            
            session_hours = int(total_seconds // 3600)
            session_minutes = int((total_seconds & 3600) // 60)
            session_seconds = int(total_seconds % 60)
            session_time = f"{session_hours}h {session_minutes}m {session_seconds}s"
            # print(f"session time: {session_time}")
        else:
            session_time = "0h 0m 0s"

        # Calculate focus score
        focus_score = calculate_focus_score(sessions, 8)
        
        # Get current sensor status
        latest_presence = presence_table.query(
            KeyConditionExpression=Key('deviceId').eq('esp32-ultrasonic'),
            ScanIndexForward=False,
            Limit=1
        )

        latest_ambience = ambient_table.query(
            KeyConditionExpression=Key('deviceId').eq('esp32-light'),
            ScanIndexForward=False,
            Limit=1
        )

        latest_camera = stress_table.query(
            KeyConditionExpression=Key('deviceId').eq('esp32-camera'),
            ScanIndexForward=False,
            Limit=1
        )

        raw_light = latest_ambience['Items'][0].get('ambientLux') if latest_ambience.get('Items') else None
        light_level = sanitize_light_level(raw_light)
        
        presence_detected = latest_presence['Items'][0].get('presence', False) if latest_presence.get('Items') else False
        emotion_state = latest_camera['Items'][0].get('primaryEmotion', 'Calm') if latest_camera.get('Items') else 'Calm'
        stress_level = latest_camera['Items'][0].get('stressScore', 0.0) if latest_camera.get('Items') else 0.0
        
        return jsonify({
            'sessionTime': session_time,
            'focusScore': focus_score,
            'lightLevel': light_level,  # Will be None if sensor offline
            'lightSensorConnected': light_level is not None,
            'presenceDetected': presence_detected,
            'emotionState': emotion_state.capitalize() if emotion_state else 'Calm',
            'stressLevel': decimal_to_float(stress_level) * 100,
        })
        
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

# done
@app.route('/api/productivity', methods=['GET'])
def get_productivity():
    """Get productivity data by time of day"""
    device_id = request.args.get('deviceId', 'esp32-ultrasonic')
    days = int(request.args.get('days', 7))
    
    try:
        # Initialize hourly buckets
        weekly_stats = {
            day: {hour: {'total': 0, 'present': 0} for hour in range(24)} for day in range(7)
        }
        
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
                    sgt_zone = timezone(timedelta(hours=8))
                    dt_sgt = dt.astimezone(sgt_zone)
                    
                    # Extract Day and Hour
                    day_idx = dt_sgt.weekday() # 0=Mon, 6=Sun
                    hour = dt_sgt.hour         # 0-23
                    
                    weekly_stats[day_idx][hour]['total'] += 1
                    if item.get('presence', False):
                        weekly_stats[day_idx][hour]['present'] += 1
            except:
                continue
        
        # Calculate productivity percentage for each hour
        days_map = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        productivity_data = []
        
        for day_idx in range(7):
            for hour in range(24):
                stats = weekly_stats[day_idx][hour]
                total = stats['total']
                present = stats['present']
                
                score = round((present / total) * 100) if total > 0 else 0
                
                productivity_data.append({
                    'day': days_map[day_idx], # "Mon", "Tue"...
                    'hour': hour,             # 0, 1, 2... 23
                    'productivity': score,
                    'dataPoints': total
                })
        
        return jsonify({'data': productivity_data})
        
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

# done
@app.route('/api/insights', methods=['GET'])
def get_insights():
    """Get smart insights based on sensor data"""
    try:
        # Get recent sensor data
        hours = 24
        cutoff_dt = datetime.now(timezone.utc) - timedelta(hours=hours)
        cutoff_iso_string = cutoff_dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')
        
        response = presence_table.query(
            KeyConditionExpression=Key('deviceId').eq("esp32-ultrasonic") & Key('timestamp').gte(cutoff_iso_string)
        )
        
        items = decimal_to_float(response.get('Items', []))
        sessions = calculate_sessions(items)
        
        # Get latest sensor reading
        latest_presence = presence_table.query(
            KeyConditionExpression=Key('deviceId').eq('esp32-ultrasonic'),
            ScanIndexForward=False,
            Limit=1
        )

        latest_ambience = ambient_table.query(
            KeyConditionExpression=Key('deviceId').eq('esp32-light'),
            ScanIndexForward=False,
            Limit=1
        )

        latest_camera = stress_table.query(
            KeyConditionExpression=Key('deviceId').eq('esp32-camera'),
            ScanIndexForward=False,
            Limit=1
        )

        raw_light = latest_ambience['Items'][0].get('ambientLux') if latest_ambience.get('Items') else None
        light_level = sanitize_light_level(raw_light)
        
        presence_detected = latest_presence['Items'][0].get('presence', False) if latest_presence.get('Items') else False
        stress_level = latest_camera['Items'][0].get('stressScore', 0.0) if latest_camera.get('Items') else 0.0

        sensor_data = {
            'lightLevel': light_level,  # Can be None
            'lightSensorConnected': light_level is not None,
            'presenceDetected': presence_detected,
            'stressLevel': stress_level
        }
        
        # Get study trends for insights
        study_trends_response = get_study_trends_internal(7)
        # print(sensor_data, study_trends_response)

        insights = generate_insights(sensor_data, sessions, study_trends_response.get('trends', []))
        print(insights)
        
        return jsonify({'insights': insights})
        
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e), "insights": []})

def get_study_trends_internal(days):
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
                KeyConditionExpression=Key('deviceId').eq('esp32-ultrasonic') & 
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

# done
@app.route('/api/sensors/latest', methods=['GET'])
def get_latest_sensor_data():
    """Get the most recent readings from all sensors"""
    try:
        # Get latest presence data
        latest_presence = presence_table.query(
            KeyConditionExpression=Key('deviceId').eq('esp32-ultrasonic'),
            ScanIndexForward=False,
            Limit=1
        )

        latest_ambience = ambient_table.query(
            KeyConditionExpression=Key('deviceId').eq('esp32-light'),
            ScanIndexForward=False,
            Limit=1
        )

        latest_camera = stress_table.query(
            KeyConditionExpression=Key('deviceId').eq('esp32-camera'),
            ScanIndexForward=False,
            Limit=1
        )

        raw_light = latest_ambience['Items'][0].get('ambientLux') if latest_ambience.get('Items') else None
        light_level = sanitize_light_level(raw_light)
        
        presence_detected = latest_presence['Items'][0].get('presence', False) if latest_presence.get('Items') else False
        distance_cm = latest_presence['Items'][0].get('distanceCm', 0.0) if latest_presence.get('Items') else 0.0
        emotion_state = latest_camera['Items'][0].get('primaryEmotion', 'Calm') if latest_camera.get('Items') else 'Calm'
        stress_level = latest_camera['Items'][0].get('stressScore', 0.0) if latest_camera.get('Items') else 0.0
        
        return jsonify({
            'lightLevel': light_level,  # Will be None if sensor offline
            'lightSensorConnected': light_level is not None,
            'presenceDetected': presence_detected,
            'distanceCm': decimal_to_float(distance_cm),
            'emotionState': emotion_state.capitalize() if emotion_state else 'Calm',
            'stressLevel': decimal_to_float(stress_level) * 100,
        })
        
    except Exception as e:
        print(f"Error fetching latest sensor data: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/study_trends', methods=['GET'])
def get_study_trends():
    """Get weekly study patterns"""
    device_id = request.args.get('deviceId', 'esp32-ultrasonic')
    days = int(request.args.get('days', 7))
    
    try:
        # Get data for the past week
        trends = []
        day_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        
        sgt_offset = timedelta(hours=8)
        
        for i in range(days):
            day_offset = days - 1 - i
            
            # Calculate day boundaries in SGT, then convert to UTC for query
            now_utc = datetime.now(timezone.utc)
            now_sgt = now_utc + sgt_offset
            target_date_sgt = now_sgt - timedelta(days=day_offset)
            
            # Start and end of day in SGT
            start_of_day_sgt = target_date_sgt.replace(hour=0, minute=0, second=0, microsecond=0)
            end_of_day_sgt = target_date_sgt.replace(hour=23, minute=59, second=59, microsecond=999999)
            
            # Convert back to UTC for DynamoDB query
            start_of_day_utc = start_of_day_sgt - sgt_offset
            end_of_day_utc = end_of_day_sgt - sgt_offset
            
            start_iso = start_of_day_utc.strftime('%Y-%m-%dT%H:%M:%S.000Z')
            end_iso = end_of_day_utc.strftime('%Y-%m-%dT%H:%M:%S.999Z')
            
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
            
            day_name = day_names[target_date_sgt.weekday()]
            
            trends.append({
                'day': day_name,
                'date': target_date_sgt.strftime('%Y-%m-%d'),
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

# done
@app.route('/api/stress_history', methods=['GET'])
def get_stress_history():
    """Get stress level history for the current session"""
    device_id = request.args.get('deviceId', 'esp32-camera')
    hours = int(request.args.get('hours', 6))  # Default to last 4 hours for session view
    
    try:
        cutoff_dt = datetime.now(timezone.utc) - timedelta(hours=hours)
        cutoff_iso_string = cutoff_dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')
        
        response = stress_table.query(
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
                    sgt_zone = timezone(timedelta(hours=8))
                    dt_sgt = dt.astimezone(sgt_zone)
                    # Round to 30-minute interval
                    interval_key = dt_sgt.replace(minute=30 if dt.minute >= 30 else 0, second=0, microsecond=0)
                    time_label = interval_key.strftime('%H:%M')
                    
                    if time_label not in interval_data:
                        interval_data[time_label] = {
                            'stress_values': [],
                            'total_count': 0
                        }
                    
                    interval_data[time_label]['total_count'] += 1
                    stress_values = interval_data[time_label]['stress_values']
                    base_stress = 20 + (len(stress_values) * 2)  # Stress increases over time
                    stress_values.append(min(base_stress, 80))
                    interval_data[time_label]['stress_values'] = stress_values
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

# done
@app.route('/api/presence_history', methods=['GET'])
def get_presence_history():
    """Get presence history and calculated sessions"""
    now = datetime.now(timezone.utc)
    sgt_offset = timedelta(hours=8)
    now_sgt = now + sgt_offset
    cutoff_dt = now_sgt.replace(hour=0, minute=0, second=0, microsecond=0)
    cutoff_utc = cutoff_dt - sgt_offset
    cutoff_iso_string = cutoff_utc.strftime('%Y-%m-%dT%H:%M:%S.000Z')

    try:
        response = presence_table.query(
            KeyConditionExpression=Key('deviceId').eq('esp32-ultrasonic') & Key('timestamp').gte(cutoff_iso_string)
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

# ============================================
# WEBSOCKET ENDPOINTS INFO
# ============================================

@app.route('/api/websocket_info', methods=['GET'])
def get_websocket_info():
    """Return WebSocket connection URLs for real-time data"""
    return jsonify({
        'presence': os.getenv('WEBSOCKET_PRESENCE_URL', 'wss://72mbqicisa.execute-api.ap-southeast-1.amazonaws.com/production/'),
        'ambient': os.getenv('WEBSOCKET_AMBIENT_URL', 'wss://7ii4srym84.execute-api.ap-southeast-1.amazonaws.com/production/'),
        'camera': os.getenv('CAMERA_API_URL', 'https://20lv30hxm5.execute-api.ap-southeast-1.amazonaws.com/production/detections'),
        'instructions': 'Connect to these WebSocket URLs for real-time sensor updates'
    })


if __name__ == '__main__':
    debug_mode = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
    port = int(os.getenv('FLASK_PORT', 5000))
    app.run(debug=debug_mode, port=port, host='0.0.0.0')