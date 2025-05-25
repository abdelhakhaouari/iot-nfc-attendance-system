<script setup>
import { ref, onMounted, nextTick, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
    fetchStudents as fetchStudentsService,
    addStudent as addStudentService,
    updateStudent as updateStudentService,
    deleteStudent as deleteStudentService,
    PREDEFINED_CLASSES,
    uploadFile as uploadStudentFaceService,
    getPublicImageUrl as getStudentFaceUrlService,
    deleteFile as deleteStudentFaceService
} from '@/services/supabaseService';

const STUDENT_FACES_BUCKET = 'student-faces';

const route = useRoute();
const router = useRouter();

const students = ref([]);
const isLoading = ref(true);
const errorMsg = ref(null);
const showForm = ref(false);
const editingStudent = ref(null);
const formIsLoading = ref(false);
const formErrorMsg = ref(null);

// Filters
const nameFilter = ref('');
const classFilter = ref(null); // Null for 'All Classes'

const availableClassesForFilter = computed(() => PREDEFINED_CLASSES);

const initialFormData = () => ({ id: null, tag_uid: '', full_name: '', class_name: '', face_image_path: null });
const formData = ref(initialFormData());

const imagePreviewUrl = ref(null);
const selectedFileToUpload = ref(null);

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try { return new Date(dateString).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch (e) { return 'Invalid Date'; }
}

async function loadStudents() {
    isLoading.value = true;
    errorMsg.value = null;
    try {
        students.value = await fetchStudentsService({
            name: nameFilter.value || null,
            className: classFilter.value
        });
    } catch (err) {
        errorMsg.value = `Error loading students: ${err.message}`;
        console.error(err);
        students.value = [];
    } finally {
        isLoading.value = false;
    }
}

watch([nameFilter, classFilter], () => {
    // Simple debounce to avoid too many API calls while typing
    // You might want a more sophisticated debounce utility for production
    let debounceTimer;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        loadStudents();
    }, 500); // 500ms delay
});

onMounted(() => {
    loadStudents();
    if (route.query.tag_uid) {
        let suggestedClass = route.query.suggested_class || '';
        if (suggestedClass && !availableClassesForFilter.value.includes(suggestedClass)) {
            suggestedClass = '';
        }
        openAddForm(route.query.tag_uid, suggestedClass);
    }
});

function getDisplayableStudentFaceUrl(path) {
    return path ? getStudentFaceUrlService(STUDENT_FACES_BUCKET, path) : null;
}

function handleFileSelected(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        selectedFileToUpload.value = file;
        imagePreviewUrl.value = URL.createObjectURL(file);
    } else {
        selectedFileToUpload.value = null;
        imagePreviewUrl.value = null;
        if (file) alert("Please select a valid image file (JPEG, PNG, WebP).");
    }
}

function clearSelectedImage() {
    selectedFileToUpload.value = null;
    imagePreviewUrl.value = null;
    if (editingStudent.value) {
        formData.value.face_image_path = null;
    }
    const fileInput = document.getElementById('face_image');
    if (fileInput) fileInput.value = '';
}


function openAddForm(prefillTagUid = null, prefillClassName = null) {
    editingStudent.value = null;
    formData.value = initialFormData();
    if (prefillTagUid) formData.value.tag_uid = prefillTagUid.toUpperCase();
    if (prefillClassName) formData.value.class_name = prefillClassName;
    clearSelectedImage();
    formErrorMsg.value = null;
    showForm.value = true;
    nextTick(() => {
        const nameInput = document.getElementById('full_name');
        const tagInput = document.getElementById('tag_uid');
        if (formData.value.tag_uid && nameInput) nameInput.focus();
        else if (tagInput) tagInput.focus();
        document.getElementById('student-form-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

function openEditForm(student) {
    editingStudent.value = { ...student };
    formData.value = {
        id: student.id,
        tag_uid: student.tag_uid,
        full_name: student.full_name,
        class_name: student.class_name,
        face_image_path: student.face_image_path || null,
    };
    selectedFileToUpload.value = null;
    imagePreviewUrl.value = getDisplayableStudentFaceUrl(formData.value.face_image_path);
    formErrorMsg.value = null;
    showForm.value = true;
    nextTick(() => {
        document.getElementById('full_name')?.focus();
        document.getElementById('student-form-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

function closeForm() {
    showForm.value = false;
    editingStudent.value = null;
    formErrorMsg.value = null;
    formData.value = initialFormData();
    clearSelectedImage();
    if (route.query.tag_uid || route.query.suggested_class) {
        router.replace({ query: {} });
    }
}

async function handleSubmit() {
    if (!formData.value.full_name.trim()) {
        formErrorMsg.value = "Full Name is required."; return;
    }
    if (!formData.value.class_name) {
        formErrorMsg.value = "Class Name is required."; return;
    }
    if (!editingStudent.value && !formData.value.tag_uid.trim()) {
        formErrorMsg.value = "Tag UID is required for new students."; return;
    }

    formIsLoading.value = true;
    formErrorMsg.value = null;
    let finalImagePath = editingStudent.value ? formData.value.face_image_path : null;

    try {
        if (selectedFileToUpload.value) {
            if (editingStudent.value && editingStudent.value.face_image_path) {
                try {
                    await deleteStudentFaceService(STUDENT_FACES_BUCKET, [editingStudent.value.face_image_path]);
                } catch (delError) {
                    console.warn("Failed to delete old student image, but proceeding with upload:", delError.message);
                }
            }
            const idForPath = editingStudent.value ? formData.value.id : `new_${Date.now()}`;
            const uniqueFileName = `${Date.now()}_${selectedFileToUpload.value.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
            const filePath = `${idForPath}/${uniqueFileName}`;
            const uploadResult = await uploadStudentFaceService(STUDENT_FACES_BUCKET, filePath, selectedFileToUpload.value, { upsert: false });
            finalImagePath = uploadResult.path;
        } else if (editingStudent.value && editingStudent.value.face_image_path && formData.value.face_image_path === null) {
            try {
                await deleteStudentFaceService(STUDENT_FACES_BUCKET, [editingStudent.value.face_image_path]);
                finalImagePath = null;
            } catch (delError) {
                console.error("Failed to delete student image on clear:", delError.message);
                formErrorMsg.value = "Failed to remove existing image. Please save again to confirm other changes or try removing image later.";
            }
        }

        const studentDataForSubmit = {
            full_name: formData.value.full_name.trim(),
            class_name: formData.value.class_name,
            face_image_path: finalImagePath,
        };

        if (editingStudent.value) {
            await updateStudentService(formData.value.id, studentDataForSubmit);
        } else {
            studentDataForSubmit.tag_uid = formData.value.tag_uid.trim().toUpperCase();
            const newStudent = await addStudentService(studentDataForSubmit);
            // Handle potential image path update if a temp path was used for new student
            if (newStudent && finalImagePath && finalImagePath.startsWith('unassigned_')) {
                console.warn("New student image uploaded to temp path. Consider moving/updating the path in storage and DB to use student.id:", newStudent.id);
                // Example (pseudo-code, actual move might be complex):
                // const permanentPath = `students/${newStudent.id}/${uniqueFileName}`;
                // await supabase.storage.from(STUDENT_FACES_BUCKET).move(finalImagePath, permanentPath);
                // await updateStudentService(newStudent.id, { face_image_path: permanentPath });
                // For this example, we'll just leave it as is.
            }
        }
        closeForm();
        await loadStudents();
    } catch (err) {
        console.error("Error saving student:", err);
        if (err.message?.includes('duplicate key value violates unique constraint "students_tag_uid_key"')) {
            formErrorMsg.value = "Error: This Tag UID is already registered.";
        } else if (err.message?.includes("mime type")) {
            formErrorMsg.value = "Error uploading image: Invalid file type or permissions.";
        } else {
            formErrorMsg.value = `Error saving student: ${err.details || err.message}`;
        }
    } finally {
        formIsLoading.value = false;
    }
}

async function handleDeleteStudent(student) {
    if (!confirm(`DELETE STUDENT?\n\nAre you sure you want to delete "${student.full_name}" (Tag: ${student.tag_uid})?\nThis action cannot be undone.`)) {
        return;
    }
    errorMsg.value = null;
    try {
        if (student.face_image_path) {
            try {
                await deleteStudentFaceService(STUDENT_FACES_BUCKET, [student.face_image_path]);
            } catch (imgDelError) {
                console.warn(`Could not delete face image for student ${student.id}, but proceeding:`, imgDelError.message);
            }
        }
        await deleteStudentService(student.id);
        await loadStudents();
    } catch (err) {
        console.error("Delete Error:", err);
        errorMsg.value = `Error deleting student "${student.full_name}": ${err.details || err.message}.`;
    }
}

function viewStudentReport(studentId) {
    router.push({ name: 'student-report', params: { studentId } });
}


function getAttendancePercentage(attended, total) {
    if (total === 0 || total === null || total === undefined) return { text: 'N/A', value: -1 }; // Return object for easier color handling
    if (attended === null || attended === undefined) attended = 0;
    const percentage = (attended / total) * 100;
    const text = percentage % 1 === 0 ? percentage.toFixed(0) + '%' : percentage.toFixed(1) + '%';
    return { text, value: percentage };
}

// Helper to get text color based on percentage value
function getPercentageTextColorClass(percentageValue) {
    if (percentageValue === -1 || percentageValue === null || percentageValue === undefined) return 'text-gray-500 dark:text-gray-400';
    if (percentageValue >= 80) return 'text-green-600 dark:text-green-400';
    if (percentageValue >= 50) return 'text-yellow-600 dark:text-yellow-500';
    return 'text-red-600 dark:text-red-400';
}
</script>

<template>
    <div class="animate-fade-in">
        <div id="student-form-section" v-if="showForm" class="form-card animate-slide-down">
            <div class="flex justify-between items-center mb-5">
                <h2 class="form-title">{{ editingStudent ? 'Edit Student' : 'Add New Student' }}</h2>
                <button @click="closeForm" class="close-button" aria-label="Close form">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>

            <form @submit.prevent="handleSubmit" class="space-y-4">
                <div v-if="formErrorMsg" class="error-banner text-sm" role="alert">
                    <div>
                        <p><strong class="font-bold">Error:</strong> {{ formErrorMsg }}</p>
                    </div>
                    <button @click="formErrorMsg = null" class="ml-2 text-red-700 hover:text-red-800"
                        aria-label="Close"><i class="fas fa-times text-xs"></i></button>
                </div>

                <div>
                    <label for="tag_uid" class="form-label">Tag UID:</label>
                    <input id="tag_uid" v-model="formData.tag_uid" type="text" :required="!editingStudent"
                        :disabled="!!editingStudent" placeholder="Scan or enter tag UID"
                        class="input-field font-mono uppercase" :class="{ 'disabled-input': !!editingStudent }">
                    <p v-if="editingStudent" class="form-help-text">Tag UID cannot be changed.</p>
                </div>
                <div>
                    <label for="full_name" class="form-label">Full Name:</label>
                    <input id="full_name" v-model="formData.full_name" type="text" required
                        placeholder="Student's full name" class="input-field">
                </div>
                <div>
                    <label for="class_name" class="form-label">Class Name:</label>
                    <select id="class_name" v-model="formData.class_name" required class="input-field">
                        <option value="" disabled>-- Select a Class --</option>
                        <option v-for="cls in availableClassesForFilter" :key="cls" :value="cls">{{ cls }}</option>
                    </select>
                </div>
                <div>
                    <label for="face_image" class="form-label">Student Photo (Optional):</label>
                    <input id="face_image" type="file" @change="handleFileSelected"
                        accept="image/png, image/jpeg, image/webp" class="input-field-file">
                    <div v-if="imagePreviewUrl || (editingStudent && getDisplayableStudentFaceUrl(formData.face_image_path))"
                        class="mt-3 p-2 border dark:border-darkBorder rounded-md inline-block bg-gray-50 dark:bg-darkSurfaceLighter">
                        <p class="text-xs mb-1 text-lightTextSecondary dark:text-darkTextSecondary">Preview:</p>
                        <img :src="imagePreviewUrl || getDisplayableStudentFaceUrl(formData.face_image_path)"
                            alt="Student face preview"
                            class="w-28 h-28 rounded object-cover border dark:border-darkBorder shadow-sm">
                        <button @click="clearSelectedImage" type="button"
                            class="text-xs text-danger hover:underline mt-1.5 block text-center w-full pt-1">
                            <i class="fas fa-times-circle mr-1"></i> Clear Image
                        </button>
                    </div>
                    <p v-else class="text-xs text-lightTextSecondary dark:text-darkTextSecondary mt-1">No photo
                        selected. Recommended: Clear, front-facing shot.</p>
                </div>
                <div class="form-actions">
                    <button type="button" @click="closeForm" class="button-secondary">Cancel</button>
                    <button type="submit" :disabled="formIsLoading" class="button-primary w-32 justify-center">
                        <i v-if="formIsLoading" class="fas fa-spinner fa-spin mr-2"></i>
                        {{ formIsLoading ? 'Saving...' : (editingStudent ? 'Update' : 'Add') }}
                    </button>
                </div>
            </form>
        </div>

        <div class="filters-card mb-6">
            <div class="filter-item">
                <label for="name-filter" class="form-label">Filter by Name:</label>
                <input id="name-filter" type="text" v-model.lazy="nameFilter" placeholder="Enter student name..."
                    class="input-field h-[42px]">
            </div>
            <div class="filter-item">
                <label for="student-class-filter" class="form-label">Filter by Class:</label>
                <select id="student-class-filter" v-model="classFilter" class="filter-select">
                    <option :value="null">All Classes</option>
                    <option v-for="cls in availableClassesForFilter" :key="cls" :value="cls">{{ cls }}</option>
                </select>
            </div>
            <button @click="nameFilter = ''; classFilter = null; loadStudents()" title="Clear Filters"
                v-if="nameFilter || classFilter"
                class="button-secondary !px-3 !py-2 h-[42px] mt-4 md:mt-0 self-start md:self-end">
                <i class="fas fa-times mr-1.5"></i> Clear Filters
            </button>
        </div>

        <div v-if="errorMsg && !isLoading" class="error-banner mb-6" role="alert">
            <div>
                <p><strong class="font-bold">Error:</strong> {{ errorMsg }}</p>
            </div>
            <button @click="errorMsg = null" class="ml-4" aria-label="Close"><i class="fas fa-times"></i></button>
        </div>

        <div class="table-card">
            <div class="table-header">
                <h2 class="table-title">Registered Students</h2>
                <div class="flex items-center gap-2">
                    <span v-if="isLoading && students.length > 0"
                        class="text-sm text-primary dark:text-darkAccent animate-pulse">
                        <i class="fas fa-sync fa-spin mr-1"></i> Refreshing...
                    </span>
                    <span v-if="!isLoading && !errorMsg" class="record-count">{{ students.length }} Students</span>
                    <button v-if="!showForm" @click="openAddForm()" class="button-primary text-sm !py-2 ml-auto">
                        <i class="fas fa-plus mr-1.5"></i> Add Student
                    </button>
                </div>
            </div>

            <div v-if="isLoading && students.length === 0" class="loading-indicator-table">
                <i class="fas fa-spinner fa-spin text-3xl mb-3 text-primary dark:text-darkAccent"></i>
                Loading students...
            </div>

            <div v-else-if="students.length > 0" class="responsive-table-wrapper">
                <table class="data-table">
                    <thead class="responsive-thead">
                        <tr>
                            <th class="w-16 text-center px-2 hidden lg:table-cell">Photo</th>
                            <th>Student Info</th>
                            <th>Class</th>
                            <th class="text-center">Attendance Stats</th>
                            <th class="text-right px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="student in students" :key="student.id" class="responsive-row group">
                            <td data-label="Photo" class="responsive-cell text-center px-2 py-1.5">
                                <img v-if="student.face_image_path"
                                    :src="getDisplayableStudentFaceUrl(student.face_image_path)"
                                    :alt="student.full_name"
                                    class="w-10 h-10 lg:w-12 lg:h-12 rounded-full object-cover inline-block border dark:border-darkBorder shadow-sm">
                                <div v-else
                                    class="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-gray-200 dark:bg-darkSurfaceLighter flex items-center justify-center text-lightTextSecondary dark:text-darkTextSecondary text-lg lg:text-xl mx-auto lg:mx-0">
                                    <i class="fas fa-user"></i>
                                </div>
                            </td>
                            <td data-label="Student" class="responsive-cell">
                                <div class="font-medium text-lightText dark:text-darkText">{{ student.full_name }}</div>
                                <div
                                    class="text-xs font-mono text-lightTextSecondary dark:text-darkTextSecondary mt-0.5">
                                    {{ student.tag_uid }}</div>
                                <div
                                    class="text-xs text-lightTextSecondary dark:text-darkTextSecondary lg:hidden mt-0.5">
                                    Registered: {{ formatDate(student.created_at) }}</div>
                            </td>
                            <td data-label="Class" class="responsive-cell">{{ student.class_name }}</td>
                            <td data-label="Attendance" class="responsive-cell text-center px-2 py-3 w-[200px]">
                                <div v-if="student.total_relevant_sessions > 0 || student.sessions_attended > 0"
                                    class="flex flex-col items-center justify-center"
                                    :title="`Attended: ${student.sessions_attended} out of ${student.total_relevant_sessions} relevant sessions`">

                                    <!-- Option 1: Prominent Percentage with Text Below -->
                                    <div class="text-lg font-bold"
                                        :class="getPercentageTextColorClass(getAttendancePercentage(student.sessions_attended, student.total_relevant_sessions).value)">
                                        {{ getAttendancePercentage(student.sessions_attended,
                                            student.total_relevant_sessions).text }}
                                    </div>
                                    <div class="text-xs text-lightTextSecondary dark:text-darkTextSecondary mt-0.5">
                                        {{ student.sessions_attended }} / {{ student.total_relevant_sessions }} sessions
                                    </div>
                                </div>
                                <div v-else class="text-xs text-gray-400 dark:text-gray-500 py-2 italic">
                                    No session data
                                </div>
                            </td>
                            <td data-label="Actions" class="responsive-cell text-right px-4 space-x-1 sm:space-x-2">
                                <button @click="openEditForm(student)" title="Edit Student"
                                    class="action-button text-primary dark:text-darkAccent">
                                    <i class="fas fa-pencil-alt"></i>
                                </button>
                                <button @click="viewStudentReport(student.id)" title="View Attendance Report"
                                    class="action-button text-indigo-600 dark:text-indigo-400">
                                    <i class="fas fa-chart-bar"></i>
                                </button>
                                <button @click="handleDeleteStudent(student)" title="Delete Student"
                                    class="action-button text-danger">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div v-else-if="!isLoading && !errorMsg" class="empty-state-table">
                <i class="fas fa-users-slash text-4xl opacity-50 mb-3"></i>
                <p>No students found{{ (nameFilter || classFilter) ? ' matching your filters' : '' }}.</p>
                <p v-if="nameFilter || classFilter" class="text-sm">Try adjusting or clearing the filters.</p>
                <p v-else class="text-sm">Click "Add Student" to begin.</p>
            </div>
        </div>
    </div>
</template>

<style lang="postcss" scoped>
.form-card {
    @apply mb-8 bg-lightSurface dark:bg-darkSurface p-6 rounded-xl shadow-lg dark:shadow-lg-dark border border-gray-100 dark:border-darkBorder;
}

.form-title {
    @apply text-xl font-semibold text-lightText dark:text-darkText;
}

.close-button {
    @apply text-lightTextSecondary dark:text-darkTextSecondary hover:text-danger dark:hover:text-danger p-1 rounded-full transition-colors;
}

.form-label {
    @apply block text-sm font-medium text-lightTextSecondary dark:text-darkTextSecondary mb-1;
}

.form-help-text {
    @apply text-xs text-lightTextSecondary dark:text-darkTextSecondary mt-1;
}

.form-actions {
    @apply flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-darkBorder mt-6;
}

.filters-card {
    @apply bg-lightSurface dark:bg-darkSurface p-4 rounded-lg shadow dark:shadow-md-dark border border-gray-100 dark:border-darkBorder flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end;
}

.filter-item {
    @apply flex-grow w-full md:w-auto md:min-w-[200px];
}

.table-card {
    @apply bg-lightSurface dark:bg-darkSurface rounded-xl shadow-lg dark:shadow-lg-dark border border-gray-100 dark:border-darkBorder;
}

.table-header {
    @apply px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-darkBorder flex justify-between items-center flex-wrap gap-2;
}

.table-title {
    @apply text-xl font-semibold text-lightText dark:text-darkText;
}

.record-count {
    @apply text-sm font-medium text-lightTextSecondary dark:text-darkTextSecondary bg-gray-100 dark:bg-darkSurfaceLighter px-3 py-1 rounded-full;
}

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

@media (max-width: 1023px) {
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
        @apply block w-full px-4 py-3 text-sm border-b border-gray-100 dark:border-darkBorder text-right;
    }

    .responsive-cell:last-child {
        @apply border-b-0;
    }

    .responsive-cell::before {
        content: attr(data-label);
        @apply float-left font-semibold text-lightTextSecondary dark:text-darkTextSecondary mr-3 text-left;
    }

    .responsive-cell[data-label="Photo"],
    .responsive-cell[data-label="Actions"] {
        @apply text-center;
    }

    .responsive-cell[data-label="Photo"]::before,
    .responsive-cell[data-label="Actions"]::before {
        @apply hidden;
    }

    .responsive-cell[data-label="Student"],
    .responsive-cell[data-label="Class"],
    .responsive-cell[data-label="Attendance"] {
        @apply text-left;
    }

    .responsive-cell[data-label="Attendance"] {
        @apply py-4;
    }
}

.data-table tbody tr:last-child td {
    @apply border-b-0 lg:border-b;
}

.hover-row:hover {
    @apply bg-gray-50 dark:hover:bg-darkSurfaceLighter/50 transition-colors duration-150;
}

.action-button {
    @apply hover:opacity-75 text-base p-1.5 rounded-md transition-opacity focus:outline-none focus:ring-2 focus:ring-opacity-50;
}

.action-button.text-primary {
    @apply focus:ring-primary dark:focus:ring-darkAccent;
}

.action-button.text-indigo-600 {
    @apply focus:ring-indigo-500;
}

.action-button.text-danger {
    @apply focus:ring-danger;
}

.loading-indicator-table {
    @apply text-center py-16 text-lightTextSecondary dark:text-darkTextSecondary flex flex-col items-center;
}

.empty-state-table {
    @apply text-center py-16 text-lightTextSecondary dark:text-darkTextSecondary;
}

.input-field {
    @apply w-full px-3 py-2 border border-gray-300 dark:border-darkBorder rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary dark:bg-darkSurfaceLighter dark:text-darkText dark:focus:ring-darkAccent dark:focus:border-darkAccent;
}

.filter-select {
    @apply w-full px-3 py-2 border border-gray-300 dark:border-darkBorder rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary dark:bg-darkSurfaceLighter dark:text-darkText dark:focus:ring-darkAccent dark:focus:border-darkAccent text-sm disabled:opacity-50 disabled:cursor-not-allowed h-[42px];
}

.disabled-input {
    @apply disabled:opacity-60 disabled:cursor-not-allowed dark:disabled:bg-darkBorder/30;
}

.input-field-file {
    @apply block w-full text-sm text-gray-500 dark:text-gray-400 file:transition-colors file:duration-150 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary dark:file:bg-darkAccent/15 dark:file:text-darkAccent hover:file:bg-primary/20 dark:hover:file:bg-darkAccent/25 cursor-pointer;
}

.button-primary {
    @apply flex items-center justify-center px-4 py-2 bg-primary hover:opacity-90 text-white text-sm font-medium rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed;
}

.button-secondary {
    @apply px-4 py-2 bg-gray-100 dark:bg-darkSurfaceLighter text-lightTextSecondary dark:text-darkTextSecondary hover:bg-gray-200 dark:hover:bg-darkBorder text-sm font-medium rounded-lg transition-colors;
}

.error-banner {
    @apply bg-red-100 border-l-4 border-red-500 text-red-700 p-3 flex justify-between items-start rounded;
}

.animate-slide-down {
    animation: slide-down 0.3s ease-out forwards;
}

@keyframes slide-down {
    from {
        opacity: 0;
        transform: translateY(-15px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.clip-rect-0 {
    clip: rect(0 0 0 0);
}
</style>