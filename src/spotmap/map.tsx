enum centerTypes {
    ALL = 'all',
    LAST = 'last',
    LAST_TRIP = 'last-trip',
}
type MapProps = {
    autoUpdate: boolean;
    mapCenter: centerTypes;
}
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

import 'leaflet/dist/leaflet.css'
import React, { Component } from 'react';


class Map extends Component {
    constructor(props) {
        super(props);
        this.state = {
            points: [
                { lat: 51.505, lng: -0.09, name: 'London' },
                { lat: 48.8566, lng: 2.3522, name: 'Paris' },
                { lat: 40.7128, lng: -74.006, name: 'New York' }
            ]
        };
        console.log(props)
    }
    render(): React.ReactNode {
        const { points } = this.state;
        this.props.setAttributes({ map: "yes!" });
        return (
            <MapContainer style={{ width: '100%', height: '100%', }} center={[51.505, -0.09]} zoom={13} scrollWheelZoom={false}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {points.map((point, index) => (
                    <Marker key={index} position={[point.lat, point.lng]}>
                        <Popup>{point.name}</Popup>
                    </Marker>
                ))}
            </MapContainer>)

    }
}

export default Map;
