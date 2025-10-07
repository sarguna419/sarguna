require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const path = require('path');

// Import models
const { Admin, Student, DailyAttendance, AttendanceLog, HistoricalAttendance } = require('./models/Attendance');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI;

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));
app.use(express.static('.')); // Serve static files from current directory

// Default student list (for initial setup)
const DEFAULT_STUDENTS = [
    'appu', 'deva', 'gopi', 'kishore', 'Lokesh', 'praveen', 
    'prabu', 'sanjay', 'santosh', 'sarguna', 'satheesh', 
    'tharun', 'tharun.s', 'thirukumaran'
];

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
.then(() => {
    console.log('✅ Connected to MongoDB Atlas');
    initializeDatabase();
})
.catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
});

// Automatic data cleanup function
async function cleanupOldData() {
    try {
        const twelveHoursAgo = new Date();
        twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12);
        
        // Archive today's data to historical collection before cleanup
        const currentDate = new Date().toDateString();
        const todayAttendance = await DailyAttendance.findOne({ date: currentDate });
        
        if (todayAttendance) {
            // Check if historical record already exists for today
            const existingHistorical = await HistoricalAttendance.findOne({ date: currentDate });
            
            if (!existingHistorical) {
                const historicalRecord = new HistoricalAttendance({
                    date: todayAttendance.date,
                    attendance: todayAttendance.attendance,
                    summary: todayAttendance.summary
                });
                
                await historicalRecord.save();
                console.log('📦 Archived today\'s attendance to historical collection');
            }
        }
        
        // Clean up old attendance logs (keep only last 12 hours)
        const deletedLogs = await AttendanceLog.deleteMany({
            timestamp: { $lt: twelveHoursAgo }
        });
        
        if (deletedLogs.deletedCount > 0) {
            console.log(`🧹 Cleaned up ${deletedLogs.deletedCount} old attendance log entries`);
        }
        
        // Clean up old daily attendance records (keep only today's)
        const deletedAttendance = await DailyAttendance.deleteMany({
            date: { $ne: currentDate },
            lastUpdated: { $lt: twelveHoursAgo }
        });
        
        if (deletedAttendance.deletedCount > 0) {
            console.log(`🧹 Cleaned up ${deletedAttendance.deletedCount} old daily attendance records`);
        }
        
    } catch (error) {
        console.error('❌ Error during data cleanup:', error);
    }
}

// Automatic attendance refresh function (every 15 hours)
async function refreshAttendanceSheet() {
    try {
        console.log('🔄 Starting automatic attendance sheet refresh...');
        
        const currentDate = new Date().toDateString();
        const activeStudents = await Student.find({ isActive: true });
        
        // Archive current attendance to historical collection before refresh
        const todayAttendance = await DailyAttendance.findOne({ date: currentDate });
        
        if (todayAttendance) {
            // Check if historical record already exists for today
            const existingHistorical = await HistoricalAttendance.findOne({ date: currentDate });
            
            if (!existingHistorical) {
                const historicalRecord = new HistoricalAttendance({
                    date: todayAttendance.date,
                    attendance: todayAttendance.attendance,
                    summary: todayAttendance.summary
                });
                
                await historicalRecord.save();
                console.log('📦 Archived current attendance to historical collection');
            }
        }
        
        // Reset attendance for all active students
        const attendanceObj = {};
        activeStudents.forEach(student => {
            attendanceObj[student.name] = null;
        });
        
        const updatedAttendance = await DailyAttendance.findOneAndUpdate(
            { date: currentDate },
            {
                attendance: attendanceObj,
                summary: calculateSummary(attendanceObj),
                lastUpdated: new Date()
            },
            { new: true, upsert: true }
        );
        
        // Log the automatic refresh action
        const refreshLog = new AttendanceLog({
            date: currentDate,
            studentName: 'SYSTEM',
            action: 'automatic refresh (15 hours)',
            previousStatus: 'various',
            currentStatus: null
        });
        
        await refreshLog.save();
        
        console.log('✅ Attendance sheet refreshed automatically');
        console.log(`📊 Reset ${activeStudents.length} students' attendance`);
        console.log(`📅 New summary: ${updatedAttendance.summary.present} present, ${updatedAttendance.summary.absent} absent, ${updatedAttendance.summary.total} total`);
        
    } catch (error) {
        console.error('❌ Error during automatic attendance refresh:', error);
    }
}

// Initialize database with admin, students and today's attendance
async function initializeDatabase() {
    try {
        // Create default admin if doesn't exist
        const adminExists = await Admin.findOne({ email: 'sarguna@gmail.com' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('sarguna', 10);
            const admin = new Admin({
                email: 'sarguna@gmail.com',
                password: hashedPassword,
                name: 'Sarguna Admin'
            });
            await admin.save();
            console.log('👤 Default admin created');
        }
        
        // Initialize students from default list if no students exist
        const studentCount = await Student.countDocuments();
        if (studentCount === 0) {
            const studentsToCreate = DEFAULT_STUDENTS.map(name => ({
                name: name,
                displayName: capitalizeName(name),
                addedBy: 'system'
            }));
            
            await Student.insertMany(studentsToCreate);
            console.log(`👥 Created ${DEFAULT_STUDENTS.length} default students`);
        }
        
        // Get active students for attendance
        const activeStudents = await Student.find({ isActive: true });
        const currentDate = new Date().toDateString();
        
        // Check if today's attendance record exists
        let todayAttendance = await DailyAttendance.findOne({ date: currentDate });
        
        if (!todayAttendance) {
            // Create new attendance record for today
            const attendanceObj = {};
            activeStudents.forEach(student => {
                attendanceObj[student.name] = null;
            });
            
            todayAttendance = new DailyAttendance({
                date: currentDate,
                attendance: attendanceObj,
                summary: {
                    present: 0,
                    absent: 0,
                    total: activeStudents.length,
                    marked: 0
                }
            });
            
            await todayAttendance.save();
            console.log('📅 Created new attendance record for today');
        }
        
        // Run initial cleanup
        await cleanupOldData();
        
        // Schedule automatic cleanup every hour
        setInterval(cleanupOldData, 60 * 60 * 1000); // 1 hour
        console.log('⏰ Scheduled automatic data cleanup every hour');
        
        // Schedule automatic attendance refresh every 15 hours
        setInterval(refreshAttendanceSheet, 15 * 60 * 60 * 1000); // 15 hours
        console.log('🔄 Scheduled automatic attendance refresh every 15 hours');
        
        console.log('🔄 Database initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing database:', error);
    }
}

// Middleware to verify admin token
function verifyAdmin(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access denied. No token provided.'
        });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Invalid token.'
        });
    }
}

// Helper function to calculate summary
function calculateSummary(attendanceObj) {
    const attendanceArray = Object.values(attendanceObj);
    const present = attendanceArray.filter(status => status === true).length;
    const absent = attendanceArray.filter(status => status === false).length;
    const total = Object.keys(attendanceObj).length;
    const marked = present + absent;
    
    return { present, absent, total, marked };
}

// Helper function to capitalize name
function capitalizeName(name) {
    return name.charAt(0).toUpperCase() + name.slice(1);
}

// Admin Routes

// Admin login
app.post('/api/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find admin
        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }
        
        // Check password
        const isValidPassword = await bcrypt.compare(password, admin.password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }
        
        // Generate token
        const token = jwt.sign(
            { id: admin._id, email: admin.email, name: admin.name },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({
            success: true,
            token,
            admin: {
                id: admin._id,
                email: admin.email,
                name: admin.name,
                role: admin.role
            }
        });
        
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
});

// Verify admin token
app.get('/api/admin/verify', verifyAdmin, async (req, res) => {
    try {
        const admin = await Admin.findById(req.admin.id).select('-password');
        res.json({
            success: true,
            admin: {
                id: admin._id,
                email: admin.email,
                name: admin.name,
                role: admin.role
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Token verification failed'
        });
    }
});

// Get all students (admin only)
app.get('/api/admin/students', verifyAdmin, async (req, res) => {
    try {
        const students = await Student.find().sort({ createdAt: -1 });
        res.json({
            success: true,
            data: students
        });
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch students'
        });
    }
});

// Add new student (admin only)
app.post('/api/admin/students', verifyAdmin, async (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name || name.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Student name is required'
            });
        }
        
        const trimmedName = name.trim();
        
        // Check if student already exists
        const existingStudent = await Student.findOne({ name: trimmedName });
        if (existingStudent) {
            return res.status(400).json({
                success: false,
                message: 'Student with this name already exists'
            });
        }
        
        const student = new Student({
            name: trimmedName,
            displayName: capitalizeName(trimmedName),
            addedBy: req.admin.email
        });
        
        await student.save();
        
        res.json({
            success: true,
            message: 'Student added successfully',
            data: student
        });
        
    } catch (error) {
        console.error('Error adding student:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add student'
        });
    }
});

// Update student (admin only)
app.put('/api/admin/students/:id', verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive, name } = req.body;
        
        const updateData = {};
        if (typeof isActive === 'boolean') updateData.isActive = isActive;
        if (name) {
            updateData.name = name.trim();
            updateData.displayName = capitalizeName(name.trim());
        }
        
        const student = await Student.findByIdAndUpdate(id, updateData, { new: true });
        
        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Student updated successfully',
            data: student
        });
        
    } catch (error) {
        console.error('Error updating student:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update student'
        });
    }
});

// Delete student (admin only)
app.delete('/api/admin/students/:id', verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const student = await Student.findByIdAndDelete(id);
        
        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Student deleted successfully'
        });
        
    } catch (error) {
        console.error('Error deleting student:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete student'
        });
    }
});

// Reset attendance (admin only)
app.post('/api/admin/reset', verifyAdmin, async (req, res) => {
    try {
        const currentDate = new Date().toDateString();
        const activeStudents = await Student.find({ isActive: true });
        
        // Reset attendance for all active students
        const attendanceObj = {};
        activeStudents.forEach(student => {
            attendanceObj[student.name] = null;
        });
        
        const updatedAttendance = await DailyAttendance.findOneAndUpdate(
            { date: currentDate },
            {
                attendance: attendanceObj,
                summary: calculateSummary(attendanceObj),
                lastUpdated: new Date()
            },
            { new: true, upsert: true }
        );
        
        // Log the reset action
        const resetLog = new AttendanceLog({
            date: currentDate,
            studentName: 'SYSTEM',
            action: 'reset',
            previousStatus: 'various',
            currentStatus: null
        });
        
        await resetLog.save();
        
        res.json({
            success: true,
            message: 'Today\'s attendance has been reset',
            data: {
                date: updatedAttendance.date,
                summary: updatedAttendance.summary
            }
        });
        
    } catch (error) {
        console.error('Error resetting attendance:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset attendance'
        });
    }
});

// Clear all data (admin only)
app.delete('/api/admin/clear-all', verifyAdmin, async (req, res) => {
    try {
        // Delete all records except students and admin
        await DailyAttendance.deleteMany({});
        await AttendanceLog.deleteMany({});
        await HistoricalAttendance.deleteMany({});
        
        res.json({
            success: true,
            message: 'All attendance data has been cleared'
        });
        
    } catch (error) {
        console.error('Error clearing data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to clear data'
        });
    }
});

// Bulk attendance operations (admin only)
app.post('/api/admin/bulk-attendance', verifyAdmin, async (req, res) => {
    try {
        const { action } = req.body; // 'present' or 'absent'
        
        if (!['present', 'absent'].includes(action)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid action. Must be "present" or "absent"'
            });
        }
        
        const currentDate = new Date().toDateString();
        const activeStudents = await Student.find({ isActive: true });
        
        if (activeStudents.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No active students found'
            });
        }
        
        // Get or create today's attendance
        let todayAttendance = await DailyAttendance.findOne({ date: currentDate });
        
        if (!todayAttendance) {
            const attendanceObj = {};
            activeStudents.forEach(student => {
                attendanceObj[student.name] = null;
            });
            
            todayAttendance = new DailyAttendance({
                date: currentDate,
                attendance: attendanceObj,
                summary: calculateSummary(attendanceObj)
            });
        }
        
        // Update all active students
        const status = action === 'present' ? true : false;
        let updatedCount = 0;
        
        activeStudents.forEach(student => {
            if (todayAttendance.attendance[student.name] !== status) {
                todayAttendance.attendance[student.name] = status;
                updatedCount++;
            }
        });
        
        // Mark attendance field as modified for Mongoose
        todayAttendance.markModified('attendance');
        
        // Recalculate summary
        todayAttendance.summary = calculateSummary(todayAttendance.attendance);
        todayAttendance.lastUpdated = new Date();
        
        // Save to database
        await todayAttendance.save();
        
        // Log the bulk action
        const bulkLog = new AttendanceLog({
            date: currentDate,
            studentName: 'BULK_OPERATION',
            action: 'system',
            previousStatus: 'various',
            currentStatus: status
        });
        
        await bulkLog.save();
        
        res.json({
            success: true,
            message: `Successfully marked ${updatedCount} students as ${action}`,
            data: {
                updated: updatedCount,
                total: activeStudents.length,
                action: action,
                summary: todayAttendance.summary
            }
        });
        
    } catch (error) {
        console.error('Error performing bulk attendance:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to perform bulk attendance operation'
        });
    }
});

// Public Routes

// Get current attendance data
app.get('/api/attendance', async (req, res) => {
    try {
        const currentDate = new Date().toDateString();
        const activeStudents = await Student.find({ isActive: true });
        const studentNames = activeStudents.map(s => s.name);
        
        let todayAttendance = await DailyAttendance.findOne({ date: currentDate });
        
        if (!todayAttendance) {
            // Create new record if doesn't exist
            const attendanceObj = {};
            activeStudents.forEach(student => {
                attendanceObj[student.name] = null;
            });
            
            todayAttendance = new DailyAttendance({
                date: currentDate,
                attendance: attendanceObj,
                summary: calculateSummary(attendanceObj)
            });
            
            await todayAttendance.save();
        }
        
        res.json({
            success: true,
            data: {
                date: todayAttendance.date,
                students: studentNames,
                attendance: todayAttendance.attendance,
                summary: todayAttendance.summary
            }
        });
    } catch (error) {
        console.error('Error fetching attendance:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch attendance data',
            error: error.message
        });
    }
});

// Mark attendance for a student
app.post('/api/attendance/:studentName', async (req, res) => {
    try {
        const { studentName } = req.params;
        const { status } = req.body; // true = present, false = absent, null = unmark
        
        // Validate student exists and is active
        const student = await Student.findOne({ name: studentName, isActive: true });
        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found or inactive'
            });
        }
        
        const currentDate = new Date().toDateString();
        let todayAttendance = await DailyAttendance.findOne({ date: currentDate });
        
        if (!todayAttendance) {
            // Create new record if doesn't exist
            const activeStudents = await Student.find({ isActive: true });
            const attendanceObj = {};
            activeStudents.forEach(student => {
                attendanceObj[student.name] = null;
            });
            
            todayAttendance = new DailyAttendance({
                date: currentDate,
                attendance: attendanceObj,
                summary: calculateSummary(attendanceObj)
            });
        }
        
        // Get previous status
        const previousStatus = todayAttendance.attendance[studentName];
        
        // Update attendance
        todayAttendance.attendance[studentName] = status;
        
        // Mark the attendance field as modified for Mongoose
        todayAttendance.markModified('attendance');
        
        // Recalculate summary
        todayAttendance.summary = calculateSummary(todayAttendance.attendance);
        todayAttendance.lastUpdated = new Date();
        
        // Save to database
        await todayAttendance.save();
        
        // Log the action
        const action = status === null ? 'unmarked' : (status ? 'marked present' : 'marked absent');
        
        const logEntry = new AttendanceLog({
            date: currentDate,
            studentName: studentName,
            action: action,
            previousStatus: previousStatus,
            currentStatus: status
        });
        
        await logEntry.save();
        
        res.json({
            success: true,
            message: `${studentName} ${action}`,
            data: {
                student: studentName,
                previousStatus,
                currentStatus: status,
                summary: todayAttendance.summary,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Error updating attendance:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update attendance',
            error: error.message
        });
    }
});

// Get real-time attendance display data
app.get('/api/display', async (req, res) => {
    try {
        const currentDate = new Date().toDateString();
        let todayAttendance = await DailyAttendance.findOne({ date: currentDate });
        
        if (!todayAttendance) {
            // Create new record if doesn't exist
            const attendanceObj = {};
            STUDENTS.forEach(student => {
                attendanceObj[student] = null;
            });
            
            todayAttendance = new DailyAttendance({
                date: currentDate,
                attendance: attendanceObj,
                summary: calculateSummary(attendanceObj)
            });
            
            await todayAttendance.save();
        }
        
        // Categorize students
        const presentStudents = [];
        const absentStudents = [];
        const unmarkedStudents = [];
        
        Object.entries(todayAttendance.attendance).forEach(([studentName, status]) => {
            const studentData = {
                name: studentName,
                displayName: capitalizeName(studentName)
            };
            
            if (status === true) {
                presentStudents.push(studentData);
            } else if (status === false) {
                absentStudents.push(studentData);
            } else {
                unmarkedStudents.push(studentData);
            }
        });
        
        res.json({
            success: true,
            data: {
                date: todayAttendance.date,
                summary: todayAttendance.summary,
                presentStudents,
                absentStudents,
                unmarkedStudents,
                lastUpdated: todayAttendance.lastUpdated || new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Error fetching display data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch display data',
            error: error.message
        });
    }
});

// Reset today's attendance
app.post('/api/reset', async (req, res) => {
    try {
        const currentDate = new Date().toDateString();
        
        // Reset attendance for all students
        const attendanceObj = {};
        STUDENTS.forEach(student => {
            attendanceObj[student] = null;
        });
        
        const updatedAttendance = await DailyAttendance.findOneAndUpdate(
            { date: currentDate },
            {
                attendance: attendanceObj,
                summary: calculateSummary(attendanceObj),
                lastUpdated: new Date()
            },
            { new: true, upsert: true }
        );
        
        // Log the reset action
        const resetLog = new AttendanceLog({
            date: currentDate,
            studentName: 'SYSTEM',
            action: 'reset all attendance',
            previousStatus: 'various',
            currentStatus: null
        });
        
        await resetLog.save();
        
        res.json({
            success: true,
            message: 'Today\'s attendance has been reset',
            data: {
                date: updatedAttendance.date,
                summary: updatedAttendance.summary
            }
        });
        
    } catch (error) {
        console.error('Error resetting attendance:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset attendance',
            error: error.message
        });
    }
});

// Clear all data
app.delete('/api/clear-all', async (req, res) => {
    try {
        // Delete all records
        await DailyAttendance.deleteMany({});
        await AttendanceLog.deleteMany({});
        await HistoricalAttendance.deleteMany({});
        
        res.json({
            success: true,
            message: 'All attendance data has been cleared'
        });
        
    } catch (error) {
        console.error('Error clearing data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to clear data',
            error: error.message
        });
    }
});

// Get attendance history
app.get('/api/history', async (req, res) => {
    try {
        const { limit = 30, page = 1 } = req.query;
        
        const historicalData = await HistoricalAttendance
            .find({})
            .sort({ date: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));
        
        const totalRecords = await HistoricalAttendance.countDocuments({});
        
        res.json({
            success: true,
            data: {
                records: historicalData,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalRecords / parseInt(limit)),
                    totalRecords,
                    hasNext: (parseInt(page) * parseInt(limit)) < totalRecords,
                    hasPrev: parseInt(page) > 1
                }
            }
        });
        
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch history',
            error: error.message
        });
    }
});

// Get attendance logs for today
app.get('/api/logs', async (req, res) => {
    try {
        const currentDate = new Date().toDateString();
        const { limit = 50 } = req.query;
        
        const logs = await AttendanceLog
            .find({ date: currentDate })
            .sort({ timestamp: -1 })
            .limit(parseInt(limit));
        
        res.json({
            success: true,
            data: logs
        });
        
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch logs',
            error: error.message
        });
    }
});

// Archive today's data to historical collection (run at end of day)
app.post('/api/archive', async (req, res) => {
    try {
        const currentDate = new Date().toDateString();
        const todayAttendance = await DailyAttendance.findOne({ date: currentDate });
        
        if (!todayAttendance) {
            return res.status(404).json({
                success: false,
                message: 'No attendance data found for today'
            });
        }
        
        // Create historical record
        const historicalRecord = new HistoricalAttendance({
            date: todayAttendance.date,
            attendance: todayAttendance.attendance,
            summary: todayAttendance.summary
        });
        
        await historicalRecord.save();
        
        res.json({
            success: true,
            message: 'Today\'s attendance has been archived',
            data: historicalRecord
        });
        
    } catch (error) {
        console.error('Error archiving data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to archive data',
            error: error.message
        });
    }
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve the admin panel
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Serve the public attendance view
app.get('/public', (req, res) => {
    res.sendFile(path.join(__dirname, 'public-attendance.html'));
});

app.get('/view', (req, res) => {
    res.sendFile(path.join(__dirname, 'public-attendance.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Hostel Attendance Server running on http://localhost:${PORT}`);
    console.log(`📊 API endpoints available at http://localhost:${PORT}/api/`);
    console.log(`🌐 Web interface available at http://localhost:${PORT}`);
    console.log(`🗄️  Database: MongoDB Atlas (hostelattendence)`);
    console.log(`📅 Current date: ${new Date().toDateString()}`);
    
    // Get student count from database
    Student.countDocuments({ isActive: true }).then(count => {
        console.log(`👥 Active students: ${count}`);
    }).catch(err => {
        console.log(`👥 Students: Loading...`);
    });
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🔄 Shutting down gracefully...');
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
});

module.exports = app;
