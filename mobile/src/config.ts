// Change this to your backend's local IP when testing on a physical device.
// e.g. 'http://192.168.1.42:8080' — find your IP with `ifconfig | grep inet`
// For Android emulator use: 'http://10.0.2.2:8080'
// For iOS simulator: 'http://localhost:8080' works fine
export const BACKEND_URL = 'http://localhost:8080'
export const WS_URL = BACKEND_URL.replace(/^http/, 'ws') + '/ws'
