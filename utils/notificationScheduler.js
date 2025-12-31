// Notification Scheduler Utility
// Calculates notification times for medications and fasting instructions

const Medication = require('../models/Medication');
const FastingInstruction = require('../models/FastingInstruction');

/**

 * @param {object} medication - Medication document
 * @param {object} preferences - User notification preferences
 * @returns {Array} - Array of reminder objects with time and message
 */
const calculateMedicationReminders = (medication, preferences = {}) => {
    const reminders = [];
    const now = new Date();
    const reminderMinutes = preferences.reminderMinutesBefore || 15;

    // Check if medication is active and reminders are enabled
    if (!medication.isActive || !medication.reminders) {
        return reminders;
    }

    // Check if medication has expired
    if (medication.endDate && new Date(medication.endDate) < now) {
        return reminders;
    }

    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate reminders for each scheduled time
    medication.times.forEach(timeStr => {
        const [hours, minutes] = timeStr.split(':').map(Number);

        // Create reminder time for today
        const medicationTime = new Date(today);
        medicationTime.setHours(hours, minutes, 0, 0);

        // Create reminder time (X minutes before medication time)
        const reminderTime = new Date(medicationTime);
        reminderTime.setMinutes(reminderTime.getMinutes() - reminderMinutes);

        // Only include future reminders
        if (reminderTime > now) {
            // Check quiet hours
            if (!isInQuietHours(reminderTime, preferences)) {
                reminders.push({
                    scheduledFor: reminderTime,
                    medicationTime: medicationTime,
                    title: `💊 Medication Reminder`,
                    body: `Time to take ${medication.name} (${medication.dosage})`,
                    data: {
                        type: 'medication',
                        medicationId: medication._id.toString(),
                        medicationName: medication.name,
                        dosage: medication.dosage,
                        scheduledTime: timeStr
                    }
                });
            }
        }
    });

    return reminders;
};

/**
 * Calculate fasting instruction reminders
 * @param {object} fastingInstruction - FastingInstruction document
 * @param {object} preferences - User notification preferences
 * @returns {Array} - Array of reminder objects
 */
const calculateFastingReminders = (fastingInstruction, preferences = {}) => {
    const reminders = [];
    const now = new Date();

    // Check if instruction is active
    if (!fastingInstruction.isActive) {
        return reminders;
    }

    const operationDate = new Date(fastingInstruction.operationDate);

    // Only send reminders for upcoming operations
    if (operationDate < now) {
        return reminders;
    }

    // Calculate days until operation
    const daysUntil = fastingInstruction.getDaysUntilOperation();

    // Reminder schedule based on days until operation
    const reminderSchedule = [
        { days: 7, title: '📅 Operation in 1 Week', body: 'Your operation is scheduled in 7 days' },
        { days: 3, title: '📅 Operation in 3 Days', body: 'Your operation is coming up in 3 days' },
        { days: 1, title: '⚠️ Operation Tomorrow', body: 'Your operation is scheduled for tomorrow. Please review fasting instructions.' },
        { days: 0, title: '🏥 Operation Today', body: 'Your operation is today. Follow all fasting and preparation instructions.' }
    ];

    reminderSchedule.forEach(schedule => {
        if (daysUntil === schedule.days) {
            const reminderTime = new Date();
            reminderTime.setHours(9, 0, 0, 0); // Send at 9 AM

            if (reminderTime > now && !isInQuietHours(reminderTime, preferences)) {
                reminders.push({
                    scheduledFor: reminderTime,
                    title: schedule.title,
                    body: schedule.body,
                    data: {
                        type: 'fasting',
                        fastingInstructionId: fastingInstruction._id.toString(),
                        operationDate: operationDate.toISOString(),
                        daysUntil: daysUntil.toString()
                    }
                });
            }
        }
    });

    // Add specific fasting reminders (e.g., 8 hours before operation)
    const fastingStartTime = new Date(operationDate);
    fastingStartTime.setHours(fastingStartTime.getHours() - 8); // 8 hours before

    if (fastingStartTime > now && !isInQuietHours(fastingStartTime, preferences)) {
        reminders.push({
            scheduledFor: fastingStartTime,
            title: '🚫 Start Fasting Now',
            body: 'You should begin fasting now for your operation. No food or drink.',
            data: {
                type: 'fasting',
                fastingInstructionId: fastingInstruction._id.toString(),
                operationDate: operationDate.toISOString(),
                action: 'start_fasting'
            }
        });
    }

    return reminders;
};

/**
 * Check if a time falls within user's quiet hours
 * @param {Date} time - Time to check
 * @param {object} preferences - User notification preferences
 * @returns {boolean} - True if in quiet hours
 */
const isInQuietHours = (time, preferences) => {
    if (!preferences.quietHoursEnabled) {
        return false;
    }

    const hours = time.getHours();
    const minutes = time.getMinutes();
    const timeInMinutes = hours * 60 + minutes;

    const [startHour, startMin] = (preferences.quietHoursStart || '22:00').split(':').map(Number);
    const [endHour, endMin] = (preferences.quietHoursEnd || '08:00').split(':').map(Number);

    const startInMinutes = startHour * 60 + startMin;
    const endInMinutes = endHour * 60 + endMin;

    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startInMinutes > endInMinutes) {
        return timeInMinutes >= startInMinutes || timeInMinutes < endInMinutes;
    }

    return timeInMinutes >= startInMinutes && timeInMinutes < endInMinutes;
};

/**
 * Get all upcoming reminders for a user
 * @param {string} userId - User ID
 * @param {object} preferences - User notification preferences
 * @returns {Promise<Array>} - Array of all upcoming reminders
 */
const getAllUpcomingReminders = async (userId, preferences = {}) => {
    const allReminders = [];

    try {
        // Get active medications
        if (preferences.medicationReminders !== false) {
            const medications = await Medication.find({
                patient: userId,
                isActive: true,
                reminders: true
            });

            medications.forEach(medication => {
                const medReminders = calculateMedicationReminders(medication, preferences);
                allReminders.push(...medReminders);
            });
        }

        // Get active fasting instructions
        if (preferences.fastingReminders !== false) {
            const fastingInstructions = await FastingInstruction.find({
                patient: userId,
                isActive: true,
                operationDate: { $gte: new Date() }
            });

            fastingInstructions.forEach(instruction => {
                const fastingReminders = calculateFastingReminders(instruction, preferences);
                allReminders.push(...fastingReminders);
            });
        }

        // Sort by scheduled time
        allReminders.sort((a, b) => a.scheduledFor - b.scheduledFor);

        return allReminders;
    } catch (error) {
        console.error('Error calculating reminders:', error);
        return [];
    }
};

/**
 * Format notification data for FCM
 * @param {string} type - Notification type
 * @param {object} item - Medication or FastingInstruction
 * @param {object} additionalData - Additional data to include
 * @returns {object} - Formatted notification object
 */
const formatNotificationData = (type, item, additionalData = {}) => {
    const data = {
        type,
        ...additionalData
    };

    // Convert all values to strings (FCM requirement)
    Object.keys(data).forEach(key => {
        if (data[key] !== null && data[key] !== undefined) {
            data[key] = String(data[key]);
        }
    });

    return data;
};

module.exports = {
    calculateMedicationReminders,
    calculateFastingReminders,
    getAllUpcomingReminders,
    isInQuietHours,
    formatNotificationData
};
