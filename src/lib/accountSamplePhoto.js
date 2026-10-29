const sampleAccounts = [
  "Malabar Cloud Works", "Coconut Grove Systems", "Monsoon Retail Labs", "Pepper Coast Traders",
  "Backwater Digital Studio", "Palmline Distributors", "Spice Route Analytics", "Blue Lagoon Services",
  "Coastal Craft Collective", "Green Canopy Technologies", "Kochi Market House", "Wayanad Supply Co",
  "Hillview Business Systems", "Lotus Bay Commerce", "Mango Leaf Retail", "Arabian Sea Logistics",
  "Riverbend Office Solutions", "Tea Garden Ventures", "Coral Reef Consulting", "Rainforest Data Co",
  "Harbourlight Wholesale", "Golden Cashew Exports", "Periyar Valley Stores", "Cinnamon Trail Foods",
  "Southern Star Services", "Neelam Digital Partners", "Cardamom Hill Trading", "Sandalwood Retail Group",
  "Kadalundi Business Hub", "Silver Palm Solutions", "Cochin Paper & Supply", "Misty Mountain Retail",
  "Fort Kochi Creative Works", "Emerald Coast Systems", "Riverstone Distribution", "Nilgiri Office Mart",
  "Sunrise Coconut Products", "Vembanad Commerce House", "Banyan Tree Technologies", "Oceanview Trading Co"
];
const cities = ["Kochi", "Kozhikode", "Thiruvananthapuram", "Thrissur", "Alappuzha", "Kannur", "Kottayam", "Palakkad"];
const localitiesByCity = {
  Kochi: ["Fort Kochi", "Mattancherry", "Edappally", "Kakkanad", "Vyttila"],
  Kozhikode: ["Mananchira", "Mavoor Road", "Nadakkavu", "Kottooli", "Feroke"],
  Thiruvananthapuram: ["Palayam", "Kowdiar", "Kazhakkoottam", "Vellayambalam", "East Fort"],
  Thrissur: ["Swaraj Round", "Ayyanthole", "Punkunnam", "Ollur", "West Fort"],
  Alappuzha: ["Mullakkal", "Alappuzha Beach", "Thathampally", "Kalappura", "Punnapra"],
  Kannur: ["Thavakkara", "Payyambalam", "Fort Road", "Talap", "Thottada"],
  Kottayam: ["Baker Junction", "Kanjikuzhi", "Nagampadam", "Ettumanoor", "Changanassery"],
  Palakkad: ["Sultanpet", "Olavakkode", "Kallekkad", "Stadium Bypass", "Chandranagar"]
};

function sampleAccountIndex(account) {
  const name = String(account?.medicalName || "").trim();
  const exactIndex = sampleAccounts.findIndex((sampleName) => sampleName.toLowerCase() === name.toLowerCase());
  if (exactIndex >= 0) return exactIndex;
  const legacy = name.match(/^TEST DATA \| (.+) (\d{2})$/i);
  if (legacy) {
    const index = sampleAccounts.findIndex((sampleName) => sampleName.toLowerCase() === legacy[1].toLowerCase());
    if (index >= 0 && index + 1 === Number(legacy[2])) return index;
  }
  const emailMatch = String(account?.email || "").match(/^contact(\d{2})@example\.com$/i);
  const emailIndex = emailMatch ? Number(emailMatch[1]) - 1 : -1;
  return emailIndex >= 0 && sampleAccounts[emailIndex] && (!name || name === `TEST DATA | ${sampleAccounts[emailIndex]} ${String(emailIndex + 1).padStart(2, "0")}`) ? emailIndex : -1;
}

export function cleanSampleAccountRecord(account) {
  const index = sampleAccountIndex(account);
  if (index < 0) return account;
  const name = sampleAccounts[index];
  const city = cities[index % cities.length];
  const locality = localitiesByCity[city][Math.floor(index / cities.length) % localitiesByCity[city].length];
  return {
    ...account,
    medicalName: name,
    locality,
    city,
    state: "Kerala",
    addressLine: "",
    pincode: "",
    formattedAddress: `${locality}, ${city}, Kerala, India`
  };
}

export function accountPhoto(account) {
  const sampleIndex = sampleAccountIndex(account);
  if (sampleIndex < 0) return account?.medicalPhotoUrl || "";
  const imageIndex = sampleIndex % 4 + 1;
  return `/account-samples/account-${imageIndex}.jpg`;
}
