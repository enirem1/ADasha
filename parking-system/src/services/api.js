import axios from 'axios';

const API_URL = 'http://localhost:5000/api';  // Make sure this matches your backend

export const getParkingSpots = async () => {
    try {
        const response = await axios.get(`${API_URL}/parking`);
        return response.data;
    } catch (error) {
        console.error('Error fetching parking spots:', error);
        return [];
    }
};
