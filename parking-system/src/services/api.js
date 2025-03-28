import axios from 'axios';

const API_URL = 'http://localhost:5000/api';  // Make sure this is correct!

export const login = async (username, password) => {
    const response = await axios.post(`${API_URL}/auth/login`, { username, password });
    return response.data;
};

export const register = async (username, password) => {
    return await axios.post(`${API_URL}/auth/register`, { username, password });
};

export const getParkingSpots = async () => {
    return await axios.get(`${API_URL}/parking`);
};

export const updateParkingSpot = async (id, status, user_id) => {
    return await axios.post(`${API_URL}/parking/update`, { id, status, user_id });
};

export const getLogs = async () => {
    return await axios.get(`${API_URL}/logs`);
};
