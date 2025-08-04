// Definuje sdílené seznamy možností, aby se neopakovaly u každé agendy.
const sharedOptions = {
    lawfulness: [
        "a) na základě souhlasu",
        "b) pro účely splnění smlouvy",
        "c) plnění právní povinnosti správce",
        "d) ochrana životně důležitých zájmů",
        "e) plnění úkolu ve veřejném zájmu, výkon veřejné moci",
        "f) oprávněný zájem správce nebo jiné strany"
    ],
    dataSources: ["subjekt údajů", "úřední činnost", "jiný správce", "základní registry", "jiné"],
    subjectCategories: ["občané/klienti", "zaměstnanci správce", "zastupitelé", "dodavatelé", "jiné"],
    personalDataCategories: ["jméno a příjmení", "datum narození", "rodné číslo", "adresa bydliště", "adresa pro doručování", "telefonní číslo", "e-mailová adresa", "číslo bankovního účtu", "jiné"],
    specialPersonalDataCategories: ["žádné", "rasový/etnický původ", "politické názory", "náboženské vyznání", "filozofické přesvědčení", "členství v odborech", "zdravotní stav", "sexuální život/orientace", "genetické údaje", "biometrické údaje"],
    recipientCategories: ["žádné", "nadřízený správní orgán", "jiný správní orgán", "poskytovatel dotace", "jiné"],
security: [
        'Přístup pouze po přihlášení do datové sítě MěÚ',
        'Přístup pouze po přihlášení do AIS heslem',
        'Přístup pouze po přihlášení do AIS certifikátem',
        'Šifrování',
        'Lokální zálohování uživatelem',
        'Centrální zálohování administrátorem',
        'Jiné'
    ],
    
    securityElectronic: [
        'Přístup pouze po přihlášení do datové sítě MěÚ',
        'Přístup pouze po přihlášení do AIS heslem',
        'Přístup pouze po přihlášení do AIS certifikátem',
        'Šifrování',
        'Lokální zálohování uživatelem',
        'Centrální zálohování administrátorem',
        'Jiné'
    ],
    securityAnalog: ["elektronicky zabezpečená budova", "uzamykatelná kancelář", "uzamykatelná skříň, apod.", "jiné"]
};
