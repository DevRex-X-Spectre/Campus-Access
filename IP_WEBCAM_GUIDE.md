# Connect your phone camera (simplest way)

You do **not** need to be technical. Follow this order.

---

## What you need

- Phone and PC on the **same Wi‑Fi** (same home/school network)
- App on phone: **IP Webcam** (Android Play Store)
- Campus Access **backend running on the PC** (not only on the internet)

---

## Fastest method (recommended)

### 1. On the phone (1 minute)

1. Open **IP Webcam**
2. Scroll down → tap **Start server**
3. Leave the app open (screen can dim; don’t force-close the app)

That’s it on the phone.

### 2. On the PC

1. Start your Campus Access backend and website as usual  
2. Open the **Gate** or **Admin → Register** page  
3. Stay on **Camera IP**  
4. Tap **Find phone**  
5. Wait a few seconds  

- If **one** phone is found → it **connects by itself**  
- If **several** are found → tap your phone in the list  

You should see the phone picture in the black preview.

### 3. Next times (automatic)

Once it worked once:

- The system **remembers** your phone  
- Next time you open the page, it **tries to reconnect automatically**  
- You only tap **Find phone** again if the phone got a new Wi‑Fi address (common after reconnecting Wi‑Fi)

---

## Super simple “first time only” manual way (if Find phone fails)

1. On the phone, after **Start server**, IP Webcam shows a link like:  
   `http://192.168.1.20:8080`
2. On the PC, in the Camera IP box, type:

   ```text
   http://192.168.1.20:8080/shot.jpg
   ```

   (use **your** numbers from the phone, then add `/shot.jpg`)

3. Tap **Connect**

Optional check: open that same link in Chrome on the PC. If you see a photo, the link is correct.

---

## How the “smart” connection works

| Mode | What happens |
|------|----------------|
| **Auto remember** | Last working phone link is saved and tested when you open the page |
| **Find phone** | PC searches the Wi‑Fi for phones running IP Webcam and fills the link |
| **Manual Connect** | You paste the link yourself (backup) |

This is the **standard practical approach** for a school demo:  
full “magic zero-config forever” is hard on normal Wi‑Fi (phones change IP; networks block scanning).  
**Remember + one-tap Find** is the best balance.

---

## Using it

### At the gate
- Connect Camera IP (auto or Find phone)  
- Choose area  
- Person stands in front of the **phone**  
- System scans **by itself** → Access granted / denied  

### In Admin → Register
- Same Camera IP connection  
- Person faces the phone  
- Enter name + Student/Staff  
- Tap **Register face**  

---

## If it doesn’t connect

Try in this order:

1. Phone and PC on **same Wi‑Fi** (not phone mobile data)  
2. IP Webcam still showing **server running**  
3. Campus Access **backend running on the PC**  
4. Website using **local** API (`http://localhost:8001`), not only Render online  
5. Tap **Find phone** again  
6. Restart IP Webcam → Start server → Find phone  

---

## One-line summary

**Start IP Webcam on the phone → on the PC tap Find phone → use the system.**  
Next visits usually reconnect alone.
