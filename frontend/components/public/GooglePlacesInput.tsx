'use client';

import { useRef, useCallback } from 'react';
import { useJsApiLoader, Autocomplete } from '@react-google-maps/api';

const LIBRARIES: ('places')[] = ['places'];

interface PlaceResult {
  formattedAddress: string;
  pincode: string;
  lat: number | null;
  lng: number | null;
}

interface GooglePlacesInputProps {
  onPlaceSelect: (result: PlaceResult) => void;
  placeholder?: string;
}

export function GooglePlacesInput({
  onPlaceSelect,
  placeholder = 'Search for your address...',
}: GooglePlacesInputProps) {
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || '',
    libraries: LIBRARIES,
  });

  const onLoad = useCallback((autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete;
  }, []);

  const onPlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace();
    if (!place) return;

    const formattedAddress = place.formatted_address || '';
    let pincode = '';
    let lat: number | null = null;
    let lng: number | null = null;

    // Extract pincode from address_components
    if (place.address_components) {
      for (const component of place.address_components) {
        if (component.types.includes('postal_code')) {
          pincode = component.long_name;
          break;
        }
      }
    }

    // Extract lat/lng from geometry
    if (place.geometry?.location) {
      lat = place.geometry.location.lat();
      lng = place.geometry.location.lng();
    }

    onPlaceSelect({ formattedAddress, pincode, lat, lng });
  }, [onPlaceSelect]);

  if (!isLoaded) {
    return (
      <input
        type="text"
        disabled
        placeholder="Loading address search..."
        className="w-full h-11 rounded-lg border border-[var(--public-border)] bg-white text-sm text-[var(--public-fg)] px-3 opacity-60"
      />
    );
  }

  return (
    <Autocomplete
      onLoad={onLoad}
      onPlaceChanged={onPlaceChanged}
      options={{
        componentRestrictions: { country: 'in' },
        fields: ['address_components', 'formatted_address', 'geometry'],
        types: ['address'],
      }}
    >
      <input
        type="text"
        placeholder={placeholder}
        className="w-full h-11 rounded-lg border border-[var(--public-border)] bg-white text-sm text-[var(--public-fg)] px-3 placeholder:text-[var(--public-muted)] focus:ring-2 focus:ring-[var(--public-terracotta)]/30 focus:outline-none"
      />
    </Autocomplete>
  );
}
