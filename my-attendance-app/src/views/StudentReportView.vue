<template>
    <div class="animate-fade-in">
        <div v-if="isLoading" class="loading-indicator">
            <i class="fas fa-spinner fa-spin text-4xl"></i>
            <span class="ml-4 text-lg">Loading Student Report...</span>
        </div>

        <div v-if="errorMsg && !isLoading" class="error-banner mb-6" role="alert">
            <div>
                <p class="font-bold">Error Loading Report</p>
                <p>{{ errorMsg }}</p>
            </div>
            <button @click="errorMsg = null" class="ml-4" aria-label="Close"><i class="fas fa-times"></i></button>
        </div>

        <div v-if="!isLoading && studentSummary.details" class="space-y-8">
            <!-- Header & Back Button -->
            <div class="flex justify-between items-center">
                <h1 class="text-2xl font-semibold text-lightText dark:text-darkText">
                    Attendance Report
                </h1>
                <RouterLink :to="{ name: 'students' }" class="button-secondary text-sm py-2">
                    <i class="fas fa-arrow-left mr-2"></i> Back to Students
                </RouterLink>
            </div>

            <!-- Student Details & Overall Stats Card -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- Student Information Card with Image -->
                <div
                    class="md:col-span-1 card p-6 flex flex-col items-center text-center md:text-left md:items-start md:flex-row md:space-x-4">
                    <img v-if="getDisplayableStudentFaceUrl(studentSummary.details.student_face_image_path)"
                        :src="getDisplayableStudentFaceUrl(studentSummary.details.student_face_image_path)"
                        :alt="studentSummary.details.student_full_name"
                        class="w-24 h-24 md:w-20 md:h-20 rounded-full object-cover border-2 border-primary dark:border-darkAccent shadow-md mb-4 md:mb-0 shrink-0">
                    <div v-else
                        class="w-24 h-24 md:w-20 md:h-20 rounded-full bg-gray-200 dark:bg-darkSurfaceLighter flex items-center justify-center text-lightTextSecondary dark:text-darkTextSecondary text-3xl md:text-2xl border-2 border-gray-300 dark:border-darkBorder shadow-md mb-4 md:mb-0 shrink-0">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="flex-grow">
                        <h2 class="card-title mb-1 text-lg md:text-xl">{{ studentSummary.details.student_full_name }}
                        </h2>
                        <div class="space-y-0.5 text-sm">
                            <p><strong class="info-label-inline">Class:</strong> {{
                                studentSummary.details.student_class_name }}</p>
                            <p><strong class="info-label-inline">Tag UID:</strong> <span class="font-mono text-xs">{{
                                    studentSummary.details.student_tag_uid }}</span></p>
                        </div>
                    </div>
                </div>

                <div class="md:col-span-2 card p-6">
                    <h2 class="card-title mb-3">Overall Attendance</h2>
                    <div v-if="studentSummary.details.total_relevant_sessions > 0 || studentSummary.details.sessions_attended > 0"
                        class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                        <div>
                            <p class="text-3xl font-bold text-primary dark:text-darkAccent">{{
                                studentSummary.details.sessions_attended }}</p>
                            <p
                                class="text-xs text-lightTextSecondary dark:text-darkTextSecondary uppercase tracking-wider">
                                Sessions Attended</p>
                        </div>
                        <div>
                            <p class="text-3xl font-bold text-lightText dark:text-darkText">{{
                                studentSummary.details.total_relevant_sessions }}</p>
                            <p
                                class="text-xs text-lightTextSecondary dark:text-darkTextSecondary uppercase tracking-wider">
                                Relevant Sessions</p>
                        </div>
                        <div>
                            <p class="text-3xl font-bold"
                                :class="getPercentageColor(studentSummary.details.attendance_percentage)">
                                {{ studentSummary.details.attendance_percentage }}%
                            </p>
                            <p
                                class="text-xs text-lightTextSecondary dark:text-darkTextSecondary uppercase tracking-wider">
                                Attendance Rate</p>
                        </div>
                    </div>
                    <div v-else class="text-center py-4">
                        <p class="text-lightTextSecondary dark:text-darkTextSecondary">No relevant session data found
                            for this student's class yet.</p>
                    </div>
                </div>
            </div>

            <!-- Session History Table -->
            <div class="table-card">
                <div class="table-header !pb-0">
                    <h2 class="table-title">Session History</h2>
                </div>
                <div v-if="studentSummary.sessions.length > 0" class="responsive-table-wrapper">
                    <table class="data-table">
                        <thead class="responsive-thead">
                            <tr>
                                <th>Session Name</th>
                                <th>Date</th>
                                <th>Status</th>
                                <th>First Scan Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="session in studentSummary.sessions" :key="session.session_id"
                                class="responsive-row group">
                                <td data-label="Session" class="responsive-cell font-medium">{{ session.session_name }}
                                </td>
                                <td data-label="Date" class="responsive-cell">{{ formatDate(session.session_started_at,
                                    true) }}</td>
                                <td data-label="Status" class="responsive-cell">
                                    <span class="status-badge" :class="{
                                        'status-present': session.student_status_for_session === 'Present',
                                        'status-absent': session.student_status_for_session === 'Absent'
                                    }">
                                        {{ session.student_status_for_session }}
                                    </span>
                                </td>
                                <td data-label="First Scan" class="responsive-cell text-opacity-70">
                                    {{ session.first_scanned_at_for_session ?
                                        formatDate(session.first_scanned_at_for_session) : 'N/A' }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div v-else class="empty-state-table">
                    <i class="fas fa-calendar-times text-4xl opacity-50 mb-3"></i>
                    <p>No session history found for this student's class.</p>
                </div>
            </div>
        </div>

        <div v-else-if="!isLoading && !errorMsg" class="empty-state-card text-center">
            <i class="fas fa-user-slash text-4xl opacity-50 mb-4"></i>
            <p class="text-lg">Student Not Found</p>
            <p class="text-opacity-70">
                The requested student report could not be generated. The student may not exist.
            </p>
            <RouterLink :to="{ name: 'students' }" class="button-primary mt-6 text-sm py-2">
                <i class="fas fa-arrow-left mr-2"></i> Go Back to Students List
            </RouterLink>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, watch, reactive } from 'vue';
import { fetchStudentAttendanceSummary, getPublicImageUrl as getStorageFileUrlService } from '@/services/supabaseService';

const STUDENT_FACES_BUCKET = 'student-faces'; // Bucket for student profile/face images

const props = defineProps({
    studentId: {
        type: [String, Number],
        required: true
    }
});

const studentSummary = reactive({
    details: null,
    sessions: []
});
const isLoading = ref(true);
const errorMsg = ref(null);

function getDisplayableStudentFaceUrl(path) {
    return path ? getStorageFileUrlService(STUDENT_FACES_BUCKET, path) : null;
}

function formatDate(dateString, includeDate = false) {
    if (!dateString) return 'N/A';
    try {
        const options = { timeStyle: 'short' };
        if (includeDate) options.dateStyle = 'medium';
        return new Date(dateString).toLocaleString([], options);
    }
    catch (e) { return 'Invalid Date'; }
}

function getPercentageColor(percentageStr) {
    if (percentageStr === null || percentageStr === undefined) return 'text-lightText dark:text-darkText';
    const percentage = parseFloat(percentageStr);
    if (isNaN(percentage)) return 'text-lightText dark:text-darkText';

    if (percentage >= 80) return 'text-green-600 dark:text-green-400';
    if (percentage >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
}

async function loadStudentReport() {
    const numericStudentId = parseInt(props.studentId);
    if (isNaN(numericStudentId)) {
        errorMsg.value = "Invalid Student ID provided.";
        isLoading.value = false;
        studentSummary.details = null;
        studentSummary.sessions = [];
        return;
    }

    isLoading.value = true;
    errorMsg.value = null;
    try {
        const data = await fetchStudentAttendanceSummary(numericStudentId);
        if (data && data.length > 0) {
            studentSummary.details = {
                student_id: data[0].student_id,
                student_full_name: data[0].student_full_name,
                student_tag_uid: data[0].student_tag_uid,
                student_class_name: data[0].student_class_name,
                student_face_image_path: data[0].student_face_image_path, // Added this
                total_relevant_sessions: data[0].total_relevant_sessions,
                sessions_attended: data[0].sessions_attended,
                attendance_percentage: data[0].attendance_percentage
            };
            studentSummary.sessions = data.map(row => ({
                session_id: row.session_id,
                session_name: row.session_name,
                session_started_at: row.session_started_at,
                session_ended_at: row.session_ended_at,
                student_status_for_session: row.student_status_for_session,
                first_scanned_at_for_session: row.first_scanned_at_for_session
            })).filter(session => session.session_id !== null);
        } else {
            studentSummary.details = null;
            studentSummary.sessions = [];
            console.warn(`No summary data returned for student ID: ${numericStudentId}`);
        }
    } catch (err) {
        console.error("Error fetching student attendance summary:", err);
        errorMsg.value = err.message || "Failed to load student report.";
        studentSummary.details = null;
        studentSummary.sessions = [];
    } finally {
        isLoading.value = false;
    }
}

onMounted(loadStudentReport);
watch(() => props.studentId, loadStudentReport, { immediate: false });
</script>

<style lang="postcss" scoped>
.card {
    @apply bg-lightSurface dark:bg-darkSurface rounded-xl shadow dark:shadow-md-dark border border-gray-100 dark:border-darkBorder;
}

.card-title {
    @apply text-lg font-semibold text-lightText dark:text-darkText;
}

.info-label-inline {
    @apply font-medium text-lightTextSecondary dark:text-darkTextSecondary mr-1;
}

.table-card {
    @apply bg-lightSurface dark:bg-darkSurface rounded-xl shadow-lg dark:shadow-lg-dark border border-gray-100 dark:border-darkBorder;
}

/* Removed overflow-hidden */
.table-header {
    @apply px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-darkBorder flex justify-between items-center;
}

.table-title {
    @apply text-xl font-semibold text-lightText dark:text-darkText;
}

/* Wrapper for horizontal scrolling on medium screens if table still too wide */
.responsive-table-wrapper {
    @apply overflow-x-auto;
}

.data-table {
    @apply w-full;
}

.data-table th {
    @apply px-4 sm:px-6 py-3 text-left text-xs font-semibold text-lightTextSecondary dark:text-darkTextSecondary uppercase tracking-wider bg-gray-50 dark:bg-darkSurfaceLighter;
}

.data-table td {
    @apply px-4 sm:px-6 py-3 text-sm text-lightText dark:text-darkText border-b border-gray-100 dark:border-darkBorder;
}

/* Responsive Card Styles (applied below 'lg' breakpoint) */
@media (max-width: 1023px) {

    /* Tailwind's lg breakpoint is 1024px */
    .responsive-thead {
        @apply border-none clip-rect-0 absolute -m-px h-px w-px overflow-hidden whitespace-nowrap;
    }

    .responsive-row {
        @apply block mb-4 border border-gray-200 dark:border-darkBorder rounded-lg shadow-md overflow-hidden;
    }

    .responsive-row:last-child {
        @apply mb-0;
    }

    .responsive-cell {
        @apply block w-full px-4 py-2.5 text-sm border-b border-gray-100 dark:border-darkBorder text-right;
    }

    .responsive-cell:last-child {
        @apply border-b-0;
    }

    .responsive-cell::before {
        content: attr(data-label);
        @apply float-left font-semibold text-lightTextSecondary dark:text-darkTextSecondary mr-3 text-left;
    }

    .responsive-cell[data-label*="Session"],
    .responsive-cell[data-label*="Date"],
    .responsive-cell[data-label*="Scan"] {
        @apply text-left;
    }
}

.data-table tbody tr:last-child td {
    @apply border-b-0 lg:border-b;
}

.hover-row:hover {
    @apply bg-gray-50 dark:hover:bg-darkSurfaceLighter/50 transition-colors duration-150;
}

.status-badge {
    @apply px-2.5 py-1 text-xs font-semibold rounded-full capitalize;
}

.status-present {
    @apply status-badge bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300;
}

.status-absent {
    @apply status-badge bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300;
}

.loading-indicator {
    @apply flex justify-center items-center py-16 text-lightText dark:text-darkText;
}

.loading-indicator i {
    @apply text-primary dark:text-darkAccent;
}

.error-banner {
    @apply bg-red-100 border-l-4 border-red-500 text-red-700 p-4 flex justify-between items-start rounded;
}

.button-secondary {
    @apply px-4 py-2 bg-gray-100 dark:bg-darkSurfaceLighter text-lightTextSecondary dark:text-darkTextSecondary hover:bg-gray-200 dark:hover:bg-darkBorder text-sm font-medium rounded-lg transition-colors;
}

.button-primary {
    @apply flex items-center justify-center px-4 py-2 bg-primary hover:opacity-90 text-white text-sm font-medium rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed;
}

.empty-state-table {
    @apply text-center py-12 text-lightTextSecondary dark:text-darkTextSecondary;
}

.empty-state-card {
    @apply bg-lightSurface dark:bg-darkSurface p-8 rounded-xl shadow dark:shadow-md-dark border border-gray-100 dark:border-darkBorder text-lightText dark:text-darkText;
}

.clip-rect-0 {
    clip: rect(0 0 0 0);
}
</style>