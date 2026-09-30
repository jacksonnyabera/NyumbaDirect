export function getBedroomDisplay(property) {
  const rawBedrooms = property?.bedrooms;
  if (rawBedrooms === null || rawBedrooms === undefined || rawBedrooms === "") {
    return { value: "Not listed", label: "Bedrooms", summary: "Bedrooms not listed" };
  }

  const bedrooms = Number(rawBedrooms);
  if (!Number.isInteger(bedrooms) || bedrooms < 0) {
    return { value: "Not listed", label: "Bedrooms", summary: "Bedrooms not listed" };
  }

  if (bedrooms === 0) {
    const type = String(property?.property_type || "").toLowerCase();
    if (type.includes("bedsitter")) {
      return { value: "Bedsitter", label: "Layout", summary: "Bedsitter" };
    }
    if (type.includes("studio")) {
      return { value: "Studio", label: "Layout", summary: "Studio" };
    }
    return { value: "Not listed", label: "Bedrooms", summary: "Bedrooms not listed" };
  }

  const label = bedrooms === 1 ? "Bedroom" : "Bedrooms";
  return { value: String(bedrooms), label, summary: `${bedrooms} ${label.toLowerCase()}` };
}
