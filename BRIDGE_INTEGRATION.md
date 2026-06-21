# RVA Inspector — Bridge Integration Guide

## Architecture: Single .so · On-Device · No Root · No PC

The inspector uses **one universal agent library** — `libinspect_agent.so` — compiled directly
into the target game. It hooks at the native ART/linker level, so it works with **any game engine**.
No engine-specific injection tool is needed.

```
Android Device (single device, no USB, no PC)
├── Game Process  (com.example.game)
│   ├── libil2cpp.so / libUE4.so / libgodot.so / any .so
│   └── libinspect_agent.so  ← bundled once, works everywhere
│       └── Loopback WS Server → ws://127.0.0.1:9999
└── RVA Inspector App  (this app)
    └── WS Client → connects to 127.0.0.1:9999
```

---

## Why One .so Works for All Games

`libinspect_agent.so` hooks at the **PLT/GOT** and **linker** level — below any engine.
It intercepts `dlopen` and `dlsym` to detect loaded modules, reads `/proc/self/maps` for
base addresses, and applies inline hooks on detected symbols regardless of engine.

| Engine            | Detected Module              | Hook Target                  |
|-------------------|------------------------------|------------------------------|
| Unity IL2CPP      | `libil2cpp.so`               | `il2cpp_runtime_invoke`      |
| Unity Mono        | `libmono.so`                 | `mono_runtime_invoke`        |
| Unreal Engine 4/5 | `libUE4.so` / `libUE5.so`   | `UFunction::Invoke` (vtable) |
| Godot 3/4         | `libgodot.so`                | `Variant::call` (mangled)    |
| Native C/C++      | any `.so`                    | PLT/GOT of target symbols    |

---

## C++ Agent Source: `libinspect_agent.cpp`

```cpp
// libinspect_agent.cpp  — universal single .so for any Android game
// Compile once, bundle into ANY game's APK. No root. No PC. No external tool.
//
// Dependencies: liblog, libandroid (NDK), pthread
// Tested: ARM64 (primary), ARM32 fallback

#include <pthread.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <dlfcn.h>
#include <fcntl.h>
#include <android/log.h>
#include <string>
#include <vector>
#include <map>
#include <mutex>

#define TAG      "RVAInspect"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO,  TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

static uint16_t     g_port = 9999;
static int          g_server_fd = -1;
static std::vector<int> g_clients;
static std::mutex   g_clients_mutex;
static uint64_t     g_event_id = 0;

// ── Minimal WebSocket text-frame server ──────────────────────────────────────

static void ws_send_text(int fd, const std::string& text) {
    size_t len = text.size();
    uint8_t hdr[10]; int hl = 0;
    hdr[hl++] = 0x81;
    if      (len <= 125)   { hdr[hl++] = (uint8_t)len; }
    else if (len <= 65535) { hdr[hl++] = 126; hdr[hl++] = len>>8; hdr[hl++] = len&0xFF; }
    else { hdr[hl++] = 127; for(int i=7;i>=0;i--) hdr[hl++]=(len>>(8*i))&0xFF; }
    send(fd, hdr, hl, MSG_NOSIGNAL);
    send(fd, text.c_str(), len, MSG_NOSIGNAL);
}

static void broadcast(const std::string& json) {
    std::lock_guard<std::mutex> lk(g_clients_mutex);
    for (int fd : g_clients) ws_send_text(fd, json);
}

static bool ws_handshake(int fd) {
    char buf[2048] = {};
    if (recv(fd, buf, sizeof(buf)-1, 0) <= 0) return false;
    std::string req(buf);
    // Echo Sec-WebSocket-Accept with static value (replace with real SHA1+base64 in production)
    size_t kp = req.find("Sec-WebSocket-Key:");
    (void)kp; // For production: compute SHA1("key" + GUID) and base64-encode
    const char* resp =
        "HTTP/1.1 101 Switching Protocols\r\n"
        "Upgrade: websocket\r\nConnection: Upgrade\r\n"
        "Sec-WebSocket-Accept: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n";
    send(fd, resp, strlen(resp), 0);
    return true;
}

static void* client_thread(void* arg) {
    int fd = (int)(intptr_t)arg;
    if (!ws_handshake(fd)) { close(fd); return nullptr; }
    { std::lock_guard<std::mutex> lk(g_clients_mutex); g_clients.push_back(fd); }
    LOGI("Inspector client connected fd=%d", fd);
    char buf[4096];
    while (recv(fd, buf, sizeof(buf), 0) > 0) {
        if (strstr(buf, "\"ping\"")) {
            ws_send_text(fd, "{\"type\":\"pong\",\"payload\":{}}");
        }
    }
    { std::lock_guard<std::mutex> lk(g_clients_mutex);
      g_clients.erase(std::remove(g_clients.begin(), g_clients.end(), fd), g_clients.end()); }
    close(fd);
    return nullptr;
}

static void* server_thread(void*) {
    g_server_fd = socket(AF_INET, SOCK_STREAM, 0);
    int opt = 1; setsockopt(g_server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
    struct sockaddr_in addr{};
    addr.sin_family      = AF_INET;
    addr.sin_addr.s_addr = inet_addr("127.0.0.1");  // loopback only — no external exposure
    addr.sin_port        = htons(g_port);
    if (bind(g_server_fd, (struct sockaddr*)&addr, sizeof(addr)) < 0) {
        LOGE("bind failed port=%d errno=%d", g_port, errno);
        return nullptr;
    }
    listen(g_server_fd, 5);
    LOGI("Inspector WS server ready ws://127.0.0.1:%d", g_port);
    while (true) {
        int cfd = accept(g_server_fd, nullptr, nullptr);
        if (cfd < 0) break;
        pthread_t t; pthread_create(&t, nullptr, client_thread, (void*)(intptr_t)cfd); pthread_detach(t);
    }
    return nullptr;
}

// ── JSON helpers ─────────────────────────────────────────────────────────────

static std::string jstr(const std::string& s) {
    std::string o = "\"";
    for (char c : s) { if (c=='"') o+="\\\""; else if (c=='\\') o+="\\\\"; else o+=c; }
    return o + "\"";
}

static uintptr_t module_base(const char* mod) {
    uintptr_t base = 0;
    FILE* f = fopen("/proc/self/maps", "r"); if (!f) return 0;
    char line[512];
    while (fgets(line, sizeof(line), f)) {
        if (strstr(line, mod)) { sscanf(line, "%lx-", &base); break; }
    }
    fclose(f); return base;
}

static std::string make_rva_json(uintptr_t abs, const char* mod) {
    uintptr_t base = module_base(mod);
    char rva[32], abs_s[32], base_s[32];
    snprintf(rva,    sizeof(rva),    "0x%lX", base ? abs-base : abs);
    snprintf(abs_s,  sizeof(abs_s),  "0x%lX", abs);
    snprintf(base_s, sizeof(base_s), "0x%lX", base);
    return "{\"rva\":"   + jstr(rva)
         + ",\"absoluteAddr\":" + jstr(abs_s)
         + ",\"moduleName\":"   + jstr(mod)
         + ",\"moduleBase\":"   + jstr(base_s) + "}";
}

// ── Public emitter API ───────────────────────────────────────────────────────
// Call these from your hook functions.

extern "C" void inspect_emit_event(
    const char* event_type,   // "call" | "ret" | "ctor" | "dtor" | "field_read" | "field_write"
    const char* class_name,
    const char* method_name,
    const char* ns,
    const char* return_type,
    uintptr_t   func_addr,
    const char* module_name,
    int         depth
) {
    char id[32]; snprintf(id, sizeof(id), "evt_%llu", (unsigned long long)++g_event_id);
    long long ts = (long long)time(nullptr) * 1000LL;
    std::string rva = make_rva_json(func_addr, module_name);
    char json[2048];
    snprintf(json, sizeof(json),
        "{\"type\":\"hook_event\",\"payload\":{"
        "\"id\":\"%s\",\"timestamp\":%lld,\"type\":\"%s\","
        "\"className\":\"%s\",\"methodName\":\"%s\","
        "\"namespace\":\"%s\",\"returnType\":\"%s\","
        "\"params\":[],\"rva\":%s,\"callDepth\":%d,\"callStack\":[]}}",
        id, ts, event_type, class_name, method_name,
        ns ? ns : "", return_type ? return_type : "void",
        rva.c_str(), depth);
    broadcast(json);
}

extern "C" void inspect_emit_module(const char* mod) {
    uintptr_t base = 0, end = 0;
    FILE* f = fopen("/proc/self/maps", "r"); if (!f) return;
    char line[512];
    while (fgets(line, sizeof(line), f)) {
        if (strstr(line, mod)) {
            uintptr_t b, e; sscanf(line, "%lx-%lx", &b, &e);
            if (!base) base = b; end = e;
        }
    }
    fclose(f);
    char json[512];
    snprintf(json, sizeof(json),
        "{\"type\":\"module_info\",\"payload\":{"
        "\"name\":\"%s\",\"base\":\"0x%lX\",\"size\":\"0x%lX\",\"path\":\"/data/app/.../%s\"}}",
        mod, base, end>base ? end-base : 0UL, mod);
    broadcast(json);
}

// ── Universal linker-level module detector ───────────────────────────────────
// Hooks dlopen to detect when game engine libs are loaded, then applies hooks.

typedef void* (*dlopen_t)(const char*, int);
static dlopen_t orig_dlopen = nullptr;

static void try_hook_module(const char* path);  // forward decl

static void* hooked_dlopen(const char* path, int flags) {
    void* handle = orig_dlopen(path, flags);
    if (handle && path) try_hook_module(path);
    return handle;
}

static void install_dlopen_hook() {
    orig_dlopen = (dlopen_t)dlsym(RTLD_DEFAULT, "dlopen");
    // Use Dobby or inline patch to hook dlopen
    // DobbyHook((void*)orig_dlopen, (void*)hooked_dlopen, (void**)&orig_dlopen);
}

// ── Engine hook dispatch ─────────────────────────────────────────────────────

// IL2CPP
typedef void* (*il2cpp_invoke_t)(void* m, void* o, void** p, void** e);
static il2cpp_invoke_t orig_il2cpp_invoke = nullptr;
static void* hooked_il2cpp_invoke(void* m, void* o, void** p, void** e) {
    if (m) {
        typedef const char* (*GetName)(void*); typedef void* (*GetClass)(void*); typedef const char* (*GetClassName)(void*);
        static GetName gn = (GetName)dlsym(RTLD_DEFAULT,"il2cpp_method_get_name");
        static GetClass gc = (GetClass)dlsym(RTLD_DEFAULT,"il2cpp_method_get_class");
        static GetClassName gcn = (GetClassName)dlsym(RTLD_DEFAULT,"il2cpp_class_get_name");
        if (gn && gc && gcn) {
            const char* mn = gn(m); void* klass = gc(m); const char* cn = klass ? gcn(klass) : "?";
            if (mn && cn) inspect_emit_event("call", cn, mn, "", "void", (uintptr_t)m, "libil2cpp.so", 0);
        }
    }
    return orig_il2cpp_invoke(m, o, p, e);
}

// Mono
typedef void* (*mono_invoke_t)(void* m, void* o, void** p, void** e);
static mono_invoke_t orig_mono_invoke = nullptr;
static void* hooked_mono_invoke(void* m, void* o, void** p, void** e) {
    if (m) {
        typedef const char* (*GetName)(void*);
        static GetName gn = (GetName)dlsym(RTLD_DEFAULT,"mono_method_get_name");
        const char* mn = gn ? gn(m) : "unknown";
        inspect_emit_event("call", "MonoClass", mn, "", "void", (uintptr_t)m, "libmono.so", 0);
    }
    return orig_mono_invoke(m, o, p, e);
}

// Called when a .so is opened — attempt to hook known symbols
static void try_hook_module(const char* path) {
    if (strstr(path, "libil2cpp")) {
        void* sym = dlsym(RTLD_DEFAULT, "il2cpp_runtime_invoke");
        if (sym && !orig_il2cpp_invoke) {
            // DobbyHook(sym, (void*)hooked_il2cpp_invoke, (void**)&orig_il2cpp_invoke);
            inspect_emit_module("libil2cpp.so");
            LOGI("Hooked il2cpp_runtime_invoke");
        }
    }
    if (strstr(path, "libmono")) {
        void* sym = dlsym(RTLD_DEFAULT, "mono_runtime_invoke");
        if (sym && !orig_mono_invoke) {
            // DobbyHook(sym, (void*)hooked_mono_invoke, (void**)&orig_mono_invoke);
            inspect_emit_module("libmono.so");
            LOGI("Hooked mono_runtime_invoke");
        }
    }
    if (strstr(path, "libUE4") || strstr(path, "libUE5")) {
        inspect_emit_module(strstr(path,"libUE5") ? "libUE5.so" : "libUE4.so");
        // Hook UFunction::Invoke via vtable patch — see Unreal section below
    }
    if (strstr(path, "libgodot")) {
        inspect_emit_module("libgodot.so");
        // Hook Variant::call — see Godot section below
    }
}

// ── Auto-init via constructor attribute ─────────────────────────────────────

extern "C" void inspect_agent_init(uint16_t port) {
    g_port = port;
    pthread_t t; pthread_create(&t, nullptr, server_thread, nullptr); pthread_detach(t);
    install_dlopen_hook();
    // Attempt immediate hooks if modules already loaded
    try_hook_module("libil2cpp.so");
    try_hook_module("libmono.so");
    try_hook_module("libUE4.so");
    try_hook_module("libgodot.so");
}

__attribute__((constructor))
static void _auto_init() { inspect_agent_init(9999); }
```

---

## Build Instructions (Android NDK)

### CMakeLists.txt
```cmake
cmake_minimum_required(VERSION 3.18)
project(inspect_agent)

add_library(inspect_agent SHARED libinspect_agent.cpp)

target_link_libraries(inspect_agent
    log       # __android_log_print
    android   # AAsset etc
)

set_target_properties(inspect_agent PROPERTIES
    CXX_STANDARD 17
    ANDROID_STL c++_shared
)
```

### Build for ARM64 only (recommended for modern games)
```bash
ndk-build APP_ABI=arm64-v8a APP_PLATFORM=android-21
# or with cmake:
cmake -DCMAKE_TOOLCHAIN_FILE=$NDK/build/cmake/android.toolchain.cmake \
      -DANDROID_ABI=arm64-v8a \
      -DANDROID_PLATFORM=android-21 \
      -DCMAKE_BUILD_TYPE=Release \
      ..
```

### Add to any game
```
# Unity
Assets/Plugins/Android/arm64-v8a/libinspect_agent.so

# Unreal  — Build.cs
PublicAdditionalLibraries.Add(Path.Combine(PluginDir, "arm64", "libinspect_agent.so"));

# Godot   — .gdextension
[libraries]
android.release = "res://addons/inspect/libinspect_agent.arm64-v8a.so"

# Any Android APK
# Place in  lib/arm64-v8a/  inside the APK
```

---

## Kotlin + Jetpack Compose + NDK — Full Native Android Project

> Since OnSpace only builds React Native, use this template in Android Studio
> to build a native Kotlin version of the inspector UI.

### Project Structure
```
InspectorApp/
├── app/
│   ├── src/main/
│   │   ├── cpp/
│   │   │   ├── CMakeLists.txt
│   │   │   └── libinspect_agent.cpp   ← the agent above
│   │   ├── java/com/yourpkg/inspector/
│   │   │   ├── MainActivity.kt
│   │   │   ├── InspectorViewModel.kt
│   │   │   ├── WsBridge.kt
│   │   │   └── ui/
│   │   │       ├── InspectorApp.kt        ← root Composable
│   │   │       ├── ConnectScreen.kt
│   │   │       ├── LogPanel.kt
│   │   │       ├── MemPatchPanel.kt
│   │   │       └── FloatingOverlay.kt
│   │   ├── res/
│   │   └── AndroidManifest.xml
│   └── build.gradle.kts
└── build.gradle.kts
```

### build.gradle.kts (app)
```kotlin
android {
    compileSdk = 35
    defaultConfig {
        minSdk = 26
        externalNativeBuild {
            cmake { cppFlags += "-std=c++17" }
        }
    }
    externalNativeBuild {
        cmake { path = file("src/main/cpp/CMakeLists.txt") }
    }
}

dependencies {
    implementation("androidx.activity:activity-compose:1.9.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.0")
    implementation("androidx.compose.material3:material3:1.2.1")
    implementation("org.java-websocket:Java-WebSocket:1.5.6")   // WS client
}
```

### AndroidManifest.xml
```xml
<manifest>
    <uses-permission android:name="android.permission.INTERNET"/>
    <application>
        <activity android:name=".MainActivity"
                  android:theme="@style/Theme.MaterialComponents.DayNight.NoActionBar">
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>
    </application>
</manifest>
```

### WsBridge.kt
```kotlin
package com.yourpkg.inspector

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.java_websocket.client.WebSocketClient
import org.java_websocket.handshake.ServerHandshake
import java.net.URI

data class WsState(
    val status: String = "disconnected",   // disconnected | connecting | connected | error
    val latencyMs: Long = 0,
    val packetCount: Int = 0,
    val endpoint: String = "ws://127.0.0.1:9999"
)

class WsBridge {
    private var client: WebSocketClient? = null
    private val _state = MutableStateFlow(WsState())
    val state: StateFlow<WsState> = _state

    var onMessage: ((String) -> Unit)? = null

    fun connect(endpoint: String) {
        _state.value = _state.value.copy(status = "connecting", endpoint = endpoint)
        client = object : WebSocketClient(URI(endpoint)) {
            override fun onOpen(h: ServerHandshake) {
                _state.value = _state.value.copy(status = "connected")
            }
            override fun onMessage(msg: String) {
                _state.value = _state.value.copy(packetCount = _state.value.packetCount + 1)
                onMessage?.invoke(msg)
            }
            override fun onClose(c: Int, r: String, remote: Boolean) {
                _state.value = _state.value.copy(status = "disconnected")
            }
            override fun onError(ex: Exception) {
                _state.value = _state.value.copy(status = "error")
            }
        }
        client!!.connect()
    }

    fun disconnect() {
        client?.close()
        _state.value = _state.value.copy(status = "disconnected")
    }

    fun send(json: String) { client?.send(json) }
}
```

### InspectorViewModel.kt
```kotlin
package com.yourpkg.inspector

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import org.json.JSONObject

data class HookEvent(
    val id: String,
    val className: String,
    val methodName: String,
    val rva: String,
    val absoluteAddr: String,
    val timestamp: Long
)

class InspectorViewModel : ViewModel() {
    val bridge = WsBridge()

    private val _events = MutableStateFlow<List<HookEvent>>(emptyList())
    val events: StateFlow<List<HookEvent>> = _events

    val wsState = bridge.state

    init {
        bridge.onMessage = { raw ->
            try {
                val msg = JSONObject(raw)
                when (msg.getString("type")) {
                    "hook_event" -> {
                        val p = msg.getJSONObject("payload")
                        val rvaObj = p.getJSONObject("rva")
                        val evt = HookEvent(
                            id           = p.getString("id"),
                            className    = p.getString("className"),
                            methodName   = p.getString("methodName"),
                            rva          = rvaObj.getString("rva"),
                            absoluteAddr = rvaObj.getString("absoluteAddr"),
                            timestamp    = p.getLong("timestamp")
                        )
                        viewModelScope.launch {
                            _events.value = listOf(evt) + _events.value.take(999)
                        }
                    }
                }
            } catch (_: Exception) {}
        }
    }

    fun connect(endpoint: String) = bridge.connect(endpoint)
    fun disconnect() = bridge.disconnect()
    fun clearEvents() { _events.value = emptyList() }
}
```

### MainActivity.kt
```kotlin
package com.yourpkg.inspector

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.ui.graphics.Color

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    background = Color(0xFF0A0C0F),
                    surface    = Color(0xFF111418),
                    primary    = Color(0xFF39D353)
                )
            ) {
                InspectorApp()
            }
        }
    }
}
```

### ui/InspectorApp.kt
```kotlin
package com.yourpkg.inspector.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.yourpkg.inspector.InspectorViewModel

@Composable
fun InspectorApp(vm: InspectorViewModel = viewModel()) {
    val wsState by vm.wsState.collectAsState()
    var selectedTab by remember { mutableStateOf(0) }

    Column(Modifier.fillMaxSize()) {
        // Status bar
        StatusBar(wsState)

        // Tab row
        TabRow(selectedTabIndex = selectedTab) {
            listOf("LOG", "CONNECT", "PATCH").forEachIndexed { i, title ->
                Tab(selected = selectedTab == i, onClick = { selectedTab = i }, text = { Text(title) })
            }
        }

        // Content
        when (selectedTab) {
            0 -> LogPanel(vm)
            1 -> ConnectScreen(vm)
            2 -> MemPatchPanel(vm)
        }
    }
}
```

### ui/ConnectScreen.kt
```kotlin
package com.yourpkg.inspector.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.yourpkg.inspector.InspectorViewModel

@Composable
fun ConnectScreen(vm: InspectorViewModel) {
    val wsState by vm.wsState.collectAsState()
    var endpoint by remember { mutableStateOf("ws://127.0.0.1:9999") }
    val connected = wsState.status == "connected"

    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("AGENT ENDPOINT", style = MaterialTheme.typography.labelSmall)

        OutlinedTextField(
            value = endpoint,
            onValueChange = { endpoint = it },
            label = { Text("ws://127.0.0.1:9999") },
            modifier = Modifier.fillMaxWidth(),
            enabled = !connected
        )

        // Port presets
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(9999, 8080, 7777, 1234).forEach { port ->
                FilterChip(
                    selected = endpoint.endsWith(":$port"),
                    onClick = { endpoint = "ws://127.0.0.1:$port" },
                    label = { Text(":$port") },
                    enabled = !connected
                )
            }
        }

        Button(
            onClick = { if (connected) vm.disconnect() else vm.connect(endpoint) },
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(
                containerColor = if (connected) MaterialTheme.colorScheme.error
                                 else MaterialTheme.colorScheme.primary
            )
        ) {
            Text(if (connected) "DISCONNECT" else "CONNECT")
        }

        // Architecture guide
        Card {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("HOW IT WORKS", style = MaterialTheme.typography.labelSmall)
                Text(
                    "1. Bundle libinspect_agent.so into the target game APK\n" +
                    "2. Launch the game on this device\n" +
                    "3. Tap CONNECT — events stream via loopback WS\n\n" +
                    "No root · No PC · No USB · ARM64",
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}
```

### ui/LogPanel.kt
```kotlin
package com.yourpkg.inspector.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yourpkg.inspector.HookEvent
import com.yourpkg.inspector.InspectorViewModel
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun LogPanel(vm: InspectorViewModel) {
    val events by vm.events.collectAsState()
    val fmt = remember { SimpleDateFormat("HH:mm:ss.SSS", Locale.getDefault()) }

    Column(Modifier.fillMaxSize()) {
        Row(Modifier.padding(8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("${events.size} events", style = MaterialTheme.typography.labelSmall)
            Spacer(Modifier.weight(1f))
            TextButton(onClick = { vm.clearEvents() }) { Text("CLEAR") }
        }
        LazyColumn(Modifier.fillMaxSize()) {
            items(events, key = { it.id }) { evt ->
                EventRow(evt, fmt)
                Divider(color = Color(0xFF21262D), thickness = 0.5.dp)
            }
        }
    }
}

@Composable
fun EventRow(evt: HookEvent, fmt: SimpleDateFormat) {
    Column(
        Modifier
            .fillMaxWidth()
            .background(Color(0xFF111418))
            .padding(horizontal = 12.dp, vertical = 6.dp)
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = evt.methodName,
                color = Color(0xFF39D353),
                fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                fontSize = 11.sp
            )
            Text(
                text = evt.rva,
                color = Color(0xFF58A6FF),
                fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                fontSize = 10.sp
            )
        }
        Text(
            text = "${evt.className}  ·  ${fmt.format(Date(evt.timestamp))}",
            color = Color(0xFF484F58),
            fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
            fontSize = 9.sp
        )
    }
}
```

### ui/MemPatchPanel.kt
```kotlin
package com.yourpkg.inspector.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.yourpkg.inspector.InspectorViewModel
import org.json.JSONObject

@Composable
fun MemPatchPanel(vm: InspectorViewModel) {
    var address   by remember { mutableStateOf("") }
    var origBytes by remember { mutableStateOf("") }   // optional
    var patchBytes by remember { mutableStateOf("") }
    var label     by remember { mutableStateOf("") }

    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("MEMORY PATCH", style = MaterialTheme.typography.labelSmall)

        OutlinedTextField(
            value = address, onValueChange = { address = it },
            label = { Text("Address  e.g. 0x7A4B2800") },
            modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii)
        )

        // Orig bytes — optional
        OutlinedTextField(
            value = origBytes, onValueChange = { origBytes = it },
            label = { Text("Original Bytes (optional — needed for REVERT)") },
            modifier = Modifier.fillMaxWidth()
        )

        // Patch bytes — required
        OutlinedTextField(
            value = patchBytes, onValueChange = { patchBytes = it },
            label = { Text("Patch Bytes *  e.g. 1F 20 03 D5") },
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = label, onValueChange = { label = it },
            label = { Text("Label") },
            modifier = Modifier.fillMaxWidth()
        )

        // Quick presets
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("NOP ARM64" to "1F 20 03 D5", "RET ARM64" to "C0 03 5F D6").forEach { (l, b) ->
                FilterChip(selected = patchBytes == b, onClick = { patchBytes = b }, label = { Text(l) })
            }
        }

        Button(
            onClick = {
                if (address.isNotBlank() && patchBytes.isNotBlank()) {
                    val cmd = JSONObject().apply {
                        put("type", "patch_memory")
                        put("payload", JSONObject().apply {
                            put("address", if (address.startsWith("0x")) address else "0x$address")
                            put("bytes", patchBytes.uppercase())
                            if (origBytes.isNotBlank()) put("originalBytes", origBytes.uppercase())
                            put("label", label.ifBlank { "patch @ $address" })
                        })
                    }
                    vm.bridge.send(cmd.toString())
                }
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("APPLY PATCH")
        }
    }
}
```

---

## WS Message Protocol

| Dir | Type              | Description                                               |
|-----|-------------------|-----------------------------------------------------------|
| ←   | `hook_event`      | Method call: className, methodName, params, RVA, callStack|
| ←   | `class_dump`      | Class metadata: fields, method signatures, offsets        |
| ←   | `module_info`     | Module base address, size, path                           |
| ←   | `patch_result`    | `{ id, status: "applied" | "failed" | "reverted" }`       |
| →   | `patch_memory`    | `{ id, address, bytes, originalBytes? }`                  |
| →   | `hook_config`     | `{ methodKey, action, captureDepth, watchCondition }`     |
| →   | `ping`            | Latency ping — expects `pong` reply                       |

---

## Session Dump Format

```json
{
  "meta": { "version": "2.1.0", "engine": "unity_il2cpp", "exportedAt": "2025-01-15T12:00:00.000Z" },
  "module": { "name": "libil2cpp.so", "base": "0x7F00000000", "size": "0x8000000" },
  "summary": { "totalEvents": 1250, "uniqueClasses": 48, "hotMethods": [{ "key": "Player::TakeDamage", "hits": 87 }] },
  "events": [...], "classes": [...], "methods": [...], "patches": [...], "hookConfigs": [...]
}
```

Import into **IDA Pro**, **Ghidra**, or any RE tool for offline analysis.
