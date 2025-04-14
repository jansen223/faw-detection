import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

function App() {
  const [results, setResults] = useState([]);
  const [mapData, setMapData] = useState([]);
  const [image, setImage] = useState(null);

  const { getRootProps, getInputProps } = useDropzone({
    accept: 'image/*',
    maxFiles: 1,
    onDrop: async (acceptedFiles) => {
      const formData = new FormData();
      formData.append('image', acceptedFiles[0]);

      try {
        const response = await fetch('http://localhost:5000/api/predict', {
          method: 'POST',
          body: formData,
        });
        
        const data = await response.json();
        setResults(data.detections);
        setImage(data.image); // Set the base64 image
        
        if(data.gps.lat && data.gps.lon) {
          setMapData([{
            lat: data.gps.lat,
            lng: data.gps.lon,
            infested: data.infested,
            confidence: data.confidence
          }]);
        }
      } catch (error) {
        console.error('Error:', error);
      }
    }
  });

  return (
    <div className="App">
      <div {...getRootProps({ className: 'dropzone' })}>
        <input {...getInputProps()} />
        <p>Upload Drone Image</p>
      </div>

      {image && (
        <div className="image-container">
          <h3>Processed Image:</h3>
          <img src={`data:image/jpeg;base64,${image}`} alt="Processed" />
        </div>
      )}

      {results.length > 0 && (
        <div className="results">
          <h3>Detection Results:</h3>
          <p>Status: {mapData[0]?.infested ? 'INFESTED' : 'HEALTHY'}</p>
          <p>Confidence: {(mapData[0]?.confidence * 100).toFixed(1)}%</p>
        </div>
      )}

      {mapData.length > 0 && (
        <div className="map-container">
          <MapContainer
            center={[mapData[0].lat, mapData[0].lng]}
            zoom={18}
            style={{ height: '400px', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />
            {mapData.map((point, idx) => (
              <Marker key={idx} position={[point.lat, point.lng]}>
                <Popup>
                  {point.infested ? 'Infested Area' : 'Healthy Area'}<br/>
                  Confidence: {(point.confidence * 100).toFixed(1)}%
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
}

export default App;