# Transaction Heatmap Feature - Setup Guide

## Overview

The Transaction Heatmap is a new feature in the Moni app that visualizes where users have performed their transactions on Google Maps. The heatmap uses color intensity to show transaction concentration - warmer colors (red/orange) indicate areas with more transactions, while cooler colors (blue/green) indicate areas with fewer transactions.

## Features

- **Visual Transaction Clustering**: See at a glance where most of your spending happens
- **Heat Map Visualization**: Color-coded intensity from blue (low) to red (high transaction density)
- **Automatic Location Grouping**: Nearby transactions are grouped together
- **Responsive Map Centering**: Map automatically zooms to show all transaction locations
- **Dark/Light Theme Support**: Adapts to your app's theme settings

## Requirements

### 1. Google Maps API Key

To use the heatmap feature with Google Maps, you need to:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Maps SDK for Android
   - Maps SDK for iOS
   - Maps Static API
4. Create an API key for each platform (Android and iOS)
5. Restrict your keys to your app's package name/bundle ID for security

### 2. App Configuration

Add your Google Maps API keys to `apps/mobile/app.json` in the `react-native-maps` plugin config:

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-maps",
        {
          "iosGoogleMapsApiKey": "YOUR_IOS_API_KEY_HERE",
          "androidGoogleMapsApiKey": "YOUR_ANDROID_API_KEY_HERE"
        }
      ]
    ]
  }
}
```

> **Note**: Without these API keys, the map will not render properly. You'll see a blank or grey map background.

## How It Works

### Data Collection

1. When users add transactions, they can optionally capture the device's location
2. Location data is stored in the `transactions` table with fields:
   - `location_latitude`
   - `location_longitude`
   - `location_name`

### Heatmap Generation

1. The `useTransactionHeatmap` hook fetches all user transactions
2. Transactions with location data are extracted
3. Nearby locations are grouped (rounded to 4 decimal places for clustering)
4. Each group is weighted based on transaction count (normalized 0-1)
5. Points are rendered on the map with a color gradient:
   - **Blue**: 0-1 transactions (cold)
   - **Green**: 2-3 transactions (cool)
   - **Yellow**: 4-7 transactions (warm)
   - **Orange**: 8-15 transactions (hot)
   - **Red**: 15+ transactions (very hot)

### Map Display

- The map automatically centers on all transaction locations
- Empty state: Shows a helpful message if no transactions with locations exist
- Loading state: Displays a loading indicator while fetching data
- Error state: Shows error message if data loading fails

## File Structure

```
apps/mobile/
├── app/
│   └── (tabs)/
│       ├── heatmap.tsx              # Main heatmap screen component
│       └── _layout.tsx              # Updated with heatmap route
├── hooks/
│   └── use-transaction-heatmap.ts   # Hook for fetching and processing heatmap data
└── app.json                          # Updated with react-native-maps config
```

## Key Components

### `use-transaction-heatmap.ts` Hook

Handles:
- Fetching all user transactions with locations
- Grouping nearby locations
- Calculating weights based on transaction density
- Computing optimal map region to fit all points

**Exported:**
- `heatmapPoints`: Array of WeightedLatLng points for the heatmap
- `mapRegion`: Region object for map centering
- `isLoading`: Loading state
- `error`: Error message if any
- `refresh()`: Function to manually refresh data

### `heatmap.tsx` Component

Displays:
- Google Maps with heatmap layer
- Legend showing color intensity scale
- Transaction count information
- Loading/empty/error states
- Dark/light theme support

## Usage

Users can access the heatmap by:
1. Opening the Moni app
2. Tapping the "Heatmap" tab in the bottom navigation
3. Viewing their transaction locations visualized on the map

## Customization

To adjust heatmap appearance, modify these constants in `heatmap.tsx`:

```typescript
// Heatmap radius (pixels, range 10-50)
radius={30}

// Heatmap opacity (0-1)
opacity={0.8}

// Color gradient configuration
gradient={{
  colors: [...], // Array of color hex codes
  startPoints: [...], // Array of positions (0-1) where each color starts
  colorMapSize: 256, // Color interpolation resolution
}}
```

## Transaction Location Capture

For the heatmap to be useful, transactions need location data. Ensure your app:

1. Requests location permissions (handled by expo-location plugin)
2. Captures location when creating transactions
3. Stores latitude/longitude in the transaction record

Example transaction creation with location:
```typescript
const transaction = await createTransaction({
  walletId: '...',
  amount: 50,
  type: 'expense',
  description: 'Coffee shop',
  transactionDate: new Date().toISOString(),
  locationLatitude: 40.7128,  // User's current latitude
  locationLongitude: -74.0060, // User's current longitude
  locationName: 'Coffee Shop',
});
```

## Platform-Specific Notes

### iOS

- Uses Google Maps SDK for iOS
- Requires `NSLocationWhenInUseUsageDescription` in Info.plist (handled by expo-location plugin)
- Google Maps API key must be provided via app.json
- iOS 14+ is required for Google Maps SDK

### Android

- Uses Google Maps SDK for Android
- Requires location permissions in AndroidManifest.xml (handled by expo-location plugin)
- Google Maps API key must be provided via app.json
- Requires Google Play Services to be installed on device

## Troubleshooting

### Map appears blank or grey

**Solution**: 
1. Verify Google Maps API keys are correct in app.json
2. Check that APIs are enabled in Google Cloud Console
3. Ensure API key restrictions match your app's package name/bundle ID
4. Clear Expo cache: `expo start --clear`

### Map doesn't render at all

**Solution**:
1. Verify react-native-maps plugin is added to app.json
2. Check MapView has proper styling with absolute positioning
3. Ensure the component is not hidden by other UI elements

### No heatmap points showing

**Possible causes**:
1. No transactions exist with location data
2. Location data was not captured during transaction creation
3. Heatmap hook is not loading data properly

**Solution**:
1. Create test transactions with location data
2. Check database to verify transactions have latitude/longitude values
3. Check console logs for errors in useTransactionHeatmap hook

### Location permissions denied

**Solution**:
1. Grant location permissions in device settings
2. For iOS: Open Settings > [App Name] > Location > Select "While Using"
3. For Android: Open Settings > Permissions > Location > Allow

## Future Enhancements

Potential improvements for future versions:

1. **Interactive Filtering**
   - Filter heatmap by date range
   - Filter by category
   - Filter by minimum/maximum amount

2. **Location Details**
   - Tap on heatmap point to see transaction details
   - Show transaction list for a location
   - Display merchant info for popular hotspots

3. **Analytics Overlays**
   - Show average spending amount per location
   - Display transaction frequency by time of day
   - Show most visited locations ranking

4. **Clustering with Zoom**
   - Dynamic cluster sizes based on map zoom level
   - Cluster breakdown on zoom in
   - Marker clusters showing aggregate data

5. **Export/Share**
   - Take snapshot of heatmap
   - Share heatmap insights
   - Export location statistics

## Technical Details

### Performance Considerations

- The hook groups nearby transactions to reduce the number of heatmap points
- Coordinates are rounded to 4 decimal places (≈ 11 meters precision)
- Weights are normalized to a 0-1 scale and capped at 10 transactions per point
- Map region is calculated with 20% padding to ensure all points are visible

### Data Privacy

- Location data is stored locally first (PowerSync)
- Synced to Supabase for cloud backup
- Subject to Row-Level Security (RLS) policies
- Only visible to the transaction owner

## Support

For issues or feature requests related to the heatmap:

1. Check this guide's troubleshooting section
2. Review console logs for error messages
3. Create an issue on the project repository
4. Include:
   - Device type (iOS/Android)
   - App version
   - Steps to reproduce
   - Error messages or screenshots
