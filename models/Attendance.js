const mongoose = require('mongoose');

// Admin Schema
const adminSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    role: {
        type: String,
        default: 'admin'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Student Schema
const studentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    displayName: {
        type: String,
        required: true,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    addedBy: {
        type: String,
        default: 'system'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Daily Attendance Schema
const dailyAttendanceSchema = new mongoose.Schema({
    date: {
        type: String,
        required: true,
        unique: true
    },
    attendance: {
        type: mongoose.Schema.Types.Mixed, // Use Mixed type to store object with any keys
        default: {}
    },
    summary: {
        present: { type: Number, default: 0 },
        absent: { type: Number, default: 0 },
        total: { type: Number, default: 14 },
        marked: { type: Number, default: 0 }
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Attendance Log Schema
const attendanceLogSchema = new mongoose.Schema({
    date: {
        type: String,
        required: true
    },
    studentName: {
        type: String,
        required: true
    },
    action: {
        type: String,
        required: true,
        enum: ['marked present', 'marked absent', 'unmarked', 'reset', 'system']
    },
    previousStatus: {
        type: mongoose.Schema.Types.Mixed, // null, true, or false
        default: null
    },
    currentStatus: {
        type: mongoose.Schema.Types.Mixed, // null, true, or false
        default: null
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// Historical Attendance Schema (for monthly/yearly reports)
const historicalAttendanceSchema = new mongoose.Schema({
    date: {
        type: String,
        required: true,
        unique: true
    },
    attendance: {
        type: mongoose.Schema.Types.Mixed, // Use Mixed type to store object with any keys
        default: {}
    },
    summary: {
        present: { type: Number, default: 0 },
        absent: { type: Number, default: 0 },
        total: { type: Number, default: 14 },
        marked: { type: Number, default: 0 }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Create indexes for better performance (removed duplicates)
attendanceLogSchema.index({ date: 1, timestamp: -1 });

// Create models
const Admin = mongoose.model('Admin', adminSchema);
const Student = mongoose.model('Student', studentSchema);
const DailyAttendance = mongoose.model('DailyAttendance', dailyAttendanceSchema);
const AttendanceLog = mongoose.model('AttendanceLog', attendanceLogSchema);
const HistoricalAttendance = mongoose.model('HistoricalAttendance', historicalAttendanceSchema);

module.exports = {
    Admin,
    Student,
    DailyAttendance,
    AttendanceLog,
    HistoricalAttendance
};
