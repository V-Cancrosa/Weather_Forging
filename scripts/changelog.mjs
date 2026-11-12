/**
 * What's new, shown in the welcome window. Newest first.
 * Each entry: { version, en: [...], pl: [...] }.
 */
export const CHANGELOG = [
  {
    version: "0.4.1",
    en: ["New cover image and a fuller module description."],
    pl: ["Nowa okładka modułu i pełniejszy opis."]
  },
  {
    version: "0.4.0",
    en: [
      "Welcome window (this one) and a weather widget for every player.",
      "Weather editor: tune every parameter, apply it live and save your own presets.",
      "Weather now darkens the scene through Foundry's lighting; lightning lights it up for real.",
      "Lightning is synchronized: all players see the same strike.",
      "Drifting fog wisps and moving cloud shadows."
    ],
    pl: [
      "Okno powitalne (to) i widżet pogody dla każdego gracza.",
      "Edytor pogody: każdy parametr na suwaku, podgląd na żywo i zapis własnych presetów.",
      "Pogoda przyciemnia scenę przez oświetlenie Foundry, a błyskawica naprawdę ją rozświetla.",
      "Błyskawice są zsynchronizowane: wszyscy gracze widzą ten sam błysk.",
      "Mgła w przesuwających się kłębach i cienie chmur sunące po mapie."
    ]
  },
  {
    version: "0.3.0",
    en: ["Snow and wetness on tiles, snowy roofs.", "No-weather zones from Regions with the Suppress Weather behavior."],
    pl: ["Śnieg i wilgoć na kafelkach, ośnieżone dachy.", "Strefy bez pogody: Regiony z zachowaniem „Suppress Weather”."]
  },
  {
    version: "0.2.0",
    en: ["Accumulating snow and wet ground with puddles on the map.", "Rain splashes, weather hidden under roofs."],
    pl: ["Narastający śnieg i mokra nawierzchnia z kałużami na mapie.", "Rozbryzgi deszczu, brak opadów pod dachami."]
  }
];
