# Weather Forging

Kinowa, niezależna od systemu pogoda dla **Foundry VTT v14**: efekty na mapie,
interfejs reagujący na pogodę i stan pogody dostępny dla innych systemów
i modułów.

> 🚧 Wczesna wersja (0.1.x): szkielet modułu i prototyp efektów.
> Plany i decyzje: [DESIGN.md](DESIGN.md).

## Instalacja

W Foundry (także na The Forge): *Add-on Modules → Install Module* i wklej
adres manifestu:

```
https://github.com/V-Cancrosa/Weather_Forging/releases/latest/download/module.json
```

## Użycie

- MG: **Sterowanie sceną → Oświetlenie → ikona chmury** otwiera panel pogody.
  Wybierz pogodę i czas przejścia.
- Ustawienia klienta: jakość efektów, interfejs reagujący na pogodę,
  ograniczenie błysków.

### Wczesne API (niestabilne)

```js
const wf = game.modules.get("weather-forging").api;
wf.getWeather(canvas.scene);                         // stan w tej chwili
await wf.setWeather(canvas.scene, "storm", { duration: 30 });
Hooks.on("weather-forging.changed", (scene, target, transition) => { /* … */ });
```

## Rozwój

```bash
npm test   # testy modelu pogody (Node 20+)
```

Wydanie: ustaw wersję w `module.json`, a potem wypchnij tag `vX.Y.Z`
(`git tag v0.2.0 && git push origin v0.2.0`). Workflow sam przetestuje
moduł, zbuduje `module.zip` i opublikuje release.

## Licencja

[MIT](LICENSE)
