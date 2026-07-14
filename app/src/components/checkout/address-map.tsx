"use client";

import * as React from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { Button } from "@/components/ui/button";

/** Inline SVG pin — avoids leaflet's broken default marker asset paths under bundlers. */
const pinIcon = L.divIcon({
  className: "",
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="#1e2a5a" stroke="#f5a623" stroke-width="1.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="#f5a623" stroke="none"/></svg>`,
  iconSize: [34, 34],
  iconAnchor: [17, 32],
});

const INDIA_CENTER: [number, number] = [17.385, 78.4867]; // Hyderabad

type Locality = { city?: string; state?: string; pincode?: string };

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function AddressMap({
  value,
  onChange,
  onLocality,
}: {
  value: { lat: number; lng: number } | null;
  onChange: (pin: { lat: number; lng: number }) => void;
  onLocality?: (loc: Locality) => void;
}) {
  const mapRef = React.useRef<L.Map | null>(null);
  const [locating, setLocating] = React.useState(false);

  async function reverseGeocode(lat: number, lng: number) {
    if (!onLocality) return;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&zoom=14`,
        { headers: { Accept: "application/json" } },
      );
      const data = (await res.json()) as {
        address?: { city?: string; town?: string; village?: string; state_district?: string; state?: string; postcode?: string };
      };
      const a = data.address;
      if (a) {
        onLocality({
          city: a.city ?? a.town ?? a.village ?? a.state_district,
          state: a.state,
          pincode: a.postcode?.replace(/\s/g, ""),
        });
      }
    } catch {
      // best-effort
    }
  }

  function pick(lat: number, lng: number, pan = false) {
    onChange({ lat, lng });
    void reverseGeocode(lat, lng);
    if (pan) mapRef.current?.setView([lat, lng], 16);
  }

  function locateMe() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        pick(pos.coords.latitude, pos.coords.longitude, true);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border">
      <MapContainer
        center={value ? [value.lat, value.lng] : INDIA_CENTER}
        zoom={value ? 16 : 5}
        className="z-0 h-64 w-full"
        ref={mapRef}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onPick={(lat, lng) => pick(lat, lng)} />
        {value && (
          <Marker
            position={[value.lat, value.lng]}
            icon={pinIcon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const ll = (e.target as L.Marker).getLatLng();
                pick(ll.lat, ll.lng);
              },
            }}
          />
        )}
      </MapContainer>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={locateMe}
        disabled={locating}
        className="absolute right-2 top-2 z-[400] gap-1.5 border shadow-md"
      >
        {locating ? "Locating…" : "Use my location"}
      </Button>
      <p className="bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">
        Tap the map (or drag the pin) to mark your doorstep.
      </p>
    </div>
  );
}
