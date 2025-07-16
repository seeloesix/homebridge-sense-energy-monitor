# Homebridge Sense Energy Monitor

Enhanced Homebridge plugin for the Sense Home Energy Monitor with comprehensive API integration from tadthies/sense.

## Features

- **Real-time Power Monitoring**: Live power consumption data via WebSocket or polling
- **Solar Power Support**: Monitor solar power generation (if available)
- **Individual Device Tracking**: Track power usage of detected devices
- **Comprehensive Data**: Daily, weekly, monthly, and yearly consumption/production data
- **HomeKit Integration**: Full HomeKit compatibility with custom characteristics
- **History Support**: Integration with Eve app via fakegato-history (optional)
- **Robust Error Handling**: Automatic reconnection and authentication refresh
- **Flexible Configuration**: WebSocket or polling modes, customizable intervals

## Installation

### Via Homebridge UI (Recommended)

1. Search for "homebridge-sense-energy-monitor" in the Homebridge UI
2. Install the plugin
3. Configure using the settings form

### Manual Installation

```bash
npm install -g homebridge-sense-energy-monitor
```

## Configuration

Add the following to your Homebridge config.json:

```json
{
  "accessory": "SensePowerMeter",
  "name": "Sense Energy Meter",
  "username": "your@email.com",
  "password": "your_sense_password",
  "monitor_id": "optional_monitor_id",
  "pollingInterval": 60,
  "useWebSocket": true,
  "includeSolar": true,
  "includeDevices": true,
  "verbose": false
}
```

### Configuration Options

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `accessory` | Yes | - | Must be "SensePowerMeter" |
| `name` | Yes | - | Display name in HomeKit |
| `username` | Yes | - | Your Sense account email |
| `password` | Yes | - | Your Sense account password |
| `monitor_id` | No | Auto-detect | Specific monitor ID (auto-detected if omitted) |
| `pollingInterval` | No | 60 | Data refresh interval in seconds |
| `useWebSocket` | No | true | Use WebSocket for real-time data |
| `includeSolar` | No | true | Include solar power monitoring |
| `includeDevices` | No | true | Track individual device usage |
| `verbose` | No | false | Enable detailed logging |

## Features in Detail

### Real-time Data
- **Active Power**: Current total power consumption
- **Solar Power**: Current solar power generation (if available)
- **Voltage**: Line voltage measurements
- **Current**: Calculated current draw
- **Frequency**: AC frequency

### Trend Data
- **Daily Usage/Production**: Current day's consumption and generation
- **Weekly Usage/Production**: Current week's totals
- **Monthly Usage/Production**: Current month's totals
- **Yearly Usage/Production**: Current year's totals

### Device Monitoring
- **Active Devices**: List of currently active detected devices
- **Device History**: Historical usage data per device
- **Custom Device Data**: Integration with smart plugs and custom devices

### HomeKit Characteristics
The plugin exposes the following characteristics in HomeKit:
- **On/Off State**: Based on power usage threshold (>10W)
- **Outlet In Use**: Indicates active power consumption
- **Consumption**: Current power usage in Watts
- **Voltage**: Line voltage in Volts
- **Electric Current**: Current draw in Amperes
- **Total Consumption**: Cumulative energy consumption in kWh

### Eve App Integration
When using the optional `fakegato-history` dependency, the plugin provides:
- **Power History**: Historical power consumption graphs
- **Consumption Tracking**: Long-term energy usage trends
- **Cost Calculations**: Estimated energy costs (configured in Eve app)

## API Integration

This plugin integrates the comprehensive Sense API from [tadthies/sense](https://github.com/tadthies/sense), providing:

### Authentication & Connection
- Automatic authentication with Sense servers
- Token refresh handling
- Monitor auto-detection
- WebSocket real-time streaming with rate limiting

### Data Retrieval Methods
- `updateRealtime()`: Get current power data
- `updateTrendData()`: Fetch consumption/production trends
- `getDevices()`: List all detected devices
- `getMonitorInfo()`: Retrieve monitor details
- `getUsageData()`: Historical usage data with date ranges
- `getDeviceHistory()`: Per-device historical data

### WebSocket Features
- Real-time power updates
- Automatic reconnection with exponential backoff
- Proper connection management to avoid rate limiting
- Event-driven data updates

## Troubleshooting

### Common Issues

#### Authentication Failures
```
Error: Authentication failed
```
- Verify your Sense account credentials
- Check if your account has access to the monitor
- Ensure you're not hitting rate limits

#### WebSocket Connection Issues
```
WebSocket error: Connection refused
```
- Check network connectivity
- Verify firewall settings
- Try disabling WebSocket mode: `"useWebSocket": false`

#### Rate Limiting
```
Rate limited - skipping realtime update
```
- Increase polling interval: `"pollingInterval": 120`
- The plugin automatically handles rate limiting

#### Missing Data
```
No devices found
```
- Ensure your Sense monitor has detected devices
- Wait for the monitor to complete its detection cycle
- Check monitor status in the Sense mobile app

### Debug Mode
Enable verbose logging for troubleshooting:
```json
{
  "verbose": true
}
```

### Log Analysis
Key log messages to look for:
- `Authentication successful`: Confirms login works
- `WebSocket connected`: Real-time data stream active
- `Power: XXXXw`: Regular power updates
- `Retrieved X devices`: Device detection working

## Advanced Configuration

### Multiple Monitors
If you have multiple Sense monitors, specify the monitor ID:
```json
{
  "monitor_id": "12345",
  "name": "Main House Meter"
}
```

### Custom Polling
Adjust polling based on your needs:
```json
{
  "pollingInterval": 30,
  "useWebSocket": false
}
```

### Solar-Only Monitoring
Monitor only solar production:
```json
{
  "includeSolar": true,
  "name": "Solar Production"
}
```

## API Rate Limits

The plugin respects Sense API rate limits:
- **Authentication**: Once every 15 minutes maximum
- **Real-time Data**: Once every 30 seconds maximum (configurable)
- **WebSocket**: Single connection per account recommended

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Development Setup
```bash
git clone https://github.com/seeloesix/homebridge-sense-energy-monitor.git
cd homebridge-sense-energy-monitor
npm install
npm link
```

## Credits

- Based on the comprehensive Sense API from [tadthies/sense](https://github.com/tadthies/sense)
- Inspired by the original [Cisien/homebridge-sense-power-meter](https://github.com/Cisien/homebridge-sense-power-meter)
- WebSocket implementation inspired by [brbeaird/sense-energy-node](https://github.com/brbeaird/sense-energy-node)

## License

MIT License - see LICENSE file for details

## Support

- **Issues**: [GitHub Issues](https://github.com/seeloesix/homebridge-sense-energy-monitor/issues)
- **Discussions**: [GitHub Discussions](https://github.com/seeloesix/homebridge-sense-energy-monitor/discussions)
- **Homebridge Discord**: #plugin-support channel

## Changelog

### 2.0.0
- Complete rewrite with comprehensive API integration
- Added WebSocket support for real-time data
- Integrated tadthies/sense API methods
- Added solar power support
- Enhanced error handling and reconnection
- Added fakegato-history support
- Improved HomeKit characteristics
- Added device monitoring capabilities

### 1.0.0
- Initial release (basic functionality)