import type { MapStyleElement } from 'react-native-maps';

type MapPalette = {
  ground: string;
  park: string;
  water: string;
  road: string;
  roadEdge: string;
  label: string;
};

// XM-Places draws the map itself: a warm ground, pale parks and water, Paper
// roads, Meta area names (no road or water names), and no business icons
// competing with the pins.
const light: MapPalette = {
  ground: '#F2ECE0',
  park: '#DCE9D5',
  water: '#CFE0EA',
  road: '#FFFDF8',
  roadEdge: '#E3DACA',
  label: '#6B665C',
};

// The same roles on the V2F-Dark ground.
const dark: MapPalette = {
  ground: '#1D1B17',
  park: '#1F2A21',
  water: '#1C262C',
  road: '#2C2924',
  roadEdge: '#3A362F',
  label: '#A39C8E',
};

function styleFor(p: MapPalette): MapStyleElement[] {
  return [
    { elementType: 'geometry', stylers: [{ color: p.ground }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: p.label }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: p.ground }] },
    { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: p.park }] },
    { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: p.road }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: p.roadEdge }] },
    { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: p.water }] },
  ];
}

export const mapStyles = { light: styleFor(light), dark: styleFor(dark) };

/** Kuala Lumpur, for a map with nothing to frame yet. */
export const FALLBACK_REGION = {
  latitude: 3.139,
  longitude: 101.6869,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};
