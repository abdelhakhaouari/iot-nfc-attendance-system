IoT-Based NFC Student Attendance System

*Project Overview:*

The IoT-Based NFC Student Attendance System is an integrated hardware and software solution designed to automate classroom attendance using Near Field Communication technology and real-time web services.

The system replaces traditional manual attendance methods by enabling students to validate their presence through NFC cards. Attendance data is transmitted instantly to a cloud database and visualized through a web dashboard accessible to professors.

This project combines embedded systems, Internet of Things technologies, and modern web development into a unified real-world application.

*Project Objectives:*

1. Automate student attendance recording
2. Prevent proxy attendance and manual errors
3. Provide real-time monitoring of classroom activity
4. Create a scalable and low-cost academic attendance solution
5. Demonstrate integration between embedded hardware and web technologies

*System Architecture:*

The project is organized into three main layers.

**Hardware Layer**
The hardware subsystem is responsible for detecting NFC cards and sending identification data to the cloud backend.

Components used:

1. Raspberry Pi 3
    Used as the main embedded controller responsible for interfacing with the NFC reader, processing scanned card data, and transmitting attendance events to the cloud database.

    (*Note:* For real deployment, an ESP32 microcontroller is sufficient and even more suitable due to its lower cost, lower power consumption, built-in Wi-Fi capabilities, and easier scalability. The Raspberry Pi 3 was selected only because it was the available development hardware at the time of implementation.)

2. PN532 NFC Reader Module
    Responsible for reading NFC student cards or tags. Each tag contains a unique identifier associated with a student profile stored in the database.
3. NFC Cards or Tags assigned to students
    Represent student identification cards used for attendance validation.

**Processing and Communication Layer**
This layer manages communication between hardware and the cloud platform.

Responsibilities:
    Reading NFC UID data
    Validating attendance session status
    Sending attendance events to Supabase
    Managing secure data transmission

**Cloud and Application Layer**
The application layer provides interaction with professors through a web interface.

*Main functions:*
Professor authentication
Class management
Attendance session creation
Real-time attendance visualization

The web dashboard is hosted online and communicates directly with Supabase services.

*Software Technologies:*

Embedded Programming
Python used on Raspberry Pi for NFC data acquisition and transmission

Web Application
Vue.js framework for frontend development
Tailwind CSS for interface design

Backend Services
Supabase cloud platform used for database management, authentication, and real-time updates

Deployment and Version Control
Netlify for web application hosting
GitHub for source code management and project documentation

System Workflow

1. The hardware system initializes and waits for NFC card detection.
2. A student taps an NFC card on the reader.
3. The controller reads the card UID.
4. UID data is transmitted to Supabase.
5. The system verifies whether an attendance session is active.
6. If valid, the student is marked present.
7. The web dashboard updates attendance information instantly.

Website Access

Live Web Dashboard
https://iot-nfc-attendance.netlify.app/

Repository Structure

my-attendance-app
Contains the web dashboard source code.

raspberry
Contains scripts responsible for NFC reading and communication with Supabase.


Demonstration Account

Email: abdelhak@attendance.app
Password: 12345

This account is provided for demonstration and evaluation purposes only.

*Project Status:*

**Completed Features**
    NFC card detection and identification
    Real-time database communication
    Web dashboard deployment
    Session-based attendance validation
    Cloud synchronization

**Planned Features**
    Facial recognition for exam authentication
    Attendance analytics and reporting
    Mobile interface optimization
    ESP32 standalone implementation

*Educational Value*

This project demonstrates practical skills in:

    Embedded systems development
    IoT system design
    Cloud database integration
    Real-time web application development
    Full-stack system architecture

*Author:*

Abdelhak Haouari
Embedded Systems Engineer

GitHub Repository
https://github.com/abdelhakhaouari/iot-nfc-attendance-system
