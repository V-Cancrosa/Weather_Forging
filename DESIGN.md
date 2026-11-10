# Weather Forging — dokument projektowy (wersja robocza)

Moduł do **Foundry VTT v14** (hostowany m.in. na The Forge), który dodaje pogodę
w dwóch wymiarach:

- **wizualnym**: efekty na mapie, w interfejsie i w dźwięku, na poziomie gier AAA;
- **mechanicznym**: stan pogody dostępny przez API dla systemów i modułów
  (docelowo m.in. system Fallout Equestria).

> Status: etap koncepcyjny. Priorytet na start: **efekt „wow”**. Porządne API
> budujemy w drugiej kolejności, kiedy już będzie wiadomo, czego wymagają efekty.

---

## 1. Zasada nadrzędna: stan ≠ prezentacja

Pogoda istnieje jako **dane**, a efekty wizualne tylko te dane odczytują.
Dzięki temu da się wyłączyć grafikę i zachować mechanikę, a zewnętrzny system
może przejąć rolę źródła prawdy.

Nawet jeśli zaczynamy od wizualiów, od pierwszego dnia sterujemy nimi przez
wewnętrzny obiekt stanu. Publiczne API będzie potem tylko „odsłonięciem” tego,
co już istnieje.

### Proponowany model stanu (szkic)

| Parametr | Zakres / przykład |
|---|---|
| `precipitation.{rain,snow,hail,ash}` | 0–1 każdy. **Mieszanka** zamiast jednego typu, dzięki czemu przejścia płynnie się przenikają, a deszcz ze śniegiem to po prostu `rain` + `snow` |
| `wind.speed`, `wind.direction`, `wind.gusts` | km/h, stopnie, 0–1 |
| `temperature` | °C |
| `cloudCover` | 0–1 |
| `fog` / `visibility` | 0–1 / metry |
| `lightning` | 0–1 (częstotliwość) |
| `ground.snow`, `ground.wetness` | 0–1, **narasta i opada w czasie** |
| `extensions.*` | dane specyficzne dla systemu (np. `radstorm` w FoE) |

## 2. Warstwy wizualne

### A. Mapa (canvas / WebGL)
- System cząsteczek ze **wspólnym polem wiatru** (deszcz, śnieg, popiół, liście).
- **Pokrywa terenu**: shader stopniowo wybiela mapę przy śniegu, a tekstura
  szumu daje zaspy przy ścianach i krawędziach. Przy deszczu nawierzchnia
  ciemnieje i błyszczy się, a w zagłębieniach z szumu tworzą się kałuże.
- Volumetryczna mgła, cienie chmur sunące po mapie.
- Błyskawice zgrane z oświetleniem i poziomem ciemności sceny.
- Maskowanie wnętrz: dachy, ściany, Regiony.
- Płynne przejścia między stanami (interpolacja parametrów zamiast przełączania).

### B. Interfejs (DOM / CSS)
- **Motyw pogodowy**: zestaw zmiennych CSS (temperatura barw, kontrast,
  nasycenie) płynnie interpolowanych wg stanu.
- Nakładki: szron narastający na krawędziach okien, śnieg na paskach tytułowych,
  krople spływające po „szybie” ekranu, błysk UI przy piorunie.
- Wyłącznie nakładki i zmienne. **Nie przebudowujemy** okien innych modułów
  ani systemów.

### C. Dźwięk
- Warstwowy ambient przenikający się zależnie od intensywności opadu i wiatru,
  grzmoty z opóźnieniem względem błysku.

## 3. Strefy pogodowe a interfejs

Pogoda może być ustawiona dla całej sceny albo dla **stref** (Regiony v14 z
własnym typem zachowania „Weather Zone”). Mapa pokazuje każdą strefę osobno,
z miękkim przejściem na granicach.

**Problem:** interfejs jest jeden, a stref może być wiele.
**Propozycja rozwiązania:** UI pokazuje **pogodę z perspektywy widza**.
- Gracz: pogoda w miejscu jego kontrolowanego/zaznaczonego tokena.
- MG (lub gracz bez tokena): pogoda w środku widoku kamery albo średnia ważona
  stref widocznych na ekranie.
- Zmiana strefy daje płynne przejście motywu UI, np. kiedy token wychodzi
  z burzy na szron.

Dzięki temu każdy gracz może mieć inny wygląd interfejsu w zależności od tego,
gdzie jest jego postać, co dodatkowo buduje immersję. Szczegóły dopracujemy później.

## 4. Wymagania przekrojowe

- **Wydajność**: profile jakości ustawiane per klient (niski/średni/wysoki/ultra),
  automatyczne obniżanie przy spadku FPS.
- **Dostępność**: tryb „ogranicz ruch i błyski” (fotowrażliwość).
- **Synchronizacja**: MG jest autorytetem; stan we flagach sceny/regionu;
  przejścia synchronizowane czasowo przez socket.
- **Zgodność**: **decyzja: zastępujemy wbudowaną pogodę Foundry** (ustawienie
  świata, domyślnie włączone). Sceny z ustawioną wbudowaną pogodą są
  automatycznie przejmowane jako nasze presety. Zgodność z FXMaster do sprawdzenia.
- **Assety**: proceduralne (shadery, szum) lub na własnych/wolnych licencjach.
- **Wydawanie**: `module.json` + GitHub Releases (zip + manifest „latest”),
  instalacja przez URL manifestu na The Forge; później ewentualnie Bazaar.

## 5. Plan etapów

1. **Szkielet modułu + wewnętrzny stan**: struktura v14, panel MG z presetami,
   płynne przejścia, synchronizacja.
2. **Efekt „wow” na mapie**: śnieg i deszcz z wiatrem, narastająca pokrywa
   śniegu i mokra nawierzchnia, mgła, burza z błyskawicami.
3. **Efekt „wow” w UI**: motyw pogodowy, szron, krople, błyski.
4. **Strefy**: Regiony, granice, UI z perspektywy widza.
5. **Publiczne API + adapter Fallout Equestria**: hooki, zapytania o pogodę
   w punkcie lub przy tokenie, tryb „system jest źródłem prawdy”.
6. **Dodatki**: dźwięk, generator klimatyczny, integracja z kalendarzem.

### Stan realizacji

- **Etap 1 (v0.1.0)**: szkielet gotowy. Model stanu, kontroler (flaga sceny
  + zegar serwera, bez socketów), panel MG, zastąpienie wbudowanej pogody,
  prototyp cząsteczek, mgły i błyskawic, prototyp barwienia UI, workflow wydań.
- **Etap 2, część 1 (v0.2.0)**: opady i pokrywa terenu ukryte pod dachami i w regionach
  „Suppress Weather” (filtr okluzji Foundry, można wyłączyć w ustawieniach);
  narastający śnieg na mapie (shader na kopii tła/tekstur poziomów: plamy,
  zaspy przy krawędziach, szron, migotanie); mokra nawierzchnia z kałużami
  i kręgami od kropli; rozbryzgi deszczu.
- **Etap 2, część 2 (v0.3.0)**: pokrywa śniegu i wilgoci także na kafelkach
  (ośnieżone dachy znikają razem z zanikającym dachem); strefy bez pogody
  z Regionów z zachowaniem „Suppress Weather”: własna maska rastrowa
  (niezależna od filtru okluzji Foundry), używana przez cząsteczki i shader ziemi.
- **v0.4.0**: okno powitalne z listą zmian, widżet pogody dla graczy, edytor
  pogody z własnymi presetami (ustawienie świata), mgła w kłębach i cienie chmur
  (shader atmosfery), przyciemnianie sceny przez hook `configureCanvasEnvironment`
  (tylko po stronie klienta), błyskawice deterministyczne z zegara serwera
  (wszyscy widzą ten sam błysk), `api.diagnose()` do zgłoszeń.

## 6. Otwarte pytania

- Szczegóły API Foundry v14 (canvas, Regiony, ApplicationV2): zweryfikowane
  na definicjach typów v14. Do potwierdzenia w działającej instancji.
- Model pogody w systemie Fallout Equestria i kierunek przepływu danych
  (czyta / zapisuje / oba).
- Relacja z FXMaster i wbudowanymi efektami pogody.
