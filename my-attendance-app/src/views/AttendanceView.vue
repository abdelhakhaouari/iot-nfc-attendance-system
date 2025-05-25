<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
    fetchFilterOptions as fetchFilterOptionsService,
    fetchAttendanceLogs as fetchAttendanceLogsService,
    PREDEFINED_CLASSES,
    startListeningForNewAttendanceLogs,
    stopListeningForNewAttendanceLogs,
    getPublicImageUrl as getStorageFileUrlService,
    getSessionClassName,
    updateScanStatus as updateScanStatusService
} from '@/services/supabaseService';

const SCAN_CAPTURES_BUCKET = 'scan-captures';
const router = useRouter();

const attendanceLogs = ref([]);
const sessionsForFilter = ref([]);
const isLoading = ref(true);
const isLoadingFilters = ref(true);
const errorMsg = ref(null);
const successMsg = ref('');

const selectedSessionId = ref(null);
const selectedClass = ref(null);
const selectedScanStatusFilter = ref(null);

const availableClassesForFilter = computed(() => PREDEFINED_CLASSES);
const scanStatuses = ['accepted', 'rejected', 'doubtful'];

const viewingFullImageUrl = ref(null);
const editingStatusLogId = ref(null);
const newStatusForLog = ref('');

async function loadFilterOptions() {
    isLoadingFilters.value = true;
    try {
        const options = await fetchFilterOptionsService();
        sessionsForFilter.value = options.sessions;
    } catch (err) {
        errorMsg.value = `Error loading filter options: ${err.message}`;
        console.error(err);
    } finally {
        isLoadingFilters.value = false;
    }
}

async function loadAttendanceLogs(showLoadingIndicator = true) {
    if (showLoadingIndicator) isLoading.value = true;
    let currentError = null;
    try {
        const filters = {
            p_session_id_filter: selectedSessionId.value,
            p_class_name_filter: selectedClass.value,
            p_scan_status_filter: selectedScanStatusFilter.value // Assuming RPC is updated
        };
        // If RPC is NOT updated to filter by status, do client-side filtering after fetch:
        // const filtersForRpc = { p_session_id: selectedSessionId.value, p_class_name: selectedClass.value };
        // let fetchedLogs = await fetchAttendanceLogsService(filtersForRpc);
        // if (selectedScanStatusFilter.value) {
        //     fetchedLogs = fetchedLogs.filter(log => log.scan_status === selectedScanStatusFilter.value);
        // }

        const fetchedLogs = await fetchAttendanceLogsService(filters);
        attendanceLogs.value = fetchedLogs;

        if (!showLoadingIndicator && errorMsg.value?.startsWith('Realtime')) {
            errorMsg.value = null;
        }
    } catch (err) {
        currentError = `Error loading attendance logs: ${err.message}`;
        console.error(err);
    } finally {
        if (showLoadingIndicator) isLoading.value = false;
        if (currentError) errorMsg.value = currentError;
    }
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try { return new Date(dateString).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }); }
    catch (e) { return 'Invalid Date'; }
}

const filteredSessionsForDropdown = computed(() => {
    if (!selectedClass.value) return sessionsForFilter.value;
    return sessionsForFilter.value.filter(s => s.class_name === selectedClass.value);
});

watch(selectedClass, (newClassValue) => {
    if (selectedSessionId.value) {
        const currentSession = sessionsForFilter.value.find(s => s.id === selectedSessionId.value);
        if (currentSession && currentSession.class_name !== newClassValue) {
            selectedSessionId.value = null;
        }
    }
});

watch([selectedSessionId, selectedClass, selectedScanStatusFilter], () => loadAttendanceLogs(true));

function registerStudentFromLog(log) {
    router.push({
        name: 'students',
        query: {
            tag_uid: log.tag_uid,
            suggested_class: PREDEFINED_CLASSES.includes(log.session_class_name) ? log.session_class_name : ''
        }
    });
}

function getDisplayableScanFaceUrl(path) {
    return path ? getStorageFileUrlService(SCAN_CAPTURES_BUCKET, path) : null;
}

async function handleIncomingNewLog(payload) {
    console.log('AttendanceView: New log received via service:', payload.new);
    const newLogData = payload.new;
    const sessionMatches = !selectedSessionId.value || newLogData.session_id === selectedSessionId.value;
    const statusMatches = !selectedScanStatusFilter.value || newLogData.scan_status === selectedScanStatusFilter.value;

    if (sessionMatches && statusMatches) {
        if (selectedClass.value) {
            const sessionClassName = await getSessionClassName(newLogData.session_id);
            if (sessionClassName && sessionClassName === selectedClass.value) {
                loadAttendanceLogs(false);
            }
        } else {
            loadAttendanceLogs(false);
        }
    }
}

function handleRealtimeError(errorMessageFromService, errorObjectFromService) {
    console.error("AttendanceView: Realtime Error from service:", errorMessageFromService, errorObjectFromService);
    errorMsg.value = `${errorMessageFromService}. Live updates might be affected.`;
}

onMounted(async () => {
    await loadFilterOptions();
    await loadAttendanceLogs(true);
    startListeningForNewAttendanceLogs(handleIncomingNewLog, handleRealtimeError);
});

onUnmounted(() => {
    stopListeningForNewAttendanceLogs();
});

function showFullImageModal(url) { if (url) viewingFullImageUrl.value = url; }
function closeFullImageModal() { viewingFullImageUrl.value = null; }

function getStatusClass(status) {
    switch (status) {
        case 'accepted': return 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300';
        case 'rejected': return 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300';
        case 'doubtful': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300';
        default: return 'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-200';
    }
}

function openStatusEditor(log) {
    editingStatusLogId.value = log.log_id;
    newStatusForLog.value = log.scan_status;
}

function cancelStatusEdit() {
    editingStatusLogId.value = null;
}

async function submitScanStatusUpdate(logId) {
    if (editingStatusLogId.value !== logId) return;
    if (!newStatusForLog.value) { alert("Please select a new status."); return; }

    const logIndex = attendanceLogs.value.findIndex(l => l.log_id === logId);
    const originalLog = attendanceLogs.value[logIndex];
    const originalStatus = originalLog ? originalLog.scan_status : null;

    if (originalLog) attendanceLogs.value[logIndex] = { ...originalLog, scan_status: newStatusForLog.value };
    const statusBeingSubmitted = newStatusForLog.value;
    cancelStatusEdit();

    successMsg.value = ''; errorMsg.value = null;
    try {
        const success = await updateScanStatusService(logId, statusBeingSubmitted, null);
        if (success) {
            successMsg.value = `Status for log #${logId} updated to ${statusBeingSubmitted.replace('_', ' ')}.`;
            if (selectedScanStatusFilter.value && statusBeingSubmitted !== selectedScanStatusFilter.value) {
                await loadAttendanceLogs(false);
            }
            setTimeout(() => successMsg.value = '', 4000);
        } else {
            errorMsg.value = "Failed to update scan status.";
            if (originalLog && originalStatus !== null && logIndex !== -1) attendanceLogs.value[logIndex] = { ...originalLog, scan_status: originalStatus };
        }
    } catch (err) {
        errorMsg.value = `Error updating status: ${err.message}`;
        if (originalLog && originalStatus !== null && logIndex !== -1) attendanceLogs.value[logIndex] = { ...originalLog, scan_status: originalStatus };
    }
}
</script>

<template>
    <div class="animate-fade-in">
        <div class="filters-card mb-6">
            <!-- Class Filter -->
            <div class="filter-item">
                <label for="class-filter" class="form-label">Class:</label>
                <select id="class-filter" v-model="selectedClass" :disabled="isLoadingFilters" class="filter-select">
                    <option :value="null">All Classes</option>
                    <option v-if="isLoadingFilters" disabled>Loading...</option>
                    <option v-for="className in availableClassesForFilter" :key="className" :value="className">
                        {{ className }}
                    </option>
                </select>
            </div>
            <!-- Session Filter -->
            <div class="filter-item">
                <label for="session-filter" class="form-label">Session:</label>
                <select id="session-filter" v-model="selectedSessionId"
                    :disabled="isLoadingFilters || (!selectedClass && !sessionsForFilter.length) || (selectedClass && !filteredSessionsForDropdown.length)"
                    class="filter-select">
                    <option :value="null">{{ selectedClass ? `All ${selectedClass} Sessions` : 'All Sessions' }}
                    </option>
                    <option v-if="isLoadingFilters" disabled>Loading...</option>
                    <option
                        v-else-if="filteredSessionsForDropdown.length === 0 && (selectedClass || sessionsForFilter.length === 0)"
                        disabled>
                        No sessions {{ selectedClass ? `for ${selectedClass}` : '' }}
                    </option>
                    <option v-for="session in filteredSessionsForDropdown" :key="session.id" :value="session.id">
                        {{ session.name }} ({{ session.class_name }})
                    </option>
                </select>
            </div>
            <!-- Status Filter -->
            <div class="filter-item">
                <label for="status-filter" class="form-label">Scan Status:</label>
                <select id="status-filter" v-model="selectedScanStatusFilter" :disabled="isLoadingFilters"
                    class="filter-select">
                    <option :value="null">All Statuses</option>
                    <option v-for="status in scanStatuses" :key="status" :value="status" class="capitalize">
                        {{ status.replace('_', ' ') }}
                    </option>
                </select>
            </div>
        </div>

        <div v-if="successMsg" class="success-banner mb-6" role="alert">
            <div>
                <p>{{ successMsg }}</p>
            </div>
            <button @click="successMsg = ''" class="ml-4" aria-label="Close"><i class="fas fa-times"></i></button>
        </div>
        <div v-if="errorMsg" class="error-banner mb-6" role="alert">
            <div>
                <p class="font-bold">Notice</p>
                <p>{{ errorMsg }}</p>
            </div>
            <button @click="errorMsg = null" class="ml-4" aria-label="Close"><i class="fas fa-times"></i></button>
        </div>

        <div class="table-card">
            <div class="table-header">
                <h2 class="table-title">Raw Attendance Scan History</h2>
                <div class="flex items-center gap-2">
                    <span v-if="isLoading && attendanceLogs.length > 0"
                        class="text-sm text-primary dark:text-darkAccent animate-pulse">
                        <i class="fas fa-sync fa-spin mr-1"></i> Refreshing...
                    </span>
                    <span v-if="!isLoading && !errorMsg" class="record-count">{{ attendanceLogs.length }} Records</span>
                </div>
            </div>

            <div v-if="isLoading && attendanceLogs.length === 0" class="loading-indicator-table">
                <i class="fas fa-spinner fa-spin text-3xl mb-3 text-primary dark:text-darkAccent"></i>
                Loading attendance logs...
            </div>

            <!-- Responsive Table Wrapper -->
            <div v-else-if="attendanceLogs.length > 0" class="responsive-table-wrapper">
                <table class="data-table">
                    <thead class="responsive-thead">
                        <tr>
                            <th class="w-16 text-center px-2 hidden lg:table-cell">Scan Photo</th>
                            <th>Scan Time</th>
                            <th>Student</th>
                            <th>Session</th>
                            <th>Status</th>
                            <th class="text-center px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="log in attendanceLogs" :key="log.log_id" class="responsive-row group">
                            <td data-label="Scan Photo" class="responsive-cell text-center px-2 py-1.5">
                                <img v-if="log.scan_face_image_path"
                                    :src="getDisplayableScanFaceUrl(log.scan_face_image_path)" alt="Scan capture"
                                    class="w-10 h-10 lg:w-12 lg:h-12 rounded object-cover inline-block cursor-pointer border dark:border-darkBorder shadow-sm hover:scale-125 transition-transform"
                                    @click="showFullImageModal(getDisplayableScanFaceUrl(log.scan_face_image_path))">
                                <div v-else
                                    class="w-10 h-10 lg:w-12 lg:h-12 rounded bg-gray-200 dark:bg-darkSurfaceLighter flex items-center justify-center text-lightTextSecondary dark:text-darkTextSecondary text-xl lg:text-2xl mx-auto lg:mx-0">
                                    <i class="fas fa-camera"></i>
                                </div>
                            </td>
                            <td data-label="Scan Time" class="responsive-cell text-opacity-70 whitespace-nowrap">{{
                                formatDate(log.scan_time) }}</td>
                            <td data-label="Student" class="responsive-cell font-medium whitespace-nowrap">
                                <div class="flex flex-col">
                                    <span>
                                        {{ log.student_name || '(Unregistered Tag)' }}
                                        <span v-if="!log.student_name" class="unregistered-indicator"
                                            title="Tag UID not found in student registry.">
                                            <i class="fas fa-exclamation-circle"></i>
                                        </span>
                                    </span>
                                    <span
                                        class="font-mono text-xs text-lightTextSecondary dark:text-darkTextSecondary mt-0.5">{{
                                            log.tag_uid }}</span>
                                </div>
                            </td>
                            <td data-label="Session" class="responsive-cell whitespace-nowrap">
                                <div class="flex flex-col">
                                    <span>{{ log.session_name || 'N/A' }}</span>
                                    <span class="text-xs text-lightTextSecondary dark:text-darkTextSecondary mt-0.5">{{
                                        log.session_class_name || 'N/A' }}</span>
                                </div>
                            </td>
                            <td data-label="Status" class="responsive-cell whitespace-nowrap py-2">
                                <div v-if="editingStatusLogId !== log.log_id"
                                    class="flex items-center justify-start min-w-[150px]">
                                    <span class="status-badge" :class="getStatusClass(log.scan_status)">
                                        {{ log.scan_status.replace('_', ' ') }}
                                    </span>
                                    <button @click="openStatusEditor(log)" title="Change Status"
                                        class="status-edit-button">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                </div>
                                <div v-else class="flex items-center gap-1.5 min-w-[150px]">
                                    <select v-model="newStatusForLog"
                                        class="filter-select !h-8 !text-xs !py-1 flex-grow !min-w-[100px]">
                                        <option v-for="statusOpt in scanStatuses" :key="statusOpt" :value="statusOpt"
                                            class="capitalize">
                                            {{ statusOpt.replace('_', ' ') }}
                                        </option>
                                    </select>
                                    <button @click="submitScanStatusUpdate(log.log_id)" title="Save Status"
                                        class="status-action-button text-green-600 dark:text-green-400 hover:bg-green-500/10">
                                        <i class="fas fa-check"></i> </button>
                                    <button @click="cancelStatusEdit" title="Cancel Edit"
                                        class="status-action-button text-red-500 dark:text-red-400 hover:bg-red-500/10">
                                        <i class="fas fa-times"></i> </button>
                                </div>
                            </td>
                            <td data-label="Actions" class="responsive-cell text-center px-4">
                                <button v-if="!log.student_name" @click="registerStudentFromLog(log)"
                                    title="Register this Tag UID" class="button-link-primary text-xs">
                                    <i class="fas fa-user-plus mr-1"></i> Register
                                </button>
                                <span v-else class="text-xs text-gray-400 dark:text-gray-600 hidden lg:inline">-</span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div v-else-if="!isLoading && !errorMsg" class="empty-state-table">
                <i class="fas fa-search text-4xl opacity-50 mb-3"></i>
                <p>No attendance logs found matching the current filters.</p>
            </div>
        </div>

        <div v-if="viewingFullImageUrl" @click.self="closeFullImageModal"
            class="fixed inset-0 bg-black/80 flex items-center justify-center z-[999] p-4 animate-fade-in_Erscheinungsbild">
            <div class="relative bg-lightSurface dark:bg-darkSurface p-2 rounded-lg shadow-xl max-w-lg max-h-[80vh]">
                <img :src="viewingFullImageUrl" alt="Full scan capture"
                    class="block max-w-full max-h-[calc(80vh-4rem)] object-contain rounded">
                <button @click="closeFullImageModal"
                    class="absolute -top-3 -right-3 text-white bg-danger rounded-full h-8 w-8 flex items-center justify-center text-lg hover:bg-danger/80 transition-colors"
                    aria-label="Close image modal">
                    ×
                </button>
            </div>
        </div>
    </div>
</template>

<style lang="postcss" scoped>
.filters-card {
    @apply bg-lightSurface dark:bg-darkSurface p-4 rounded-lg shadow dark:shadow-md-dark border border-gray-100 dark:border-darkBorder flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end;
    /* Allow wrapping for filters */
}

.filter-item {
    @apply flex-grow w-full md:w-auto md:min-w-[200px];
    /* Control width of filter items */
}

.form-label {
    @apply block text-sm font-medium text-lightTextSecondary dark:text-darkTextSecondary mb-1;
}

.filter-select {
    @apply w-full px-3 py-2 border border-gray-300 dark:border-darkBorder rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary dark:bg-darkSurfaceLighter dark:text-darkText dark:focus:ring-darkAccent dark:focus:border-darkAccent text-sm disabled:opacity-50 disabled:cursor-not-allowed h-[42px];
}

.table-card {
    @apply bg-lightSurface dark:bg-darkSurface rounded-xl shadow-lg dark:shadow-lg-dark border border-gray-100 dark:border-darkBorder;
}

/* Removed overflow-hidden to let wrapper handle scroll */
.table-header {
    @apply px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-darkBorder flex justify-between items-center flex-wrap gap-2;
}

.table-title {
    @apply text-xl font-semibold text-lightText dark:text-darkText;
}

.record-count {
    @apply text-sm font-medium text-lightTextSecondary dark:text-darkTextSecondary bg-gray-100 dark:bg-darkSurfaceLighter px-3 py-1 rounded-full;
}

/* Wrapper for horizontal scrolling on medium screens if table still too wide */
.responsive-table-wrapper {
    @apply overflow-x-auto;
}

.data-table {
    @apply w-full;
}

/* min-width will be set by content or CSS for medium screens if needed */

/* Desktop table headers */
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
        /* Hide table header on small screens */
        @apply border-none clip-rect-0 absolute -m-px h-px w-px overflow-hidden whitespace-nowrap;
        /* clip-rect-0 is a common utility for sr-only: clip: rect(0 0 0 0); */
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
        /* Use data-label for headers */
        @apply float-left font-semibold text-lightTextSecondary dark:text-darkTextSecondary mr-3 text-left;
    }

    /* Specific adjustments for certain "card" cells */
    .responsive-cell[data-label="Scan Photo"] {
        @apply py-3 text-center;
    }

    .responsive-cell[data-label="Scan Photo"]::before {
        @apply hidden;
    }

    /* Photo is self-explanatory */
    .responsive-cell[data-label="Actions"] {
        @apply text-center;
    }

    .responsive-cell[data-label="Actions"]::before {
        @apply hidden;
    }

    .responsive-cell[data-label*="Student"],
    .responsive-cell[data-label*="Session"] {
        @apply text-left;
    }

    /* Align Student/Session info left */
    .responsive-cell[data-label*="Student"]::before,
    .responsive-cell[data-label*="Session"]::before {
        @apply font-bold;
    }
}


.data-table tbody tr:last-child td {
    @apply border-b-0 lg:border-b;
}

/* No bottom border for last cell in card view */
.hover-row:hover {
    @apply bg-gray-50 dark:hover:bg-darkSurfaceLighter/50 transition-colors duration-150;
}

.status-badge {
    @apply px-2.5 py-1 text-xs font-semibold rounded-full capitalize;
}

.status-edit-button {
    @apply ml-2 text-lightTextSecondary dark:text-darkTextSecondary hover:text-primary dark:hover:text-darkAccent opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 text-sm p-1 rounded-md hover:bg-gray-100 dark:hover:bg-darkSurfaceLighter;
}

.status-action-button {
    @apply p-1.5 rounded-md;
}


.unregistered-indicator {
    @apply text-amber-600 dark:text-amber-400 ml-1 text-xs;
}

.button-link-primary {
    @apply text-primary dark:text-darkAccent hover:opacity-75 font-medium px-2 py-1 transition-opacity focus:outline-none focus:ring-1 focus:ring-primary/50 dark:focus:ring-darkAccent/50 rounded border border-primary/30 dark:border-darkAccent/30;
}

.loading-indicator-table {
    @apply text-center py-16 text-lightTextSecondary dark:text-darkTextSecondary flex flex-col items-center;
}

.empty-state-table {
    @apply text-center py-16 text-lightTextSecondary dark:text-darkTextSecondary;
}

.error-banner {
    @apply bg-red-100 border-l-4 border-red-500 text-red-700 p-4 flex justify-between items-start rounded;
}

.success-banner {
    @apply bg-green-100 border-l-4 border-green-500 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300 p-4 flex justify-between items-start rounded;
}

.loading-indicator-table i {
    @apply text-primary dark:text-darkAccent;
}

.animate-fade-in_Erscheinungsbild {
    animation: fadeInModal 0.3s ease-out forwards;
}

@keyframes fadeInModal {
    from {
        opacity: 0;
        transform: scale(0.95);
    }

    to {
        opacity: 1;
        transform: scale(1);
    }
}

.clip-rect-0 {
    clip: rect(0 0 0 0);
}
</style>