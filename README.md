# SDO Marinduque Attendance Monitoring System

This is a simple offline-friendly prototype that matches the admin and employee UI formats from your images.
It includes:

- Admin web app (`/admin`)
- Employee mobile web app (`/employee`)
- Shared local JSON database (`/data/db.json`)
- Node.js server (no external dependencies)

## Run

1. Open a terminal in `c:\Users\Asus\Desktop\application`.
2. Start the server:

```bash
node server/server.js
```

3. Open in browser:

- Admin: `http://localhost:5173/admin/`
- Employee: `http://localhost:5173/employee/`

## Admin Website + Employee App Flow

- Admin uses the website (`/admin`) to monitor attendance.
- Employees use the APK to time-in/time-out.
- Both connect to the same server, so attendance recorded by employees appears in the admin dashboard.

If employees are using phones on the same network, use your PC IP:
- Admin: `http://<YOUR-PC-IP>:5173/admin/`
- Employee app Server URL: `http://<YOUR-PC-IP>:5173`

## Default Accounts

Admin
- username: `admin`
- password: `admin123`

Employees
- `SDO-001` / `juan123`
- `SDO-002` / `joji123`
- `SDO-003` / `nhilliza123`

## Notes

- All buttons are functional (login, add employee, attendance actions, report generation).
- Employee time-in/out updates are saved in `data/db.json` and immediately visible in the admin dashboard.
- The **Download PDF** button uses the browser print dialog to save as PDF.

## APK Option

Capacitor wrapper is already added.

### Build APK (Android Studio)
1. Install Android Studio + Android SDK.
2. Run the server locally so the app can reach the API:
   - `node server/server.js`
3. Open the Android project:
   - `npx.cmd cap open android`
4. In the app, open the menu (☰) and set the Server URL.
   - Emulator: `http://10.0.2.2:5173`
   - Real device: `http://<YOUR-PC-IP>:5173`
5. Build APK from Android Studio: **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

### Release Keystore
A release keystore has been generated and wired into Gradle:
- File: `android\app\keystore\sdo-release.keystore`
- Alias: `sdo_release`
- Store password: `sdo1234`
- Key password: `sdo1234`

You can change these later by editing `android\keystore.properties` and generating a new keystore.

### Build APK (CLI)
```bash
cd android
gradlew.bat assembleDebug
```
The APK will be in `android\app\build\outputs\apk\debug`.

## iOS (iPhone) Build

You need a Mac with Xcode to build the iOS app.

1. On Mac, open the iOS project:
   - `npx cap open ios`
2. In Xcode, select a device or simulator and build/run.
3. Use the same Server URL inside the app:
   - `http://<YOUR-PC-IP>:5173`

## Deploy To Render (Public Website)

This makes the admin website and employee web app work from any network (Wi‑Fi or mobile data).

1. Create a new GitHub repo and push this project.
2. On Render, create a **Web Service** from that GitHub repo.
3. Render auto‑detects `render.yaml` and will use:
   - Build: `npm install`
   - Start: `node server/server.js`
4. After deploy, Render gives you a public URL, for example:
   - `https://your-app.onrender.com`

Use these URLs:
- Admin: `https://your-app.onrender.com/admin/`
- Employee web: `https://your-app.onrender.com/employee/`

For the APK, set the Server URL to your Render URL:
- `https://your-app.onrender.com`

### Important
Render’s free plan sleeps on inactivity. First load can be slow (cold start).
