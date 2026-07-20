#!/bin/bash
# PiCaster - Restore Normal Wi-Fi
# This script undoes the Phase 9 Standalone AP configuration,
# allowing the Raspberry Pi to connect to normal Wi-Fi networks again.

echo "Restoring normal Wi-Fi configuration..."

# 1. Stop and disable the hotspot services
echo "Stopping hostapd and dnsmasq..."
sudo systemctl stop hostapd
sudo systemctl disable hostapd
sudo systemctl stop dnsmasq
sudo systemctl disable dnsmasq

# 2. Remove the static IP assignment
if [ -f "/etc/systemd/network/10-wlan0.network" ]; then
    echo "Removing static IP configuration..."
    sudo rm /etc/systemd/network/10-wlan0.network
    sudo systemctl restart systemd-networkd
fi

# 3. Restore the original dnsmasq config if it exists
if [ -f "/etc/dnsmasq.conf.orig" ]; then
    echo "Restoring original dnsmasq configuration..."
    sudo mv /etc/dnsmasq.conf.orig /etc/dnsmasq.conf
fi

# 4. Tell NetworkManager to manage wlan0 again
if [ -f "/etc/NetworkManager/conf.d/99-unmanaged-devices.conf" ]; then
    echo "Telling NetworkManager to manage wlan0 again..."
    sudo rm /etc/NetworkManager/conf.d/99-unmanaged-devices.conf
    sudo systemctl restart NetworkManager
fi

echo "Wi-Fi restored! You can now connect to your local network using the desktop network icon or 'sudo raspi-config'."
