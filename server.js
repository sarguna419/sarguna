const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.')); // Serve static files from current directory

// Data file path
const DATA_FILE = path.join(__dirname, 'attendance_data.json');

// Initialize data structure
const initializeData = () => {
    const defaultData = {
        students: [
            'appu', 'deva', 'gopi', 'kishore', 'Lokesh', 'praveen', 
            'prabu', 'sanjay', 'santosh', 'sarguna', 'satheesh', 
            'tharun', 'tharun.s', 'thirukumaran'
        ],
        // Today's attendance
        attendance: {},
        // Historical attendance records by date
        history: {},
        currentDate: new Date().toDateString()
    };
    
    // Initialize today's attendance
    defaultData.students.forEach(student => {
        defaultData.attendance[student] = null; // null = not marked, true = present, false = absent
    });
    
    return defaultData;
};

// Load data from file
const loadData = () => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            const currentDate = new Date().toDateString();
            
            // Check if it's a new day
            if (data.currentDate !== currentDate) {
                // Save yesterday's data to history BEFORE resetting
                if (data.currentDate && Object.keys(data.attendance).length > 0) {
                    data.history[data.currentDate] = {
                        date: data.currentDate,
                        attendance: {...data.attendance},
                        summary: calculateSummary(data.attendance),
                        timestamp: new Date().toISOString()
                    };
                }
                
                // Reset for new day
                data.currentDate = currentDate;
                data.students.forEach(student => {
                    data.attendance[student] = null;
                });
            }
            
            return data;
        }
    } catch (error) {
        console.error('Error loading data:', error);
    }
    
    return initializeData();
};

// Save data to file
const saveData = (data) => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving data:', error);
        return false;
    }
};

// Calculate attendance summary
const calculateSummary = (attendance) => {
    const present = Object.values(attendance).filter(status => status === true).length;
    const absent = Object.values(attendance).filter(status => status === false).length;
    const total = Object.keys(attendance).length;
    const marked = present + absent;
    
    return { present, absent, total, marked };
};

// Routes

// Get current attendance data
app.get('/api/attendance', (req, res) => {
    const data = loadData();
    const summary = calculateSummary(data.attendance);
    
    res.json({
        success: true,
        data: {
            date: data.currentDate,
            students: data.students,
            attendance: data.attendance,
            summary: summary
        }
    });
});

// Mark attendance for a student
app.post('/api/attendance/:studentName', (req, res) => {
    const { studentName } = req.params;
    const { status } = req.body; // true = present, false = absent, null = unmark
    
    const data = loadData();
    
    // Validate student exists
    if (!data.students.includes(studentName)) {
        return res.status(404).json({
            success: false,
            message: 'Student not found'
        });
    }
    
    // Update attendance
    const previousStatus = data.attendance[studentName];
    data.attendance[studentName] = status;
    
    // Save data
    if (saveData(data)) {
        const summary = calculateSummary(data.attendance);
        
        res.json({
            success: true,
            message: `${studentName} marked as ${status === true ? 'present' : status === false ? 'absent' : 'unmarked'}`,
            data: {
                student: studentName,
                previousStatus,
                currentStatus: status,
                summary: summary,
                timestamp: new Date().toISOString()
            }
        });
    } else {
        res.status(500).json({
            success: false,
            message: 'Failed to save attendance data'
        });
    }
});

// Get attendance history
app.get('/api/history', (req, res) => {
    const data = loadData();
    res.json({
        success: true,
        data: data.history
    });
});

// Get specific date's attendance record
app.get('/api/history/:date', (req, res) => {
    const { date } = req.params;
    const data = loadData();
    
    if (data.history[date]) {
        res.json({
            success: true,
            data: data.history[date]
        });
    } else {
        res.status(404).json({
            success: false,
            message: `No attendance record found for ${date}`
        });
    }
});

// Reset today's attendance
app.post('/api/reset', (req, res) => {
    const data = loadData();
    
    // Save current attendance to history before resetting
    if (Object.keys(data.attendance).length > 0) {
        data.history[data.currentDate] = {
            date: data.currentDate,
            attendance: {...data.attendance},
            summary: calculateSummary(data.attendance),
            timestamp: new Date().toISOString()
        };
    }
    
    // Reset all students to unmarked
    data.students.forEach(student => {
        data.attendance[student] = null;
    });
    
    if (saveData(data)) {
        res.json({
            success: true,
            message: 'Today\'s attendance has been reset',
            data: {
                date: data.currentDate,
                attendance: data.attendance,
                summary: calculateSummary(data.attendance)
            }
        });
    } else {
        res.status(500).json({
            success: false,
            message: 'Failed to reset attendance data'
        });
    }
});

// Clear all data
app.delete('/api/clear-all', (req, res) => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            fs.unlinkSync(DATA_FILE);
        }
        
        res.json({
            success: true,
            message: 'All attendance data has been cleared'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to clear data'
        });
    }
});

// Get real-time attendance display (for screen display)
app.get('/api/display', (req, res) => {
    const data = loadData();
    const summary = calculateSummary(data.attendance);
    
    // Get present and absent students
    const presentStudents = data.students.filter(student => data.attendance[student] === true);
    const absentStudents = data.students.filter(student => data.attendance[student] === false);
    const unmarkedStudents = data.students.filter(student => data.attendance[student] === null);
    
    res.json({
        success: true,
        data: {
            date: data.currentDate,
            summary: summary,
            presentStudents: presentStudents.map(name => ({
                name: name,
                displayName: name.charAt(0).toUpperCase() + name.slice(1)
            })),
            absentStudents: absentStudents.map(name => ({
                name: name,
                displayName: name.charAt(0).toUpperCase() + name.slice(1)
            })),
            unmarkedStudents: unmarkedStudents.map(name => ({
                name: name,
                displayName: name.charAt(0).toUpperCase() + name.slice(1)
            })),
            lastUpdated: new Date().toISOString()
        }
    });
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Hostel Attendance Server running on http://localhost:${PORT}`);
    console.log(`📊 API endpoints available at http://localhost:${PORT}/api/`);
    console.log(`🌐 Web interface available at http://localhost:${PORT}`);
    
    // Initialize data on startup
    const data = loadData();
    saveData(data);
    console.log(`📅 Current date: ${data.currentDate}`);
    console.log(`👥 Total students: ${data.students.length}`);
});

module.exports = app;




