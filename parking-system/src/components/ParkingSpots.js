import React, { useEffect, useState } from 'react';
import { getParkingSpots } from '../services/api';

const ParkingSpots = () => {
    const [spots, setSpots] = useState([]);

    useEffect(() => {
        fetchSpots();
    }, []);

    const fetchSpots = async () => {
        const data = await getParkingSpots();
        setSpots(data);
    };

    return (
        <div>
            <h2>Parking Spots</h2>
            {spots.length > 0 ? (
                <ul>
                    {spots.map(spot => (
                        <li key={spot.id}>
                            Spot {spot.id} - {spot.status}
                        </li>
                    ))}
                </ul>
            ) : (
                <p>No spots available</p>
            )}
        </div>
    );
};

export default ParkingSpots;
