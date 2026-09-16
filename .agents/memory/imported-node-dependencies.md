---
name: Imported Node dependencies
description: Compatibility considerations when a Node project arrives through a zip import.
---

Zip-imported Node projects can contain a usable dependency tree with missing executable permissions and platform-specific optional native packages. Restore package-bin permissions and install the matching native optional package through the package manager before diagnosing application code.

**Why:** The imported app initially failed before Vite could start because both the command shim permissions and Rolldown's native binding were absent.

**How to apply:** When an imported Node build reports permission or missing-native-binding errors, repair the dependency installation first and avoid changing the app architecture.