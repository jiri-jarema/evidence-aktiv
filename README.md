# Evidence Aktiv

Aplikace pro evidenci aktiv Městského úřadu Vítkov.

## Popis

Tato webová aplikace umožňuje centrální evidenci a správu primárních, podpůrných a dalších aktiv v souladu s legislativními požadavky. Umožňuje definovat vazby mezi aktivy a spravovat uživatelská oprávnění.

## Technologie

-   **Frontend**: HTML, Tailwind CSS, JavaScript (ES6)
-   **Backend**: Netlify Functions (Node.js)
-   **Databáze**: Firebase Realtime Database
-   **Autentizace**: Firebase Authentication
-   **Hosting**: Netlify

## Struktura projektu

-   `index.html`: Hlavní HTML soubor aplikace.
-   `app.js`: Sjednocený JavaScriptový soubor obsahující veškerou frontendovou logiku.
-   `netlify/functions/`: Adresář s bezserverovými (serverless) funkcemi pro backendové operace.
-   `netlify.toml`: Konfigurační soubor pro nasazení na Netlify.
-   `package.json`: Definuje závislosti pro Netlify funkce (`firebase-admin`).

## Instalace a spuštění

### Předpoklady

-   Účet na [Netlify](https://www.netlify.com/)
-   Účet na [Firebase](https://firebase.google.com/)
-   Nainstalovaný [Node.js](https://nodejs.org/) a [Netlify CLI](https://docs.netlify.com/cli/get-started/)

### Kroky

1.  **Klonování repozitáře:**
    ```bash
    git clone <URL_repozitare>
    cd <nazev_repozitare>
    ```

2.  **Nastavení Firebase:**
    -   Vytvořte nový projekt ve Firebase konzoli.
    -   Povolte **Authentication** (metoda Email/Password).
    -   Vytvořte **Realtime Database** (doporučeno v `europe-west1`).
    -   V nastavení projektu vygenerujte nový privátní klíč pro servisní účet (soubor `.json`).
    -   Zkopírujte konfigurační objekt Firebase pro webové aplikace.

3.  **Nastavení Frontend (`index.html` a `app.js`):**
    -   V souboru `app.js` (dříve `js/firebase.js`) vložte konfigurační objekt z Firebase do proměnné `firebaseConfig`.

4.  **Nastavení Backend (Netlify):**
    -   Nainstalujte závislosti pro funkce:
        ```bash
        npm install
        ```
    -   Nastavte proměnné prostředí v Netlify (v UI nebo v souboru `.env` pro lokální vývoj):
        -   `FIREBASE_CREDENTIALS`: Obsah `.json` souboru se servisním klíčem (jako jeden řádek).
        -   `FIREBASE_DATABASE_URL`: URL vaší Realtime Database.

5.  **Lokální spuštění:**
    -   Použijte Netlify CLI pro spuštění lokálního serveru, který bude obsluhovat jak frontend, tak funkce:
        ```bash
        netlify dev
        ```
    -   Aplikace bude dostupná na `http://localhost:8888`.

6.  **Nasazení na Netlify:**
    -   Propojte svůj lokální projekt s Netlify:
        ```bash
        netlify link
        ```
    -   Nasaďte projekt:
        ```bash
        netlify deploy --prod
        ```

## Správa uživatelů

-   Prvního uživatele (administrátora) je nutné vytvořit buď ručně ve Firebase konzoli (Authentication) a následně mu přiřadit roli v Realtime Database pod cestou `/users/<UID>`, nebo se přihlásit a roli si přidat ručně do databáze.
-   Struktura záznamu uživatele v databázi:
    ```json
    {
      "users": {
        "firebase-user-uid": {
          "email": "admin@mesto.cz",
          "role": "administrator",
          "odbor": ""
        }
      }
    }
    ```
-   Další uživatelé mohou být spravováni přes administrátorské rozhraní v aplikaci.