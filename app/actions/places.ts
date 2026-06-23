"use server";

export async function getPlacePredictions(input: string, lat?: number | null, lng?: number | null) {
  if (!input || input.trim() === "") return [];
  
  const apiKey = process.env.NEXT_PUBLIC_PLACES_API_KEY;
  if (!apiKey) {
    console.error("Missing NEXT_PUBLIC_PLACES_API_KEY");
    return [];
  }

  try {
    const payload: any = {
      input: input,
    };

    if (lat && lng) {
      payload.locationRestriction = {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: 7000.0, // 7km restriction
        },
      };
      payload.origin = { latitude: lat, longitude: lng }; // Calculate distance from user
    }

    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const data = await res.json();
    
    if (data.suggestions) {
      return data.suggestions.map((s: any) => {
        const p = s.placePrediction;
        return {
          id: p.placeId,
          description: p.text?.text || "",
          mainText: p.structuredFormat?.mainText?.text || p.text?.text || "",
          secondaryText: p.structuredFormat?.secondaryText?.text || "",
        };
      });
    }
    
    return [];
  } catch (error) {
    console.error("Error fetching place predictions:", error);
    return [];
  }
}
