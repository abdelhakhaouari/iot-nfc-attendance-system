<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { fetchDashboardData, endLatestSession } from '@/services/supabaseService'

const activeSession = ref(null)
const studentCount = ref(0)
const totalSessionCount = ref(0)
const isLoading = ref(true)
const errorMsg = ref(null)
const actionLoading = ref(false)

const router = useRouter()

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  try { return new Date(dateString).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); }
  catch (e) { return 'Invalid Date'; }
}

async function loadDashboard() {
  isLoading.value = true;
  errorMsg.value = null;
  try {
    const data = await fetchDashboardData();
    activeSession.value = data.activeSession;
    studentCount.value = data.studentCount;
    totalSessionCount.value = data.totalSessionCount;
  } catch (err) {
    console.error("Error fetching dashboard data:", err);
    errorMsg.value = `Failed to load dashboard: ${err.message}`;
  } finally {
    isLoading.value = false;
  }
}

onMounted(loadDashboard);

async function handleEndSession() {
  if (!activeSession.value) return;
  if (!confirm(`Are you sure you want to end the active session "${activeSession.value.name}"?`)) return;

  actionLoading.value = true;
  errorMsg.value = null;
  try {
    const success = await endLatestSession();
    if (success) {
      await loadDashboard(); // Refresh dashboard data
    } else {
      errorMsg.value = "Could not end session. It might have already ended or an error occurred.";
      await loadDashboard(); // Refresh state anyway
    }
  } catch (err) {
    errorMsg.value = `Error ending session: ${err.details || err.message}`;
    console.error(err);
  } finally {
    actionLoading.value = false;
  }
}

function goToStartSession() {
  router.push({ name: 'sessions' });
}
</script>

<template>
  <div class="animate-fade-in">
    <div v-if="isLoading" class="loading-indicator">
      <i class="fas fa-spinner fa-spin text-4xl text-primary dark:text-darkAccent"></i>
      <span class="ml-4 text-lg">Loading Dashboard...</span>
    </div>

    <div v-if="errorMsg && !isLoading" class="error-banner mb-6" role="alert">
      <div>
        <p class="font-bold">Error Loading Dashboard</p>
        <p>{{ errorMsg }}</p>
      </div>
      <button @click="errorMsg = null" class="ml-4" aria-label="Close"><i class="fas fa-times"></i></button>
    </div>

    <div v-if="!isLoading && !errorMsg">
      <section class="mb-8">
        <div v-if="activeSession" class="card">
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

        <div v-else class="card">
          <h2 class="card-title flex items-center">
            <span class="status-dot inactive"></span> No Active Session
          </h2>
          <p class="text-lightTextSecondary dark:text-darkTextSecondary mb-5">There is no session currently running.</p>
          <button @click="goToStartSession" class="button-primary w-full sm:w-auto">
            <i class="fas fa-play mr-2"></i> Go to Sessions Page to Start
          </button>
        </div>
      </section>

      <section class="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div class="stat-card">
          <div class="flex items-center justify-between mb-3">
            <p class="text-sm font-medium text-lightTextSecondary dark:text-darkTextSecondary">Registered Students</p>
            <i class="fas fa-users stat-icon"></i>
          </div>
          <p class="text-3xl font-semibold text-lightText dark:text-darkText">{{ studentCount }}</p>
        </div>
        <div class="stat-card">
          <div class="flex items-center justify-between mb-3">
            <p class="text-sm font-medium text-lightTextSecondary dark:text-darkTextSecondary">Sessions Recorded</p>
            <i class="fas fa-calendar-check stat-icon"></i>
          </div>
          <p class="text-3xl font-semibold text-lightText dark:text-darkText">{{ totalSessionCount }}</p>
        </div>
        <div class="stat-card">
          <div class="flex items-center justify-between mb-3">
            <p class="text-sm font-medium text-lightTextSecondary dark:text-darkTextSecondary">Reader Status</p>
            <i class="fas fa-wifi text-lg text-green-500"></i> 
          </div>
          <p class="text-3xl font-semibold text-lightText dark:text-darkText">Online</p>
        </div>
      </section>

      <section class="card">
        <h2 class="card-title text-lg">Quick Links</h2>
        <nav class="flex flex-wrap gap-4">
          <RouterLink :to="{ name: 'students' }" class="quick-link">
            <i class="fas fa-users mr-2 opacity-70"></i> Manage Students
          </RouterLink>
          <RouterLink :to="{ name: 'sessions' }" class="quick-link">
            <i class="fas fa-history mr-2 opacity-70"></i> Manage Sessions
          </RouterLink>
          <RouterLink :to="{ name: 'attendance' }" class="quick-link">
            <i class="fas fa-clipboard-check mr-2 opacity-70"></i> View Scan History
          </RouterLink>
        </nav>
      </section>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
.card {
  @apply bg-lightSurface dark:bg-darkSurface p-6 rounded-xl shadow dark:shadow-md-dark border border-gray-100 dark:border-darkBorder;
}

.card-title {
  @apply text-xl font-semibold text-lightText dark:text-darkText mb-4;
}

.info-label {
  @apply font-medium text-lightTextSecondary dark:text-darkTextSecondary block mb-0.5;
}

.stat-card {
  @apply bg-lightSurface dark:bg-darkSurface p-5 rounded-xl shadow dark:shadow-md-dark border border-gray-100 dark:border-darkBorder transition-all hover:shadow-lg hover:dark:shadow-accent/10;
}

.stat-icon {
  @apply text-lg text-primary dark:text-darkAccent opacity-70;
}

.quick-link {
  @apply flex items-center px-4 py-2 bg-gray-100 dark:bg-darkSurfaceLighter text-lightText dark:text-darkText hover:bg-gray-200 dark:hover:bg-darkBorder text-sm font-medium rounded-lg transition-colors;
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
.status-dot.inactive {
  background-color: #A0AEC0;
}

/* Gray */

/* Shared styles moved to a global CSS or a style block in App.vue would be better */
.loading-indicator {
  @apply flex justify-center items-center py-16 text-lightTextSecondary dark:text-darkTextSecondary;
}

.error-banner {
  @apply bg-red-100 border-l-4 border-red-500 text-red-700 p-4 flex justify-between items-start rounded;
}

.button-primary {
  @apply flex items-center justify-center px-5 py-2.5 bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white text-sm font-medium rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed;
}

.button-danger {
  @apply flex items-center justify-center px-4 py-2 bg-danger hover:bg-danger/90 text-white text-sm font-medium rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed;
}
</style>