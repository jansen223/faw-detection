import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

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
  const [selectedImage, setSelectedImage] = useState(null); // For modal

  const { getRootProps, getInputProps } = useDropzone({
    accept: 'image/*',
    multiple: true, // Allow multiple files
    onDrop: async (acceptedFiles) => {
      const formData = new FormData();
      acceptedFiles.forEach((file) => formData.append('images', file));

      try {
        const response = await fetch('http://localhost:5000/api/detect', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        setResults(data);

        const gpsPoints = data
          .filter((item) => item.gps.lat && item.gps.lon)
          .map((item) => ({
            lat: item.gps.lat,
            lng: item.gps.lon,
            infested: item.infested,
            confidence: item.confidence,
          }));
        setMapData(gpsPoints);
      } catch (error) {
        console.error('Error:', error);
      }
    },
  });

  return (
    <div className="App">
      <div {...getRootProps({ className: 'dropzone' })}>
        <input {...getInputProps()} />
        <p>Drag and drop images here, or click to select files</p>
      </div>

      {results.length > 0 && (
        <div className="image-gallery">
          {results.map((result, idx) => (
            <div key={idx} className="image-item" onClick={() => setSelectedImage(result.image)}>
              <h4>Image {idx + 1}</h4>
              <img
                src={`data:image/jpeg;base64,${result.image}`}
                alt={`Processed ${idx + 1}`}
              />
              <p>Status: {result.infested ? 'INFESTED' : 'HEALTHY'}</p>
              <p>Confidence: {(result.confidence * 100).toFixed(1)}%</p>
              {result.gps.lat && result.gps.lon && (
                <p>GPS: {result.gps.lat.toFixed(6)}, {result.gps.lon.toFixed(6)}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedImage && (
        <div className="modal" onClick={() => setSelectedImage(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <img src={`data:image/jpeg;base64,${selectedImage}`} alt="Zoomed" />
          </div>
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
              attribution="&copy; OpenStreetMap contributors"
            />
            {mapData.map((point, idx) => (
              <Marker key={idx} position={[point.lat, point.lng]}>
                <Popup>
                  {point.infested ? 'Infested Area' : 'Healthy Area'}
                  <br />
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