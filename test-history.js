// Simple test script to verify historical attendance functionality
const fs = require('fs');
const path = require('path');

// Test data file path
const DATA_FILE = path.join(__dirname, 'attendance_data.json');

console.log('=== Hostel Attendance History Test ===\n');

// Check if data file exists
if (fs.existsSync(DATA_FILE)) {
    console.log('✓ Attendance data file found');
    
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        console.log('✓ Data file is valid JSON');
        
        // Check current date
        console.log(`\nCurrent Date: ${data.currentDate}`);
        
        // Check students
        console.log(`\nNumber of Students: ${data.students.length}`);
        console.log('Students:', data.students.join(', '));
        
        // Check today's attendance
        console.log('\n--- Today\'s Attendance ---');
        Object.entries(data.attendance).forEach(([student, status]) => {
            const statusText = status === true ? 'Present' : status === false ? 'Absent' : 'Not Marked';
            console.log(`  ${student}: ${statusText}`);
        });
        
        // Check history
        const historyDates = Object.keys(data.history);
        console.log(`\n--- Historical Records ---`);
        console.log(`Number of historical records: ${historyDates.length}`);
        
        if (historyDates.length > 0) {
            historyDates.forEach(date => {
                const record = data.history[date];
                console.log(`\nDate: ${date}`);
                console.log(`  Present: ${record.summary.present}`);
                console.log(`  Absent: ${record.summary.absent}`);
                console.log(`  Total: ${record.summary.total}`);
            });
        } else {
            console.log('  No historical records found');
        }
        
        console.log('\n=== Test Completed Successfully ===');
        
    } catch (error) {
        console.error('✗ Error reading/parsing data file:', error.message);
    }
} else {
    console.log('✗ Attendance data file not found');
    console.log('  Please run the application first to generate data');
}