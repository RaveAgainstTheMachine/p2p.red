# TURN Server Troubleshooting Guide

**Date:** January 10, 2026  
**Status:** TURN Server Running - Testing Required

---

## ✅ **CURRENT STATUS**

### TURN Server Configuration:
```
✅ Running in host network mode
✅ Listening on: 149.56.131.26:3478 (UDP/TCP)
✅ Relay IP: 149.56.131.26
✅ External IP: 149.56.131.26
✅ Firewall: Port 3478 open (UDP/TCP)
✅ Authentication: Time-limited HMAC-SHA1
✅ Network test: Connection successful
```

### Client Configuration:
```
✅ STUN servers: Google STUN (stun.l.google.com:19302)
✅ TURN server: turn:p2p.red:3478 (UDP)
✅ TURN server: turn:p2p.red:3478?transport=tcp (TCP)
✅ Credentials: Time-limited (24h expiry)
✅ ICE policy: 'all' (tries STUN first, falls back to TURN)
```

---

## 🔍 **DIAGNOSTIC STEPS**

### Step 1: Check WebRTC Internals
1. Open Chrome/Edge
2. Navigate to: `chrome://webrtc-internals/`
3. Start a file transfer
4. Look for:
   - **ICE candidates** being gathered
   - **TURN candidates** (should show `relay` type)
   - **Connection state** changes
   - **Error messages** in the logs

### Step 2: Verify TURN Credentials
Open browser console and run:
```javascript
const turnSecret = 'p2p-secret-key-123456789';
const turnTTL = 86400;
const turnTimestamp = Math.floor(Date.now() / 1000) + turnTTL;
const turnUsername = `${turnTimestamp}:p2puser`;

async function generateTurnCredential(username, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(username));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

const credential = await generateTurnCredential(turnUsername, turnSecret);
console.log('TURN Username:', turnUsername);
console.log('TURN Credential:', credential);
```

### Step 3: Test TURN Server Directly
Use a TURN test tool:
```bash
# Install turnutils (if not already installed)
sudo apt-get install coturn-utils

# Test TURN server
turnutils_uclient -v -u ${turnUsername} -w ${credential} 149.56.131.26
```

---

## 🚨 **COMMON ISSUES**

### Issue 1: Browser Cache
**Symptom:** Old JavaScript version still loading  
**Solution:**
1. Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
2. Clear cache: Chrome Settings → Privacy → Clear browsing data
3. Try incognito/private window

### Issue 2: TURN Not Being Used
**Symptom:** ICE fails without trying TURN  
**Possible causes:**
- Browser blocking TURN due to security policy
- TURN credentials expired or invalid
- TURN server not reachable from browser's network
- ICE policy set to 'relay' only (should be 'all')

### Issue 3: Symmetric NAT
**Symptom:** STUN works but connection still fails  
**Solution:** TURN server required (already configured)

### Issue 4: Corporate Firewall
**Symptom:** All WebRTC connections fail  
**Solution:** 
- Try from different network
- Check if UDP port 3478 is blocked
- Try TCP fallback (turn:p2p.red:3478?transport=tcp)

---

## 🧪 **MANUAL TEST PROCEDURE**

### Test 1: Verify TURN Server is Reachable
```bash
# From your local machine (not the server)
nc -zvu p2p.red 3478
# Should show: Connection succeeded
```

### Test 2: Check TURN Server Logs
```bash
# On the server
docker logs p2p-file-share_turnserver_1 --follow

# Look for connection attempts when you start a transfer
# Should see: "session ... created"
```

### Test 3: Browser Network Tab
1. Open DevTools → Network tab
2. Filter: WS (WebSocket)
3. Start transfer
4. Look for PeerJS WebSocket connection
5. Check for ICE candidate exchange

---

## 📊 **EXPECTED BEHAVIOR**

### Successful STUN Connection (Direct P2P):
```
Console:
- Gathering ICE candidates
- Found host candidate
- Found srflx candidate (STUN)
- ICE connection state: connected
- Transfer starts
```

### Successful TURN Connection (Relayed):
```
Console:
- Gathering ICE candidates
- Found host candidate
- Found srflx candidate (STUN)
- Found relay candidate (TURN)
- ICE connection state: connected (via relay)
- Transfer starts

TURN Server Logs:
- session ... created
- allocation ... created
- relay ... established
```

### Failed Connection:
```
Console:
- Gathering ICE candidates
- ICE connection state: failed
- Error: Negotiation failed
- WebRTC: ICE failed, your TURN server appears to be broken
```

---

## 🔧 **TROUBLESHOOTING COMMANDS**

### Check TURN Server Status:
```bash
docker ps | grep turn
docker logs p2p-file-share_turnserver_1 --tail 50
```

### Check TURN Server Ports:
```bash
sudo ss -ulnp | grep 3478
sudo ss -tlnp | grep 3478
```

### Check Firewall:
```bash
sudo ufw status | grep 3478
```

### Restart TURN Server:
```bash
docker restart p2p-file-share_turnserver_1
```

### View TURN Configuration:
```bash
cat /tmp/p2p-config/turnserver.conf
```

---

## 🎯 **NEXT STEPS**

1. **Clear browser cache** completely (Ctrl+Shift+Delete)
2. **Open `chrome://webrtc-internals/`** in a new tab
3. **Start a file transfer** and watch the ICE negotiation
4. **Check TURN server logs** for connection attempts
5. **Report findings:**
   - Are TURN candidates being generated?
   - Is the browser trying to connect to TURN?
   - Are there any errors in webrtc-internals?
   - Are there any connection attempts in TURN logs?

---

## 📋 **VERIFICATION CHECKLIST**

- [ ] TURN server is running (docker ps)
- [ ] TURN server is listening on public IP (ss -ulnp | grep 3478)
- [ ] Firewall allows port 3478 (ufw status)
- [ ] Browser cache is cleared
- [ ] WebRTC internals shows TURN candidates
- [ ] TURN server logs show connection attempts
- [ ] ICE negotiation completes successfully

---

## 💡 **ALTERNATIVE: Test Without TURN**

If TURN continues to fail, you can test if direct P2P works:

1. **Use same network** - Both sender and receiver on same WiFi
2. **Use mobile hotspot** - One device creates hotspot, other connects
3. **Use VPN** - Both devices on same VPN network

This will help determine if the issue is TURN-specific or general WebRTC.

---

**Current Status:** TURN server is properly configured and running. The issue appears to be with ICE negotiation or browser-side configuration. Please follow the diagnostic steps above to identify the exact cause.
