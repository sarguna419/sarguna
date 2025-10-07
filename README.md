# Hostel Attendance Management System

A comprehensive web application for managing daily attendance of hostel residents with date-wise storage and historical record retrieval.

## Features

1. **Daily Attendance Tracking**: Mark students as present or absent each day
2. **Automatic Date-wise Storage**: Attendance data is automatically saved with the date as a key
3. **Historical Data Preservation**: All previous days' attendance records are preserved
4. **Attendance History View**: View attendance records for any previous date
5. **Real-time Display**: Public display screen for real-time attendance viewing
6. **Admin Panel**: Manage students and system settings
7. **Data Persistence**: All data is securely stored in a database

## System Architecture

### Backend Options

The system supports two backend implementations:

1. **MongoDB Version** (`server-mongodb.js`) - Full-featured with MongoDB database
2. **File-based Version** (`server.js`) - Lightweight with JSON file storage

### Frontend
- **HTML5/CSS3/JavaScript** for responsive UI
- Modern, user-friendly interface
- Real-time updates without page refresh

## File Structure

```
├── models/
│   └── Attendance.js          # Database models
├── admin.html                 # Admin panel interface
├── display.html               # Public display screen
├── history.html               # Attendance history viewer
├── index.html                 # Main attendance marking interface
├── public-attendance.html     # Public attendance view
├── script.js                  # Main frontend JavaScript
├── server-mongodb.js          # Main server with MongoDB integration
├── server.js                  # Legacy server with file-based storage
├── styles.css                 # Main stylesheet
└── package.json               # Project dependencies
```

## API Endpoints

### Attendance Management
- `GET /api/attendance` - Get current day's attendance
- `POST /api/attendance/:studentName` - Mark attendance for a student
- `POST /api/reset` - Reset today's attendance

### History & Reports
- `GET /api/history` - Get all historical attendance records
- `GET /api/history/:date` - Get attendance record for a specific date

### Admin Functions
- `POST /api/admin/login` - Admin login
- `GET /api/admin/students` - Get all students
- `POST /api/admin/students` - Add new student
- `PUT /api/admin/students/:id` - Update student
- `DELETE /api/admin/students/:id` - Delete student
- `POST /api/admin/reset` - Reset today's attendance (admin)
- `DELETE /api/admin/clear-all` - Clear all data (admin)

## How It Works

### Daily Attendance Process
1. Each day, staff visit the main interface (`/`) to mark attendance
2. Students are marked as Present or Absent using the interface
3. At the end of the day, data is automatically saved with the current date
4. When a new day begins, the interface resets for fresh marking while preserving previous data

### Data Storage

#### MongoDB Version (Recommended)
- Current day's attendance: Stored in `DailyAttendance` collection
- Historical records: Archived in `HistoricalAttendance` collection
- Attendance logs: Stored in `AttendanceLog` collection
- Student information: Stored in `Student` collection

#### File-based Version
- All data stored in `attendance_data.json`
- Current attendance and history stored in the same file
- Automatic date detection and history preservation

### Viewing Historical Data
1. Navigate to the History page (`/history.html`)
2. Select a date from the dropdown or enter a specific date
3. View the attendance record for that date with full details

## Setup Instructions

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure MongoDB** (for MongoDB version):
   - Update the MongoDB connection string in `server-mongodb.js`
   - Ensure you have a MongoDB Atlas account and database

3. **Start the Server**:
   
   For MongoDB version:
   ```bash
   npm start
   ```
   
   For file-based version:
   ```bash
   npm run start-local
   ```

4. **Access the Application**:
   - Main Interface: `http://localhost:3000`
   - Admin Panel: `http://localhost:3000/admin.html`
   - Public Display: `http://localhost:3000/display.html`
   - History View: `http://localhost:3000/history.html`

## Default Admin Credentials

- **Email**: sarguna@gmail.com
- **Password**: sarguna

## Key Features Implementation

### Date-wise Attendance Storage
The system automatically saves attendance data with the current date as a key, ensuring that:
- Each day's data is stored separately
- Previous days' data is never overwritten
- Data can be retrieved for any specific date

### Automatic Daily Reset
At the start of each new day:
- The attendance marking interface automatically resets
- Staff can begin marking attendance for the new day
- Previous day's data is preserved in the history

### Historical Data Retrieval
- All attendance records are stored permanently
- Users can view attendance for any previous date
- Detailed records include present/absent status for each student

## Security Features

- Admin authentication with JWT tokens
- Password encryption using bcrypt
- Session management
- Role-based access control

## Data Management

### Automatic Cleanup
- Attendance logs are automatically cleaned up after 12 hours
- Old daily attendance records are archived appropriately

### Manual Controls
- Admins can reset today's attendance
- Admins can clear all data (with confirmation)
- Bulk attendance marking for all students

## Browser Compatibility

The application works on all modern browsers:
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Support

For issues or questions, please contact the development team.




