"use client";

/**
 * Google Maps version of the doorstep pin (used when
 * NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set; Leaflet/OSM otherwise).
 * Same props contract as address-map.tsx.
 */
import * as React from "react";

import { Button } from "@/components/ui/button";

type Locality = { city?: string; state?: string; pincode?: string };

const INDIA_CENTER = { lat: 17.385, lng: 78.4867 };

declare global {
  interface Window {
    google?: typeof google;
    __gmapsLoading?: Promise<void>;
  }
}

function loadGoogleMaps(key: string): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (window.__gmapsLoading) return window.__gmapsLoading;
  window.__gmapsLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&v=weekly`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });
  return window.__gmapsLoading;
}

export default function AddressMapGoogle({
  value,
  onChange,
  onLocality,
}: {
  value: { lat: number; lng: number } | null;
  onChange: (pin: { lat: number; lng: number }) => void;
  onLocality?: (loc: Locality) => void;
}) {
  const holderRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<google.maps.Map | null>(null);
  const markerRef = React.useRef<google.maps.Marker | null>(null);
  const geocoderRef = React.useRef<google.maps.Geocoder | null>(null);
  const [ready, setReady] = React.useState(false);
  const [locating, setLocating] = React.useState(false);

  const reverseGeocode = React.useCallback(
    (lat: number, lng: number) => {
      if (!onLocality || !geocoderRef.current) return;
      void geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
        if (status !== "OK" || !results?.[0]) return;
        const parts = results[0].address_components;
        const find = (type: string) => parts.find((c) => c.types.includes(type))?.long_name;
        onLocality({
          city: find("locality") ?? find("administrative_area_level_3") ?? find("administrative_area_level_2"),
          state: find("administrative_area_level_1"),
          pincode: find("postal_code")?.replace(/\s/g, ""),
        });
      });
    },
    [onLocality],
  );

  const place = React.useCallback(
    (lat: number, lng: number, pan = false) => {
      onChange({ lat, lng });
      reverseGeocode(lat, lng);
      if (markerRef.current) markerRef.current.setPosition({ lat, lng });
      if (pan && mapRef.current) {
        mapRef.current.panTo({ lat, lng });
        mapRef.current.setZoom(17);
      }
    },
    [onChange, reverseGeocode],
  );

  React.useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key || !holderRef.current) return;
    let cancelled = false;
    void loadGoogleMaps(key).then(() => {
      if (cancelled || !holderRef.current || mapRef.current) return;
      const center = value ?? INDIA_CENTER;
      const map = new google.maps.Map(holderRef.current, {
        center,
        zoom: value ? 17 : 5,
        clickableIcons: false,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      });
      mapRef.current = map;
      geocoderRef.current = new google.maps.Geocoder();
      const marker = new google.maps.Marker({
        map,
        position: value ?? undefined,
        draggable: true,
        visible: Boolean(value),
      });
      markerRef.current = marker;
      map.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        marker.setVisible(true);
        place(e.latLng.lat(), e.latLng.lng());
      });
      marker.addListener("dragend", () => {
        const pos = marker.getPosition();
        if (pos) place(pos.lat(), pos.lng());
      });
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function locateMe() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        markerRef.current?.setVisible(true);
        place(pos.coords.latitude, pos.coords.longitude, true);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border">
      <div ref={holderRef} className="h-64 w-full bg-muted" />
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={locateMe}
        disabled={!ready || locating}
        className="absolute right-2 top-2 z-10 gap-1.5 border shadow-md"
      >
        {locating ? "Locating…" : "Use my location"}
      </Button>
      <p className="bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">
        Tap the map (or drag the pin) to mark your doorstep. Powered by Google Maps.
      </p>
    </div>
  );
}
