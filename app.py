from flask import Flask, jsonify, request
import boto3
from boto3.dynamodb.conditions import Key
from datetime import datetime, timedelta, timezone
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

dynamodb = boto3.resource(
    'dynamodb',
    region_name='ap-southeast-1',
    aws_access_key_id='AKIAYIIXBU65ZGLW4BGD',
    aws_secret_access_key='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') 
    # change to env variables or smething
table = dynamodb.Table('ProximitySensorData')


def calculate_sessions(raw_data):
    if not raw_data:
        return []
    
    active_moments = []
    for item in raw_data:
        if item.get('presence') is True:
            temp_item = {'presence': item.get('presence'), 'distanceCM': item.get('distanceCm'), 'unixTimestamp': item.get('unixTimestamp')}
            active_moments.append(temp_item)
    active_moments.sort(key=lambda x: x['unixTimestamp'])
    # print(active_moments)

    if not active_moments:
        return []

    sessions = []
    
    # first session
    current_session = {
        'start': active_moments[0]['unixTimestamp'],
        'end': active_moments[0]['unixTimestamp'],
    }
    
    # TIMEOUT_THRESHOLD = 15 * 60  # 15 minutes in seconds
    TIMEOUT_THRESHOLD = 60

    for i in range(1, len(active_moments)):
        current = active_moments[i]['unixTimestamp']
        prev = active_moments[i-1]['unixTimestamp']

        if (current - prev) <= TIMEOUT_THRESHOLD:
            # extend session
            current_session['end'] = current
        else:
            # close session
            duration_min = (current_session['end'] - current_session['start']) / 60
            current_session['duration_minutes'] = round(duration_min, 2)
            sessions.append(current_session)
            
            # new session
            current_session = {
                'start': current,
                'end': current
            }
    duration_min = (current_session['end'] - current_session['start']) / 60
    current_session['duration_minutes'] = round(duration_min, 2)
    sessions.append(current_session)

    print(sessions)

    return sessions

@app.route('/api/presence_history', methods=['GET'])
def get_presence_history():
    device_id = request.args.get('deviceId', 'ESP32-lamp')
    hours = int(request.args.get('hours', 24))
    cutoff_dt = datetime.now(timezone.utc) - timedelta(hours=hours)
    cutoff_iso_string = cutoff_dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')

    print(cutoff_iso_string)

    try:
        response = table.query(
            KeyConditionExpression=Key('deviceId').eq(device_id) & Key('timestamp').gte(cutoff_iso_string)
        )
        # print(response)
        items = response.get('Items', [])
        
        calculated_sessions = calculate_sessions(items)

        return jsonify({
            "count": len(items),
            "sessions": calculated_sessions
        })
        
    except Exception as e:
        print(F"error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)