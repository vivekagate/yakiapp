<img src="src/assets/img/brand/yaki-base.png" alt="Yaki Kubernetes IDE" />

## Introduction

Yaki stands for "Yet Another Kubernetes IDE". Yaki is a desktop application that allows DevOps, Developers, SREs and anyone who wish the manage the applications deployed in their Kubernetes Cluster. This is built on [Tauri](https://tauri.studio). Huge shoutout to the folks developing Tauri.

### Why Another Kubernetes IDE?

There are already a number of different IDEs. Yaki offers an alternative to the existing IDEs where by
- Open Source (MIT License)
- Uses [Tauri](https://github.com/tauri-apps/tauri) instead of [Electron](https://github.com/electron/electron) - Leading to smaller memory footprint and other advantages. [Tauri vs. Electron](https://github.com/tauri-apps/tauri#comparison-between-tauri-and-electron)
- Fully functional free version available. (If you build it, you can use it for free.)
- No Telemetry (Except for checking for updates)
- No Sign up or Email address needed.

## Free vs Paid (WIP)

The source code for Yaki is Open source and is available for anyone to build. If you build it, you can use it for free.

In case you wish to go directly to the binaries, they can be downloaded [here](https://yaki.nirops.com/#downloads).

### Platforms

Yaki can be installed on the following platforms:

| Platform                 | Versions        |
| :----------------------- |:----------------|
| Windows                  | 7 and above     |
| macOS                    | 10.15 and above |
| Linux                    |                 |


## Development

### Prerequisites

#### Node 14+
You can install nvm to manage different node versions. 
Install NVM
```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
```
Install Node 14
```
nvm install 14
nvm use 14 # If already installed
```

#### Rust
```
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

#### Git
```
apt install git-all
```

#### Yarn
```
npm install --global yarn
```

### Building
#### Clone the repo
```
git clone git@github.com:nirops/yakiapp
```
#### Install dependencies
```
cd yakiapp
yarn install
```
#### Build Tauri
```
yarn tauri build
```

### Infrastructure

### Contributing

Before you start working on something, it's best to check if there is an existing issue first. It's also a good idea to stop by the Discord server and confirm with the team if it makes sense or if someone else is already working on it.

## Semver

**yaki** is following [Semantic Versioning 2.0](https://semver.org/).

## Developer View
Application 
----Logs
-----CPU Metrics
----- Memory
---- Environment variables / Configuration
---- Instances
---- Access Logs
----  DB Logs
---- Network Access - Ports or Domain available ?
---- Restarts?
---- Time since last restart?

## Disable License Check

## Contact
[Discord](https://discord.gg/KDNpzFgV4h)

[Website](https://yaki.nirops.com)

[Email](nirops.contact@gmail.com)


## Licenses

MIT or MIT/Apache 2.0 where applicable.

