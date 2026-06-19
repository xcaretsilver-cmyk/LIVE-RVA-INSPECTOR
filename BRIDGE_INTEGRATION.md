# C++ Hook Bridge Integration Guide

## Overview

The floating RVA Inspector overlays any React Native / Android app. In production,
it connects via WebSocket to a **C++ relay agent** injected into the target game process.

---

## Architecture

```
Target Game Process (ARM64)
  └── injected libinspector.so
        ├── il2cpp hooks (Frida / manual inline hooks)
        ├── UnixSocket server  ← sends JSON events
        └── RVA resolver

Relay Agent (localhost:9999)
  └── WebSocket server  ← bridges Unix socket → WS
        └── broadcasts WsMessage JSON

React Native Overlay (this app)
  └── websocketBridge.ts  ← connects to ws://127.0.0.1:9999
        └── InspectorContext.tsx  ← parses + renders events
```

---

## C++ Hook Event JSON Protocol

The relay agent sends JSON objects matching the `WsMessage` interface:

```json
{
  "type": "hook_event",
  "payload": {
    "id": "evt_1719000000000_1",
    "timestamp": 1719000000000,
    "type": "call",
    "methodName": "Shoot",
    "className": "PlayerController",
    "namespace": "Game.Player",
    "returnType": "void",
    "params": [
      { "name": "force", "type": "float", "value": "850.0" }
    ],
    "rva": {
      "rva": "0x3A1500",
      "absoluteAddr": "0x7D7A1500",
      "moduleName": "libil2cpp.so",
      "moduleBase": "0x7A400000"
    },
    "callDepth": 1,
    "threadId": "0x1234",
    "returnValue": null
  }
}
```

### Message Types

| type          | Description                              |
|---------------|------------------------------------------|
| `hook_event`  | A function call/return was intercepted   |
| `class_dump`  | Class metadata dump from il2cpp          |
| `module_info` | Loaded module base address info          |
| `heartbeat`   | Keep-alive ping                          |
| `clear`       | Clear all logged events                  |
| `error`       | Error from native side                   |

---

## C++ Implementation Sketch (Android ARM64 / il2cpp)

```cpp
// inspector_hook.cpp
#include <sys/socket.h>
#include <netinet/in.h>
#include <nlohmann/json.hpp>
#include "il2cpp-api.h"

using json = nlohmann::json;

static int ws_fd = -1;

void send_event(const json& evt) {
    std::string data = evt.dump() + "\n";
    if (ws_fd >= 0) send(ws_fd, data.c_str(), data.size(), 0);
}

// Hook target: PlayerController::Shoot(float force)
void* orig_Shoot = nullptr;
void hook_Shoot(void* this_ptr, float force) {
    uintptr_t mod_base = get_module_base("libil2cpp.so");
    uintptr_t fn_abs = (uintptr_t)orig_Shoot;
    uintptr_t rva = fn_abs - mod_base;

    json evt = {
        {"type", "hook_event"},
        {"payload", {
            {"id", generate_id()},
            {"timestamp", current_time_ms()},
            {"type", "call"},
            {"methodName", "Shoot"},
            {"className", "PlayerController"},
            {"namespace", "Game.Player"},
            {"returnType", "void"},
            {"params", {{ "name","force" }, { "type","float" }, { "value", force }}},
            {"rva", {
                {"rva", to_hex(rva)},
                {"absoluteAddr", to_hex(fn_abs)},
                {"moduleName", "libil2cpp.so"},
                {"moduleBase", to_hex(mod_base)}
            }},
            {"callDepth", 1},
            {"threadId", to_hex(gettid())}
        }}
    };
    send_event(evt);

    // Call original
    ((void(*)(void*, float))orig_Shoot)(this_ptr, force);
}

// Setup hooks using Dobby / KittyMemory
void setup_hooks() {
    void* shoot_addr = il2cpp_class_get_method_from_name(
        il2cpp_class_from_name(il2cpp_get_image("Assembly-CSharp.dll"),
        "Game.Player", "PlayerController"), "Shoot", 1)->methodPointer;

    DobbyHook(shoot_addr, (void*)hook_Shoot, &orig_Shoot);
    // ... repeat for other methods
}
```

---

## Switching from Mock to Live Mode

In the overlay UI:
1. Tap the **MOCK/LIVE** toggle button in the inspector toolbar
2. The `useMockMode` flag in `InspectorContext` will switch to the real WebSocket feed
3. Ensure the C++ relay agent is running on `127.0.0.1:9999`

### Configuration

Edit `constants/config.ts`:
```typescript
export const WS_HOST = '127.0.0.1';
export const WS_PORT = 9999;
```

---

## Class Dump Protocol

Send one `class_dump` message per class when the module loads:

```json
{
  "type": "class_dump",
  "payload": {
    "name": "PlayerController",
    "namespace": "Game.Player",
    "baseClass": "MonoBehaviour",
    "size": 256,
    "rva": { "rva": "0x3A1200", "absoluteAddr": "0x7D7A1200", "moduleName": "libil2cpp.so", "moduleBase": "0x7A400000" },
    "fields": [
      { "name": "health", "type": "float", "offset": "0x18", "isStatic": false }
    ],
    "methods": [
      {
        "name": "Shoot", "className": "PlayerController",
        "returnType": "void", "params": [{"name":"force","type":"float"}],
        "rva": { "rva": "0x3A1500", "absoluteAddr": "0x7D7A1500", "moduleName": "libil2cpp.so", "moduleBase": "0x7A400000" },
        "isVirtual": false, "isStatic": false, "isConstructor": false, "isDestructor": false, "hitCount": 0
      }
    ]
  }
}
```
