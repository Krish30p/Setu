import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

// Fix default Leaflet icon paths in Vite builds
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Fallback regional geocoding coordinates for Karnataka districts
const DISTRICT_COORDS = {
    'Tumkur': { lat: 13.3409, lng: 77.1006 },
    'Mysuru': { lat: 12.2958, lng: 76.6394 },
    'Bengaluru Rural': { lat: 13.0900, lng: 77.5700 },
    'Mandya': { lat: 12.5218, lng: 76.8951 },
    'Chikmagalur': { lat: 13.3161, lng: 75.7720 }
};

export default function HotspotMapPage() {
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef([]);
    const [locations, setLocations] = useState([]);
    const [firs, setFirs] = useState([]);
    const [selectedStation, setSelectedStation] = useState(null);
    const [stationCases, setStationCases] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadGeospatialData = async () => {
        setLoading(true);
        try {
            const res = await fetch('http://localhost:5001/api/get-graph');
            const data = await res.json();
            if (data.status === 'success') {
                // Map real DB locations and resolve geo coordinates
                const resolvedLocations = (data.locations || []).map(loc => {
                    const lat = loc.latitude || (DISTRICT_COORDS[loc.district_name] ? DISTRICT_COORDS[loc.district_name].lat : 13.0);
                    const lng = loc.longitude || (DISTRICT_COORDS[loc.district_name] ? DISTRICT_COORDS[loc.district_name].lng : 77.0);
                    return {
                        ...loc,
                        lat,
                        lng
                    };
                });

                setLocations(resolvedLocations);
                setFirs(data.firs || []);
                updateMapMarkers(resolvedLocations, data.firs || []);
            }
        } catch (e) {
            console.error("Failed to load geospatial data:", e);
        } finally {
            setLoading(false);
        }
    };

    // Initialize map container once
    useEffect(() => {
        if (!mapContainerRef.current) return;

        const map = L.map(mapContainerRef.current).setView([13.0000, 76.9000], 8); // Centered in Southern Karnataka

        // Dark theme map tiles matching Outfit HSL palette
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
        }).addTo(map);

        mapInstanceRef.current = map;
        loadGeospatialData();

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    const updateMapMarkers = (locs, cases) => {
        const map = mapInstanceRef.current;
        if (!map) return;

        // Clear existing markers
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];

        locs.forEach(loc => {
            const stationCasesList = cases.filter(c => c.station_id === loc.location_id);
            const caseCount = stationCasesList.length;

            if (caseCount === 0) return;

            // Heat indicator radius & color styling based on case concentration
            const color = caseCount >= 3 ? '#ff5e62' : caseCount >= 2 ? '#ffb515' : '#2cb67d';
            const radius = 20000 + (caseCount * 5000);

            // 1. Heat circle overlay
            const circle = L.circle([loc.lat, loc.lng], {
                color: color,
                fillColor: color,
                fillOpacity: 0.25,
                radius: radius
            }).addTo(map);

            // 2. Map marker pin
            const marker = L.marker([loc.lat, loc.lng])
                .addTo(map)
                .bindPopup(`<b>${loc.station_name} Station</b><br/>District: ${loc.district_name}<br/>Active Cases: ${caseCount}`);

            marker.on('click', () => {
                setSelectedStation(loc);
                setStationCases(stationCasesList);
            });

            markersRef.current.push(circle, marker);
        });
    };

    return (
        <div className="chat-page-container">
            {/* Left Hand Panel: Leaflet Geospatial View */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <div>
                        <h3 style={{ margin: '0 0 5px 0' }}>SETU Hotspot Spatial Dashboard</h3>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                            Visualize case concentration and click markers to audit local incident filings.
                        </p>
                    </div>
                    <button className="send-btn" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={loadGeospatialData}>
                        Sync GPS Data
                    </button>
                </div>

                <div style={{ flex: 1, position: 'relative', minHeight: '520px' }}>
                    {loading && (
                        <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', color: 'var(--text-muted)', borderRadius: '8px' }}>
                            Loading maps overlay...
                        </div>
                    )}
                    <div 
                        ref={mapContainerRef} 
                        style={{ 
                            width: '100%',
                            height: '100%',
                            position: 'absolute',
                            inset: 0,
                            border: '1px solid rgba(255, 255, 255, 0.05)', 
                            borderRadius: '8px', 
                            background: '#16171d'
                        }} 
                    />
                </div>
            </div>

            {/* Right Hand Panel: Cases List by selected station */}
            <div className="glass-panel" style={{ height: 'fit-content', minWidth: '320px' }}>
                <h4 className="side-panel-header">Station Incident Log</h4>

                {selectedStation ? (
                    <div>
                        <div style={{ marginBottom: '15px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Selected Station:</span>
                            <h3 style={{ margin: '3px 0 0 0', color: 'var(--primary-hover)' }}>{selectedStation.station_name}</h3>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{selectedStation.district_name} District</div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {stationCases.map(c => (
                                <div key={c.fir_id} className="evidence-card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                        <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--accent)' }}>{c.fir_id}</span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.filing_date}</span>
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px' }}>
                                        Crime Type: <span style={{ color: 'var(--text-main)' }}>{c.crime_type}</span>
                                    </div>
                                    <p style={{ fontSize: '12px', margin: 0, fontStyle: 'italic', color: 'var(--text-muted)' }}>
                                        "{c.raw_text}"
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '14px' }}>
                        Click on any map marker pin to retrieve the local station incident ledger.
                    </div>
                )}
            </div>
        </div>
    );
}
