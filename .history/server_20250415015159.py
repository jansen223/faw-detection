from flask import Flask, request, jsonify
from flask_cors import CORS
import exifread
import io
from PIL import Image
from ultralytics import YOLO
import numpy as np

app = Flask(__name__)
CORS(app)

# Load YOLOv8 model
model = YOLO('best.pt')  # Your trained model

def decimal_coords(coords, ref):
    decimal = float(coords[0] + coords[1]/60 + coords[2]/3600)
    if ref in ['S', 'W']:
        decimal = -decimal
    return decimal

@app.route('/api/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'}), 400

    image_file = request.files['image']
    img_bytes = image_file.read()
    
    # Extract GPS data
    gps_data = {}
    tags = exifread.process_file(io.BytesIO(img_bytes), details=False)
    if 'GPS GPSLatitude' in tags and 'GPS GPSLongitude' in tags:
        lat = decimal_coords(tags['GPS GPSLatitude'].values,
                            tags['GPS GPSLatitudeRef'].values)
        lon = decimal_coords(tags['GPS GPSLongitude'].values,
                            tags['GPS GPSLongitudeRef'].values)
        gps_data = {'lat': lat, 'lon': lon}

    # Process image
    img = Image.open(io.BytesIO(img_bytes))
    results = model(img)
    
    # Process detections
    detections = []
    infested = False
    max_confidence = 0
    
    for result in results:
        boxes = result.boxes
        for box in boxes:
            if box.cls == 0:  # Assuming 0 is infested class
                infested = True
                confidence = float(box.conf)
                max_confidence = max(max_confidence, confidence)
                detections.append({
                    'x1': float(box.xyxy[0][0]),
                    'y1': float(box.xyxy[0][1]),
                    'x2': float(box.xyxy[0][2]),
                    'y2': float(box.xyxy[0][3]),
                    'confidence': confidence
                })

    return jsonify({
        'infested': infested,
        'confidence': max_confidence,
        'detections': detections,
        'gps': gps_data
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)