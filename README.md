# GSLIB Setup CLI

GSLIB Setup CLI is a Windows-focused Node.js command line tool for creating Visual Studio C++ projects configured for GSLIB.

It generates a `.sln`, `.vcxproj`, `.vcxproj.filters`, `src/main.cpp`, and `.gitignore` directly. Generated projects target Visual Studio / Win32 and use the PlatformToolset detected from the local Visual Studio installation.

## Installation

Install from npm:

```powershell
npm install -g @ciellllllllll/setup
```

After installation, the global command is:

```powershell
Setup
```

## Main Commands

### Find

Find and save the GSLIB path and Visual Studio toolset configuration:

```powershell
Setup --find
Setup --find "C:\Libraries\gslib_2021"
```

You can also choose a specific toolset or profile:

```powershell
Setup --find "C:\Libraries\gslib_2021" --toolset v142
Setup --find "C:\Libraries\gslib_2021" --as gslib2021
```

### Setup

Create a GSLIB project in the current directory:

```powershell
Setup
Setup "MyGame"
Setup --name "MyGame"
```

Without a name, the solution directory uses the default date-based name, and the project name is `GSLIB_Project`.

### Uninstall

Uninstall the CLI and remove saved Setup configuration:

```powershell
Setup --uninstall
Setup --uninstall --force
```

To uninstall while keeping the saved configuration:

```powershell
Setup --uninstall --keep-config
```

### Help

Show all available commands and options:

```powershell
Setup --help
```

Use `Setup --help` to view additional commands such as profile management, toolset switching, config display, version output, and update checks.

## JSON Configuration

Setup stores its configuration as JSON. It does not use SQLite or a custom server.

The configuration file is stored at:

```txt
%USERPROFILE%\.gslib-setup\config.json
```

The update-check state is stored separately at:

```txt
%USERPROFILE%\.gslib-setup\update-check.json
```

You can display the active JSON configuration with:

```powershell
Setup --config
```

To print only the config file path:

```powershell
Setup --config-path
```
