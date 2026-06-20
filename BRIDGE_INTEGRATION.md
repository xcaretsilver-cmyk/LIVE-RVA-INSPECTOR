# RVA Inspector — Bridge Integration Guide

## Architecture: On-Device, No Root, No PC

The inspector uses an **on-device loopback WebSocket** architecture.  
No ADB forwarding, no USB cable, and no root access are required.

```
Android Device
├── Game Process (libgame.so, libil2cpp.so, libUE4.so, etc.)
│   └── libinspect_agent.so  ← compiled INTO the game
│       └── WS Server → ws://127.0.0.1:9999
└── RVA Inspector App
    └── WS Client → connects to loopback
```

---

## Engine Support

| Engine            | Library              | Hook Method              |
|-------------------|----------------------|--------------------------|
| Unity IL2CPP      | `libil2cpp.so`       | il2cpp_runtime_invoke    |
| Unity Mono        | `libmono.so`         | mono_runtime_invoke      |
| Unreal Engine 4/5 | `libUE4.so/libUE5.so`| UFunction::Invoke        |
| Godot 3/4         | `libgodot.so`        | Variant::call            |
| Native C/C++      | any `.so`            | PLT/GOT inline hook      |

---

## C++ Agent Source: `libinspect_agent.cpp`

```cpp
// libinspect_agent.cpp
// Compile as shared library and include in your game build.
// No root required — listens on loopback 127.0.0.1.

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
#include <functional>
#include <map>
#include <mutex>
#include <queue>

#define TAG "RVAInspect"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO,  TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

// ─────────────────────────────────────────────────────────────────────────────
// Minimal WebSocket server (RFC 6455 — text frames only)
// ─────────────────────────────────────────────────────────────────────────────

static int g_server_fd = -1;
static std::vector<int> g_clients;
static std::mutex g_clients_mutex;
static std::queue<std::string> g_send_queue;
static std::mutex g_queue_mutex;
static uint16_t g_port = 9999;

static std::string base64_encode(const uint8_t* buf, size_t len) {
    static const char* B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string out;
    for (size_t i = 0; i < len; i += 3) {
        uint32_t b = (uint32_t)buf[i] << 16;
        if (i + 1 < len) b |= (uint32_t)buf[i+1] << 8;
        if (i + 2 < len) b |= buf[i+2];
        out += B64[(b >> 18) & 0x3F];
        out += B64[(b >> 12) & 0x3F];
        out += (i + 1 < len) ? B64[(b >> 6) & 0x3F] : '=';
        out += (i + 2 < len) ? B64[b & 0x3F] : '=';
    }
    return out;
}

static std::string sha1_ws_key(const std::string& key) {
    // Minimal SHA1 for WebSocket handshake
    std::string input = key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    // --- Simplified: use openssl if available, otherwise stub ---
    // For production use: #include <openssl/sha.h>
    // SHA1((uint8_t*)input.c_str(), input.size(), digest);
    // return base64_encode(digest, 20);
    // Stub for compilation — replace with real SHA1 in production:
    return "dGhlIHNhbXBsZSBub25jZQ=="; // placeholder
}

static bool ws_handshake(int fd) {
    char buf[2048] = {};
    int n = recv(fd, buf, sizeof(buf)-1, 0);
    if (n <= 0) return false;
    std::string req(buf, n);
    size_t kp = req.find("Sec-WebSocket-Key: ");
    if (kp == std::string::npos) return false;
    size_t ke = req.find("\r\n", kp);
    std::string key = req.substr(kp + 19, ke - kp - 19);
    std::string accept = sha1_ws_key(key);
    std::string resp =
        "HTTP/1.1 101 Switching Protocols\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        "Sec-WebSocket-Accept: " + accept + "\r\n\r\n";
    send(fd, resp.c_str(), resp.size(), 0);
    return true;
}

static void ws_send_text(int fd, const std::string& text) {
    size_t len = text.size();
    uint8_t header[10];
    int hlen = 0;
    header[hlen++] = 0x81; // FIN + text opcode
    if (len <= 125) {
        header[hlen++] = (uint8_t)len;
    } else if (len <= 65535) {
        header[hlen++] = 126;
        header[hlen++] = (len >> 8) & 0xFF;
        header[hlen++] = len & 0xFF;
    } else {
        header[hlen++] = 127;
        for (int i = 7; i >= 0; i--) header[hlen++] = (len >> (8*i)) & 0xFF;
    }
    send(fd, header, hlen, MSG_NOSIGNAL);
    send(fd, text.c_str(), len, MSG_NOSIGNAL);
}

static void broadcast(const std::string& json) {
    std::lock_guard<std::mutex> lk(g_clients_mutex);
    for (int fd : g_clients) ws_send_text(fd, json);
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON helpers
// ─────────────────────────────────────────────────────────────────────────────

static std::string json_str(const std::string& s) {
    std::string out = "\"";
    for (char c : s) {
        if (c == '"') out += "\\\"";
        else if (c == '\\') out += "\\\\";
        else if (c == '\n') out += "\\n";
        else out += c;
    }
    return out + "\"";
}

static std::string format_rva(uintptr_t abs_addr, const char* module) {
    uintptr_t base = 0;
    // Get module base via /proc/self/maps
    FILE* f = fopen("/proc/self/maps", "r");
    if (f) {
        char line[512];
        while (fgets(line, sizeof(line), f)) {
            if (strstr(line, module)) {
                sscanf(line, "%lx-", &base);
                break;
            }
        }
        fclose(f);
    }
    char rva[64], abs[64], basebuf[64];
    snprintf(rva,  sizeof(rva),  "0x%lX", base ? (abs_addr - base) : abs_addr);
    snprintf(abs,  sizeof(abs),  "0x%lX", abs_addr);
    snprintf(basebuf, sizeof(basebuf), "0x%lX", base);
    return std::string("{\"rva\":") + json_str(rva) +
           ",\"absoluteAddr\":" + json_str(abs) +
           ",\"moduleName\":" + json_str(module) +
           ",\"moduleBase\":" + json_str(basebuf) + "}";
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook event emitter
// ─────────────────────────────────────────────────────────────────────────────

static uint64_t g_event_counter = 0;

void emit_hook_event(
    const char* event_type,    // "call", "ret", "ctor", "dtor"
    const char* class_name,
    const char* method_name,
    const char* ns,
    const char* return_type,
    uintptr_t   func_addr,
    const char* module_name,
    int         depth
) {
    char id[64];
    snprintf(id, sizeof(id), "evt_%llu", (unsigned long long)++g_event_counter);
    long long ts = (long long)(time(nullptr)) * 1000LL;
    std::string rva_json = format_rva(func_addr, module_name);
    char json[2048];
    snprintf(json, sizeof(json),
        "{\"type\":\"hook_event\",\"payload\":{"
        "\"id\":\"%s\","
        "\"timestamp\":%lld,"
        "\"type\":\"%s\","
        "\"className\":\"%s\","
        "\"methodName\":\"%s\","
        "\"namespace\":\"%s\","
        "\"returnType\":\"%s\","
        "\"params\":[],"
        "\"rva\":%s,"
        "\"callDepth\":%d,"
        "\"callStack\":[]"
        "}}",
        id, ts, event_type, class_name, method_name,
        ns ? ns : "", return_type ? return_type : "void",
        rva_json.c_str(), depth
    );
    broadcast(json);
}

// ─────────────────────────────────────────────────────────────────────────────
// Module info emitter
// ─────────────────────────────────────────────────────────────────────────────

void emit_module_info(const char* module_name) {
    uintptr_t base = 0, end_addr = 0;
    FILE* f = fopen("/proc/self/maps", "r");
    if (f) {
        char line[512];
        while (fgets(line, sizeof(line), f)) {
            if (strstr(line, module_name)) {
                uintptr_t b, e;
                sscanf(line, "%lx-%lx", &b, &e);
                if (!base) base = b;
                end_addr = e;
            }
        }
        fclose(f);
    }
    char json[1024];
    snprintf(json, sizeof(json),
        "{\"type\":\"module_info\",\"payload\":{"
        "\"name\":\"%s\","
        "\"base\":\"0x%lX\","
        "\"size\":\"0x%lX\","
        "\"path\":\"/data/app/.../%s\""
        "}}",
        module_name, base,
        end_addr > base ? end_addr - base : 0,
        module_name
    );
    broadcast(json);
}

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket server thread
// ─────────────────────────────────────────────────────────────────────────────

static void* client_thread(void* arg) {
    int fd = (int)(intptr_t)arg;
    if (!ws_handshake(fd)) { close(fd); return nullptr; }
    {
        std::lock_guard<std::mutex> lk(g_clients_mutex);
        g_clients.push_back(fd);
    }
    LOGI("Client connected fd=%d", fd);
    char buf[4096];
    while (true) {
        int n = recv(fd, buf, sizeof(buf), 0);
        if (n <= 0) break;
        // Echo ping as pong
        if (n >= 2 && (buf[0] & 0x0F) == 0x01) {
            // Parse text frame — look for ping type
            // Simple check: if payload contains "ping" reply pong
            if (strstr(buf, "ping")) {
                std::string pong = "{\"type\":\"pong\",\"payload\":{}}";
                ws_send_text(fd, pong);
            }
        }
    }
    {
        std::lock_guard<std::mutex> lk(g_clients_mutex);
        g_clients.erase(std::remove(g_clients.begin(), g_clients.end(), fd), g_clients.end());
    }
    close(fd);
    LOGI("Client disconnected fd=%d", fd);
    return nullptr;
}

static void* server_thread(void*) {
    g_server_fd = socket(AF_INET, SOCK_STREAM, 0);
    int opt = 1;
    setsockopt(g_server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
    struct sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = inet_addr("127.0.0.1"); // loopback only
    addr.sin_port = htons(g_port);
    if (bind(g_server_fd, (struct sockaddr*)&addr, sizeof(addr)) < 0) {
        LOGE("Bind failed on port %d", g_port);
        return nullptr;
    }
    listen(g_server_fd, 5);
    LOGI("WS server listening on 127.0.0.1:%d", g_port);
    while (true) {
        int client_fd = accept(g_server_fd, nullptr, nullptr);
        if (client_fd < 0) break;
        pthread_t tid;
        pthread_create(&tid, nullptr, client_thread, (void*)(intptr_t)client_fd);
        pthread_detach(tid);
    }
    return nullptr;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — call this from JNI_OnLoad or constructor attribute
// ─────────────────────────────────────────────────────────────────────────────

extern "C" void inspect_agent_init(uint16_t port) {
    g_port = port;
    pthread_t tid;
    pthread_create(&tid, nullptr, server_thread, nullptr);
    pthread_detach(tid);
}

// Auto-start via constructor attribute (no explicit call needed)
__attribute__((constructor))
static void auto_init() {
    inspect_agent_init(9999);
}
```

---

## Unity IL2CPP Hook Example

```cpp
// Hook il2cpp_runtime_invoke to capture all method calls
#include "libinspect_agent.cpp"

typedef void* (*il2cpp_runtime_invoke_t)(void* method, void* obj, void** params, void** exc);
static il2cpp_runtime_invoke_t orig_invoke = nullptr;

static void* hooked_invoke(void* method, void* obj, void** params, void** exc) {
    if (method) {
        // Get method name via il2cpp reflection
        typedef const char* (*GetMethodName_t)(void*);
        static GetMethodName_t get_name = (GetMethodName_t)
            dlsym(RTLD_DEFAULT, "il2cpp_method_get_name");
        typedef void* (*GetClass_t)(void*);
        static GetClass_t get_class = (GetClass_t)
            dlsym(RTLD_DEFAULT, "il2cpp_method_get_class");
        typedef const char* (*GetClassName_t)(void*);
        static GetClassName_t get_class_name = (GetClassName_t)
            dlsym(RTLD_DEFAULT, "il2cpp_class_get_name");
        if (get_name && get_class && get_class_name) {
            const char* method_name = get_name(method);
            void* klass = get_class(method);
            const char* class_name = get_class_name(klass);
            if (method_name && class_name) {
                emit_hook_event("call", class_name, method_name, "",
                    "void", (uintptr_t)method, "libil2cpp.so", 0);
            }
        }
    }
    return orig_invoke(method, obj, params, exc);
}

// Install hook (use your preferred inline hook library: Dobby, Substrate, xHook)
void install_il2cpp_hook() {
    void* sym = dlsym(RTLD_DEFAULT, "il2cpp_runtime_invoke");
    if (sym) {
        // DobbyHook(sym, (void*)hooked_invoke, (void**)&orig_invoke);
        LOGI("il2cpp_runtime_invoke hook installed at %p", sym);
        emit_module_info("libil2cpp.so");
    }
}
```

---

## Unreal Engine Hook Example

```cpp
// Hook UFunction::Invoke for Unreal Blueprint/C++ calls
#include "libinspect_agent.cpp"

// UObject layout stub (adjust for your UE version)
struct UFunction {
    void* vtable;
    // ... UObject fields (simplified)
    char FunctionName[64];
};

typedef void (*UFunction_Invoke_t)(void* func, void* obj, void* params);
static UFunction_Invoke_t orig_ue_invoke = nullptr;

static void hooked_ue_invoke(void* func, void* obj, void* params) {
    if (func) {
        UFunction* uf = (UFunction*)func;
        emit_hook_event("call", "UObject", uf->FunctionName, "Unreal",
            "void", (uintptr_t)func, "libUE4.so", 0);
    }
    orig_ue_invoke(func, obj, params);
}

void install_unreal_hook() {
    // Use PLT/GOT hook or vtable patch on UFunction
    emit_module_info("libUE4.so");
}
```

---

## Godot Engine Hook Example

```cpp
// Hook Variant::call for GDScript/C++ method dispatch
#include "libinspect_agent.cpp"

typedef void* (*Variant_call_t)(void* self, const char* method, void** args, int argc, void* err);
static Variant_call_t orig_gdcall = nullptr;

static void* hooked_gdcall(void* self, const char* method, void** args, int argc, void* err) {
    if (method) {
        emit_hook_event("call", "GDScript", method, "Godot",
            "Variant", (uintptr_t)orig_gdcall, "libgodot.so", 0);
    }
    return orig_gdcall(self, method, args, argc, err);
}

void install_godot_hook() {
    void* sym = dlsym(RTLD_DEFAULT, "_ZN7Variant4callERKNS_10StringNameEPKPS_iRNS_8CallErrorE");
    if (sym) {
        // DobbyHook(sym, (void*)hooked_gdcall, (void**)&orig_gdcall);
        emit_module_info("libgodot.so");
    }
}
```

---

## Build Instructions (Android NDK)

```bash
# Android.mk
LOCAL_PATH := $(call my-dir)
include $(CLEAR_VARS)
LOCAL_MODULE    := inspect_agent
LOCAL_SRC_FILES := libinspect_agent.cpp
LOCAL_LDLIBS    := -llog -landroid
LOCAL_CFLAGS    := -O2 -fvisibility=hidden
include $(BUILD_SHARED_LIBRARY)

# Or with CMake (CMakeLists.txt):
# add_library(inspect_agent SHARED libinspect_agent.cpp)
# target_link_libraries(inspect_agent log android)

# Build for ARM64 (target Android 5.0+)
ndk-build APP_ABI=arm64-v8a APP_PLATFORM=android-21
```

### Unity: Place in project
```
Assets/Plugins/Android/libinspect_agent.so   ← pre-built for arm64-v8a
```

### Unreal: Add to Build.cs
```csharp
PublicAdditionalLibraries.Add(Path.Combine(ThirdPartyPath, "libinspect_agent.so"));
```

### Godot: .gdextension file
```ini
[libraries]
android.release = "res://addons/inspect_agent/libinspect_agent.arm64-v8a.so"
```

---

## Session Dump Format

When you export a session from the EXP tab, you get a JSON file:

```json
{
  "meta": {
    "version": "2.1.0",
    "engine": "unity_il2cpp",
    "exportedAt": "2025-01-15T12:00:00.000Z",
    "sessionDuration": 60000,
    "agentEndpoint": "ws://127.0.0.1:9999"
  },
  "module": { "name": "libil2cpp.so", "base": "0x7F00000000", "size": "0x8000000", "path": "..." },
  "summary": {
    "totalEvents": 1250,
    "uniqueClasses": 48,
    "uniqueMethods": 312,
    "appliedPatches": 2,
    "hotMethods": [{ "key": "Player::TakeDamage", "hits": 87 }]
  },
  "events": [...],
  "classes": [...],
  "methods": [...],
  "patches": [...],
  "hookConfigs": [...]
}
```

Import into IDA Pro, Ghidra, or any reverse engineering tool for offline analysis.
