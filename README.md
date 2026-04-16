# Homebridge Sense Energy Monitor

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![npm](https://img.shields.io/npm/v/homebridge-sense-energy-monitor.svg)](https://www.npmjs.com/package/homebridge-sense-energy-monitor)
[![npm](https://img.shields.io/npm/dt/homebridge-sense-energy-monitor.svg)](https://www.npmjs.com/package/homebridge-sense-energy-monitor)

A Homebridge platform plugin for the Sense Home Energy Monitor. It connects to the Sense API and exposes your monitor as a single HomeKit outlet accessory that turns on or off based on a configurable power threshold. Historical power data is available through the Eve app.

## What This Plugin Does

- Creates **one HomeKit outlet** representing the energy monitor
  - Shows **On** when total house power exceeds your threshold
  - Shows **Off** when power is below threshold
  - Does **not** display wattage in the Home app (HomeKit limitation)
- Streams live power data from the Sense real-time feed via WebSocket
- Optionally logs power, voltage, and current history for the **Eve app**
- Logs currently active device names to the Homebridge console (not HomeKit)
- Supports Sense accounts with MFA/2FA enabled

## What This Plugin Does NOT Do

- **No per-device HomeKit accessories** — individual device outlets are not created
- **No energy data in the Home app** — watts, kWh, and usage totals require the Eve app
- **No solar display** — solar data is collected from the API but not shown anywhere in HomeKit
- **No daily/weekly/monthly totals** — trend data is fetched but not surfaced in HomeKit or Eve

## Requirements

- Homebridge v1.8.0 or higher
- Node.js v20.0.0 or higher
- A Sense Home Energy Monitor with an active account

## Installation

### Via Homebridge Config UI X (Recommended)

1. Search for **"homebridge-sense-energy-monitor"** in the Homebridge UI
2. Install the plugin
3. Configure using the settings form
4. Restart Homebridge

### Manual Installation

```bash
npm install -g homebridge-sense-energy-monitor
```

**Note:** If you want Eve app history support, also install the optional dependency:

```bash
npm install -g fakegato-history
```

## Configuration

### Minimal Configuration

```json
{
  "platforms": [
    {
      "platform": "SenseEnergyMonitor",
      "name": "Sense Energy Monitor",
      "username": "your@email.com",
      "password": "your_sense_password"
    }
  ]
}
```

### Full Configuration Example

```json
{
  "platforms": [
    {
      "platform": "SenseEnergyMonitor",
      "name": "Sense Energy Monitor",
      "username": "your@email.com",
      "password": "your_sense_password",
      "pollingInterval": 60,
      "useWebSocket": true,
      "devicePowerThreshold": 10,
      "enableHistory": false,
      "verbose": false
    }
  ]
}
```

### Configuration Options

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `platform` | Yes | — | Must be `"SenseEnergyMonitor"` |
| `name` | Yes | — | Name shown in HomeKit |
| `username` | Yes | — | Sense account email |
| `password` | Yes | — | Sense account password |
| `monitor_id` | No | Auto | Leave blank to use your first monitor. Specify manually if you have multiple monitors. |
| `pollingInterval` | No | 60 | Seconds between trend data fetches (30–3600) |
| `useWebSocket` | No | true | Use real-time WebSocket feed. Set to `false` if you have connection issues. |
| `devicePowerThreshold` | No | 0 | Watts above which the HomeKit outlet shows "On" |
| `enableHistory` | No | false | Log history for the Eve app. Requires `fakegato-history` to be installed. |
| `mfaEnabled` | No | false | Enable if your Sense account has 2FA turned on |
| `mfaSecret` | No | — | Your TOTP base32 secret (see MFA section below) |
| `verbose` | No | false | Extra logging in the Homebridge console |
| `deviceLoggingInterval` | No | 2 | Minutes between active device log entries (only shown when `verbose` is true) |

### Multi-Factor Authentication (MFA/2FA)

If your Sense account has 2FA enabled, set `mfaEnabled: true` and provide `mfaSecret`:

```json
{
  "platforms": [
    {
      "platform": "SenseEnergyMonitor",
      "name": "Sense Energy Monitor",
      "username": "your@email.com",
      "password": "your_sense_password",
      "mfaEnabled": true,
      "mfaSecret": "XXXXXXXXXXXXXXXX"
    }
  ]
}
```

**`mfaSecret` is your TOTP base32 secret — not a 6-digit code.** This is the secret shown when you first set up 2FA in your authenticator app (it looks like `XXXXXXXXXXXXXXXX`). The plugin generates fresh 6-digit codes automatically from this secret.

### Child Bridge Configuration

```json
{
  "platforms": [
    {
      "platform": "SenseEnergyMonitor",
      "name": "Sense Energy Monitor",
      "username": "your@email.com",
      "password": "your_sense_password",
      "_bridge": {
        "username": "XX:XX:XX:XX:XX:XX",
        "port": 51827
      }
    }
  ]
}
```

## HomeKit Behavior

After setup, you will see **one accessory** in the Home app: your Sense Energy Monitor as an outlet.

- **On**: Total house power is above `devicePowerThreshold`
- **Off**: Total house power is at or below `devicePowerThreshold`

You can use this accessory in automations to trigger actions when your home starts or stops using significant power.

**There are no individual device tiles.** Active device names (Fridge, AC, etc.) are written to the Homebridge log when `verbose` is enabled, but they do not appear in HomeKit.

## Eve App Integration

When `enableHistory: true` and `fakegato-history` is installed, the plugin logs power, voltage, and current readings to local storage. The Eve app can read this history and display:

- Power consumption graphs over time
- Voltage and calculated current
- Data export

This data is local-only — nothing is sent to external servers.

## Real-time Data

The plugin connects to the Sense WebSocket feed (`wss://clientrt.sense.com`) for live updates. If the WebSocket disconnects, it reconnects automatically with exponential backoff (starting at 30 seconds, up to 5 minutes).

If you disable WebSocket (`useWebSocket: false`), the plugin falls back to polling the Sense HTTP API, which is subject to Sense's rate limiting. The plugin enforces a 30-second minimum between HTTP realtime calls.

## Troubleshooting

### Authentication fails

- Double-check your email and password
- If your account has 2FA, set `mfaEnabled: true` and provide your `mfaSecret` (the base32 secret, not a 6-digit code)
- If you recently changed your password, update the config and restart Homebridge

### WebSocket won't connect

```
WebSocket error: Connection refused
```

- Check network connectivity and firewall rules
- Try `"useWebSocket": false` to fall back to polling
- Verify the Sense service is reachable from your Homebridge host

### Rate limiting

```
Rate limited - skipping realtime update
```

Increase the polling interval: `"pollingInterval": 120`

### Old callback errors after upgrading

```
This callback function has already been called by someone else
```

Clear the Homebridge cache and restart:

```bash
sudo systemctl stop homebridge
sudo rm -rf ~/.homebridge/accessories/ ~/.homebridge/persist/
sudo systemctl start homebridge
```

The plugin removes and recreates its accessory on every startup to prevent stale callbacks. Clearing the cache ensures no old accessory state conflicts.

### Plugin not found after upgrading from v2.0.x

```
No plugin was found for the accessory "SensePowerMeter"
```

The plugin changed from an accessory to a platform in v2.1.0. Update your config:

```json
// Remove this:
"accessories": [{"accessory": "SensePowerMeter", ...}]

// Add this:
"platforms": [{"platform": "SenseEnergyMonitor", ...}]
```

### Debug Logging

Enable verbose logging to see active device names, power readings, and connection events:

```json
{
  "verbose": true
}
```

Key log messages:
- `Authentication successful` — login working
- `WebSocket connected` — real-time stream active
- `Power: XXXXw` — regular power updates
- `Active devices: Fridge (234w), AC (5678w)` — active device log

## Development

```bash
git clone https://github.com/seeloesix/homebridge-sense-energy-monitor.git
cd homebridge-sense-energy-monitor
npm install
npm link
```

```bash
# Run integration tests
node test-integration.js <username> <password>

# Lint
npm run lint
```

## Privacy & Security

- No analytics or user tracking
- All data stored locally in the Homebridge storage directory
- Auth token cached locally in `sense_auth.json` (15-minute TTL)
- API connections use HTTPS and WSS

## Comparison with homebridge-sense-power-meter

| Feature | This Plugin | homebridge-sense-power-meter |
|---------|-------------|------------------------------|
| Plugin Type | Dynamic Platform | Static Accessory |
| Real-time Updates | WebSocket + Polling | Polling Only |
| HomeKit Accessories | 1 outlet (monitor) | 1 outlet (monitor) |
| Power Display in Home App | On/Off only | On/Off only |
| MFA Support | Yes | No |
| Eve App History | Yes | No |
| Homebridge Verified | Yes | Abandoned (5+ years) |

**Note**: No HomeKit plugin can display actual wattage in Apple's Home app. This is a platform limitation.

## Credits

- API integration based on [tadthies/sense](https://github.com/tadthies/sense)
- Original inspiration: [Cisien/homebridge-sense-power-meter](https://github.com/Cisien/homebridge-sense-power-meter)
- WebSocket approach inspired by [brbeaird/sense-energy-node](https://github.com/brbeaird/sense-energy-node)

## Support

- [GitHub Issues](https://github.com/seeloesix/homebridge-sense-energy-monitor/issues)
- [GitHub Discussions](https://github.com/seeloesix/homebridge-sense-energy-monitor/discussions)
- Homebridge Discord: #plugin-support

## License

MIT — see [LICENSE](LICENSE) for details.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for full version history.
