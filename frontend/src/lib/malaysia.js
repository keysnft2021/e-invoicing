// Malaysia address reference data used across LHDN e-invoice forms.
// State/City dropdowns are sourced from LHDN's official state code list.

export const COUNTRIES = [
    { code: "MYS", name: "MALAYSIA" },
    { code: "SGP", name: "SINGAPORE" },
    { code: "IDN", name: "INDONESIA" },
    { code: "THA", name: "THAILAND" },
    { code: "BRN", name: "BRUNEI" },
];

export const MY_STATES = [
    "Not Applicable",
    "Johor",
    "Kedah",
    "Kelantan",
    "Melaka",
    "Negeri Sembilan",
    "Pahang",
    "Perak",
    "Perlis",
    "Pulau Pinang",
    "Sabah",
    "Sarawak",
    "Selangor",
    "Terengganu",
    "Wilayah Persekutuan Kuala Lumpur",
    "Wilayah Persekutuan Labuan",
    "Wilayah Persekutuan Putrajaya",
];

// Cities per state — curated primary cities/districts (Malaysia).
export const MY_CITIES = {
    "Not Applicable": ["NA"],
    "Johor": ["Johor Bahru", "Batu Pahat", "Kluang", "Kulai", "Muar", "Pasir Gudang", "Pontian", "Segamat", "Skudai"],
    "Kedah": ["Alor Setar", "Sungai Petani", "Kulim", "Langkawi", "Baling", "Kubang Pasu"],
    "Kelantan": ["Kota Bharu", "Tumpat", "Pasir Mas", "Machang", "Kuala Krai"],
    "Melaka": ["Melaka Tengah", "Alor Gajah", "Jasin"],
    "Negeri Sembilan": ["Seremban", "Port Dickson", "Nilai", "Rembau", "Tampin"],
    "Pahang": ["Kuantan", "Temerloh", "Bentong", "Raub", "Jerantut", "Cameron Highlands"],
    "Perak": ["Ipoh", "Taiping", "Teluk Intan", "Sitiawan", "Batu Gajah", "Kampar", "Lumut"],
    "Perlis": ["Kangar", "Arau", "Padang Besar"],
    "Pulau Pinang": ["George Town", "Bayan Lepas", "Butterworth", "Bukit Mertajam", "Nibong Tebal"],
    "Sabah": ["Kota Kinabalu", "Sandakan", "Tawau", "Lahad Datu", "Semporna", "Kudat"],
    "Sarawak": ["Kuching", "Miri", "Sibu", "Bintulu", "Sarikei", "Limbang"],
    "Selangor": ["Shah Alam", "Petaling Jaya", "Subang Jaya", "Klang", "Kajang", "Ampang", "Puchong", "Sepang", "Rawang"],
    "Terengganu": ["Kuala Terengganu", "Kemaman", "Dungun", "Marang"],
    "Wilayah Persekutuan Kuala Lumpur": ["Bukit Bintang", "KLCC", "Cheras", "Setapak", "Wangsa Maju", "Titiwangsa", "Kepong", "Segambut", "Bandar Tun Razak", "Batu"],
    "Wilayah Persekutuan Labuan": ["Victoria", "Rancha-Rancha"],
    "Wilayah Persekutuan Putrajaya": ["Presint 1", "Presint 2", "Presint 3", "Presint 4", "Presint 5"],
};

// Areas per city — the ones users pick most often. Fallback = ["Central"].
export const MY_AREAS = {
    "Kuala Lumpur": ["Bukit Bintang", "KLCC", "Bangsar", "Mont Kiara", "Cheras", "Setapak", "Wangsa Maju", "Titiwangsa"],
    "Petaling Jaya": ["Damansara", "Bandar Utama", "Kelana Jaya", "SS2", "Section 14", "Section 17", "PJ Old Town"],
    "Shah Alam": ["Section 7", "Section 13", "Setia Alam", "Kota Kemuning", "Bukit Jelutong"],
    "George Town": ["UNESCO Heritage Zone", "Pulau Tikus", "Gurney Drive", "Jelutong"],
    "Bayan Lepas": ["FIZ 1", "FIZ 2", "FIZ 3", "Sungai Nibong"],
    "Ipoh": ["Ipoh Garden", "Ipoh Old Town", "Bercham", "Falim", "Menglembu"],
    "Johor Bahru": ["Larkin", "Nusajaya", "Iskandar Puteri", "Tebrau", "Skudai", "Molek"],
    "Kuching": ["Padungan", "Kuching Waterfront", "Petra Jaya", "Kota Sentosa"],
    "Miri": ["CBD", "Krokop", "Lutong", "Piasau"],
    "Kota Kinabalu": ["City Centre", "Karamunsing", "Likas", "Inanam", "Penampang"],
    "Kota Bharu": ["Kubang Kerian", "Wakaf Che Yeh", "Pengkalan Chepa"],
    "Kuantan": ["Teluk Cempedak", "Indera Mahkota", "Semambu"],
    "Seremban": ["Rasah", "Ampangan", "Senawang"],
    "Melaka Tengah": ["Ayer Keroh", "Bukit Beruang", "Klebang", "Cheng"],
    "Teluk Intan": ["Bandar Baru", "Bandar Utama", "Air Kuning"],
};

export function citiesFor(state) {
    return MY_CITIES[state] || [];
}

export function areasFor(city) {
    return MY_AREAS[city] || ["Central"];
}
