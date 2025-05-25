-- Remove existing dummy data if re-running (optional, be careful)
TRUNCATE public.attendance_logs CASCADE;
TRUNCATE public.sessions CASCADE;
TRUNCATE public.students CASCADE;

DO $$
DECLARE
    first_names_male TEXT[] := ARRAY[
        'Mohammed', 'Ahmed', 'Ali', 'Omar', 'Youssef', 'Khaled', 'Abdelkader', 'Mustapha', 'Said', 'Hassan', 'Mehdi', 'Karim', 'Samir', 'Rachid', 'Farid'
    ];
    first_names_female TEXT[] := ARRAY[
        'Fatima', 'Aisha', 'Zahra', 'Khadija', 'Meriem', 'Nour', 'Imane', 'Sara', 'Leila', 'Amira', 'Sofia', 'Nadia', 'Linda', 'Houda', 'Yasmine', 'Amina', 'Zineb'
    ];
    last_names TEXT[] := ARRAY[
        'Belkacem', 'Brahimi', 'Cherif', 'Djebbar', 'Fekir', 'Ghezal', 'Haddad', 'Khelifa', 'Mansouri', 'Messaoud',
        'Rahmani', 'Saadi', 'Slimani', 'Taleb', 'Ziani', 'Amrani', 'Bouzid', 'Chouaib', 'Dahmani', 'Hamdani',
        'Kaddour', 'Larbi', 'Mahfoud', 'Nait', 'Ouali', 'Rabhi', 'Salhi', 'Toumi', 'Yahi', 'Zeroual'
    ];
    classes TEXT[] := ARRAY[
        'ESE', 'ELT', 'AUTO', 'GP', 'INDUS', 'PM', 'SE', 'RT', 'IMSI'
    ];
    num_students INT := 50;
    num_sessions_per_class INT := 3;
    student_id_counter BIGINT;
    session_id_counter BIGINT;
    loop_student_id BIGINT;

    random_tag_uid TEXT;
    random_full_name TEXT;
    random_class TEXT;
    random_session_name TEXT;
    scan_chance FLOAT;
    student_image_value TEXT;
    student_gender_assigned TEXT; -- To store 'male' or 'female' for name selection

    sess_record RECORD;
    stud_record RECORD;
BEGIN
    SELECT COALESCE(MAX(id), 0) INTO student_id_counter FROM public.students;
    SELECT COALESCE(MAX(id), 0) INTO session_id_counter FROM public.sessions;

    RAISE NOTICE 'Starting student generation...';
    FOR i IN 1..num_students LOOP
        student_id_counter := student_id_counter + 1;
        loop_student_id := student_id_counter;

        -- Randomly assign gender and pick name accordingly
        IF random() < 0.5 THEN
            student_gender_assigned := 'male';
            random_full_name := first_names_male[1 + floor(random() * array_length(first_names_male, 1))] || ' ' || last_names[1 + floor(random() * array_length(last_names, 1))];
        ELSE
            student_gender_assigned := 'female';
            random_full_name := first_names_female[1 + floor(random() * array_length(first_names_female, 1))] || ' ' || last_names[1 + floor(random() * array_length(last_names, 1))];
        END IF;

        random_class := classes[1 + floor(random() * array_length(classes, 1))];
        random_tag_uid := 'TAGDUMMY' || lpad(loop_student_id::TEXT, 5, '0') || (array['A','B','C'])[1 + floor(random()*3)];

        -- Generate avatar URL using DiceBear 'pixel-art' style (or another general style)
        -- This style doesn't explicitly guarantee gender match, but provides unique, distinct avatars.
        IF random() < 0.8 THEN -- 80% chance to have an image
            -- Example using 'pixel-art' style from DiceBear
            -- You can choose other styles like 'adventurer', 'bottts', 'identicon', etc.
            -- Check https://www.dicebear.com/styles/ for available styles.
            student_image_value := 'https://api.dicebear.com/8.x/adventurer/svg?seed=' || replace(random_full_name, ' ', '%20') || '&size=200&radius=50';
            -- For a slightly more "human-like" cartoon, you might try 'adventurer'
            -- student_image_value := 'https://api.dicebear.com/8.x/adventurer/svg?seed=' || replace(random_full_name, ' ', '%20') || '&size=200';
        ELSE
            student_image_value := NULL;
        END IF;

        INSERT INTO public.students (id, tag_uid, full_name, class_name, face_image_path)
        VALUES (loop_student_id, random_tag_uid, random_full_name, random_class, student_image_value);
    END LOOP;
    RAISE NOTICE '% students created.', num_students;

    -- Session generation (same as before)
    RAISE NOTICE 'Starting session generation...';
    FOR class_idx IN 1..array_length(classes, 1) LOOP
        FOR j IN 1..num_sessions_per_class LOOP
            session_id_counter := session_id_counter + 1;
            random_session_name := classes[class_idx] || ' - Lecture ' || j || ' - ' || (array['Math','Physics','Programming','Lab','Theory'])[1 + floor(random()*5)];
            INSERT INTO public.sessions (id, name, class_name, started_at, ended_at)
            VALUES (
                session_id_counter,
                random_session_name,
                classes[class_idx],
                now() - (floor(random() * 30) + 1 || ' days')::interval - (floor(random() * 8) || ' hours')::interval,
                CASE WHEN random() > 0.2 THEN
                    now() - (floor(random() * 30) || ' days')::interval - (floor(random() * 2) || ' hours')::interval + interval '2 hours'
                ELSE NULL END
            );
        END LOOP;
    END LOOP;
    RAISE NOTICE '% sessions created for each of % classes.', num_sessions_per_class, array_length(classes,1);

    -- Attendance Log generation (same as before, scan_face_image_path remains NULL for dummy data)
    RAISE NOTICE 'Starting attendance log generation...';
    FOR sess_record IN SELECT s.id AS s_id, s.class_name AS s_class_name, s.started_at AS s_started_at FROM public.sessions s LOOP
        FOR stud_record IN SELECT st.id AS st_id, st.tag_uid AS st_tag_uid FROM public.students st WHERE st.class_name = sess_record.s_class_name LOOP
            scan_chance := random();
            IF scan_chance <= 0.75 THEN
                INSERT INTO public.attendance_logs (tag_uid, session_id, scanned_at, status, scan_face_image_path)
                VALUES (stud_record.st_tag_uid, sess_record.s_id, sess_record.s_started_at + (floor(random() * 50) + 5 || ' minutes')::interval, 'accepted', NULL);
                IF random() < 0.1 THEN
                     INSERT INTO public.attendance_logs (tag_uid, session_id, scanned_at, status, scan_face_image_path)
                     VALUES (stud_record.st_tag_uid, sess_record.s_id, sess_record.s_started_at + (floor(random() * 50) + 15 || ' minutes')::interval, 'accepted', NULL);
                END IF;
            ELSIF scan_chance <= 0.85 THEN
                INSERT INTO public.attendance_logs (tag_uid, session_id, scanned_at, status, scan_face_image_path)
                VALUES (stud_record.st_tag_uid, sess_record.s_id, sess_record.s_started_at + (floor(random() * 50) + 5 || ' minutes')::interval, 'doubtful', NULL);
            ELSIF scan_chance <= 0.90 THEN
                 INSERT INTO public.attendance_logs (tag_uid, session_id, scanned_at, status, scan_face_image_path)
                VALUES (stud_record.st_tag_uid, sess_record.s_id, sess_record.s_started_at + (floor(random() * 50) + 5 || ' minutes')::interval, 'rejected', NULL);
            END IF;
        END LOOP;
    END LOOP;
    RAISE NOTICE 'Attendance logs generated.';

    RAISE NOTICE 'Dummy data generation complete. Student face_image_path now contains direct URLs from DiceBear for some students.';
END $$;