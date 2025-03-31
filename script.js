document.addEventListener('DOMContentLoaded', function() {
    // Configuration
    const API_URL = 'http://localhost:5000/api'; // Change this to your actual API URL
    let isLoggedIn = false;
    let userData = null;
    let parkingData = [];
    
    // DOM Elements
    const parkingLotElement = document.getElementById('parkingLot');
    const totalSpotsElement = document.getElementById('totalSpots');
    const availableSpotsElement = document.getElementById('availableSpots');
    const occupiedSpotsElement = document.getElementById('occupiedSpots');
    const activityLogElement = document.getElementById('activityLog');
    const usernameElement = document.getElementById('username');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginCloseBtn = document.querySelector('#loginModal .close');
    const registerCloseBtn = document.querySelector('#registerModal .close');
    
    // Event Listeners
    loginBtn.addEventListener('click', openLoginModal);
    registerBtn.addEventListener('click', openRegisterModal);
    logoutBtn.addEventListener('click', logout);
    loginCloseBtn.addEventListener('click', closeLoginModal);
    registerCloseBtn.addEventListener('click', closeRegisterModal);
    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
    
    // Click outside modal to close
    window.addEventListener('click', function(event) {
        if (event.target == loginModal) {
            closeLoginModal();
        }
        if (event.target == registerModal) {
            closeRegisterModal();
        }
    });
    
    // Initialize app
    initializeApp();
    
    // Functions
    function initializeApp() {
        checkLoginStatus();
        fetchParkingData();
        fetchActivityLogs();
        
        // Set up polling for real-time updates
        setInterval(fetchParkingData, 5000); // Update parking data every 5 seconds
        setInterval(fetchActivityLogs, 10000); // Update logs every 10 seconds
    }
    
    function checkLoginStatus() {
        const token = localStorage.getItem('parkingToken');
        
        if (token) {
            isLoggedIn = true;
            try {
                // Decode JWT to get user info (simple decode, not verification)
                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                
                userData = JSON.parse(jsonPayload);
                updateUIForLoggedInUser();
            } catch (e) {
                console.error('Error parsing token:', e);
                logout();
            }
        } else {
            isLoggedIn = false;
            userData = null;
            updateUIForLoggedOutUser();
        }
    }
    
    function updateUIForLoggedInUser() {
        usernameElement.textContent = `Logged in (User ID: ${userData.id})`;
        loginBtn.style.display = 'none';
        registerBtn.style.display = 'none';
        logoutBtn.style.display = 'block';
    }
    
    function updateUIForLoggedOutUser() {
        usernameElement.textContent = 'Not logged in';
        loginBtn.style.display = 'block';
        registerBtn.style.display = 'block';
        logoutBtn.style.display = 'none';
    }
    
    function openLoginModal() {
        loginModal.style.display = 'block';
    }
    
    function closeLoginModal() {
        loginModal.style.display = 'none';
        loginForm.reset();
    }
    
    function openRegisterModal() {
        registerModal.style.display = 'block';
    }
    
    function closeRegisterModal() {
        registerModal.style.display = 'none';
        registerForm.reset();
    }
    
    async function handleLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('username-field').value;
        const password = document.getElementById('password').value;
        
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                localStorage.setItem('parkingToken', data.token);
                closeLoginModal();
                checkLoginStatus();
                alert('Login successful!');
            } else {
                alert(`Login failed: ${data.message || 'Invalid credentials'}`);
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Login failed. Please try again.');
        }
    }
    
    async function handleRegister(e) {
        e.preventDefault();
        
        const username = document.getElementById('reg-username').value;
        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-confirm-password').value;
        
        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }
        
        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            if (response.ok) {
                alert('Registration successful! Please log in.');
                closeRegisterModal();
                openLoginModal();
            } else {
                const data = await response.json();
                alert(`Registration failed: ${data.message || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Registration error:', error);
            alert('Registration failed. Please try again.');
        }
    }
    
    function logout() {
        localStorage.removeItem('parkingToken');
        isLoggedIn = false;
        userData = null;
        updateUIForLoggedOutUser();
    }
    
    async function fetchParkingData() {
        try {
            const response = await fetch(`${API_URL}/parking`);
            const data = await response.json();
            
            if (response.ok) {
                parkingData = data;
                updateParkingUI();
            } else {
                console.error('Failed to fetch parking data');
            }
        } catch (error) {
            console.error('Error fetching parking data:', error);
        }
    }
    
    async function fetchActivityLogs() {
        try {
            const response = await fetch(`${API_URL}/logs`);
            const data = await response.json();
            
            if (response.ok) {
                updateActivityLogsUI(data);
            } else {
                console.error('Failed to fetch activity logs');
            }
        } catch (error) {
            console.error('Error fetching activity logs:', error);
        }
    }
    
    function updateParkingUI() {
        // Clear existing spots
        parkingLotElement.innerHTML = '';
        
        // Update stats
        const totalSpots = parkingData.length;
        const occupiedSpots = parkingData.filter(spot => spot.status === 'occupied').length;
        const availableSpots = totalSpots - occupiedSpots;
        
        totalSpotsElement.textContent = totalSpots;
        availableSpotsElement.textContent = availableSpots;
        occupiedSpotsElement.textContent = occupiedSpots;
        
        // Create parking spot elements
        parkingData.forEach(spot => {
            const isVacant = spot.status !== 'occupied';
            const spotElement = document.createElement('div');
            spotElement.className = `parking-spot ${isVacant ? 'vacant' : 'occupied'}`;
            spotElement.innerHTML = `
                <div class="spot-id">Spot ${spot.id}</div>
                <i class="fas ${isVacant ? 'fa-check-circle' : 'fa-car'}"></i>
                <div>${isVacant ? 'Available' : 'Occupied'}</div>
            `;
            
            // Add click handler for spot interaction
            spotElement.addEventListener('click', () => handleSpotClick(spot));
            
            parkingLotElement.appendChild(spotElement);
        });
    }
    
    function updateActivityLogsUI(logs) {
        // Clear existing logs
        activityLogElement.innerHTML = '';
        
        // Show most recent 20 logs
        const recentLogs = logs.slice(0, 20);
        
        recentLogs.forEach(log => {
            const logItem = document.createElement('div');
            logItem.className = 'activity-item';
            
            const actionText = log.action === 'entry' ? 'parked in' : 'left';
            // Use username if available, otherwise fallback to user ID or "Unknown user"
            const userText = log.username ? `${log.username}` : 
                             (log.user_id ? `User ${log.user_id}` : 'Unknown user');
            
            logItem.innerHTML = `
                <div>${userText} ${actionText} spot ${log.spot_id}</div>
                <div class="timestamp">${new Date(log.timestamp).toLocaleString()}</div>
            `;
            
            activityLogElement.appendChild(logItem);
        });
        
        // If no logs found
        if (recentLogs.length === 0) {
            activityLogElement.innerHTML = '<div class="activity-item">No activity recorded yet.</div>';
        }
    }
    
    async function handleSpotClick(spot) {
        if (!isLoggedIn) {
            alert('Please log in to interact with parking spots');
            return;
        }
        
        const isVacant = spot.status !== 'occupied';
        const action = isVacant ? 'park in' : 'leave';
        
        if (confirm(`Do you want to ${action} spot ${spot.id}?`)) {
            const newStatus = isVacant ? 'occupied' : 'vacant';
            
            try {
                const token = localStorage.getItem('parkingToken');
                const response = await fetch(`${API_URL}/parking/update`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        id: spot.id,
                        status: newStatus,
                        user_id: userData.id
                    })
                });
                
                if (response.ok) {
                    // Update data immediately
                    fetchParkingData();
                    fetchActivityLogs();
                    alert(`Successfully ${action} spot ${spot.id}`);
                } else {
                    const errorData = await response.json();
                    alert(`Failed to update: ${errorData.message || 'Unknown error'}`);
                }
            } catch (error) {
                console.error('Error updating spot:', error);
                alert('Failed to update parking spot. Please try again.');
            }
        }
    }
    
    // For demo purposes - generate some sample data if no data is available
    function generateSampleData() {
        const sampleData = [];
        for (let i = 1; i <= 16; i++) {
            sampleData.push({
                id: i,
                status: Math.random() > 0.5 ? 'vacant' : 'occupied',
                user_id: Math.random() > 0.7 ? Math.floor(Math.random() * 10) + 1 : null
            });
        }
        parkingData = sampleData;
        updateParkingUI();
    }
    
    // If API fails, use sample data for demonstration
    setTimeout(() => {
        if (parkingData.length === 0) {
            console.log('Using sample data for demonstration');
            generateSampleData();
        }
    }, 3000);
});