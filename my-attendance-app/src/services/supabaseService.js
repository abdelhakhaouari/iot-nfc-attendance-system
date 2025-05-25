import { supabase } from '@/supabase'

// --- PREDEFINED DATA ---
export const PREDEFINED_CLASSES = [
  'ESE', 'ELT', 'AUTO', 'GP', 'INDUS', 'PM', 'SE', 'RT', 'IMSI'
].sort();

// --- Students ---
export async function fetchStudents(filters = { name: null, className: null }) { // Modified
  const { data, error } = await supabase.rpc('get_students_with_summary_stats', {
    p_name_filter: filters.name,
    p_class_filter: filters.className
  });
  if (error) throw error;
  return data || [];
}

export async function addStudent(studentData) {
  const preparedStudent = {
    tag_uid: studentData.tag_uid.trim().toUpperCase(),
    full_name: studentData.full_name.trim(),
    class_name: studentData.class_name,
    face_image_path: studentData.face_image_path || null // New field
  };
  const { data, error } = await supabase
    .from('students')
    .insert([preparedStudent])
    .select()
    .single(); 
  if (error) throw error;
  return data;
}

export async function updateStudent(id, updates) {
  const preparedUpdates = {
    full_name: updates.full_name.trim(),
    class_name: updates.class_name, 
    face_image_path: updates.face_image_path 
  };
  const { data, error } = await supabase
    .from('students')
    .update(preparedUpdates)
    .eq('id', id)
    .select()
    .single(); 
  if (error) throw error;
  return data;
}

export async function deleteStudent(id) {
  const { error } = await supabase
    .from('students')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// --- Sessions ---
export async function fetchSessions() {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .order('started_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function startSession(name, className) {
  const { data, error } = await supabase.rpc('start_session', {
    p_name: name.trim(),
    p_class_name: className, 
  });
  if (error) throw error;
  return data; 
}

export async function endLatestSession() {
  const { data, error } = await supabase.rpc('end_latest_session');
  if (error) throw error;
  return data; 
}

export async function getSessionClassName(sessionId) {
  if (!sessionId) return null;
  const { data, error } = await supabase
    .from('sessions')
    .select('class_name')
    .eq('id', sessionId)
    .single();

  if (error) {
    console.error(`Error fetching class name for session ${sessionId}:`, error.message);
    return null;
  }
  return data?.class_name || null;
}

// --- Attendance Data & Filters ---
export async function fetchFilterOptions() {
  const { data: sessionsData, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, name, class_name') 
    .order('name', { ascending: true });

  if (sessionsError) throw sessionsError;

  return {
    sessions: sessionsData || [],
    classes: PREDEFINED_CLASSES, 
  };
}

export async function fetchAttendanceLogs(filters = {}) {
  const { data, error } = await supabase.rpc('get_attendance_logs_with_details', filters);
  if (error) throw error;
  return data || [];
}

export async function fetchSessionAttendanceReport(sessionId) {
  if (!sessionId) {
    throw new Error("Session ID is required to fetch an attendance report.");
  }
  const { data, error } = await supabase.rpc('get_session_attendance_report', {
    p_session_id_param: sessionId,
  });
  if (error) throw error;
  return data || [];
}

export async function fetchStudentAttendanceSummary(studentId) {
  if (!studentId) {
    throw new Error("Student ID is required to fetch attendance summary.");
  }
  const { data, error } = await supabase.rpc('get_student_attendance_summary', {
    p_student_id_param: studentId,
  });
  if (error) throw error;
  return data || []; 
}

// For HomeView.vue dashboard
export async function fetchDashboardData() {
    const { data: activeSessionData, error: activeSessionError } = await supabase
        .from('sessions')
        .select('*')
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle(); 

    if (activeSessionError) throw activeSessionError;

    const { count: studentCount, error: studentError } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true });

    if (studentError) throw studentError;

    const { count: totalSessionCount, error: sessionCountError } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true });

    if (sessionCountError) throw sessionCountError;

    return {
        activeSession: activeSessionData, 
        studentCount: studentCount || 0,
        totalSessionCount: totalSessionCount || 0,
    };
}

export async function updateScanStatus(logId, newStatus, rejectionReason = null) {
  const params = {
    p_log_id: logId,
    p_new_status: newStatus
  };
  if (rejectionReason && newStatus === 'rejected') { 
    params.p_rejection_reason = rejectionReason;
  }
  console.log("SERVICE: Updating scan status with params:", params);
  const { data, error } = await supabase.rpc('update_scan_status', params);

  if (error) throw error;
  return data; 
}


// --- Realtime Subscription Management ---

// For AttendanceView (general attendance log inserts)
let attendanceLogsChannel = null;
let onNewAttendanceLogCallback = null; 

export function startListeningForNewAttendanceLogs(onNewLog, onError) {
  if (attendanceLogsChannel) {
    console.warn("SERVICE: Already listening for new attendance logs. May be overwriting previous setup or this is a HMR re-init.");
    
  }

  onNewAttendanceLogCallback = onNewLog; 

  attendanceLogsChannel = supabase.channel('public-attendance-log-inserts');
  attendanceLogsChannel
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'attendance_logs' },
      (payload) => {
        if (onNewAttendanceLogCallback) {
          onNewAttendanceLogCallback(payload);
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('SERVICE: Successfully subscribed to new attendance logs!');
      }
      if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && onError) {
        onError(`Realtime (Attendance Logs) Error: ${status}`, err);
      }
      if (status === 'CLOSED') {
        console.log('SERVICE: Attendance logs channel closed.');
        
      }
    });
}

export async function stopListeningForNewAttendanceLogs() {
  if (attendanceLogsChannel) {
    try {
      await supabase.removeChannel(attendanceLogsChannel);
      console.log('SERVICE: Unsubscribed from new attendance logs.');
    } catch (error) {
      console.error('SERVICE: Error unsubscribing from new attendance logs:', error);
    } finally {
      attendanceLogsChannel = null;
      onNewAttendanceLogCallback = null;
    }
  }
}


// For SessionReportView (specific session updates)
const activeSessionReportChannels = new Map(); 

export function startListeningForSessionReportUpdates(sessionId, onNewLogForSession, onError) {
  if (isNaN(Number(sessionId))) {
    console.error('SERVICE: Invalid sessionId for session report listener.');
    if (onError) onError('Invalid sessionId for Realtime subscription.');
    return;
  }

  if (activeSessionReportChannels.has(sessionId)) {
    console.warn(`SERVICE: Replacing existing listener for session report ${sessionId}.`);
    stopListeningForSessionReportUpdates(sessionId); // Ensure clean state
  }

  const channelName = `session-report-${sessionId}`;
  const channel = supabase.channel(channelName);

  activeSessionReportChannels.set(sessionId, { channel, callback: onNewLogForSession });

  channel
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'attendance_logs',
        filter: `session_id=eq.${sessionId}` 
      },
      (payload) => {
        const existingSubscription = activeSessionReportChannels.get(sessionId);
        if (existingSubscription && existingSubscription.callback) {
          existingSubscription.callback(payload);
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`SERVICE: Successfully subscribed to report updates for session ${sessionId}!`);
      }
      if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && onError) {
        onError(`Realtime (Session Report ${sessionId}) Error: ${status}`, err);
        // Attempt to clean up on critical error
        stopListeningForSessionReportUpdates(sessionId);
      }
      if (status === 'CLOSED') {
        console.log(`SERVICE: Session report channel for ${sessionId} closed.`);
        // Channel closed, remove from map.
        activeSessionReportChannels.delete(sessionId);
      }
    });
}

export async function stopListeningForSessionReportUpdates(sessionId) {
  if (isNaN(Number(sessionId))) return;

  const subscriptionInfo = activeSessionReportChannels.get(sessionId);
  if (subscriptionInfo && subscriptionInfo.channel) {
    try {
      await supabase.removeChannel(subscriptionInfo.channel);
      console.log(`SERVICE: Unsubscribed from report updates for session ${sessionId}.`);
    } catch (error) {
      console.error(`SERVICE: Error unsubscribing from session report ${sessionId}:`, error);
    } finally {
      activeSessionReportChannels.delete(sessionId);
    }
  }
}



// --- Authentication ---
export async function loginWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  });
  if (error) throw error;
  return data.user; 
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Function to get the current user session on app load
export async function getCurrentUserSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
        console.error("Error getting current session:", error.message);
        return null;
    }
    return session; 
}

// Expose onAuthStateChange for the app to listen to
export function onAuthStateChange(callback) {
  const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return authListener; // Return the subscription object to allow unsubscribing
}


export function getPublicImageUrl(bucketName, filePath) {
  if (!filePath || !bucketName) {
    return null;
  }
  if(isFullUrl(filePath)) {
    return filePath;
  }
  
  const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
  return data.publicUrl;
}
function isFullUrl(path) {
  if (!path) return false;
  return path.startsWith('http://') || path.startsWith('https://');
}

export async function uploadFile(bucketName, filePath, file, options = { upsert: false }) {
  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, file, {
      cacheControl: options.cacheControl || '3600',
      upsert: options.upsert, 
    });
  if (error) throw error;
  return data;
}

export async function deleteFile(bucketName, filePaths) {
  const pathsToDelete = Array.isArray(filePaths) ? filePaths : [filePaths];
  if (pathsToDelete.length === 0) return;

  const { data, error } = await supabase.storage
    .from(bucketName)
    .remove(pathsToDelete);
  if (error) throw error;
  return data;
}