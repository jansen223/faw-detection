from flask import Flask, request, jsonify
from flask_cors import CORS
import exifread
import io
from PIL import Image, ImageDraw
from ultralytics import YOLO
import numpy as np
import base64
from io import BytesIO

app = Flask(__name__)
CORS(app)

# Load YOLOv8 model
model = YOLO('best.pt')  # Your trained model

def decimal_coords(coords, ref):
    decimal = float(coords[0] + coords[1]/60 + coords[2]/3600)
    if ref in ['S', 'W']:
        decimal = -decimal
    return decimal

@app.route('/api/detect', methods=['POST'])
def detect():
    if 'images' not in request.files:
        return jsonify({'error': 'No images uploaded'}), 400

    images = request.files.getlist('images')
    results = []

    for image_file in images:
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
        draw = ImageDraw.Draw(img)
        detection_results = model(img)

        # Process detections
        detections = []
        infested = False
        max_confidence = 0

        for result in detection_results:
            boxes = result.boxes
            for box in boxes:
                if box.cls == 0:  # Assuming 0 is infested class
                    infested = True
                    confidence = float(box.conf)
                    max_confidence = max(max_confidence, confidence)
                    x1, y1, x2, y2 = box.xyxy[0]
                    detections.append({
                        'x1': float(x1),
                        'y1': float(y1),
                        'x2': float(x2),
                        'y2': float(y2),
                        'confidence': confidence
                    })
                    # Draw bounding box
                    draw.rectangle([x1, y1, x2, y2], outline="red", width=3)
                    draw.text((x1, y1 - 10), f"{confidence:.2f}", fill="red")

        # Convert image to base64
        buffered = BytesIO()
        img.save(buffered, format="JPEG")
        img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')

        results.append({
            'infested': infested,
            'confidence': max_confidence,
            'detections': detections,
            'gps': gps_data,
            'image': img_base64
        })

    return jsonify(results)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)