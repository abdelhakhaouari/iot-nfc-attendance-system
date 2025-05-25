<template>
    <div class="animate-fade-in">
        <div v-if="isLoading && !report.length" class="loading-indicator">
            <i class="fas fa-spinner fa-spin text-4xl"></i>
            <span class="ml-4 text-lg">Loading Report...</span>
        </div>

        <div v-if="errorMsg && !isLoading" class="error-banner mb-6" role="alert">
            <div>
                <p class="font-bold">Notice</p>
                <p>{{ errorMsg }}</p>
            </div>
            <button @click="errorMsg = null" class="ml-4" aria-label="Close"><i class="fas fa-times"></i></button>
        </div>

        <div v-if="!isLoading || report.length > 0">
            <div class="report-header-card mb-6">
                <div class="flex justify-between items-center mb-1">
                    <h1 class="text-2xl font-semibold">Attendance Report</h1>
                    <RouterLink :to="{ name: 'sessions' }" class="button-secondary text-sm py-2">
                        <i class="fas fa-arrow-left mr-2"></i> Back to Sessions
                    </RouterLink>
                </div>
                <div v-if="sessionContext.name">
                    <p class="text-opacity-80">
                        For Session: <strong class="text-opacity-100">{{ sessionContext.name }}</strong>
                    </p>
                    <p class="text-opacity-80 flex items-center flex-wrap gap-x-2">
                        <span>Class: <strong class="text-opacity-100">{{ sessionContext.className }}</strong></span>
                        <span v-if="sessionContext.startedAt">| Started: {{ formatDate(sessionContext.startedAt, true)
                        }}</span>
                        <span v-if="sessionContext.endedAt">| Ended: {{ formatDate(sessionContext.endedAt, true)
                        }}</span>
                        <span v-else class="text-green-500 dark:text-green-400 font-semibold flex items-center text-sm">
                            <i class="fas fa-broadcast-tower fa-fw mr-1 animate-pulse"></i> LIVE
                        </span>
                        <span v-if="isRefreshingInBackground"
                            class="text-xs text-primary dark:text-darkAccent animate-pulse ml-2">
                            <i class="fas fa-sync fa-spin mr-1"></i> Refreshing...
                        </span>
                    </p>
                </div>
                <p v-else class="text-opacity-70">Details for session ID <span class="font-semibold">{{ sessionId
                }}</span> not fully loaded.</p>
            </div>

            <div v-if="report.length > 0" class="table-card">
                <div class="overflow-x-auto">
                    <table class="data-table min-w-[700px]">
                        <thead>
                            <tr>
                                <th>Student Name</th>
                                <th>Tag UID</th>
                                <th>Registered Class</th>
                                <th>Status</th>
                                <th>First Scan Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="entry in report" :key="entry.student_id" class="hover-row" :class="{
                                'bg-red-50 dark:bg-red-900/10 opacity-80 hover:opacity-100': entry.attendance_status === 'Absent',
                                'bg-yellow-50 dark:bg-yellow-900/10': entry.student_class_name !== entry.session_class_name && entry.attendance_status === 'Present',
                            }">
                                <td class="font-medium">{{ entry.student_full_name }}</td>
                                <td class="font-mono text-xs">{{ entry.student_tag_uid }}</td>
                                <td>
                                    {{ entry.student_class_name }}
                                    <span v-if="entry.student_class_name !== entry.session_class_name"
                                        class="mismatch-indicator"
                                        :title="`Student in '${entry.student_class_name}', session for '${entry.session_class_name}'`">
                                        <i class="fas fa-exclamation-triangle"></i> Mismatch
                                    </span>
                                </td>
                                <td>
                                    <span :class="{
                                        'status-present': entry.attendance_status === 'Present',
                                        'status-absent': entry.attendance_status === 'Absent'
                                    }">
                                        {{ entry.attendance_status }}
                                    </span>
                                </td>
                                <td class="text-opacity-70">
                                    {{ entry.first_scanned_at ? formatDate(entry.first_scanned_at) : 'N/A' }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <div v-else-if="!isLoading && !errorMsg" class="empty-state-card text-center">
                <i class="fas fa-clipboard-question text-4xl opacity-50 mb-4"></i>
                <p class="text-lg">No Attendance Data</p>
                <p class="text-opacity-70">
                    No attendance report could be generated for this session.
                </p>
                <p class="text-sm text-opacity-60 mt-1">This could be because no students are registered for the class
                    <strong class="text-opacity-80">
                        {{ sessionContext.className || 'associated with this session' }}</strong>,
                    or no attendance logs exist for them in this session.
                </p>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, reactive, computed } from 'vue';
import {
    fetchSessionAttendanceReport,
    fetchSessions,
    startListeningForSessionReportUpdates,
    stopListeningForSessionReportUpdates
} from '@/services/supabaseService';

const props = defineProps({
    sessionId: {
        type: [String, Number],
        required: true
    }
});

const report = ref([]);
const isLoading = ref(true);
const isRefreshingInBackground = ref(false);
const errorMsg = ref(null);
const sessionContext = reactive({ name: '', className: '', startedAt: null, endedAt: null });
const numericSessionId = computed(() => parseInt(props.sessionId));

function formatDate(dateString, includeDate = false) {
    if (!dateString) return 'N/A';
    try {
        const options = { timeStyle: 'short' };
        if (includeDate) options.dateStyle = 'medium';
        return new Date(dateString).toLocaleString([], options);
    }
    catch (e) { return 'Invalid Date'; }
}

async function loadReport(showFullLoading = true) {
    if (isNaN(numericSessionId.value)) {
        errorMsg.value = "Invalid Session ID provided.";
        isLoading.value = false;
        isRefreshingInBackground.value = false;
        return;
    }

    if (showFullLoading) {
        isLoading.value = true;
    } else {
        isRefreshingInBackground.value = true;
    }

    try {
        const [reportData, allSessions] = await Promise.all([
            fetchSessionAttendanceReport(numericSessionId.value),
            fetchSessions()
        ]);

        report.value = reportData || [];
        const currentSession = allSessions.find(s => s.id === numericSessionId.value);

        if (currentSession) {
            sessionContext.name = currentSession.name;
            sessionContext.className = currentSession.class_name;
            sessionContext.startedAt = currentSession.started_at;
            const prevEndedAt = sessionContext.endedAt;
            sessionContext.endedAt = currentSession.ended_at;

            if (sessionContext.endedAt && !prevEndedAt) {
                stopListeningForSessionReportUpdates(numericSessionId.value);
            } else if (!sessionContext.endedAt) {
                startListeningForSessionReportUpdates(numericSessionId.value, handleIncomingLogForThisReport, handleRealtimeError);
            }
        } else {
            sessionContext.name = reportData.length > 0 ? reportData[0].session_name : 'Unknown Session';
            sessionContext.className = reportData.length > 0 ? reportData[0].session_class_name : 'Unknown Class';
            sessionContext.startedAt = null;
            sessionContext.endedAt = new Date(); 
            stopListeningForSessionReportUpdates(numericSessionId.value);
        }
        if (!showFullLoading && errorMsg.value?.startsWith('Realtime')) {
            errorMsg.value = null;
        }
    } catch (err) {
        console.error("Error fetching session attendance report:", err);
        errorMsg.value = err.message || "Failed to load attendance report.";
    } finally {
        isLoading.value = false;
        isRefreshingInBackground.value = false;
    }
}

function handleIncomingLogForThisReport(payload) {
    console.log(`SessionReportView (${numericSessionId.value}): New log via service:`, payload.new);
    loadReport(false);
}

function handleRealtimeError(errorMessageFromService, errorObjectFromService) {
    console.error(`SessionReportView (${numericSessionId.value}): Realtime Error from service:`, errorMessageFromService, errorObjectFromService);
    errorMsg.value = `${errorMessageFromService}. Live updates might be affected.`;
}

onMounted(() => {
    loadReport(true);
});

onUnmounted(() => {
    stopListeningForSessionReportUpdates(numericSessionId.value);
});

watch(() => props.sessionId, (newId, oldId) => {
    if (newId !== oldId) {
        if (!isNaN(Number(oldId))) {
            stopListeningForSessionReportUpdates(Number(oldId));
        }
        loadReport(true); 
    }
}, { immediate: false });

</script>

<style lang="postcss" scoped>
.report-header-card {
    @apply bg-lightSurface dark:bg-darkSurface p-6 rounded-xl shadow dark:shadow-md-dark border border-gray-100 dark:border-darkBorder text-lightText dark:text-darkText;
}

.table-card {
    @apply bg-lightSurface dark:bg-darkSurface rounded-xl shadow-lg dark:shadow-lg-dark overflow-hidden border border-gray-100 dark:border-darkBorder;
}

.empty-state-card {
    @apply bg-lightSurface dark:bg-darkSurface p-8 rounded-xl shadow dark:shadow-md-dark border border-gray-100 dark:border-darkBorder text-lightText dark:text-darkText;
}

.data-table {
    @apply w-full;
}

.data-table th {
    @apply px-6 py-3 text-left text-xs font-semibold text-lightTextSecondary dark:text-darkTextSecondary uppercase tracking-wider bg-gray-50 dark:bg-darkSurfaceLighter sticky top-0 z-10;
}

.data-table td {
    @apply px-6 py-4 whitespace-nowrap text-sm text-lightText dark:text-darkText border-b border-gray-100 dark:border-darkBorder;
}

.data-table tbody tr:last-child td {
    @apply border-b-0;
}

.hover-row:hover {
    @apply bg-gray-100 dark:hover:bg-darkSurfaceLighter;
}

.mismatch-indicator {
    @apply ml-1 text-xs text-amber-600 dark:text-amber-400 font-medium inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-500/20 rounded;
}

.status-present {
    @apply text-green-700 dark:text-green-400 font-semibold;
}

.status-absent {
    @apply text-red-700 dark:text-red-400;
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
</style>