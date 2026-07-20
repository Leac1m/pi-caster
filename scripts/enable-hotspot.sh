#!/bin/bash
# PiCaster - Enable Hotspot
# This script re-enables the PiCaster Standalone AP configuration
# if you previously disabled it using restore-wifi.sh.

echo "Re-enabling PiCaster Hotspot configuration..."

echo "Telling NetworkManager to ignore wlan0..."
sudo mkdir -p /etc/NetworkManager/conf.d
cat <<EOF | sudo tee /etc/NetworkManager/conf.d/99-unmanaged-devices.conf
[keyfile]
unmanaged-devices=interface-name:wlan0
EOF
sudo systemctl restart NetworkManager

echo "Configuring static IP for wlan0 via systemd-networkd..."
cat <<EOF | sudo tee /etc/systemd/network/10-wlan0.network
[Match]
Name=wlan0

[Network]
Address=10.42.0.1/24
DHCPServer=no
EOF
sudo systemctl enable systemd-networkd
sudo systemctl restart systemd-networkd

echo "Configuring dnsmasq for DHCP and Captive Portal DNS spoofing..."
if [ ! -f /etc/dnsmasq.conf.orig ] && [ -f /etc/dnsmasq.conf ]; then
    sudo cp /etc/dnsmasq.conf /etc/dnsmasq.conf.orig
fi
cat <<EOF | sudo tee /etc/dnsmasq.conf
interface=wlan0
dhcp-range=10.42.0.10,10.42.0.100,255.255.255.0,24h
# Wildcard DNS to trigger captive portal
address=/#/10.42.0.1
EOF

echo "Starting hostapd and dnsmasq..."
sudo systemctl unmask hostapd
sudo systemctl enable hostapd
sudo systemctl enable dnsmasq
sudo systemctl start hostapd
sudo systemctl start dnsmasq

echo "PiCaster Hotspot has been re-enabled! Devices can now connect to 'PiCaster' Wi-Fi."
