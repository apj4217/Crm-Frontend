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

export function cleanSampleAccountRecord(account) {
  const match = String(account?.email || "").match(/^contact(\d{2})@example\.com$/i);
  if (!match) return account;
  const index = Number(match[1]) - 1;
  const name = sampleAccounts[index];
  const city = cities[index % cities.length];
  const locality = localitiesByCity[city][Math.floor(index / cities.length) % localitiesByCity[city].length];
  const oldName = `TEST DATA | ${name} ${String(index + 1).padStart(2, "0")}`;
  if (!name || (account.medicalName !== oldName && account.medicalName !== name)) return account;
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
  if (account?.medicalPhotoUrl) return account.medicalPhotoUrl;
  const match = String(account?.email || "").match(/^contact(\d{2})@example\.com$/i);
  if (!match || !sampleAccounts[Number(match[1]) - 1]) return "";
  const imageIndex = (Number(match[1]) - 1) % 4 + 1;
  return `/account-samples/account-${imageIndex}.jpg`;
}
