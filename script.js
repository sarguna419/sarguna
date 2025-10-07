// Student names in alphabetical order
const students = [
    'appu',
    'deva',
    'gopi',
    'kishore',
    'Lokesh',
    'praveen',
    'prabu',
    'sanjay',
    'santosh',
    'sarguna',
    'satheesh',
    'tharun',
    'tharun.s',
    'thirukumaran',
    
];

// Function to capitalize first letter
function capitalizeName(name) {
    return name.charAt(0).toUpperCase() + name.slice(1);
}

// API Configuration
const API_BASE = window.location.origin;

// Initialize attendance data
let attendanceData = {
    date: new Date().toDateString(),
    students: {},
    log: []
};

// Load data from API
async function loadAttendanceData() {
    try {
        const response = await fetch(`${API_BASE}/api/attendance`);
        const result = await response.json();
        
        if (result.success) {
            attendanceData = {
                date: result.data.date,
                students: result.data.attendance,
                log: []
            };
        } else {
            throw new Error(result.message || 'Failed to load data');
        }
    } catch (error) {
        console.error('Error loading attendance data:', error);
        // Fallback to localStorage if API fails
        loadLocalData();
    }
}

// Fallback function to load from localStorage
function loadLocalData() {
    const currentDate = new Date().toDateString();
    const savedData = localStorage.getItem('attendanceData');
    
    if (savedData) {
        const parsed = JSON.parse(savedData);
        // Check if it's the same date
        if (parsed.date === currentDate) {
            attendanceData = parsed;
        } else {
            // New day - create new data for today
            attendanceData = {
                date: currentDate,
                students: {},
                log: []
            };
            
            // Initialize all students as neutral (not marked)
            students.forEach(student => {
                attendanceData.students[student] = null;
            });
            
            saveAttendanceData();
        }
    } else {
        resetAttendanceData();
    }
    
    // Ensure all students are properly initialized as unmarked
    students.forEach(student => {
        if (attendanceData.students[student] === undefined) {
            attendanceData.students[student] = null;
        }
    });
}

// Save data to localStorage with historical tracking
function saveAttendanceData() {
    const currentDate = attendanceData.date;
    
    // Save current day's data
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
}

// Reset attendance data for new day
function resetAttendanceData() {
    attendanceData = {
        date: new Date().toDateString(),
        students: {},
        log: []
    };
    
    // Initialize all students as neutral (not marked)
    students.forEach(student => {
        attendanceData.students[student] = null; // null = not marked, true = present, false = absent
    });
    
    saveAttendanceData();
}

// Initialize student data if not exists
function initializeStudent(studentName) {
    if (attendanceData.students[studentName] === undefined) {
        attendanceData.students[studentName] = null;
    }
}

// Get initials for avatar
function getInitials(name) {
    return name.charAt(0).toUpperCase();
}

// Update attendance summary
function updateSummary() {
    const presentCount = Object.values(attendanceData.students).filter(status => status === true).length;
    const absentCount = Object.values(attendanceData.students).filter(status => status === false).length;
    const markedCount = presentCount + absentCount; // Total students who have been marked
    
    document.getElementById('present-count').textContent = presentCount;
    document.getElementById('absent-count').textContent = absentCount;
    document.getElementById('total-count').textContent = students.length;
}

// Create student card HTML
function createStudentCard(studentName) {
    initializeStudent(studentName);
    const status = attendanceData.students[studentName];
    const statusClass = status === null ? 'neutral' : (status ? 'present' : 'absent');
    const displayName = capitalizeName(studentName);
    
    return `
        <div class="student-card ${statusClass}" data-student="${studentName}">
            <div class="student-info">
                <div class="student-avatar">${getInitials(studentName)}</div>
                <div class="student-name">${displayName}</div>
            </div>
            <div class="student-controls">
                <button class="status-btn present ${status === true ? 'active' : ''}" 
                        onclick="toggleAttendance('${studentName}', true)">
                    <i class="fas fa-check"></i> Present
                </button>
                <button class="status-btn absent ${status === false ? 'active' : ''}" 
                        onclick="toggleAttendance('${studentName}', false)">
                    <i class="fas fa-times"></i> Absent
                </button>
            </div>
        </div>
    `;
}

// Set attendance for a student (only one option allowed - present OR absent)
async function toggleAttendance(studentName, isPresent) {
    const currentStatus = attendanceData.students[studentName];
    let newStatus;
    
    // If student is already marked as the same status, unmark them
    if (currentStatus === isPresent) {
        newStatus = null;
    } else {
        // Set the student to the selected status (this automatically removes any previous status)
        newStatus = isPresent;
    }
    
    try {
        // Send to API
        const response = await fetch(`${API_BASE}/api/attendance/${studentName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Update local data
            attendanceData.students[studentName] = newStatus;
            
            // Add to log
            const timestamp = new Date().toLocaleTimeString();
            let action;
            
            if (newStatus === null) {
                action = 'unmarked';
            } else {
                action = newStatus ? 'marked present' : 'marked absent';
            }
            
            attendanceData.log.unshift({
                time: timestamp,
                student: studentName,
                action: action,
                status: newStatus
            });
            
            // Keep only last 50 log entries
            if (attendanceData.log.length > 50) {
                attendanceData.log = attendanceData.log.slice(0, 50);
            }
            
            // Update UI
            renderStudents();
            updateSummary();
            renderPresentList();
            renderAbsentList();
            renderAttendanceLog();
            
            // Also save to localStorage as backup
            saveAttendanceData();
        } else {
            throw new Error(result.message || 'Failed to update attendance');
        }
    } catch (error) {
        console.error('Error updating attendance:', error);
        alert('Failed to update attendance. Please check your connection and try again.');
    }
}

// Mark attendance for a student (legacy function for bulk actions)
function markAttendance(studentName, isPresent) {
    const previousStatus = attendanceData.students[studentName];
    attendanceData.students[studentName] = isPresent;
    
    // Add to log
    const timestamp = new Date().toLocaleTimeString();
    const action = isPresent ? 'marked present' : 'marked absent';
    attendanceData.log.unshift({
        time: timestamp,
        student: studentName,
        action: action,
        status: isPresent
    });
    
    // Keep only last 50 log entries
    if (attendanceData.log.length > 50) {
        attendanceData.log = attendanceData.log.slice(0, 50);
    }
    
    saveAttendanceData();
    renderStudents();
    updateSummary();
    renderPresentList();
    renderAbsentList();
    renderAttendanceLog();
}

// Reset today's attendance only
async function resetTodayAttendance() {
    try {
        const response = await fetch(`${API_BASE}/api/reset`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Update local data
            students.forEach(student => {
                attendanceData.students[student] = null;
            });
            attendanceData.log = [];
            
            // Update UI
            renderStudents();
            updateSummary();
            renderPresentList();
            renderAbsentList();
            renderAttendanceLog();
            
            // Also save to localStorage as backup
            saveAttendanceData();
            
            alert('Today\'s attendance has been reset successfully!');
        } else {
            throw new Error(result.message || 'Failed to reset attendance');
        }
    } catch (error) {
        console.error('Error resetting attendance:', error);
        alert('Failed to reset attendance. Please check your connection and try again.');
    }
}

// Clear all data (current and historical)
async function clearAllData() {
    if (confirm('Are you sure you want to clear ALL attendance data? This cannot be undone.')) {
        try {
            const response = await fetch(`${API_BASE}/api/clear-all`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Clear local data
                localStorage.removeItem('attendanceData');
                localStorage.removeItem('attendanceHistory');
                
                // Reset local state
                resetAttendanceData();
                renderStudents();
                updateSummary();
                renderAttendanceLog();
                
                alert('All data has been cleared successfully!');
            } else {
                throw new Error(result.message || 'Failed to clear data');
            }
        } catch (error) {
            console.error('Error clearing data:', error);
            alert('Failed to clear data. Please check your connection and try again.');
        }
    }
}

// Render all student cards
function renderStudents() {
    const container = document.querySelector('.students-grid');
    container.innerHTML = students.map(createStudentCard).join('');
}

// Render present students list
function renderPresentList() {
    const container = document.getElementById('present-students');
    const presentStudents = students.filter(student => attendanceData.students[student] === true);
    
    if (presentStudents.length === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px; font-style: italic;">No students marked as present yet.</p>';
        return;
    }
    
    container.innerHTML = presentStudents.map(student => `
        <div class="list-student-item">
            <div class="list-student-avatar">${getInitials(student)}</div>
            <div class="list-student-name">${capitalizeName(student)}</div>
        </div>
    `).join('');
}

// Render absent students list
function renderAbsentList() {
    const container = document.getElementById('absent-students');
    const absentStudents = students.filter(student => attendanceData.students[student] === false);
    
    if (absentStudents.length === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px; font-style: italic;">No students marked as absent yet.</p>';
        return;
    }
    
    container.innerHTML = absentStudents.map(student => `
        <div class="list-student-item">
            <div class="list-student-avatar">${getInitials(student)}</div>
            <div class="list-student-name">${capitalizeName(student)}</div>
        </div>
    `).join('');
}

// Render attendance log
function renderAttendanceLog() {
    const container = document.getElementById('attendance-log');
    
    if (attendanceData.log.length === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No attendance recorded yet.</p>';
        return;
    }
    
    container.innerHTML = attendanceData.log.map(entry => `
        <div class="log-entry ${entry.status ? 'present' : 'absent'}">
            <span><strong>${capitalizeName(entry.student)}</strong> ${entry.action}</span>
            <span class="log-time">${entry.time}</span>
        </div>
    `).join('');
}

// Update current date display
function updateCurrentDate() {
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    document.getElementById('current-date').textContent = now.toLocaleDateString('en-US', options);
}

// Initialize the application
async function initializeApp() {
    await loadAttendanceData();
    updateCurrentDate();
    renderStudents();
    updateSummary();
    renderPresentList();
    renderAbsentList();
    renderAttendanceLog();
    
    // No admin event listeners needed - moved to admin panel
    
    // Update date every minute
    setInterval(updateCurrentDate, 60000);
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);

// Export functions for global access
window.toggleAttendance = toggleAttendance;
window.markAttendance = markAttendance;
window.resetTodayAttendance = resetTodayAttendance;
window.clearAllData = clearAllData;