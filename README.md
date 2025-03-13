# 🎓 IoT-Based NFC Student Attendance  

🚀 **An innovative, secure, and automated student attendance system using NFC & facial recognition.**  

## 📖 Overview  
This project is a **smart student attendance system** that utilizes **NFC technology** and **facial recognition** to authenticate students during classes and exams. It provides a **real-time web dashboard** for professors and administrators to manage attendance efficiently.  

### 🔹 **Key Features**  
✔ **NFC-Based Attendance** – Students tap their NFC card on an IoT device (Raspberry Pi + PN532).  
✔ **Facial Recognition for Exams** – Prevent identity fraud with AI-based facial verification.  
✔ **Real-Time Web Dashboard** – Professors track attendance, view records, and manage students.  
✔ **Secure Database Storage** – Attendance data is stored securely in **MySQL/Firebase**.  
✔ **Responsive Web Interface** – Built with **React** and **Django**, hosted on the **Raspberry Pi 3**.  

---

## 🛠️ **Tech Stack**  
### 🔹 **Hardware**  
- 🖥️ **Raspberry Pi 3** (Main Controller)  
- 📡 **PN532 NFC Module** (Card Reader)  
- 🎥 **Raspberry Pi Camera** (For Facial Recognition)  
- ⚡ **5V / 3A Power Supply**  

### 🔹 **Software**  
| Component      | Technology Used  |
|---------------|-----------------|
| **Frontend**  | React, Tailwind CSS |
| **Backend**   | Django (REST API) |
| **Database**  | MySQL / Firebase |
| **IoT Logic** | Python (nfcpy, OpenCV) |
| **Deployment**| Raspberry Pi (Gunicorn + Nginx) |

---

## 📊 **System Architecture**  
## 🚀 **How It Works**  
1️⃣ **Student taps NFC card** on the **PN532 reader** connected to **Raspberry Pi**.  
2️⃣ **System verifies the NFC UID** and records the attendance.  
3️⃣ **For exams**, the system **captures the student’s face** and verifies it using **OpenCV facial recognition**.  
4️⃣ **Data is stored in MySQL/Firebase** and displayed on a **web dashboard** in real time.  
5️⃣ Professors **monitor attendance, manage students, and export reports** from the web interface.  

