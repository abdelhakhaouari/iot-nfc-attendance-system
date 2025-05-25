<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
    fetchSessions as fetchSessionsService,
    startSession as startSessionService,
    endLatestSession as endLatestSessionService,
    PREDEFINED_CLASSES // Import predefined classes
} from '@/services/supabaseService'

const router = useRouter()

const sessions = ref([])
const isLoading = ref(true)
const errorMsg = ref(null)
const actionLoading = ref(false) // For start/end buttons specifically
const newSessionName = ref('')
const newSessionClass = ref('') // Will hold selected class

const availableClasses = computed(() => PREDEFINED_CLASSES);

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try { return new Date(dateString).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); }
    catch (e) { return 'Invalid Date'; }
}

async function loadSessions() {
    isLoading.value = true;
    errorMsg.value = null; // Clear previous errors
    try {
        sessions.value = await fetchSessionsService();
    } catch (err) {
        errorMsg.value = `Error fetching sessions: ${err.message}`;
        console.error(err);
    } finally {
        isLoading.value = false;
    }
}

onMounted(loadSessions);

const activeSession = computed(() => sessions.value.find(s => s.ended_at === null));

async function handleStartSession() {
    if (!newSessionName.value.trim()) {
        errorMsg.value = "Session Name is required."; return;
    }
    if (!newSessionClass.value) {
        errorMsg.value = "Class Name is required."; return;
    }
    if (activeSession.value) {
        errorMsg.value = "Another session is already active. Please end it first."; return;
    }

    actionLoading.value = true;
    errorMsg.value = null;
    try {
        await startSessionService(newSessionName.value, newSessionClass.value);
        newSessionName.value = '';
        newSessionClass.value = ''; // Reset form
        await loadSessions(); // Refresh list
    } catch (err) {
        errorMsg.value = `Error starting session: ${err.details || err.message}`;
        console.error(err);
    } finally {
        actionLoading.value = false;
    }
}

async function handleEndSession() {
    if (!activeSession.value) {
        errorMsg.value = "No active session found to end."; return;
    }
    if (!confirm(`Are you sure you want to end the active session "${activeSession.value.name}"?`)) return;

    actionLoading.value = true;
    errorMsg.value = null;
    try {
        const success = await endLatestSessionService();
        if (success) {
            await loadSessions();
        } else {
            errorMsg.value = "Failed to end session (maybe already ended or an error occurred).";
            await loadSessions(); // Refresh state to be sure
        }
    } catch (err) {
        errorMsg.value = `Error ending session: ${err.details || err.message}`;
        console.error(err);
    } finally {
        actionLoading.value = false;
    }
}

function viewSessionReport(sessionId) {
    router.push({ name: 'session-report', params: { sessionId } });
}
</script>

<template>
    <div class="animate-fade-in">
        <div v-if="actionLoading" class="processing-indicator">
            <i class="fas fa-spinner fa-spin mr-2"></i> Processing...
        </div>

        <div v-if="errorMsg && !actionLoading" class="error-banner mb-6" role="alert">
            <div>
                <p class="font-bold">Error</p>
                <p>{{ errorMsg }}</p>
            </div>
            <button @click="errorMsg = null" class="ml-4" aria-label="Close"><i class="fas fa-times"></i></button>
        </div>

        <section class="mb-8">
            <!-- Start Form or Active Session Display -->
            <div v-if="!isLoading" class="card">
                <div v-if="!activeSession">
                    <h2 class="card-title">Start New Session</h2>
                    <form @submit.prevent="handleStartSession" class="space-y-4">
                        <div>
                            <label for="session-name" class="form-label">Session Name:</label>
                            <input id="session-name" v-model="newSessionName" type="text" required class="input-field"
                                placeholder="e.g., CS101 Lecture 1">
                        </div>
                        <div>
                            <label for="session-class" class="form-label">Class Name:</label>
                            <select id="session-class" v-model="newSessionClass" required class="input-field">
                                <option value="" disabled>-- Select a Class --</option>
                                <option v-for="cls in availableClasses" :key="cls" :value="cls">{{ cls }}</option>
                            </select>
                        </div>
                        <button type="submit" :disabled="actionLoading" class="button-primary w-full sm:w-auto">
                            <i class="fas fa-play mr-2"></i> {{ actionLoading ? 'Starting...' : 'Start Session' }}
                        </button>
                    </form>
                </div>
                <div v-else> <!-- Active Session Display -->
                    <h2 class="card-title flex items-center">
                        <span class="status-dot active animate-pulse"></span> Currently Active Session
                    </h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 mb-5">
                        <p><strong class="info-label">Name:</strong> {{ activeSession.name }}</p>
                        <p><strong class="info-label">Class:</strong> {{ activeSession.class_name }}</p>
                        <p class="col-span-1 md:col-span-2"><strong class="info-label">Started:</strong>
                            {{ formatDate(activeSession.started_at) }}</p>
                    </div>
                    <button @click="handleEndSession" :disabled="actionLoading" class="button-danger w-full sm:w-auto">
                        <i class="fas fa-stop-circle mr-2"></i> {{ actionLoading ? 'Ending...' : 'End This Session' }}
                    </button>
                </div>
            </div>
            <div v-if="isLoading" class="card opacity-60">
                <div class="h-6 bg-gray-200 dark:bg-darkSurfaceLighter rounded w-3/5 mb-4 animate-pulse"></div>
                <div class="h-4 bg-gray-200 dark:bg-darkSurfaceLighter rounded w-4/5 mb-2 animate-pulse"></div>
                <div class="h-4 bg-gray-200 dark:bg-darkSurfaceLighter rounded w-1/2 mb-5 animate-pulse"></div>
                <div class="h-10 bg-gray-200 dark:bg-darkSurfaceLighter rounded w-36 animate-pulse"></div>
            </div>
        </section>

        <section class="table-card">
            <h2 class="table-title mb-0 py-4 px-6">Session History</h2>
            <div v-if="isLoading && sessions.length === 0" class="loading-indicator-table">
                <i class="fas fa-spinner fa-spin text-2xl mr-2"></i>Loading history...
            </div>
            <div v-else-if="!isLoading && sessions.length === 0" class="empty-state-table">
                <i class="fas fa-history text-4xl opacity-50 mb-3"></i>
                <p>No session history found.</p>
            </div>
            <div v-else class="overflow-x-auto ">
                <table class="data-table  ">
                    <thead>
                        <tr>
                            <th>Status</th>
                            <th>Name</th>
                            <th>Class</th>
                            <th>Started At</th>
                            <th>Ended At</th>
                            <th class="text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="session in sessions" :key="session.id">
                            <td>
                                <span v-if="!session.ended_at" class="status-badge active">
                                    <span class="status-dot active mr-1.5"></span>Active
                                </span>
                                <span v-else class="status-badge inactive">Completed</span>
                            </td>
                            <td class="font-medium">{{ session.name }}</td>
                            <td>{{ session.class_name }}</td>
                            <td class="text-opacity-70">{{ formatDate(session.started_at) }}</td>
                            <td class="text-opacity-70">{{ formatDate(session.ended_at) }}</td>
                            <td class="text-center">
                                <button @click="viewSessionReport(session.id)" title="View Attendance Report"
                                    class="action-button text-primary dark:text-darkAccent text-sm">
                                    <i class="fas fa-clipboard-list mr-1"></i> Report
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>
    </div>
</template>

<style lang="postcss" scoped>
/* Shared styles (ideally global or from App.vue) */
.card {
    @apply bg-lightSurface dark:bg-darkSurface p-6 rounded-xl shadow dark:shadow-md-dark border border-gray-100 dark:border-darkBorder;
}

.card-title {
    @apply text-xl font-semibold text-lightText dark:text-darkText mb-4;
}

.info-label {
    @apply font-medium text-lightTextSecondary dark:text-darkTextSecondary block mb-0.5;
}

.form-label {
    @apply block text-sm font-medium text-lightTextSecondary dark:text-darkTextSecondary mb-1;
}

.table-card {
    @apply bg-lightSurface dark:bg-darkSurface rounded-xl shadow-lg dark:shadow-lg-dark overflow-hidden border border-gray-100 dark:border-darkBorder;
}

.table-title {
    @apply text-xl font-semibold text-lightText dark:text-darkText;
}

.data-table {
    @apply w-full;
}

.data-table th {
    @apply px-6 py-3 text-left text-xs font-semibold text-lightTextSecondary dark:text-darkTextSecondary uppercase tracking-wider bg-gray-50 dark:bg-darkSurfaceLighter;
}

.data-table td {
    @apply px-6 py-4 whitespace-nowrap text-sm text-lightText dark:text-darkText border-b border-gray-100 dark:border-darkBorder;
}

.data-table tbody tr:last-child td {
    @apply border-b-0;
}

.data-table tbody tr:hover {
    @apply bg-gray-50 dark:hover:bg-darkSurfaceLighter/50 transition-colors duration-150;
}

.action-button {
    @apply hover:opacity-75 p-1 transition-opacity focus:outline-none focus:ring-2 focus:ring-opacity-50 rounded;
}

.action-button.text-primary {
    @apply focus:ring-primary dark:focus:ring-darkAccent;
}

.status-dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    margin-right: 8px;
}

.status-dot.active {
    background-color: #10B981;
}

/* Green */
.status-badge {
    @apply px-2.5 py-0.5 rounded-full text-xs font-medium inline-flex items-center;
}

.status-badge.active {
    @apply bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300;
}

.status-badge.inactive {
    @apply bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300;
}

.input-field {
    @apply w-full px-3 py-2 border border-gray-300 dark:border-darkBorder rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary dark:bg-darkSurfaceLighter dark:text-darkText dark:focus:ring-darkAccent dark:focus:border-darkAccent;
}

.button-primary {
    @apply flex items-center justify-center px-5 py-2.5 bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white text-sm font-medium rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed;
}

.button-danger {
    @apply flex items-center justify-center px-4 py-2 bg-danger hover:bg-danger/90 text-white text-sm font-medium rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed;
}

.error-banner {
    @apply bg-red-100 border-l-4 border-red-500 text-red-700 p-4 flex justify-between items-start rounded;
}

.processing-indicator {
    @apply fixed top-20 right-6 bg-blue-100 dark:bg-blue-900 border border-blue-400 dark:border-blue-700 text-blue-700 dark:text-blue-200 px-4 py-2 rounded shadow-lg z-50 flex items-center;
}

.loading-indicator-table {
    @apply text-center py-10 text-lightTextSecondary dark:text-darkTextSecondary;
}

.empty-state-table {
    @apply text-center py-10 text-lightTextSecondary dark:text-darkTextSecondary;
}
</style>