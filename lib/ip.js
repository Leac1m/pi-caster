import os from 'os';

export function getLocalIp(interfaces = os.networkInterfaces()) {
    let localIp = 'localhost';
    let isHotspot = false;
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                localIp = iface.address;
                if (localIp === '10.42.0.1') {
                    isHotspot = true;
                }
                break;
            }
        }
        if (localIp !== 'localhost') break;
    }
    return { ip: localIp, isHotspot };
}
